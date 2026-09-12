-- IGPAT R14: close the legacy 7-argument scoped Community media bypass
-- while preserving backward compatibility for older authenticated clients.

create or replace function public.buklod_scope_social_create_post_v1(
    p_scope_id uuid,
    p_body text,
    p_category text default 'discussion'::text,
    p_media_path text default null::text,
    p_media_mime_type text default null::text,
    p_media_size_bytes bigint default null::bigint,
    p_duration_seconds numeric default null::numeric
)
returns uuid
language plpgsql
security invoker
set search_path to ''
as $function$
begin
    return public.buklod_scope_social_create_post_v1(
        p_scope_id,
        p_body,
        p_category,
        p_media_path,
        p_media_mime_type,
        p_media_size_bytes,
        p_duration_seconds,
        false
    );
end;
$function$;

-- Authenticated app clients keep compatibility. Anonymous callers never need
-- direct Community mutation RPC access; the function also retains auth guards.
revoke all on function public.buklod_scope_social_create_post_v1(uuid, text, text, text, text, bigint, numeric) from public;
revoke all on function public.buklod_scope_social_create_post_v1(uuid, text, text, text, text, bigint, numeric) from anon;
grant execute on function public.buklod_scope_social_create_post_v1(uuid, text, text, text, text, bigint, numeric) to authenticated, service_role;

revoke all on function public.buklod_scope_social_create_post_v1(uuid, text, text, text, text, bigint, numeric, boolean) from public;
revoke all on function public.buklod_scope_social_create_post_v1(uuid, text, text, text, text, bigint, numeric, boolean) from anon;
grant execute on function public.buklod_scope_social_create_post_v1(uuid, text, text, text, text, bigint, numeric, boolean) to authenticated, service_role;
