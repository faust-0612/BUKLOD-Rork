-- Allow Supabase Auth user deletion without FK failures while preserving shared/audit records.
-- Existing CASCADE / SET NULL relationships are left untouched.
-- Legacy NO ACTION / RESTRICT references are converted to SET NULL.
-- Protected official System Admin deletion remains blocked by its profile guard trigger.

do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      con.conname,
      a.attname as column_name
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    join unnest(con.conkey) with ordinality ck(attnum,ord) on true
    join pg_attribute a on a.attrelid=c.oid and a.attnum=ck.attnum
    where con.contype='f'
      and con.confrelid='auth.users'::regclass
      and n.nspname='public'
      and con.confdeltype in ('a','r')
      and cardinality(con.conkey)=1
  loop
    execute format(
      'alter table %I.%I alter column %I drop not null',
      r.schema_name,r.table_name,r.column_name
    );

    execute format(
      'alter table %I.%I drop constraint %I',
      r.schema_name,r.table_name,r.conname
    );

    execute format(
      'alter table %I.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      r.schema_name,r.table_name,r.conname,r.column_name
    );
  end loop;
end
$$;
