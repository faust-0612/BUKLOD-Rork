-- SECURITY CRITICAL: legacy generic point-credit RPC is not an earning endpoint.
-- It accepts arbitrary user_id, amount, activity_type and source_key; only trusted
-- SECURITY DEFINER backend functions / service role may invoke it. This revocation
-- does not affect existing ledger rows and does not require modifying a balance.
revoke all on function public.buklod_award_verification_points_v1(
 uuid,integer,text,text,uuid,text,uuid) from public,anon,authenticated;
comment on function public.buklod_award_verification_points_v1(
 uuid,integer,text,text,uuid,text,uuid)
is 'Privileged internal verification credit only; client roles intentionally cannot execute';

-- No alternate verified-attendance direct credit path should be reachable by clients.
revoke all on function public.buklod_award_scope_attendance_points_v1(
 uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.buklod_reverse_scope_attendance_points_v1(
 uuid,uuid,timestamptz,uuid) from public,anon,authenticated;

-- Kingdom legacy result RPCs accept client-declared win/score without server game
-- replay verification. These cannot be trusted to mint Kingdom XP/collectibles.
-- The active 39-game in-app pilot writes account-isolated local previews only.
-- Retain trusted server-role access for a future validated engine integration.
revoke execute on function public.submit_my_buklod_kingdom_result_v1(
 text,text,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.submit_my_buklod_kingdom_result_v2(
 text,text,text,integer,integer,integer) from public,anon,authenticated;

comment on function public.submit_my_buklod_kingdom_result_v2(
 text,text,text,integer,integer,integer)
is 'Internal-only until server-side game outcome validation prevents forged XP and collectible awards';
