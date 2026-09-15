-- BUKLOD CITY WEB R1C
-- Supabase may preserve explicit anon EXECUTE grants independently of PUBLIC.
-- City RPCs are authenticated-only; revoke anon explicitly.

revoke execute on function public.buklod_city_can_view_presence_v1(uuid, uuid, text, uuid[]) from anon;
revoke execute on function public.buklod_city_map_snapshot_v1() from anon;
revoke execute on function public.buklod_city_set_presence_v1(double precision, double precision, text, text, uuid, integer, uuid[]) from anon;
revoke execute on function public.buklod_city_set_scope_location_v1(uuid, double precision, double precision, text, text) from anon;
revoke execute on function public.buklod_city_stop_presence_v1() from anon;

grant execute on function public.buklod_city_can_view_presence_v1(uuid, uuid, text, uuid[]) to authenticated;
grant execute on function public.buklod_city_map_snapshot_v1() to authenticated;
grant execute on function public.buklod_city_set_presence_v1(double precision, double precision, text, text, uuid, integer, uuid[]) to authenticated;
grant execute on function public.buklod_city_set_scope_location_v1(uuid, double precision, double precision, text, text) to authenticated;
grant execute on function public.buklod_city_stop_presence_v1() to authenticated;
