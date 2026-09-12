-- BUKLOD IGPAT R9: expose every active Cluster the signed-in user may publish to.
-- The create RPC already validates the selected group_id against active membership;
-- this read helper removes the client-side single-group assumption without widening table access.

create or replace function public.get_my_active_igpat_groups_v1()
returns table(
  group_id uuid,
  group_name text,
  group_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    g.id,
    g.name::text,
    g.code::text
  from public.group_members gm
  join public.buklod_groups g
    on g.id = gm.group_id
  where gm.user_id = actor
    and gm.is_active = true
    and g.is_active = true
  order by lower(coalesce(g.name, '')),
           g.created_at,
           g.id;
end;
$$;

revoke all on function public.get_my_active_igpat_groups_v1() from public;
revoke all on function public.get_my_active_igpat_groups_v1() from anon;
grant execute on function public.get_my_active_igpat_groups_v1() to authenticated;
grant execute on function public.get_my_active_igpat_groups_v1() to service_role;
