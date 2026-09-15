-- BUKLOD IGPAT R47-R48
-- Reuse existing igpat_events / igpat_feedback; do not create a parallel recommender.
-- Safety reports continue through submit_content_report, not through feedback.

create index if not exists igpat_events_user_creator_created_idx
  on public.igpat_events(user_id, creator_id, created_at desc)
  where creator_id is not null;
create index if not exists igpat_events_user_post_created_idx
  on public.igpat_events(user_id, post_id, created_at desc)
  where post_id is not null;
create index if not exists igpat_feedback_user_kind_post_idx
  on public.igpat_feedback(user_id, feedback_kind, post_id)
  where post_id is not null;
create index if not exists igpat_feedback_user_kind_creator_idx
  on public.igpat_feedback(user_id, feedback_kind, creator_id)
  where creator_id is not null;

create or replace function public.igpat_track_event_v2(
  p_event_name text,
  p_post_id uuid default null,
  p_creator_id uuid default null,
  p_feed_source text default null,
  p_watch_ms integer default 0,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_event text := lower(trim(coalesce(p_event_name, '')));
  safe_feed text := left(lower(trim(coalesce(p_feed_source, ''))), 40);
  safe_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  post_creator uuid;
begin
  if actor is null then return; end if;
  if safe_event not in (
    'impression','watch','qualified_watch','share','save','unsave',
    'follow','comment_open','relay_open','skip','feedback','report'
  ) then return; end if;
  if jsonb_typeof(safe_meta) <> 'object' or length(safe_meta::text) > 2000 then
    safe_meta := '{}'::jsonb;
  end if;
  if p_post_id is not null then
    select cp.user_id into post_creator
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(cp.id);
    if post_creator is null then return; end if;
    if p_creator_id is not null and p_creator_id is distinct from post_creator then return; end if;
  elsif p_creator_id is not null and not exists (
    select 1 from public.profiles p where p.id = p_creator_id
  ) then return;
  end if;
  insert into public.igpat_events(user_id,event_name,post_id,creator_id,feed_source,watch_ms,meta)
  values(
    actor,safe_event,p_post_id,coalesce(p_creator_id, post_creator),safe_feed,
    least(greatest(coalesce(p_watch_ms, 0), 0), 120000),safe_meta
  );
end;
$$;

create or replace function public.igpat_track_event_v1(
  p_event_name text,
  p_post_id uuid default null,
  p_creator_id uuid default null,
  p_feed_source text default null,
  p_watch_ms integer default 0,
  p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.igpat_track_event_v2(
    p_event_name,p_post_id,p_creator_id,p_feed_source,p_watch_ms,p_meta
  );
$$;

create or replace function public.igpat_set_feedback_v2(
  p_feedback_kind text,
  p_post_id uuid default null,
  p_creator_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_kind text := lower(trim(coalesce(p_feedback_kind, '')));
  post_creator uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if safe_kind not in ('not_interested','show_fewer','dont_recommend_creator','hide') then
    raise exception 'Invalid IGPAT recommendation feedback';
  end if;
  if p_post_id is not null then
    select cp.user_id into post_creator
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(cp.id);
    if post_creator is null then raise exception 'IGPAT is unavailable for this account'; end if;
  end if;
  if safe_kind = 'dont_recommend_creator' then
    if p_creator_id is null then raise exception 'Creator is required'; end if;
    if p_creator_id = actor then raise exception 'You cannot block recommendations from yourself'; end if;
    if not exists (select 1 from public.profiles p where p.id = p_creator_id) then
      raise exception 'Creator was not found';
    end if;
  elsif p_post_id is null then
    raise exception 'IGPAT post is required for this feedback';
  end if;
  if p_post_id is not null and p_creator_id is not null and p_creator_id is distinct from post_creator then
    raise exception 'Feedback creator does not match the IGPAT';
  end if;
  delete from public.igpat_feedback f
  where f.user_id = actor
    and f.feedback_kind = safe_kind
    and f.post_id is not distinct from p_post_id
    and f.creator_id is not distinct from p_creator_id;
  insert into public.igpat_feedback(user_id,feedback_kind,post_id,creator_id)
  values(actor,safe_kind,p_post_id,p_creator_id);
  perform public.igpat_track_event_v2(
    'feedback',p_post_id,coalesce(p_creator_id, post_creator),'controls',0,
    jsonb_build_object('kind', safe_kind)
  );
end;
$$;

create or replace function public.igpat_set_feedback_v1(
  p_feedback_kind text,
  p_post_id uuid default null,
  p_creator_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.igpat_set_feedback_v2(p_feedback_kind,p_post_id,p_creator_id);
$$;

revoke insert, update, delete on table public.igpat_feedback from anon;
revoke insert, update, delete on table public.igpat_feedback from authenticated;
revoke insert, update, delete on table public.igpat_events from anon;
revoke insert, update, delete on table public.igpat_events from authenticated;

create or replace function public.get_buklod_igpat_feed_v4(
  p_mode text default 'for-you',
  p_limit integer default 15
)
returns table(
  id uuid,user_id uuid,author_name text,audience text,category text,body text,
  created_at timestamptz,media_path text,media_mime_type text,media_size_bytes bigint,
  media_duration_seconds numeric,reaction_counts jsonb,reaction_count bigint,
  comment_count bigint,my_reaction text,igpat_edit_meta jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_mode text := lower(coalesce(nullif(trim(p_mode), ''), 'for-you'));
  safe_limit integer := least(greatest(coalesce(p_limit, 15), 1), 50);
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if safe_mode not in ('for-you','following','latest') then raise exception 'Invalid IGPAT feed mode'; end if;
  return query
  select
    cp.id,cp.user_id,
    coalesce(author.full_name, author.first_name, author.username, 'BUKLOD Member')::text,
    cp.audience::text,cp.category::text,cp.body,cp.created_at,cp.media_path,cp.media_mime_type,
    cp.media_size_bytes::bigint,cp.media_duration_seconds::numeric,
    coalesce((select jsonb_object_agg(z.reaction,z.cnt) from (
      select rx.reaction::text as reaction, count(*)::bigint as cnt
      from public.reactions rx where rx.post_id = cp.id group by rx.reaction
    ) z), '{}'::jsonb),
    (select count(*)::bigint from public.reactions rx where rx.post_id = cp.id),
    (select count(*)::bigint from public.comments cm where cm.post_id = cp.id and cm.is_hidden = false and cm.deleted_at is null),
    (select rx.reaction::text from public.reactions rx where rx.post_id = cp.id and rx.user_id = actor order by rx.created_at desc limit 1),
    cp.igpat_edit_meta
  from public.community_posts cp
  join public.profiles author on author.id = cp.user_id
  where cp.is_hidden = false
    and cp.deleted_at is null
    and cp.is_reel = true
    and cp.media_mime_type like 'video/%'
    and public.can_view_community_post_v2(cp.id)
    and not exists (
      select 1 from public.igpat_feedback f
      where f.user_id = actor and f.feedback_kind in ('hide','not_interested') and f.post_id = cp.id
    )
    and not exists (
      select 1 from public.igpat_feedback f
      where f.user_id = actor and f.feedback_kind = 'dont_recommend_creator' and f.creator_id = cp.user_id
    )
    and (
      safe_mode <> 'following'
      or exists (
        select 1 from public.buklod_user_follows f
        where f.follower_id = actor and f.followed_user_id = cp.user_id
      )
    )
  order by
    case when safe_mode = 'for-you' then
      coalesce((
        select sum(case ev.event_name
          when 'share' then 3 when 'save' then 3 when 'follow' then 4
          when 'comment_open' then 1 when 'qualified_watch' then 1 when 'skip' then -2 else 0 end)::numeric
        from public.igpat_events ev
        where ev.user_id = actor and ev.creator_id = cp.user_id and ev.created_at >= now() - interval '90 days'
      ), 0)
      - case when exists (
          select 1 from public.igpat_feedback f
          where f.user_id = actor and f.feedback_kind = 'show_fewer'
            and (f.creator_id = cp.user_id or f.post_id = cp.id)
        ) then 8 else 0 end
      + (select count(*)::numeric from public.reactions rx where rx.post_id = cp.id)
      + (select count(*)::numeric * 2 from public.comments cm where cm.post_id = cp.id and cm.is_hidden = false and cm.deleted_at is null)
      + greatest(0, 7 - extract(epoch from (now() - cp.created_at)) / 86400)
      else 0 end desc,
    cp.created_at desc,cp.id desc
  limit safe_limit;
end;
$$;

create or replace function public.get_buklod_igpat_feed_v3(
  p_mode text default 'for-you',p_limit integer default 15
)
returns table(
  id uuid,user_id uuid,author_name text,audience text,category text,body text,
  created_at timestamptz,media_path text,media_mime_type text,media_size_bytes bigint,
  media_duration_seconds numeric,reaction_counts jsonb,reaction_count bigint,
  comment_count bigint,my_reaction text,igpat_edit_meta jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.get_buklod_igpat_feed_v4(p_mode, p_limit);
$$;

-- R52: creator-owned, RPC-mediated caption storage. The AI Edge Function writes
-- with service_role after independently validating the authenticated owner.
create table if not exists public.igpat_captions (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  language text not null default 'auto' check (char_length(language) between 1 and 40),
  caption_text text not null default '' check (char_length(caption_text) <= 12000),
  segments jsonb not null default '[]'::jsonb check (jsonb_typeof(segments) = 'array'),
  is_visible boolean not null default true,
  source_model text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.igpat_captions enable row level security;
revoke all on table public.igpat_captions from public;
revoke all on table public.igpat_captions from anon;
revoke all on table public.igpat_captions from authenticated;
grant all on table public.igpat_captions to service_role;

create or replace function public.get_buklod_igpat_caption_v1(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  owner_id uuid;
  row_data public.igpat_captions%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select cp.user_id into owner_id
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.is_hidden = false
    and cp.deleted_at is null
    and cp.media_mime_type like 'video/%'
    and (cp.user_id = actor or public.can_view_community_post_v2(cp.id));

  if owner_id is null then raise exception 'IGPAT is unavailable for this account'; end if;

  select * into row_data from public.igpat_captions c where c.post_id = p_post_id;
  if row_data.post_id is null then
    return jsonb_build_object('configured', false, 'is_owner', actor = owner_id);
  end if;

  if actor <> owner_id and not row_data.is_visible then
    return jsonb_build_object('configured', false, 'is_owner', false);
  end if;

  return jsonb_build_object(
    'configured', true,
    'is_owner', actor = owner_id,
    'language', row_data.language,
    'caption_text', row_data.caption_text,
    'segments', row_data.segments,
    'is_visible', row_data.is_visible,
    'updated_at', row_data.updated_at
  );
end;
$$;

create or replace function public.update_buklod_igpat_caption_v1(
  p_post_id uuid,
  p_caption_text text,
  p_is_visible boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_text text := trim(coalesce(p_caption_text, ''));
  updated public.igpat_captions%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if char_length(safe_text) > 12000 then raise exception 'IGPAT captions are too long'; end if;
  if not exists (
    select 1 from public.community_posts cp
    where cp.id = p_post_id and cp.user_id = actor and cp.is_reel = true
      and cp.is_hidden = false and cp.deleted_at is null and cp.media_mime_type like 'video/%'
  ) then raise exception 'Only the IGPAT creator can edit captions'; end if;

  update public.igpat_captions c
  set caption_text = safe_text,
      segments = '[]'::jsonb,
      is_visible = coalesce(p_is_visible, true),
      updated_at = now()
  where c.post_id = p_post_id and c.owner_user_id = actor
  returning * into updated;

  if updated.post_id is null then raise exception 'Generate captions first before editing them'; end if;
  return jsonb_build_object(
    'configured', true,'is_owner', true,'language', updated.language,
    'caption_text', updated.caption_text,'segments', updated.segments,
    'is_visible', updated.is_visible,'updated_at', updated.updated_at
  );
end;
$$;

revoke all on function public.igpat_track_event_v2(text,uuid,uuid,text,integer,jsonb) from public;
revoke all on function public.igpat_track_event_v2(text,uuid,uuid,text,integer,jsonb) from anon;
grant execute on function public.igpat_track_event_v2(text,uuid,uuid,text,integer,jsonb) to authenticated;
grant execute on function public.igpat_track_event_v2(text,uuid,uuid,text,integer,jsonb) to service_role;
revoke all on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) from public;
revoke all on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) from anon;
grant execute on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) to authenticated;
grant execute on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) to service_role;
revoke all on function public.igpat_set_feedback_v2(text,uuid,uuid) from public;
revoke all on function public.igpat_set_feedback_v2(text,uuid,uuid) from anon;
grant execute on function public.igpat_set_feedback_v2(text,uuid,uuid) to authenticated;
grant execute on function public.igpat_set_feedback_v2(text,uuid,uuid) to service_role;
revoke all on function public.igpat_set_feedback_v1(text,uuid,uuid) from public;
revoke all on function public.igpat_set_feedback_v1(text,uuid,uuid) from anon;
grant execute on function public.igpat_set_feedback_v1(text,uuid,uuid) to authenticated;
grant execute on function public.igpat_set_feedback_v1(text,uuid,uuid) to service_role;
revoke all on function public.get_buklod_igpat_feed_v4(text,integer) from public;
revoke all on function public.get_buklod_igpat_feed_v4(text,integer) from anon;
grant execute on function public.get_buklod_igpat_feed_v4(text,integer) to authenticated;
grant execute on function public.get_buklod_igpat_feed_v4(text,integer) to service_role;
revoke all on function public.get_buklod_igpat_feed_v3(text,integer) from public;
revoke all on function public.get_buklod_igpat_feed_v3(text,integer) from anon;
grant execute on function public.get_buklod_igpat_feed_v3(text,integer) to authenticated;
grant execute on function public.get_buklod_igpat_feed_v3(text,integer) to service_role;
revoke all on function public.get_buklod_igpat_caption_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_caption_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_caption_v1(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_caption_v1(uuid) to service_role;
revoke all on function public.update_buklod_igpat_caption_v1(uuid,text,boolean) from public;
revoke all on function public.update_buklod_igpat_caption_v1(uuid,text,boolean) from anon;
grant execute on function public.update_buklod_igpat_caption_v1(uuid,text,boolean) to authenticated;
grant execute on function public.update_buklod_igpat_caption_v1(uuid,text,boolean) to service_role;
