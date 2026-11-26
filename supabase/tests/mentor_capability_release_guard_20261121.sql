-- Run only after both 20261121 mentor migrations on an isolated PostgreSQL database.
-- Read-only structural/permission negative assertions; real actor-context and
-- concurrent grant/revoke integration tests remain mandatory before production.
begin;
do $mentor_gate$
declare
  v_def text;
begin
  if to_regclass('private.buklod_mentor_capability_audit_v1') is null then
    raise exception 'Private mentor capability audit table missing';
  end if;
  if not exists (
    select 1 from pg_class
    where oid='private.buklod_mentor_capability_audit_v1'::regclass
      and relrowsecurity
  ) then raise exception 'Mentor audit RLS not enabled'; end if;
  if has_table_privilege('authenticated','private.buklod_mentor_capability_audit_v1','SELECT')
    or has_table_privilege('anon','private.buklod_mentor_capability_audit_v1','SELECT') then
    raise exception 'Private mentor capability audit readable by client';
  end if;
  if to_regprocedure('public.admin_set_mentor_capability_v1(uuid,boolean,text,uuid)') is null then
    raise exception 'Audited System Admin mentor permission RPC missing';
  end if;
  if has_function_privilege('anon',
       'public.admin_set_mentor_capability_v1(uuid,boolean,text,uuid)','EXECUTE') then
    raise exception 'Anonymous users can invoke mentor grants';
  end if;
  if not has_function_privilege('authenticated',
       'public.admin_set_mentor_capability_v1(uuid,boolean,text,uuid)','EXECUTE') then
    raise exception 'Authenticated System Admin cannot reach guarded mentor RPC';
  end if;
  select pg_get_functiondef('public.admin_set_mentor_capability_v1(uuid,boolean,text,uuid)'::regprocedure)
    into v_def;
  if position('public.is_system_admin()' in v_def)=0
    or position('buklod_foundation_protected_principals' in v_def)=0
    or position('pg_advisory_xact_lock' in v_def)=0
    or position('buklod_mentor_capability_audit_v1' in v_def)=0
    or position('p_request_key' in v_def)=0 then
    raise exception 'Role review missing required authorization, audit or idempotency guard';
  end if;
  if not exists (select 1 from pg_trigger
      where tgrelid='public.user_capabilities'::regclass
        and tgname='buklod_guard_protected_mentor_capability_v1' and not tgisinternal) then
    raise exception 'Protected capability mutation trigger absent';
  end if;
  if not exists (select 1 from pg_trigger
      where tgrelid='public.mentor_assignments'::regclass
        and tgname='buklod_guard_active_mentor_assignment_v1' and not tgisinternal) then
    raise exception 'Active relationship permission trigger absent';
  end if;
  select pg_get_functiondef('public.get_my_mentor_reportable_lessons_r2()'::regprocedure)
    into v_def;
  if position('public.has_capability(actor,''mentor'')' in v_def)=0
    or position('l.lesson_number::text' in v_def)=0 then
    raise exception 'Track/lesson catalog or mentor authorization contract missing';
  end if;
  raise notice 'Isolated mentor/CCP5 database contract PASS';
end;
$mentor_gate$;
rollback;
