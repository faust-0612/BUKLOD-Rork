-- BUKLOD IGPAT R53/R54 — internal share-helper privilege hardening.
-- Clients share through share_buklod_igpat_to_direct_v1 / _to_scope_v1.
-- The arbitrary-recipient visibility helper is internal and must not be exposed
-- as a user-enumeration/privacy oracle.

revoke all on function public.igpat_can_user_view_post_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.igpat_can_user_view_post_v1(uuid,uuid) to service_role;
