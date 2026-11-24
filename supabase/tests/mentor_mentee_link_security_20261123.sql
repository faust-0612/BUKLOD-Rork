-- Read-only structural security regression for the mentee link workflow.
-- Execute on an isolated staging DB after the matching migration (not live).
do $$
declare
  tbl oid := to_regclass('public.buklod_mentor_mentee_link_requests_v1');
  f_request oid := to_regprocedure('public.request_my_mentee_link_v1(text)');
  f_self oid := to_regprocedure('public.get_my_mentee_link_requests_v1()');
  f_queue oid := to_regprocedure('public.admin_pending_mentee_link_requests_v1()');
  f_review oid := to_regprocedure('public.admin_review_mentee_link_request_v1(uuid,uuid,boolean,text)');
  definition text;
begin
  if tbl is null or f_request is null or f_self is null
    or f_queue is null or f_review is null then
    raise exception 'Mentee request schema/functions missing';
  end if;
  if not (select relrowsecurity from pg_class where oid=tbl) then
    raise exception 'Mentee request queue must have RLS enabled';
  end if;
  if has_table_privilege('authenticated', tbl, 'SELECT')
    or has_table_privilege('authenticated', tbl, 'INSERT')
    or has_table_privilege('authenticated', tbl, 'UPDATE')
    or has_table_privilege('authenticated', tbl, 'DELETE') then
    raise exception 'Clients must not access private mentee request table directly';
  end if;
  if has_function_privilege('anon', f_request, 'EXECUTE')
    or has_function_privilege('anon', f_self, 'EXECUTE')
    or has_function_privilege('anon', f_queue, 'EXECUTE')
    or has_function_privilege('anon', f_review, 'EXECUTE') then
    raise exception 'Anonymous clients must not execute mentee-link RPCs';
  end if;
  if not has_function_privilege('authenticated', f_request, 'EXECUTE')
    or not has_function_privilege('authenticated', f_self, 'EXECUTE')
    or not has_function_privilege('authenticated', f_queue, 'EXECUTE')
    or not has_function_privilege('authenticated', f_review, 'EXECUTE') then
    raise exception 'Authenticated RPC grants missing';
  end if;
  definition := pg_get_functiondef(f_request);
  if position('public.has_capability' in definition)=0
    or position('pg_advisory_xact_lock' in definition)=0
    or position('>= 5' in definition)=0 then
    raise exception 'Mentor authority/rate/idempotency guard missing';
  end if;
  definition := pg_get_functiondef(f_self);
  if position('r.mentor_id=actor' in replace(definition,' ',''))=0 then
    raise exception 'Mentor request read must be actor-scoped';
  end if;
  definition := pg_get_functiondef(f_review);
  if position('public.is_system_admin' in definition)=0
    or position('for update' in lower(definition))=0
    or position('public.has_capability' in definition)=0
    or position('public.mentor_assignments' in definition)=0 then
    raise exception 'Admin authorization/locking/verified linking missing';
  end if;
end;
$$;
