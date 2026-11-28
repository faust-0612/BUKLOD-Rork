-- DEV candidate; apply only after isolated SQL QA and release authorization.
begin;
create or replace function public.get_buklod_supreme_authority_v1(p_user_ids uuid[])
returns table(user_id uuid)
language sql stable security definer set search_path to ''
as $fn$
 select p.id
 from public.profiles p
 where (select auth.uid()) is not null
 and pg_catalog.cardinality(p_user_ids) between 1 and 40
 and p.id=any(p_user_ids)
 and p.is_active=true
 and p.role='system_admin'::public.app_role
 and private.buklod_is_platform_official_v1(p.id);
$fn$;
revoke all on function public.get_buklod_supreme_authority_v1(uuid[]) from public,anon,authenticated;
grant execute on function public.get_buklod_supreme_authority_v1(uuid[]) to authenticated;
commit;
