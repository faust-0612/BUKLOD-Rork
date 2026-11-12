-- Read-only BSOC GPT integration release contract; no user data or secrets.
-- The Edge Function itself is tested separately for auth/header/fallback behavior.
-- The access-control RPC and private case infrastructure must remain protected.
begin;
do $bsoc_gpt_perm$
begin
  if to_regprocedure('public.buklod_bsoc_can(text)') is null then
    raise exception 'Missing BSOC server-side permission checker';
  end if;
  if has_function_privilege('anon', 'public.buklod_bsoc_can(text)', 'EXECUTE') then
    raise exception 'Anonymous callers must not invoke BSOC authorization RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.buklod_bsoc_can(text)', 'EXECUTE') then
    raise exception 'Authenticated callers must be able to verify own BSOC rights';
  end if;
  if to_regclass('public.bsoc_case_messages') is null
     or to_regclass('public.user_feedback') is null then
    raise exception 'BSOC case infrastructure unavailable';
  end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='bsoc_case_messages' and c.relrowsecurity
  ) then
    raise exception 'BSOC support messages require RLS';
  end if;
  if has_table_privilege('anon','public.bsoc_case_messages','SELECT') then
    raise exception 'Anonymous access to private BSOC support messages denied';
  end if;
end;
$bsoc_gpt_perm$;
rollback;
