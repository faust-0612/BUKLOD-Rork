-- BUKLOD_PERMISSION_SNAPSHOT_R1 security hardening.
-- Supabase default function privileges may grant anon EXECUTE explicitly.
-- The snapshot is for authenticated current-user presentation checks only.

revoke execute on function public.buklod_my_permission_snapshot_v1() from anon;
revoke all on function public.buklod_my_permission_snapshot_v1() from public;
grant execute on function public.buklod_my_permission_snapshot_v1() to authenticated;
grant execute on function public.buklod_my_permission_snapshot_v1() to service_role;
