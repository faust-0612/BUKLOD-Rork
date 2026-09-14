-- BUKLOD IGPAT R53-R54 — PENDING RELEASE SQL
-- Not a migration filename. Apply/fold through the authorized release migration step.
-- Internal share reuses BUKLOD Connect; original IGPAT access remains authoritative.

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
        or (cp.audience = 'local' and cp.church_id is not null and viewer.church_id = cp.church_id)
        or (cp.audience = 'group' and cp.group_id is not null and exists (
          select 1 from public.group_members gm
          where gm.group_id = cp.group_id
            and gm.user_id = p_user_id
            and gm.is_active = true
        ))
        or (cp.audience = 'scope' and cp.scope_id is not null and public.buklod_scope_can_access_v1(cp.scope_id, p_user_id))
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
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.first_name), ''), nullif(trim(p.username), ''), 'BUKLOD Member'),
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
    case when nullif(trim(coalesce(post_body, '')), '') is not null
      then E'\n' || left(trim(post_body), 220)
      else '' end,
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
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.first_name), ''), nullif(trim(p.username), ''), 'BUKLOD Member'),
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
     and not (post_audience = 'scope' and post_scope_id is not distinct from p_scope_id) then
    raise exception 'Only Public IGPATs or IGPATs from this exact Scope can be shared to this room';
  end if;

  message_body := concat(
    'BUKLOD IGPAT · ', creator_name,
    case when nullif(trim(coalesce(post_body, '')), '') is not null
      then E'\n' || left(trim(post_body), 220)
      else '' end,
    E'\nhttps://buklod.expo.app/post/', p_post_id::text
  );

  insert into public.buklod_connect_scope_messages(scope_id, sender_id, body)
  values(p_scope_id, actor, message_body)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.igpat_can_user_view_post_v1(uuid,uuid) from public;
revoke all on function public.igpat_can_user_view_post_v1(uuid,uuid) from anon;
grant execute on function public.igpat_can_user_view_post_v1(uuid,uuid) to authenticated;
grant execute on function public.igpat_can_user_view_post_v1(uuid,uuid) to service_role;

revoke all on function public.share_buklod_igpat_to_direct_v1(uuid,uuid) from public;
revoke all on function public.share_buklod_igpat_to_direct_v1(uuid,uuid) from anon;
grant execute on function public.share_buklod_igpat_to_direct_v1(uuid,uuid) to authenticated;
grant execute on function public.share_buklod_igpat_to_direct_v1(uuid,uuid) to service_role;

revoke all on function public.share_buklod_igpat_to_scope_v1(uuid,uuid) from public;
revoke all on function public.share_buklod_igpat_to_scope_v1(uuid,uuid) from anon;
grant execute on function public.share_buklod_igpat_to_scope_v1(uuid,uuid) to authenticated;
grant execute on function public.share_buklod_igpat_to_scope_v1(uuid,uuid) to service_role;
