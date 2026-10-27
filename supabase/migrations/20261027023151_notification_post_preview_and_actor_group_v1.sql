CREATE OR REPLACE FUNCTION public.notify_new_community_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_name text;
  member_record record;
  post_excerpt text;
  post_summary text;
begin
  -- Plain-text, bounded preview; never include media URLs or attachment keys.
  post_excerpt := btrim(regexp_replace(coalesce(new.body, ''), '[[:space:]]+', ' ', 'g'));
  if post_excerpt <> '' then
    post_summary := left(post_excerpt, 120) ||
      case when char_length(post_excerpt) > 120 then '…' else '' end;
  elsif coalesce(new.media_mime_type, '') like 'video/%' then
    post_summary := 'Shared a video';
  elsif coalesce(new.media_path, '') <> '' then
    post_summary := 'Shared a photo';
  else
    post_summary := 'Shared a post';
  end if;

  -- New exact-scope posts use scope_id rather than legacy group_id.
  -- Never notify for local/public/hidden/author-only rows here.
  if new.group_id is null then
    if new.audience is distinct from 'scope'
       or new.scope_id is null
       or new.is_hidden is distinct from false
       or new.deleted_at is not null
       or coalesce(new.author_only, false) then
      return new;
    end if;

    -- Exact scope only: no Organization/Cluster parent-child inheritance.
    if not exists (
      select 1 from public.buklod_scopes s
      where s.id = new.scope_id
        and s.status = 'ACTIVE'
        and s.scope_type in ('ORGANIZATION', 'CLUSTER')
    ) then
      return new;
    end if;

    select coalesce(nullif(p.full_name, ''), 'A BUKLOD member')
      into actor_name
    from public.profiles p
    where p.id = new.user_id;

    for member_record in
      select m.user_id
      from public.buklod_scope_memberships m
      join public.profiles recipient
        on recipient.id = m.user_id
       and recipient.is_active = true
      where m.scope_id = new.scope_id
        and m.membership_status = 'ACTIVE'
        and m.user_id <> new.user_id
        and not exists (
          select 1
          from public.notifications n
          where n.user_id = m.user_id
            and n.kind = 'community_post'
            and n.data ->> 'post_id' = new.id::text
        )
    loop
      perform public.queue_notification(
        member_record.user_id,
        'New post from ' || left(actor_name, 80),
        post_summary,
        'community_post',
        jsonb_build_object(
          'post_id', new.id,
          'scope_id', new.scope_id,
          'actor_id', new.user_id
        )
      );
    end loop;

    return new;
  end if;

  -- Legacy group path is intentionally unchanged.
  select coalesce(nullif(p.full_name, ''), 'A BUKLOD member')
    into actor_name
  from public.profiles p
  where p.id = new.user_id;

  for member_record in
    select gm.user_id
    from public.group_members gm
    where gm.group_id = new.group_id
      and gm.is_active = true
      and gm.user_id <> new.user_id
  loop
    perform public.queue_notification(
      member_record.user_id,
      'New post from ' || left(actor_name, 80),
      post_summary,
      'community_post',
      jsonb_build_object(
        'post_id', new.id,
        'group_id', new.group_id,
        'actor_id', new.user_id
      )
    );
  end loop;

  return new;
end;
$function$
;
