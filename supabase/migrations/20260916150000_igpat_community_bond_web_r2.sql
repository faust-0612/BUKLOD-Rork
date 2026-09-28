-- BUKLOD IGPAT WEB R2 — Community + Relay + Share + Bond
-- Additive/backward-compatible subset of the approved IGPAT R17+/R24/R25/R53/R54 contracts.
-- Deliberately excludes Arena, Reveal, Captions, Analytics, Monetization, and native release work.

create or replace function public.get_buklod_igpat_edit_v1(p_post_id uuid)
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
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.can_view_community_post_v2(p_post_id) then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  select cp.igpat_edit_meta into result
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.deleted_at is null
    and cp.is_hidden = false;

  return result;
end;
$$;

create or replace function public.get_buklod_igpat_relay_chain_v1(p_post_id uuid)
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
  if actor is null then raise exception 'Authentication required'; end if;

  if not exists(
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

  if requested_root_text ~ uuid_pattern and exists(
    select 1
    from public.community_posts root_post
    where root_post.id = requested_root_text::uuid
      and root_post.is_reel = true
      and root_post.is_hidden = false
      and root_post.deleted_at is null
      and root_post.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(root_post.id)
  ) then
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
      meta.context_config #>> '{igpat_relay,depth}' as depth_text
    from public.community_posts cp
    join public.profiles author on author.id = cp.user_id
    left join public.buklod_community_post_meta meta on meta.post_id = cp.id
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
      case when raw.parent_text ~ uuid_pattern then raw.parent_text::uuid else null end as raw_parent_id,
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

create or replace function public.igpat_can_user_view_post_v1(
  p_post_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_posts cp
    join public.profiles viewer on viewer.id = p_user_id
    where cp.id = p_post_id
      and viewer.is_active = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and coalesce(cp.author_only, false) = false
      and (
        public.buklod_community_root_owner_v1(cp.id) = p_user_id
        or cp.audience = 'public'
        or (
          cp.audience = 'local'
          and cp.church_id is not null
          and viewer.church_id = cp.church_id
        )
        or (
          cp.audience = 'group'
          and cp.group_id is not null
          and exists (
            select 1
            from public.group_members gm
            where gm.group_id = cp.group_id
              and gm.user_id = p_user_id
              and gm.is_active = true
          )
        )
        or (
          cp.audience = 'scope'
          and cp.scope_id is not null
          and public.buklod_scope_can_access_v1(cp.scope_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.share_buklod_igpat_to_direct_v1(
  p_post_id uuid,
  p_conversation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  recipient uuid;
  creator_name text;
  post_body text;
  message_body text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.can_view_community_post_v2(p_post_id) then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  select case when c.user_low = actor then c.user_high else c.user_low end
    into recipient
  from public.direct_conversations c
  where c.id = p_conversation_id
    and (c.user_low = actor or c.user_high = actor);

  if recipient is null then raise exception 'Conversation is unavailable'; end if;
  if not public.igpat_can_user_view_post_v1(p_post_id, recipient) then
    raise exception 'This person cannot currently view the original IGPAT';
  end if;

  select
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.first_name), ''),
      nullif(trim(p.username), ''),
      'BUKLOD Member'
    ),
    cp.body
  into creator_name, post_body
  from public.community_posts cp
  join public.profiles p on p.id = cp.user_id
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.media_mime_type like 'video/%';

  if creator_name is null then raise exception 'IGPAT was not found'; end if;

  message_body := concat(
    'BUKLOD IGPAT · ', creator_name,
    case
      when nullif(trim(coalesce(post_body, '')), '') is not null
        then E'\n' || left(trim(post_body), 220)
      else ''
    end,
    E'\nhttps://buklod.expo.app/post/', p_post_id::text
  );

  return public.send_direct_message_v3(
    p_conversation_id,
    message_body,
    null,
    null,
    null,
    null
  );
end;
$$;

create or replace function public.share_buklod_igpat_to_scope_v1(
  p_post_id uuid,
  p_scope_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  post_audience text;
  post_scope_id uuid;
  creator_name text;
  post_body text;
  message_body text;
  new_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.can_view_community_post_v2(p_post_id) then
    raise exception 'IGPAT is unavailable for this account';
  end if;
  if not public.buklod_connect_can_use_scope_room(p_scope_id) then
    raise exception 'Connect room is unavailable for this account';
  end if;

  select
    cp.audience,
    cp.scope_id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.first_name), ''),
      nullif(trim(p.username), ''),
      'BUKLOD Member'
    ),
    cp.body
  into post_audience, post_scope_id, creator_name, post_body
  from public.community_posts cp
  join public.profiles p on p.id = cp.user_id
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.is_hidden = false
    and cp.deleted_at is null
    and cp.media_mime_type like 'video/%';

  if creator_name is null then raise exception 'IGPAT was not found'; end if;
  if post_audience <> 'public'
     and not (
       post_audience = 'scope'
       and post_scope_id is not distinct from p_scope_id
     ) then
    raise exception 'Only Public IGPATs or IGPATs from this exact Scope can be shared to this room';
  end if;

  message_body := concat(
    'BUKLOD IGPAT · ', creator_name,
    case
      when nullif(trim(coalesce(post_body, '')), '') is not null
        then E'\n' || left(trim(post_body), 220)
      else ''
    end,
    E'\nhttps://buklod.expo.app/post/', p_post_id::text
  );

  insert into public.buklod_connect_scope_messages(scope_id, sender_id, body)
  values(p_scope_id, actor, message_body)
  returning id into new_id;

  return new_id;
end;
$$;

-- Harden the already-live Bond action subsystem. Existing v1 callers remain compatible.
create or replace function public.igpat_create_bond_v2(
  p_kind text,
  p_post_id uuid,
  p_target_id uuid default null,
  p_message text default null,
  p_unlock_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_kind text := lower(trim(coalesce(p_kind, '')));
  safe_message text := left(coalesce(p_message, ''), 1200);
  new_id uuid;
  post_audience text;
  post_group_id uuid;
  post_church_id uuid;
  post_scope_id uuid;
  post_author_only boolean;
  post_owner_id uuid;
  target_church_id uuid;
  target_active boolean;
  target_can_access boolean := false;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if safe_kind not in ('relay', 'pass', 'capsule', 'mosaic', 'memory_echo') then
    raise exception 'Invalid Bond type';
  end if;

  select
    cp.audience,
    cp.group_id,
    cp.church_id,
    cp.scope_id,
    coalesce(cp.author_only, false),
    cp.user_id
  into
    post_audience,
    post_group_id,
    post_church_id,
    post_scope_id,
    post_author_only,
    post_owner_id
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.is_hidden = false
    and cp.deleted_at is null
    and cp.media_mime_type like 'video/%'
    and public.can_view_community_post_v2(cp.id);

  if post_owner_id is null then raise exception 'IGPAT is unavailable for this account'; end if;
  if safe_kind in ('pass', 'capsule') and p_target_id is null then
    raise exception 'A recipient is required';
  end if;

  if p_target_id is not null then
    select p.church_id, coalesce(p.is_active, false)
      into target_church_id, target_active
    from public.profiles p
    where p.id = p_target_id;

    if not coalesce(target_active, false) then raise exception 'Recipient is not active'; end if;

    target_can_access := case
      when p_target_id = actor then true
      when post_author_only then p_target_id = post_owner_id
      when post_audience = 'public' then true
      when post_audience = 'local'
        then post_church_id is not null and target_church_id = post_church_id
      when post_audience = 'group'
        then post_group_id is not null and exists(
          select 1
          from public.group_members gm
          where gm.group_id = post_group_id
            and gm.user_id = p_target_id
            and gm.is_active = true
        )
      when post_audience = 'scope'
        then post_scope_id is not null and public.buklod_scope_can_access_v1(post_scope_id, p_target_id)
      else false
    end;

    if not target_can_access then raise exception 'Recipient cannot access this IGPAT'; end if;
  end if;

  if safe_kind = 'capsule' then
    if p_unlock_at is null or p_unlock_at <= now() + interval '1 minute' then
      raise exception 'Capsule opening time must be in the future';
    end if;
    if p_unlock_at > now() + interval '730 days' then
      raise exception 'Capsule opening time is too far in the future';
    end if;
  elsif safe_kind <> 'memory_echo' then
    p_unlock_at := null;
  end if;

  insert into public.igpat_bond_actions(
    actor_user_id,
    kind,
    post_id,
    target_id,
    message,
    unlock_at,
    status
  )
  values(
    actor,
    safe_kind,
    p_post_id,
    p_target_id,
    safe_message,
    p_unlock_at,
    'ACTIVE'
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.igpat_create_bond_v1(
  p_kind text,
  p_post_id uuid,
  p_target_id uuid default null,
  p_message text default null,
  p_unlock_at timestamptz default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.igpat_create_bond_v2(
    p_kind,
    p_post_id,
    p_target_id,
    p_message,
    p_unlock_at
  );
$$;

create or replace function public.igpat_create_capsule_v2(
  p_post_id uuid,
  p_target_id uuid,
  p_message text default null,
  p_unlock_at timestamptz default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.igpat_create_bond_v2(
    'capsule',
    p_post_id,
    p_target_id,
    p_message,
    p_unlock_at
  );
$$;

create or replace function public.igpat_create_pass_v2(
  p_post_id uuid,
  p_target_id uuid,
  p_message text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.igpat_create_bond_v2(
    'pass',
    p_post_id,
    p_target_id,
    p_message,
    null
  );
$$;

drop policy if exists igpat_bond_visible on public.igpat_bond_actions;
create policy igpat_bond_visible
on public.igpat_bond_actions
for select
to authenticated
using (
  actor_user_id = (select auth.uid())
  or (
    target_id = (select auth.uid())
    and (
      kind <> 'capsule'
      or (unlock_at is not null and unlock_at <= now())
    )
  )
);

revoke insert, update, delete, truncate on table public.igpat_bond_actions from anon;
revoke insert, update, delete, truncate on table public.igpat_bond_actions from authenticated;

create or replace function public.igpat_get_bond_inbox_v2(p_limit integer default 80)
returns table(
  id uuid,
  kind text,
  post_id uuid,
  actor_user_id uuid,
  actor_name text,
  target_id uuid,
  message text,
  unlock_at timestamptz,
  status text,
  created_at timestamptz,
  locked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(p_limit, 80), 1), 200);
begin
  if actor is null then raise exception 'Authentication required'; end if;

  return query
  select
    action.id,
    action.kind,
    action.post_id,
    action.actor_user_id,
    coalesce(nullif(trim(profile.full_name), ''), 'BUKLOD Member')::text,
    action.target_id,
    case
      when action.actor_user_id = actor then action.message
      when action.kind = 'capsule'
       and action.unlock_at is not null
       and action.unlock_at > now()
        then null
      else action.message
    end,
    action.unlock_at,
    action.status,
    action.created_at,
    (
      action.kind = 'capsule'
      and action.actor_user_id <> actor
      and action.unlock_at is not null
      and action.unlock_at > now()
    )
  from public.igpat_bond_actions action
  join public.profiles profile on profile.id = action.actor_user_id
  where action.status in ('ACTIVE', 'OPENED')
    and (action.actor_user_id = actor or action.target_id = actor)
    and public.can_view_community_post_v2(action.post_id)
  order by action.created_at desc, action.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.get_buklod_igpat_edit_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_edit_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_edit_v1(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_edit_v1(uuid) to service_role;

revoke all on function public.get_buklod_igpat_relay_chain_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_relay_chain_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_relay_chain_v1(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_relay_chain_v1(uuid) to service_role;

revoke all on function public.igpat_can_user_view_post_v1(uuid, uuid) from public;
revoke all on function public.igpat_can_user_view_post_v1(uuid, uuid) from anon;
grant execute on function public.igpat_can_user_view_post_v1(uuid, uuid) to authenticated;
grant execute on function public.igpat_can_user_view_post_v1(uuid, uuid) to service_role;

revoke all on function public.share_buklod_igpat_to_direct_v1(uuid, uuid) from public;
revoke all on function public.share_buklod_igpat_to_direct_v1(uuid, uuid) from anon;
grant execute on function public.share_buklod_igpat_to_direct_v1(uuid, uuid) to authenticated;
grant execute on function public.share_buklod_igpat_to_direct_v1(uuid, uuid) to service_role;

revoke all on function public.share_buklod_igpat_to_scope_v1(uuid, uuid) from public;
revoke all on function public.share_buklod_igpat_to_scope_v1(uuid, uuid) from anon;
grant execute on function public.share_buklod_igpat_to_scope_v1(uuid, uuid) to authenticated;
grant execute on function public.share_buklod_igpat_to_scope_v1(uuid, uuid) to service_role;

revoke all on function public.igpat_create_bond_v2(text, uuid, uuid, text, timestamptz) from public;
revoke all on function public.igpat_create_bond_v2(text, uuid, uuid, text, timestamptz) from anon;
grant execute on function public.igpat_create_bond_v2(text, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.igpat_create_bond_v2(text, uuid, uuid, text, timestamptz) to service_role;

revoke all on function public.igpat_create_bond_v1(text, uuid, uuid, text, timestamptz) from public;
revoke all on function public.igpat_create_bond_v1(text, uuid, uuid, text, timestamptz) from anon;
grant execute on function public.igpat_create_bond_v1(text, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.igpat_create_bond_v1(text, uuid, uuid, text, timestamptz) to service_role;

revoke all on function public.igpat_create_capsule_v2(uuid, uuid, text, timestamptz) from public;
revoke all on function public.igpat_create_capsule_v2(uuid, uuid, text, timestamptz) from anon;
grant execute on function public.igpat_create_capsule_v2(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.igpat_create_capsule_v2(uuid, uuid, text, timestamptz) to service_role;

revoke all on function public.igpat_create_pass_v2(uuid, uuid, text) from public;
revoke all on function public.igpat_create_pass_v2(uuid, uuid, text) from anon;
grant execute on function public.igpat_create_pass_v2(uuid, uuid, text) to authenticated;
grant execute on function public.igpat_create_pass_v2(uuid, uuid, text) to service_role;

revoke all on function public.igpat_get_bond_inbox_v2(integer) from public;
revoke all on function public.igpat_get_bond_inbox_v2(integer) from anon;
grant execute on function public.igpat_get_bond_inbox_v2(integer) to authenticated;
grant execute on function public.igpat_get_bond_inbox_v2(integer) to service_role;
