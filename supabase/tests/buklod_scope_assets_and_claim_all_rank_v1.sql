-- Read-only production smoke contract for the exact applied scope asset/claim migrations.
-- No storage writes, no artificial user claims, and no changes to financial data.
begin;
do $contract$
declare c int;
declare fn text;
declare sources text;
begin
 select count(*) into c from information_schema.columns
 where table_schema='public' and (
   (table_name='buklod_cluster_events' and column_name in ('media_path','media_mime_type'))
   or (table_name='buklod_cluster_home_notices' and column_name in ('media_path','media_mime_type'))
   or (table_name='buklod_cluster_resources' and column_name in ('storage_path','original_name','mime_type'))
   or (table_name='buklod_scopes' and column_name='profile_photo_path')
 );
 if c<>8 then raise exception 'Expected 8 additive scope media columns, got %',c; end if;

 if not exists(select 1 from storage.buckets
   where id='buklod-scope-home-assets' and public=false and file_size_limit=104857600) then
   raise exception 'Missing private scoped asset bucket';
 end if;
 select count(*) into c from pg_policies
 where schemaname='storage' and tablename='objects'
 and policyname in ('buklod_scope_home_assets_read_v1',
   'buklod_scope_home_assets_admin_insert_v1','buklod_scope_home_assets_admin_delete_v1');
 if c<>3 then raise exception 'Missing one or more scope asset RLS policies'; end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
   and policyname='buklod_scope_home_assets_admin_insert_v1'
   and with_check like '%buklod_is_scope_admin%') then
   raise exception 'Private scope insert must require server-admin role';
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
   and policyname='buklod_scope_home_assets_read_v1'
   and qual like '%buklod_scope_social_can_access%') then
   raise exception 'Media select must verify scope membership';
 end if;
 select pg_get_functiondef(oid) into fn from pg_proc
 where pronamespace='public'::regnamespace
   and proname='claim_all_my_buklod_reward_events';
 if fn is null or position('first_claim_ledger' in fn)=0
   or position('ledger_crossing' in fn)=0
   or position('claim_all_crossing' in fn)<>0 then
   raise exception 'Claim All rank must have a ledger-backed permitted crossing';
 end if;
 if not exists(select 1 from pg_constraint
   where conrelid='public.buklod_rank_history'::regclass
   and conname='buklod_rank_history_achievement_source_check'
   and pg_get_constraintdef(oid) like '%ledger_crossing%') then
   raise exception 'Missing rank-history source whitelist';
 end if;
 if not exists(select 1 from supabase_migrations.schema_migrations
   where version='20261108114034') or not exists(
   select 1 from supabase_migrations.schema_migrations where version='20261108120757'
 ) then raise exception 'Applied scope media / claim migration not recorded'; end if;
end;
$contract$;
rollback;
