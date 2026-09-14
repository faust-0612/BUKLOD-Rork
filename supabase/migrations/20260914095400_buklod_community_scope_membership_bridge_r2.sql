-- Internal bridge used by the anonymous-feed ranking wrapper.
-- Keep it private so it cannot become a membership enumeration surface.

begin;

create or replace function public.buklod_scope_user_is_member_v1(
  p_scope_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.buklod_scope_has_active_membership_v1(p_scope_id,p_user_id)
$$;

revoke all on function public.buklod_scope_user_is_member_v1(uuid,uuid)
  from public,anon,authenticated;

commit;
