revoke all on table public.buklod_account_recovery_requests from anon, authenticated;
grant select, insert, update, delete on table public.buklod_account_recovery_requests to service_role;
