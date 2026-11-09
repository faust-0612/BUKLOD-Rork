-- BUKLOD Nov09 consolidated read-only schema and restricted scheduler regression.
do $buklod_nov09_test$
begin
  if not exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='buklod_music_library'
        and column_name='category' and column_default like '%others%') then
    raise exception 'Music virtual category missing or defaults incorrectly';
  end if;
  if not exists(select 1 from pg_constraint
    where conrelid='public.buklod_music_library'::regclass
      and conname='buklod_music_library_category_check') then
    raise exception 'Music category allowlist check missing';
  end if;
  if not exists(select 1 from pg_indexes
    where schemaname='public' and tablename='buklod_music_library'
      and indexname='buklod_music_category_browse_idx') then
    raise exception 'Category browse index absent';
  end if;
  if not exists(select 1 from pg_proc
    where pronamespace='private'::regnamespace
      and proname='buklod_living_dispatch_batch_v1'
      and prosecdef=true) then
    raise exception 'Private bounded greeting dispatcher missing';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.proname='buklod_living_dispatch_batch_v1' and n.nspname='public') then
    raise exception 'Greeting dispatcher must not be in exposed public schema';
  end if;
  if not exists(select 1 from cron.job where jobname='buklod-living-greetings-dispatch-v1'
      and active and command like '%private.buklod_living_dispatch_batch_v1(6,100)%') then
    raise exception 'Single bounded dispatcher cron not active';
  end if;
end;
$buklod_nov09_test$;
