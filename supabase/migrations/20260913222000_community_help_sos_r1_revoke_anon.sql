-- BUKLOD Community Help / Emergency SOS R1 hardening
-- Authenticated users may call safety RPCs; anonymous callers may not enter them.

revoke all on function public.buklod_help_distance_km(double precision,double precision,double precision,double precision) from anon;
revoke all on function public.buklod_help_distance_km(double precision,double precision,double precision,double precision) from public;
revoke all on function public.buklod_help_update_presence(double precision,double precision,boolean) from anon;
revoke all on function public.buklod_help_disable_presence() from anon;
revoke all on function public.buklod_help_create_request(text,text,text,double precision,double precision) from anon;
revoke all on function public.buklod_help_list_nearby(integer) from anon;
revoke all on function public.buklod_help_respond(uuid,text) from anon;
revoke all on function public.buklod_help_resolve(uuid,text) from anon;

grant execute on function public.buklod_help_update_presence(double precision,double precision,boolean) to authenticated;
grant execute on function public.buklod_help_disable_presence() to authenticated;
grant execute on function public.buklod_help_create_request(text,text,text,double precision,double precision) to authenticated;
grant execute on function public.buklod_help_list_nearby(integer) to authenticated;
grant execute on function public.buklod_help_respond(uuid,text) to authenticated;
grant execute on function public.buklod_help_resolve(uuid,text) to authenticated;
