-- Public community identity photos are not private profile details.
-- Preserve signed-in access, active accounts, exact-UUID lookup and the
-- existing private profile RLS / detail authorization. Return only avatar URL.
create or replace function public.get_buklod_profile_avatars_v1(p_user_ids uuid[])
returns table(user_id uuid, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id, p.avatar_url
  from public.profiles as p
  where (select auth.uid()) is not null
    and p.id = any(coalesce(p_user_ids, array[]::uuid[]))
    and p.is_active = true;
$function$;

revoke execute on function public.get_buklod_profile_avatars_v1(uuid[]) from public, anon;
grant execute on function public.get_buklod_profile_avatars_v1(uuid[]) to authenticated, service_role;
