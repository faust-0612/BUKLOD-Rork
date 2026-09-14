-- BUKLOD Community Living Chains R2
-- Completes the locked Community design without turning the Wall into a work dashboard.
-- Anonymous roots, safe identity masking, resolve/helpful/takeaway, Pulse, Memory,
-- quiet resurfacing, existing-Points reward pots, and moderation state plumbing.

begin;

alter table public.buklod_community_post_meta
  add column if not exists moderation_state text not null default 'approved',
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz;

alter table public.buklod_community_post_meta
  drop constraint if exists buklod_community_post_meta_moderation_state_check;
alter table public.buklod_community_post_meta
  add constraint buklod_community_post_meta_moderation_state_check
  check (moderation_state = any(array['approved','pending','limited','blocked']::text[]));

create table if not exists public.buklod_community_takeaways (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.community_posts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  source_dugtong_ids uuid[] not null default '{}'::uuid[],
  is_public boolean not null default false,
  ai_model text,
  moderation_state text not null default 'approved',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buklod_community_takeaways_summary_check check (char_length(trim(summary)) between 1 and 3000),
  constraint buklod_community_takeaways_moderation_check check (moderation_state = any(array['approved','limited','blocked']::text[]))
);
create index if not exists idx_buklod_community_takeaways_public
  on public.buklod_community_takeaways(is_public,created_at desc)
  where is_public=true and moderation_state='approved';
alter table public.buklod_community_takeaways enable row level security;
revoke all on table public.buklod_community_takeaways from public,anon,authenticated;

create table if not exists public.buklod_community_reward_pot_awards (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  dugtong_id uuid not null references public.buklod_community_dugtongs(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null,
  created_at timestamptz not null default now(),
  primary key(post_id,dugtong_id),
  constraint buklod_community_reward_pot_points_check check(points between 1 and 2)
);
create index if not exists idx_buklod_community_reward_pot_recipient
  on public.buklod_community_reward_pot_awards(post_id,recipient_id);
alter table public.buklod_community_reward_pot_awards enable row level security;
revoke all on table public.buklod_community_reward_pot_awards from public,anon,authenticated;

create table if not exists public.buklod_community_moderation_events (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  verdict text not null,
  categories jsonb not null default '{}'::jsonb,
  reason text,
  model text,
  created_at timestamptz not null default now(),
  constraint buklod_community_moderation_type_check check(content_type = any(array['root','dugtong','takeaway']::text[])),
  constraint buklod_community_moderation_verdict_check check(verdict = any(array['allow','protect','block','error']::text[]))
);
create index if not exists idx_buklod_community_moderation_content
  on public.buklod_community_moderation_events(content_type,content_id,created_at desc);
alter table public.buklod_community_moderation_events enable row level security;
revoke all on table public.buklod_community_moderation_events from public,anon,authenticated;

insert into public.buklod_point_rules(activity_type,label,base_points,max_points_per_event,daily_cap_points,weekly_cap_points,is_active,notes)
values
 ('community_helpful_dugtong','Helpful Community Dugtong',2,2,6,24,true,'Existing Points only; root owner helpful mark + optional post reward pool; anti-collusion guarded.'),
 ('community_chain_resolve','Resolve a useful Community chain',1,1,3,12,true,'Small closure reward only when another member actually contributed.'),
 ('community_takeaway_share','Share an anonymized Community takeaway',1,1,2,8,true,'Reward for turning a resolved chain into reusable anonymous Community Memory.')
on conflict(activity_type) do update set
 label=excluded.label,
 max_points_per_event=excluded.max_points_per_event,
 daily_cap_points=excluded.daily_cap_points,
 weekly_cap_points=excluded.weekly_cap_points,
 is_active=true,
 notes=excluded.notes,
 updated_at=now();

create or replace function public.buklod_community_hard_block_v1(p_text text)
returns boolean
language sql
immutable
set search_path=''
as $$
  select
    coalesce(p_text,'') ~* '\m(kill[[:space:]]+yourself|kys|child[[:space:]]+porn|rape[[:space:]]+you)\M'
    or ((length(lower(coalesce(p_text,'')))-length(replace(lower(coalesce(p_text,'')),'http','')))/4) > 5
$$;
revoke all on function public.buklod_community_hard_block_v1(text) from public,anon,authenticated;

create or replace function public.create_buklod_community_living_post_v2(
  p_kind text,
  p_privacy text default 'public',
  p_body text default '',
  p_title text default null,
  p_topic text default null,
  p_quiet_mode boolean default false,
  p_poll_options jsonb default null,
  p_challenge_config jsonb default null,
  p_context_config jsonb default '{}'::jsonb,
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_kind text := lower(trim(coalesce(p_kind,'open_discussion')));
  v_privacy text := lower(trim(coalesce(p_privacy,'public')));
  v_body text := trim(coalesce(p_body,''));
  v_post_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if v_kind <> all(array['question','need_advice','challenge','poll','idea','encouragement','help_needed','share_a_win','decision','resource','story','open_discussion','moment']::text[]) then
    raise exception 'Invalid Community post type';
  end if;
  if v_privacy not in ('public','anonymous') then raise exception 'Invalid Community privacy'; end if;
  if char_length(v_body)>12000 then raise exception 'Community post is too long'; end if;
  if public.buklod_community_hard_block_v1(v_body) then raise exception 'This content cannot be posted'; end if;
  if v_privacy='anonymous' and (
    v_body ~* '\m(?:\+?63|0)?9[0-9]{9}\M'
    or v_body ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
  ) then raise exception 'Remove identifying contact details from an anonymous post'; end if;
  if v_kind='poll' and (p_poll_options is null or jsonb_typeof(p_poll_options)<>'array' or jsonb_array_length(p_poll_options)<2) then
    raise exception 'A poll needs at least two choices';
  end if;

  select public.create_buklod_community_post_v3(
    'public',null,'reflection',v_body,
    p_media_path,p_media_mime_type,p_media_size_bytes,
    '{}'::uuid[],null,false
  ) into v_post_id;

  perform public.set_buklod_community_post_meta_v1(
    v_post_id,v_kind,v_privacy,p_title,p_topic,coalesce(p_quiet_mode,false),
    p_poll_options,p_challenge_config,coalesce(p_context_config,'{}'::jsonb)
  );

  update public.buklod_community_post_meta
  set moderation_state='pending',updated_at=now()
  where post_id=v_post_id;

  return v_post_id;
end
$$;
revoke all on function public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint) from public,anon;
grant execute on function public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint) to authenticated;

-- Anonymous roots are public content with hidden presentation identity, not inaccessible content.
create or replace function public.buklod_community_can_access_root_v1(p_post_id uuid,p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.community_posts p
    left join public.buklod_community_post_meta m on m.post_id=p.id
    where p.id=p_post_id
      and p.deleted_at is null
      and coalesce(p.is_hidden,false)=false
      and (
        p.user_id=p_actor
        or (
          coalesce(p.author_only,false)=false
          and coalesce(p.audience,'public')='public'
          and coalesce(m.privacy,'public') in ('public','anonymous')
          and coalesce(m.moderation_state,'approved')<>'blocked'
        )
      )
  )
$$;
revoke all on function public.buklod_community_can_access_root_v1(uuid,uuid) from public,anon,authenticated;

-- Replace the mature Public feed only with an identity-safe wrapper. The old
-- ranking engine remains intact under a raw name, avoiding feed regression.
do $$
begin
  if to_regprocedure('public.get_buklod_public_community_feed_v7_page_raw_r2(uuid,text,integer,integer)') is null then
    alter function public.get_buklod_public_community_feed_v7_page(uuid,text,integer,integer)
      rename to get_buklod_public_community_feed_v7_page_raw_r2;
  end if;
end
$$;

create or replace function public.get_buklod_public_community_feed_v7_page(
  p_location_scope_id uuid default null,
  p_mode text default 'for_you',
  p_limit integer default 40,
  p_offset integer default 0
)
returns table(
  id uuid,user_id uuid,author_name text,group_id uuid,church_id uuid,audience text,body text,category text,created_at timestamptz,
  media_path text,media_mime_type text,media_size_bytes bigint,reaction_counts jsonb,total_reactions bigint,comment_count bigint,mentions jsonb,
  score_total numeric,score_recency numeric,score_scope_relevance numeric,score_interaction_affinity numeric,score_content_preference numeric,
  score_engagement numeric,score_priority numeric,is_following_author boolean,shares_active_scope boolean
)
language sql
stable
security definer
set search_path=''
as $$
  select
    r.id,
    case when coalesce(m.privacy,'public')='anonymous' and r.user_id<>(select auth.uid()) then null else r.user_id end,
    case when coalesce(m.privacy,'public')='anonymous' and r.user_id<>(select auth.uid()) then 'Anonymous BUKLOD Member' else r.author_name end,
    r.group_id,r.church_id,r.audience,r.body,r.category,r.created_at,
    r.media_path,r.media_mime_type,r.media_size_bytes,r.reaction_counts,r.total_reactions,r.comment_count,r.mentions,
    r.score_total,r.score_recency,r.score_scope_relevance,r.score_interaction_affinity,r.score_content_preference,r.score_engagement,r.score_priority,
    r.is_following_author,r.shares_active_scope
  from public.get_buklod_public_community_feed_v7_page_raw_r2(p_location_scope_id,p_mode,p_limit,p_offset) r
  left join public.buklod_community_post_meta m on m.post_id=r.id
  where coalesce(m.moderation_state,'approved')<>'blocked'
$$;
revoke all on function public.get_buklod_public_community_feed_v7_page(uuid,text,integer,integer) from public,anon;
grant execute on function public.get_buklod_public_community_feed_v7_page(uuid,text,integer,integer) to authenticated;

create or replace function public.create_buklod_dugtong_v1(
  p_post_id uuid,
  p_parent_id uuid default null,
  p_body text default '',
  p_type text default 'continuation',
  p_privacy text default 'public',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_root_owner uuid;
  v_body text := trim(coalesce(p_body,''));
  v_parent public.buklod_community_dugtongs%rowtype;
  v_depth smallint := 1;
  v_id uuid := gen_random_uuid();
  v_branch uuid;
  v_count integer := 0;
  v_privacy text := lower(trim(coalesce(p_privacy,'public')));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_community_can_access_root_v1(p_post_id,v_actor) then raise exception 'Post is not available for Dugtong'; end if;
  select p.user_id into v_root_owner from public.community_posts p where p.id=p_post_id and p.deleted_at is null;
  if char_length(v_body)<1 or char_length(v_body)>4000 then raise exception 'Dugtong must be 1 to 4000 characters'; end if;
  if public.buklod_community_hard_block_v1(v_body) then raise exception 'This content cannot be posted'; end if;
  if v_privacy not in ('public','anonymous','private_poster') then raise exception 'Invalid Dugtong privacy'; end if;
  if v_privacy='anonymous' and (
    v_body ~* '\m(?:\+?63|0)?9[0-9]{9}\M'
    or v_body ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
  ) then raise exception 'Remove identifying contact details from an anonymous Dugtong'; end if;

  if p_parent_id is not null then
    select * into v_parent from public.buklod_community_dugtongs d
    where d.id=p_parent_id and d.root_post_id=p_post_id and d.deleted_at is null;
    if not found then raise exception 'Parent Dugtong was not found in this chain'; end if;
    if v_parent.privacy='private_poster' and v_actor not in (v_parent.user_id,v_root_owner) then
      raise exception 'This private Dugtong can only be continued by its author or the original poster';
    end if;
    v_depth := (v_parent.depth+1)::smallint;
    if v_depth>24 then raise exception 'This branch is already deep. Start from the original post.'; end if;
    v_branch := coalesce(v_parent.branch_id,v_parent.id);
  else
    v_branch := v_id;
  end if;

  if nullif(trim(coalesce(p_media_path,'')),'') is not null and (storage.foldername(p_media_path))[1] is distinct from v_actor::text then
    raise exception 'Invalid Dugtong media path';
  end if;

  insert into public.buklod_community_dugtongs(
    id,root_post_id,parent_id,branch_id,user_id,body,dugtong_type,privacy,depth,
    media_path,media_mime_type,media_size_bytes,moderation_state
  ) values(
    v_id,p_post_id,p_parent_id,v_branch,v_actor,v_body,
    lower(trim(coalesce(p_type,'continuation'))),v_privacy,v_depth,
    nullif(trim(coalesce(p_media_path,'')),''),nullif(lower(trim(coalesce(p_media_mime_type,''))),''),p_media_size_bytes,'approved'
  );

  select count(*)::integer into v_count from public.buklod_community_dugtongs d
  where d.root_post_id=p_post_id and d.user_id=v_actor and d.deleted_at is null;
  if v_count=1 then
    perform public.buklod_community_award_small_v1(v_actor,'community_dugtong','community_dugtong:'||p_post_id::text,1,'Meaningful Dugtong added to a Community chain');
  end if;

  update public.buklod_community_post_meta
  set chain_status=case when chain_status='resolved' then 'resolved' else 'growing' end,updated_at=now()
  where post_id=p_post_id;

  return jsonb_build_object('id',v_id,'root_post_id',p_post_id,'parent_id',p_parent_id,'depth',v_depth,'branch_id',v_branch);
end
$$;
revoke all on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) from public,anon;
grant execute on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function public.set_buklod_dugtong_helpful_v1(p_dugtong_id uuid,p_helpful boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.buklod_community_dugtongs%rowtype;
  v_root_owner uuid;
  v_helpful_count integer;
  v_budget integer := 0;
  v_spent integer := 0;
  v_award integer := 0;
  v_ledger uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_row from public.buklod_community_dugtongs d where d.id=p_dugtong_id and d.deleted_at is null;
  if not found then raise exception 'Dugtong not found'; end if;
  select p.user_id into v_root_owner from public.community_posts p where p.id=v_row.root_post_id and p.deleted_at is null;
  if v_actor is distinct from v_root_owner then raise exception 'Only the original poster can mark a helpful Dugtong'; end if;
  if v_row.user_id=v_actor then raise exception 'Your own Dugtong cannot receive a helpful bonus'; end if;

  if coalesce(p_helpful,false) and not v_row.is_helpful then
    select count(*)::integer into v_helpful_count from public.buklod_community_dugtongs d
    where d.root_post_id=v_row.root_post_id and d.is_helpful=true and d.deleted_at is null;
    if v_helpful_count>=3 then raise exception 'Choose up to three most helpful Dugtongs'; end if;
  end if;

  update public.buklod_community_dugtongs set is_helpful=coalesce(p_helpful,false),updated_at=now() where id=p_dugtong_id;

  if coalesce(p_helpful,false) then
    select greatest(0,least(10,coalesce((m.context_config->>'reward_pot_points')::integer,0))) into v_budget
    from public.buklod_community_post_meta m where m.post_id=v_row.root_post_id;
    select coalesce(sum(a.points),0)::integer into v_spent from public.buklod_community_reward_pot_awards a where a.post_id=v_row.root_post_id;
    if v_budget>v_spent
       and not exists(select 1 from public.buklod_community_reward_pot_awards a where a.post_id=v_row.root_post_id and a.dugtong_id=p_dugtong_id)
       and not exists(select 1 from public.buklod_community_reward_pot_awards a where a.post_id=v_row.root_post_id and a.recipient_id=v_row.user_id) then
      v_award := least(2,v_budget-v_spent);
      v_ledger := public.buklod_community_award_small_v1(
        v_row.user_id,'community_helpful_dugtong','community_helpful_dugtong:'||v_row.root_post_id::text||':'||v_row.user_id::text,
        v_award,'A Dugtong was marked helpful by the original poster'
      );
      if v_ledger is not null then
        insert into public.buklod_community_reward_pot_awards(post_id,dugtong_id,recipient_id,points)
        values(v_row.root_post_id,p_dugtong_id,v_row.user_id,v_award)
        on conflict(post_id,dugtong_id) do nothing;
      end if;
    end if;
  end if;

  return jsonb_build_object('dugtong_id',p_dugtong_id,'helpful',coalesce(p_helpful,false),'bonus_points',v_award);
end
$$;
revoke all on function public.set_buklod_dugtong_helpful_v1(uuid,boolean) from public,anon;
grant execute on function public.set_buklod_dugtong_helpful_v1(uuid,boolean) to authenticated;

create or replace function public.resolve_buklod_community_chain_v1(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_count integer;
  v_other_count integer;
  v_best uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.user_id into v_owner from public.community_posts p where p.id=p_post_id and p.deleted_at is null;
  if v_owner is distinct from v_actor then raise exception 'Only the original poster can resolve this chain'; end if;
  select count(*)::integer,count(*) filter(where d.user_id<>v_actor)::integer
    into v_count,v_other_count
  from public.buklod_community_dugtongs d
  where d.root_post_id=p_post_id and d.deleted_at is null and d.moderation_state='approved';
  if v_count<1 then raise exception 'A chain needs at least one Dugtong before it can be resolved'; end if;
  select d.id into v_best from public.buklod_community_dugtongs d
  where d.root_post_id=p_post_id and d.deleted_at is null and d.moderation_state='approved'
  order by d.is_helpful desc,d.created_at asc limit 1;
  update public.buklod_community_post_meta
  set chain_status='resolved',resolved_dugtong_id=coalesce(resolved_dugtong_id,v_best),updated_at=now()
  where post_id=p_post_id;
  if v_other_count>0 then
    perform public.buklod_community_award_small_v1(v_actor,'community_chain_resolve','community_chain_resolve:'||p_post_id::text,1,'Closed the loop on a useful Community chain');
  end if;
  return jsonb_build_object('post_id',p_post_id,'status','resolved','dugtong_count',v_count);
end
$$;
revoke all on function public.resolve_buklod_community_chain_v1(uuid) from public,anon;
grant execute on function public.resolve_buklod_community_chain_v1(uuid) to authenticated;

create or replace function public.set_buklod_community_takeaway_public_v1(p_post_id uuid,p_public boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_was_public boolean;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.user_id into v_owner from public.community_posts p where p.id=p_post_id and p.deleted_at is null;
  if v_owner is distinct from v_actor then raise exception 'Only the original poster can share this Takeaway'; end if;
  select t.is_public into v_was_public from public.buklod_community_takeaways t where t.post_id=p_post_id;
  if not found then raise exception 'Takeaway is not ready yet'; end if;
  update public.buklod_community_takeaways
    set is_public=coalesce(p_public,false),published_at=case when coalesce(p_public,false) then coalesce(published_at,now()) else null end,updated_at=now()
    where post_id=p_post_id;
  if coalesce(p_public,false) and not coalesce(v_was_public,false) then
    perform public.buklod_community_award_small_v1(v_actor,'community_takeaway_share','community_takeaway_share:'||p_post_id::text,1,'Shared an anonymized Community Takeaway');
  end if;
  return jsonb_build_object('post_id',p_post_id,'is_public',coalesce(p_public,false));
end
$$;
revoke all on function public.set_buklod_community_takeaway_public_v1(uuid,boolean) from public,anon;
grant execute on function public.set_buklod_community_takeaway_public_v1(uuid,boolean) to authenticated;

create or replace function public.get_buklod_dugtong_summary_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'post_id',p.id,
    'kind',coalesce(m.kind,case when coalesce(p.media_mime_type,'') like 'image/%' then 'moment' else 'open_discussion' end),
    'status',coalesce(m.chain_status,'open'),
    'quiet_mode',coalesce(m.quiet_mode,false),
    'is_owner',p.user_id=(select auth.uid()),
    'context_config',coalesce(m.context_config,'{}'::jsonb),
    'reward_pot_points',greatest(0,least(10,coalesce((m.context_config->>'reward_pot_points')::integer,0))),
    'root_media_path',p.media_path,
    'public_count',coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy in ('public','anonymous')),0),
    'private_count',case when p.user_id=(select auth.uid()) then coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy='private_poster'),0) else 0 end,
    'branch_count',coalesce((select count(distinct d.branch_id) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved'),0),
    'helpful_count',coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.is_helpful=true),0),
    'takeaway_summary',case when t.is_public or p.user_id=(select auth.uid()) then t.summary else null end,
    'takeaway_public',coalesce(t.is_public,false)
  )
  from public.community_posts p
  left join public.buklod_community_post_meta m on m.post_id=p.id
  left join public.buklod_community_takeaways t on t.post_id=p.id and t.moderation_state='approved'
  where p.id=p_post_id and p.deleted_at is null
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
$$;
revoke all on function public.get_buklod_dugtong_summary_v1(uuid) from public,anon;
grant execute on function public.get_buklod_dugtong_summary_v1(uuid) to authenticated;

create or replace function public.get_buklod_community_discovery_v2(p_mode text default 'for_you',p_limit integer default 30)
returns table(
  post_id uuid,body text,title text,topic text,kind text,privacy text,chain_status text,quiet_mode boolean,
  dugtong_count bigint,branch_count bigint,is_owner boolean,rescue_reason text,context_config jsonb,created_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  with candidates as (
    select
      p.id post_id,p.body,m.title,m.topic,
      coalesce(m.kind,case when coalesce(p.media_mime_type,'') like 'image/%' then 'moment' else 'open_discussion' end) kind,
      coalesce(m.privacy,'public') privacy,coalesce(m.chain_status,'open') chain_status,coalesce(m.quiet_mode,false) quiet_mode,
      coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy in ('public','anonymous')),0) dugtong_count,
      coalesce((select count(distinct d.branch_id) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy in ('public','anonymous')),0) branch_count,
      p.user_id=(select auth.uid()) is_owner,
      coalesce(m.context_config,'{}'::jsonb) context_config,p.created_at,coalesce(m.updated_at,p.created_at) activity_at,
      case
        when coalesce(m.chain_status,'open')<>'resolved'
         and p.created_at<now()-interval '3 hours'
         and p.created_at>now()-interval '7 days'
         and coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved'),0)=0
          then 'No one has answered yet'
        when coalesce(m.chain_status,'open')<>'resolved'
         and p.created_at<now()-interval '12 hours'
         and p.created_at>now()-interval '7 days'
         and coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved'),0)=1
          then 'Could use another perspective'
        else null
      end rescue_reason
    from public.community_posts p
    left join public.buklod_community_post_meta m on m.post_id=p.id
    where p.deleted_at is null and coalesce(p.is_hidden,false)=false and coalesce(p.author_only,false)=false
      and coalesce(p.audience,'public')='public'
      and coalesce(m.privacy,'public') in ('public','anonymous')
      and coalesce(m.moderation_state,'approved')<>'blocked'
  )
  select c.post_id,c.body,c.title,c.topic,c.kind,c.privacy,c.chain_status,c.quiet_mode,c.dugtong_count,c.branch_count,c.is_owner,c.rescue_reason,c.context_config,c.created_at
  from candidates c
  where case lower(trim(coalesce(p_mode,'for_you')))
    when 'help_someone' then c.rescue_reason is not null
    when 'growing' then c.chain_status='growing' or c.dugtong_count>=2
    when 'challenges' then c.kind='challenge'
    when 'polls' then c.kind in ('poll','decision')
    when 'resolved' then c.chain_status='resolved'
    when 'resources' then c.kind='resource'
    when 'moments' then c.kind='moment'
    else true end
  order by
    case when lower(trim(coalesce(p_mode,'for_you')))='for_you' and c.rescue_reason is not null then 1 else 0 end desc,
    c.activity_at desc
  limit greatest(1,least(coalesce(p_limit,30),60))
$$;
revoke all on function public.get_buklod_community_discovery_v2(text,integer) from public,anon;
grant execute on function public.get_buklod_community_discovery_v2(text,integer) to authenticated;

create or replace function public.get_buklod_community_pulse_v1()
returns table(kind text,label text,post_count bigint,dugtong_count bigint,resolved_count bigint)
language sql
security definer
set search_path=''
as $$
  with recent as (
    select p.id,coalesce(m.kind,'open_discussion') kind,coalesce(m.chain_status,'open') status
    from public.community_posts p
    left join public.buklod_community_post_meta m on m.post_id=p.id
    where p.deleted_at is null and coalesce(p.is_hidden,false)=false and coalesce(p.author_only,false)=false
      and p.audience='public' and p.created_at>=now()-interval '7 days'
      and coalesce(m.privacy,'public') in ('public','anonymous') and coalesce(m.moderation_state,'approved')<>'blocked'
  ), grouped as (
    select r.kind,count(*) post_count,
      coalesce(sum((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=r.id and d.deleted_at is null and d.moderation_state='approved')),0)::bigint dugtong_count,
      count(*) filter(where r.status='resolved')::bigint resolved_count
    from recent r group by r.kind
  )
  select g.kind,
    case g.kind when 'need_advice' then 'Advice & real-life concerns' when 'help_needed' then 'People asking for help' when 'challenge' then 'Challenges' when 'poll' then 'Community decisions' when 'moment' then 'Shared Moments' when 'encouragement' then 'Encouragement' when 'question' then 'Questions' when 'resource' then 'Helpful Resources' else initcap(replace(g.kind,'_',' ')) end,
    g.post_count,g.dugtong_count,g.resolved_count
  from grouped g
  where g.post_count>=3
  order by g.post_count desc,g.dugtong_count desc
  limit 8
$$;
revoke all on function public.get_buklod_community_pulse_v1() from public,anon;
grant execute on function public.get_buklod_community_pulse_v1() to authenticated;

create or replace function public.get_buklod_community_memory_v1(p_query text default null,p_limit integer default 30)
returns table(takeaway_id uuid,post_id uuid,summary text,kind text,topic text,created_at timestamptz)
language sql
security definer
set search_path=''
as $$
  select t.id,t.post_id,t.summary,coalesce(m.kind,'open_discussion'),m.topic,t.created_at
  from public.buklod_community_takeaways t
  join public.buklod_community_post_meta m on m.post_id=t.post_id
  join public.community_posts p on p.id=t.post_id
  where t.is_public=true and t.moderation_state='approved' and p.deleted_at is null and coalesce(p.is_hidden,false)=false
    and (
      nullif(trim(coalesce(p_query,'')),'') is null
      or to_tsvector('simple',coalesce(t.summary,'')||' '||coalesce(m.title,'')||' '||coalesce(m.topic,'')) @@ plainto_tsquery('simple',trim(p_query))
    )
  order by t.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),60))
$$;
revoke all on function public.get_buklod_community_memory_v1(text,integer) from public,anon;
grant execute on function public.get_buklod_community_memory_v1(text,integer) to authenticated;

commit;
