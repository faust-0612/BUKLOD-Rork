-- Staging-only DB contract test. Run AFTER the two DEV migrations.
-- Must not mutate production or any stored user comment/health record.
begin;
do $verify$
declare
  v_ddl text;
  v_idx text;
begin
  if to_regprocedure('public.add_buklod_post_comment_v5(uuid,text,text,uuid)') is null then
    raise exception 'Missing idempotent Wall comment RPC v5';
  end if;
  if to_regprocedure('public.add_buklod_post_comment_v4(uuid,text,uuid)') is null then
    raise exception 'Old v4 public comment contract was removed';
  end if;
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='comments'
      and c.column_name='client_request_key' and c.is_nullable='YES'
  ) then
    raise exception 'Missing nullable client request key; old v4 clients must continue to work';
  end if;
  select indexdef into v_idx
  from pg_indexes
  where schemaname='public' and tablename='comments'
    and indexname='comments_author_request_key_v1';
  if v_idx is null
     or position('UNIQUE INDEX' in upper(v_idx))=0
     or position('(user_id, client_request_key)' in v_idx)=0
  then
    raise exception 'Missing unique, per-author idempotency index';
  end if;
  if has_function_privilege('anon','public.add_buklod_post_comment_v5(uuid,text,text,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.add_buklod_post_comment_v5(uuid,text,text,uuid)','EXECUTE')
  then
    raise exception 'Wall comment v5 RPC must be authenticated-only';
  end if;

  select pg_get_functiondef(
    'public.add_buklod_post_comment_v5(uuid,text,text,uuid)'::regprocedure
  ) into v_ddl;
  if position('auth.uid()' in v_ddl)=0
     or position('can_view_community_post_v2' in v_ddl)=0
     or position('on conflict do nothing' in lower(v_ddl))=0
     or position('client_request_key' in v_ddl)=0
  then
    raise exception 'Wall comment auth, visibility or retry contract missing';
  end if;

  if to_regprocedure('public.buklod_bsoc_process_closed_loop_v1(integer)') is null then
    raise exception 'BSOC closed-loop recovery processor missing';
  end if;
  select pg_get_functiondef(
    'public.buklod_bsoc_process_closed_loop_v1(integer)'::regprocedure
  ) into v_ddl;
  if position('he.repeat_count < 3' in v_ddl)=0
     or position('he.privacy_classification' in v_ddl)=0
     or position('SECURITY_REVIEW_REQUIRED' in v_ddl)=0
     or position('REMOTE_RECOVERY_RUNNING' in v_ddl)=0
  then
    raise exception 'BSOC weak-signal gate or security/remote recovery coverage missing';
  end if;
end
$verify$;
rollback;
