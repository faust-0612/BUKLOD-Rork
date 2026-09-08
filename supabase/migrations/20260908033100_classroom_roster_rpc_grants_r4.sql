-- Least-privilege grants for faculty-facing roster RPCs.
revoke all on function public.buklod_classroom_roster_pending_v1(uuid) from public, anon;
grant execute on function public.buklod_classroom_roster_pending_v1(uuid) to authenticated;
revoke all on function public.buklod_classroom_roster_confirm_match_v1(uuid,uuid) from public, anon;
grant execute on function public.buklod_classroom_roster_confirm_match_v1(uuid,uuid) to authenticated;
