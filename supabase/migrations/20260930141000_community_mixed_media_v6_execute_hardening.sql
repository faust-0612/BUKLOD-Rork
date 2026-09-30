-- BUKLOD COMMUNITY MIXED MEDIA V6 EXECUTE HARDENING
-- Keep v6 callable only by authenticated app users.

revoke all on function public.set_buklod_post_media_v6(uuid,jsonb) from public;
revoke all on function public.set_buklod_post_media_v6(uuid,jsonb) from anon;
revoke all on function public.set_buklod_post_media_v6(uuid,jsonb) from authenticated;
grant execute on function public.set_buklod_post_media_v6(uuid,jsonb) to authenticated;
