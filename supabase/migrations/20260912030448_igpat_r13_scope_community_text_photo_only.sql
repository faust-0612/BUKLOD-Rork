-- IGPAT R13: reserve exact-scope Community creation for text + still photos.
-- Historical video/GIF rows remain readable. New video publishing belongs to BUKLOD IGPAT.

create or replace function public.buklod_scope_social_create_post_v1(
    p_scope_id uuid,
    p_body text,
    p_category text default 'discussion'::text,
    p_media_path text default null::text,
    p_media_mime_type text default null::text,
    p_media_size_bytes bigint default null::bigint,
    p_duration_seconds numeric default null::numeric,
    p_is_reel boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_user uuid := (select auth.uid());
    v_scope_type text;
    v_body text := nullif(btrim(coalesce(p_body, '')), '');
    v_category text := lower(coalesce(nullif(btrim(p_category), ''), 'discussion'));
    v_mime text := lower(coalesce(p_media_mime_type, ''));
    v_id uuid;
begin
    if v_user is null then
        raise exception 'Authentication required';
    end if;

    select s.scope_type
    into v_scope_type
    from public.buklod_scopes s
    where s.id = p_scope_id;

    if v_scope_type not in ('ORGANIZATION', 'CLUSTER') then
        raise exception 'Exclusive Community posting is available only for Organization/Sub-organization and Cluster scopes';
    end if;

    if not public.buklod_scope_social_can_access(p_scope_id) then
        raise exception 'Active membership in this exact Community is required';
    end if;

    if coalesce(p_is_reel, false) then
        raise exception 'Videos are published through BUKLOD IGPAT';
    end if;

    if v_mime like 'video/%' then
        raise exception 'Videos are published through BUKLOD IGPAT';
    end if;

    if v_mime = 'image/gif' then
        raise exception 'GIF posting is not available in Community';
    end if;

    if p_media_path is not null and (v_mime = '' or v_mime not like 'image/%') then
        raise exception 'Community attachments must be still photos';
    end if;

    if v_body is null and p_media_path is null then
        raise exception 'Write a post or attach a photo';
    end if;

    if v_category not in (
        'reflection', 'testimony', 'encouragement',
        'prayer_update', 'discussion', 'announcement'
    ) then
        v_category := 'discussion';
    end if;

    if v_mime like 'image/%'
       and coalesce(p_media_size_bytes, 0) > 10485760 then
        raise exception 'Images must be 10 MB or smaller';
    end if;

    if p_media_path is not null then
        if split_part(p_media_path, '/', 1) <> 'scope'
           or split_part(p_media_path, '/', 2) <> p_scope_id::text
           or split_part(p_media_path, '/', 3) <> v_user::text then
            raise exception 'Invalid exact-scope media path';
        end if;
    end if;

    insert into public.community_posts (
        user_id,
        group_id,
        church_id,
        scope_id,
        audience,
        category,
        body,
        media_path,
        media_mime_type,
        media_size_bytes,
        media_duration_seconds,
        is_reel,
        is_hidden
    )
    values (
        v_user,
        null,
        null,
        p_scope_id,
        'scope',
        v_category,
        coalesce(v_body, 'Shared photos.'),
        p_media_path,
        p_media_mime_type,
        p_media_size_bytes,
        null,
        false,
        false
    )
    returning id into v_id;

    return v_id;
end;
$function$;
