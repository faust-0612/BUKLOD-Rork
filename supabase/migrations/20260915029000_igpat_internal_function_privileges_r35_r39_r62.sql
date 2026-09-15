-- BUKLOD IGPAT R35/R39/R62 — internal function privilege hardening.
-- Client applications use the public Arena RPCs, not internal membership helpers
-- or trigger entry points. Restrict these internal functions to service_role.

revoke all on function public.igpat_is_active_squad_member_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.igpat_is_active_squad_member_v1(uuid,uuid) to service_role;

revoke all on function public.buklod_igpat_notify_squad_member_v1() from public,anon,authenticated;
revoke all on function public.buklod_igpat_notify_squad_match_v1() from public,anon,authenticated;
revoke all on function public.buklod_igpat_notify_lms_participant_v1() from public,anon,authenticated;
revoke all on function public.buklod_igpat_notify_lms_round_v1() from public,anon,authenticated;

grant execute on function public.buklod_igpat_notify_squad_member_v1() to service_role;
grant execute on function public.buklod_igpat_notify_squad_match_v1() to service_role;
grant execute on function public.buklod_igpat_notify_lms_participant_v1() to service_role;
grant execute on function public.buklod_igpat_notify_lms_round_v1() to service_role;
