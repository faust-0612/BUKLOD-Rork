-- BUKLOD IGPAT R17+
-- Non-destructive Quick Edit metadata. The original uploaded media remains intact;
-- supported playback edits are persisted separately and enforced by IGPAT clients.
-- This unapplied IGPat migration also carries the later Relay RPC layer so the
-- client can ship one coherent database contract without inventing a parallel table.

alter table public.community_posts
  add column if not exists igpat_edit_meta jsonb;

comment on column public.community_posts.igpat_edit_meta is
  'BUKLOD IGPAT non-destructive edit metadata. Null for legacy/unmodified posts.';

create or replace function public.create_buklod_reel_v2(
  p_audience text,
  p_group_id uuid default null,
  p_body text default '',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null,
  p_duration_seconds numeric default null,
  p_edit_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_id uuid;
  safe_meta jsonb := coalesce(p_edit_meta, '{}'::jsonb);
  trim_start numeric;
  trim_end numeric;
  speed_value numeric;
  rotation_value integer;
  cover_value numeric;
  muted_value boolean;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(safe_meta) <> 'object' then
    raise exception 'Invalid IGPAT edit metadata';
  end if;

  trim_start := greatest(0, coalesce(nullif(safe_meta->>'trim_start_seconds', '')::numeric, 0));
  trim_end := least(
    coalesce(p_duration_seconds, 0),
    coalesce(nullif(safe_meta->>'trim_end_seconds', '')::numeric, p_duration_seconds)
  );
  speed_value := coalesce(nullif(safe_meta->>'speed', '')::numeric, 1);
  rotation_value := coalesce(nullif(safe_meta->>'rotation', '')::integer, 0);
  cover_value := coalesce(nullif(safe_meta->>'cover_seconds', '')::numeric, trim_start);
  muted_value := lower(coalesce(safe_meta->>'muted', 'false')) = 'true';

  if p_duration_seconds is null or p_duration_seconds <= 0 or p_duration_seconds > 60 then
    raise exception 'BUKLOD IGPAT may be up to 60 seconds only';
  end if;

  if trim_end <= trim_start or trim_end - trim_start < 1 then
    raise exception 'IGPAT trim must keep at least 1 second';
  end if;

  if trim_start < 0 or trim_end > p_duration_seconds then
    raise exception 'IGPAT trim is outside the source video';
  end if;

  if speed_value not in (0.5, 0.75, 1, 1.25, 1.5, 2) then
    raise exception 'Unsupported IGPAT playback speed';
  end if;

  if rotation_value not in (0, 90, 180, 270) then
    raise exception 'Unsupported IGPAT rotation';
  end if;

  if coalesce(safe_meta->>'content_fit', 'cover') not in ('contain', 'cover') then
    raise exception 'Unsupported IGPAT framing mode';
  end if;

  if length(coalesce(safe_meta->>'text_overlay', '')) > 160 then
    raise exception 'IGPAT text overlay is too long';
  end if;

  if cover_value < trim_start or cover_value > trim_end then
    raise exception 'IGPAT cover frame must be inside the trimmed video';
  end if;

  new_id := public.create_buklod_reel_v1(
    p_audience,
    p_group_id,
    p_body,
    p_media_path,
    p_media_mime_type,
    p_media_size_bytes,
    p_duration_seconds
  );

  update public.community_posts
  set igpat_edit_meta = jsonb_build_object(
    'version', 1,
    'trim_start_seconds', trim_start,
    'trim_end_seconds', trim_end,
    'speed', speed_value,
    'muted', muted_value,
    'text_overlay', left(coalesce(safe_meta->>'text_overlay', ''), 160),
    'content_fit', coalesce(safe_meta->>'content_fit', 'cover'),
    'rotation', rotation_value,
    'cover_seconds', cover_value
  )
  where id = new_id
    and user_id = actor;

  return new_id;
end;
$$;

create or replace function public.create_buklod_reel_v3(
  p_audience text,
  p_group_id uuid default null,
  p_body text default '',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null,
  p_duration_seconds numeric default null,
  p_edit_meta jsonb default '{}'::jsonb,
  p_relay_parent_post_id uuid default null,
  p_relay_prompt text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_id uuid;
  safe_prompt text := nullif(lower(trim(coalesce(p_relay_prompt, ''))), '');
  relay_root uuid;
  relay_depth integer := 1;
  parent_root_text text;
  parent_depth_text text;
  uuid_pattern text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if (p_relay_parent_post_id is null) <> (safe_prompt is null) then
    raise exception 'IGPAT Relay needs both a parent IGPAT and a Relay prompt';
  end if;

  if p_relay_parent_post_id is not null then
    if safe_prompt not in ('continue_this', 'your_turn', 'answer_this', 'show_yours') then
      raise exception 'Invalid IGPAT Relay prompt';
    end if;

    if not exists (
      select 1
      from public.community_posts parent_post
      where parent_post.id = p_relay_parent_post_id
        and parent_post.is_reel = true
        and parent_post.is_hidden = false
        and parent_post.deleted_at is null
        and parent_post.media_mime_type like 'video/%'
        and public.can_view_community_post_v2(parent_post.id)
    ) then
      raise exception 'Relay parent IGPAT is unavailable for this account';
    end if;

    relay_root := p_relay_parent_post_id;

    select
      meta.context_config #>> '{igpat_relay,root_post_id}',
      meta.context_config #>> '{igpat_relay,depth}'
    into parent_root_text, parent_depth_text
    from public.buklod_community_post_meta meta
    where meta.post_id = p_relay_parent_post_id;

    if parent_root_text ~ uuid_pattern
      and exists (
        select 1
        from public.community_posts root_post
        where root_post.id = parent_root_text::uuid
          and root_post.is_reel = true
          and root_post.is_hidden = false
          and root_post.deleted_at is null
          and root_post.media_mime_type like 'video/%'
          and public.can_view_community_post_v2(root_post.id)
      )
    then
      relay_root := parent_root_text::uuid;
    end if;

    if coalesce(parent_depth_text, '') ~ '^[0-9]+$' then
      relay_depth := least(greatest(parent_depth_text::integer + 1, 1), 100);
    end if;
  end if;

  new_id := public.create_buklod_reel_v2(
    p_audience,
    p_group_id,
    p_body,
    p_media_path,
    p_media_mime_type,
    p_media_size_bytes,
    p_duration_seconds,
    p_edit_meta
  );

  if p_relay_parent_post_id is not null then
    insert into public.buklod_community_post_meta(
      post_id,
      kind,
      privacy,
      context_config,
      updated_at
    )
    values(
      new_id,
      'story',
      'public',
      jsonb_build_object(
        'igpat_relay',
        jsonb_build_object(
          'version', 1,
          'parent_post_id', p_relay_parent_post_id,
          'root_post_id', relay_root,
          'prompt', safe_prompt,
          'depth', relay_depth
        )
      ),
      now()
    )
    on conflict(post_id) do update
      set context_config = coalesce(buklod_community_post_meta.context_config, '{}'::jsonb)
            || excluded.context_config,
          updated_at = now();
  end if;

  return new_id;
end;
$$;

create or replace function public.get_buklod_igpat_feed_v3(
  p_mode text default 'for-you',
  p_limit integer default 15
)
returns table(
  id uuid,
  user_id uuid,
  author_name text,
  audience text,
  category text,
  body text,
  created_at timestamptz,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  media_duration_seconds numeric,
  reaction_counts jsonb,
  reaction_count bigint,
  comment_count bigint,
  my_reaction text,
  igpat_edit_meta jsonb
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
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if safe_mode not in ('for-you', 'following', 'latest') then
    raise exception 'Invalid IGPAT feed mode';
  end if;

  return query
  select
    cp.id,
    cp.user_id,
    coalesce(author.full_name, 'BUKLOD Member')::text,
    cp.audience::text,
    cp.category::text,
    cp.body,
    cp.created_at,
    cp.media_path,
    cp.media_mime_type,
    cp.media_size_bytes::bigint,
    cp.media_duration_seconds::numeric,
    coalesce(
      (
        select jsonb_object_agg(z.reaction, z.cnt)
        from (
          select rx.reaction::text as reaction, count(*)::bigint as cnt
          from public.reactions rx
          where rx.post_id = cp.id
          group by rx.reaction
        ) z
      ),
      '{}'::jsonb
    ),
    (
      select count(*)::bigint
      from public.reactions rx
      where rx.post_id = cp.id
    ),
    (
      select count(*)::bigint
      from public.comments cm
      where cm.post_id = cp.id
        and cm.is_hidden = false
    ),
    (
      select rx.reaction::text
      from public.reactions rx
      where rx.post_id = cp.id
        and rx.user_id = actor
      order by rx.created_at desc
      limit 1
    ),
    cp.igpat_edit_meta
  from public.community_posts cp
  join public.profiles author
    on author.id = cp.user_id
  where cp.is_hidden = false
    and cp.deleted_at is null
    and cp.is_reel = true
    and cp.media_mime_type like 'video/%'
    and public.can_view_community_post_v2(cp.id)
    and (
      safe_mode <> 'following'
      or exists (
        select 1
        from public.buklod_user_follows f
        where f.follower_id = actor
          and f.followed_user_id = cp.user_id
      )
    )
  order by
    case
      when safe_mode = 'for-you' then
        (
          select count(*)::numeric
          from public.reactions rx
          where rx.post_id = cp.id
        )
        + (
          select count(*)::numeric * 2
          from public.comments cm
          where cm.post_id = cp.id
            and cm.is_hidden = false
        )
        + greatest(
            0,
            7 - extract(epoch from (now() - cp.created_at)) / 86400
          )
      else 0
    end desc,
    cp.created_at desc,
    cp.id desc
  limit safe_limit;
end;
$$;

create or replace function public.get_buklod_igpat_edit_v1(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result jsonb;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_view_community_post_v2(p_post_id) then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  select cp.igpat_edit_meta
    into result
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.deleted_at is null
    and cp.is_hidden = false;

  return result;
end;
$$;

create or replace function public.get_buklod_igpat_relay_chain_v1(
  p_post_id uuid
)
returns table(
  id uuid,
  parent_post_id uuid,
  relay_prompt text,
  relay_depth integer,
  user_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  media_path text,
  media_mime_type text,
  media_duration_seconds numeric,
  igpat_edit_meta jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  root_id uuid := p_post_id;
  requested_root_text text;
  uuid_pattern text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.community_posts current_post
    where current_post.id = p_post_id
      and current_post.is_reel = true
      and current_post.is_hidden = false
      and current_post.deleted_at is null
      and current_post.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(current_post.id)
  ) then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  select meta.context_config #>> '{igpat_relay,root_post_id}'
  into requested_root_text
  from public.buklod_community_post_meta meta
  where meta.post_id = p_post_id;

  if requested_root_text ~ uuid_pattern
    and exists (
      select 1
      from public.community_posts root_post
      where root_post.id = requested_root_text::uuid
        and root_post.is_reel = true
        and root_post.is_hidden = false
        and root_post.deleted_at is null
        and root_post.media_mime_type like 'video/%'
        and public.can_view_community_post_v2(root_post.id)
    )
  then
    root_id := requested_root_text::uuid;
  end if;

  return query
  with raw as (
    select
      cp.id,
      cp.user_id,
      coalesce(author.full_name, 'BUKLOD Member')::text as author_name,
      cp.body,
      cp.created_at,
      cp.media_path,
      cp.media_mime_type,
      cp.media_duration_seconds::numeric as media_duration_seconds,
      cp.igpat_edit_meta,
      meta.context_config #>> '{igpat_relay,parent_post_id}' as parent_text,
      lower(coalesce(meta.context_config #>> '{igpat_relay,prompt}', '')) as prompt_text,
      meta.context_config #>> '{igpat_relay,depth}' as depth_text,
      meta.context_config #>> '{igpat_relay,root_post_id}' as relay_root_text
    from public.community_posts cp
    join public.profiles author
      on author.id = cp.user_id
    left join public.buklod_community_post_meta meta
      on meta.post_id = cp.id
    where cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and (
        cp.id = root_id
        or meta.context_config #>> '{igpat_relay,root_post_id}' = root_id::text
      )
  ), normalized as (
    select
      raw.*,
      case
        when raw.parent_text ~ uuid_pattern then raw.parent_text::uuid
        else null
      end as raw_parent_id,
      case
        when raw.prompt_text in ('continue_this', 'your_turn', 'answer_this', 'show_yours')
          then raw.prompt_text
        else null
      end as safe_prompt,
      case
        when raw.id = root_id then 0
        when coalesce(raw.depth_text, '') ~ '^[0-9]+$'
          then least(greatest(raw.depth_text::integer, 1), 100)
        else 1
      end as safe_depth
    from raw
  )
  select
    normalized.id,
    case
      when normalized.raw_parent_id is not null
        and public.can_view_community_post_v2(normalized.raw_parent_id)
        then normalized.raw_parent_id
      else null
    end,
    normalized.safe_prompt,
    normalized.safe_depth,
    normalized.user_id,
    normalized.author_name,
    normalized.body,
    normalized.created_at,
    normalized.media_path,
    normalized.media_mime_type,
    normalized.media_duration_seconds,
    normalized.igpat_edit_meta
  from normalized
  where public.can_view_community_post_v2(normalized.id)
  order by normalized.safe_depth asc, normalized.created_at asc, normalized.id asc;
end;
$$;

-- R23 Community Reveal keeps its hidden payload outside generic Community metadata
-- because existing Community summary RPCs may legitimately expose context_config.
create table if not exists public.igpat_community_reveals (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  target_count smallint not null check (target_count between 2 and 500),
  reveal_text text not null check (char_length(trim(reveal_text)) between 1 and 1200),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.igpat_community_reveals enable row level security;
revoke all on table public.igpat_community_reveals from public;
revoke all on table public.igpat_community_reveals from anon;
revoke all on table public.igpat_community_reveals from authenticated;
grant all on table public.igpat_community_reveals to service_role;

create or replace function public.set_buklod_igpat_reveal_v1(
  p_post_id uuid,
  p_target_count integer default 50,
  p_reveal_text text default '',
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  owner_id uuid;
  safe_text text := trim(coalesce(p_reveal_text, ''));
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select cp.user_id
  into owner_id
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.is_hidden = false
    and cp.deleted_at is null
    and cp.media_mime_type like 'video/%';

  if owner_id is null then
    raise exception 'IGPAT was not found';
  end if;

  if owner_id is distinct from actor then
    raise exception 'Only the IGPAT creator can manage Community Reveal';
  end if;

  if not coalesce(p_enabled, true) then
    delete from public.igpat_community_reveals reveal
    where reveal.post_id = p_post_id
      and reveal.owner_user_id = actor;
    return jsonb_build_object(
      'configured', false,
      'is_owner', true
    );
  end if;

  if p_target_count is null or p_target_count < 2 or p_target_count > 500 then
    raise exception 'Community Reveal target must be from 2 to 500 unique participants';
  end if;

  if char_length(safe_text) < 1 or char_length(safe_text) > 1200 then
    raise exception 'Community Reveal text must be 1 to 1200 characters';
  end if;

  insert into public.igpat_community_reveals(
    post_id,
    owner_user_id,
    target_count,
    reveal_text,
    enabled,
    updated_at
  )
  values(
    p_post_id,
    actor,
    p_target_count::smallint,
    safe_text,
    true,
    now()
  )
  on conflict(post_id) do update
    set target_count = excluded.target_count,
        reveal_text = excluded.reveal_text,
        enabled = true,
        updated_at = now()
  where igpat_community_reveals.owner_user_id = actor;

  return jsonb_build_object(
    'configured', true,
    'is_owner', true,
    'target_count', p_target_count,
    'reveal_text', safe_text
  );
end;
$$;

create or replace function public.get_buklod_igpat_reveal_v1(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  owner_id uuid;
  parent_audience text;
  parent_group_id uuid;
  parent_church_id uuid;
  parent_scope_id uuid;
  reveal_row public.igpat_community_reveals%rowtype;
  participant_count integer := 0;
  unlocked boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select
    cp.user_id,
    cp.audience,
    cp.group_id,
    cp.church_id,
    cp.scope_id
  into
    owner_id,
    parent_audience,
    parent_group_id,
    parent_church_id,
    parent_scope_id
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.is_hidden = false
    and cp.deleted_at is null
    and cp.media_mime_type like 'video/%'
    and public.can_view_community_post_v2(cp.id);

  if owner_id is null then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  select *
  into reveal_row
  from public.igpat_community_reveals reveal
  where reveal.post_id = p_post_id
    and reveal.enabled = true;

  if not found then
    return jsonb_build_object(
      'configured', false,
      'is_owner', actor = owner_id
    );
  end if;

  with participants as (
    select rx.user_id
    from public.reactions rx
    where rx.post_id = p_post_id
      and rx.user_id <> owner_id

    union

    select cm.user_id
    from public.comments cm
    where cm.post_id = p_post_id
      and cm.user_id <> owner_id
      and cm.is_hidden = false
      and cm.deleted_at is null

    union

    select child.user_id
    from public.community_posts child
    join public.buklod_community_post_meta meta
      on meta.post_id = child.id
    where meta.context_config #>> '{igpat_relay,parent_post_id}' = p_post_id::text
      and child.user_id is not null
      and child.user_id <> owner_id
      and child.is_reel = true
      and child.is_hidden = false
      and child.deleted_at is null
      and child.media_mime_type like 'video/%'
      and child.audience = parent_audience
      and child.group_id is not distinct from parent_group_id
      and child.church_id is not distinct from parent_church_id
      and child.scope_id is not distinct from parent_scope_id
  )
  select count(distinct user_id)::integer
  into participant_count
  from participants;

  participant_count := coalesce(participant_count, 0);
  unlocked := participant_count >= reveal_row.target_count;

  return jsonb_build_object(
    'configured', true,
    'is_owner', actor = owner_id,
    'enabled', reveal_row.enabled,
    'target_count', reveal_row.target_count,
    'meaningful_count', participant_count,
    'remaining_count', greatest(reveal_row.target_count - participant_count, 0),
    'unlocked', unlocked,
    'reveal_text', case
      when actor = owner_id or unlocked then reveal_row.reveal_text
      else null
    end
  );
end;
$$;

revoke all on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) from public;
revoke all on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) from anon;
grant execute on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) to authenticated;
grant execute on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) to service_role;

revoke all on function public.create_buklod_reel_v3(text,uuid,text,text,text,bigint,numeric,jsonb,uuid,text) from public;
revoke all on function public.create_buklod_reel_v3(text,uuid,text,text,text,bigint,numeric,jsonb,uuid,text) from anon;
grant execute on function public.create_buklod_reel_v3(text,uuid,text,text,text,bigint,numeric,jsonb,uuid,text) to authenticated;
grant execute on function public.create_buklod_reel_v3(text,uuid,text,text,text,bigint,numeric,jsonb,uuid,text) to service_role;

revoke all on function public.get_buklod_igpat_feed_v3(text,integer) from public;
revoke all on function public.get_buklod_igpat_feed_v3(text,integer) from anon;
grant execute on function public.get_buklod_igpat_feed_v3(text,integer) to authenticated;
grant execute on function public.get_buklod_igpat_feed_v3(text,integer) to service_role;

revoke all on function public.get_buklod_igpat_edit_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_edit_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_edit_v1(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_edit_v1(uuid) to service_role;

revoke all on function public.get_buklod_igpat_relay_chain_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_relay_chain_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_relay_chain_v1(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_relay_chain_v1(uuid) to service_role;

revoke all on function public.set_buklod_igpat_reveal_v1(uuid,integer,text,boolean) from public;
revoke all on function public.set_buklod_igpat_reveal_v1(uuid,integer,text,boolean) from anon;
grant execute on function public.set_buklod_igpat_reveal_v1(uuid,integer,text,boolean) to authenticated;
grant execute on function public.set_buklod_igpat_reveal_v1(uuid,integer,text,boolean) to service_role;

revoke all on function public.get_buklod_igpat_reveal_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_reveal_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_reveal_v1(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_reveal_v1(uuid) to service_role;
