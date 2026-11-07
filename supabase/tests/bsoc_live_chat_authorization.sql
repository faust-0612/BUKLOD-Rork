-- BSOC live-chat authorization regression. Execute after the BSOC migrations.
-- Read-only assertions inside an explicit transaction; no account or case records are altered.
begin;
do $bsoc_test$
begin
  if to_regclass('public.bsoc_case_messages') is null
     or to_regclass('public.bsoc_case_attachments') is null
     or to_regclass('public.bsoc_personnel_invites_v1') is null then
    raise exception 'BSOC support migrations are missing';
  end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='bsoc_case_messages' and c.relrowsecurity
  ) or not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='bsoc_case_attachments' and c.relrowsecurity
  ) then
    raise exception 'BSOC message/evidence RLS is required';
  end if;
  if has_table_privilege('anon','public.bsoc_case_messages','SELECT')
     or has_table_privilege('anon','public.bsoc_case_attachments','SELECT')
     or has_table_privilege('anon','public.bsoc_personnel_invites_v1','SELECT') then
    raise exception 'Anonymous BSOC case or invitation visibility must be denied';
  end if;
  if has_table_privilege('authenticated','public.bsoc_case_messages','UPDATE')
     or has_table_privilege('authenticated','public.bsoc_case_messages','DELETE')
     or has_table_privilege('authenticated','public.bsoc_case_attachments','DELETE') then
    raise exception 'BSOC support receipts/evidence must be append-only';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='bsoc_case_messages' and policyname='bsoc_case_messages_post'
  ) or not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='bsoc_case_attachments' and policyname='bsoc_attachments_insert'
  ) then
    raise exception 'BSOC authenticated case and evidence policies are absent';
  end if;
end;
$bsoc_test$;
rollback;
