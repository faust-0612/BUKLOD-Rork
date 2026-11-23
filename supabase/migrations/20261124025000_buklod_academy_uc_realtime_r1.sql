-- Realtime is opt-in for verified Academy UC only (no public user data).
-- RLS remains own-row. Feature OFF disables insertion; app subscribes only when enabled.
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
   and not exists(select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public'
       and tablename='buklod_university_uc_ledger') then
  alter publication supabase_realtime add table public.buklod_university_uc_ledger;
 end if;
end;
$$;
