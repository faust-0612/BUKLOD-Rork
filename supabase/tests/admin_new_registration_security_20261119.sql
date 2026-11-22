-- New-member admin inbox: read-only database security / regression assertions.
-- No real users are created, changed, deleted or notified.
begin;
do $test$
declare
  v_list oid := to_regprocedure('public.buklod_admin_recent_registrations_v1(integer,timestamptz,uuid)');
  v_detail oid := to_regprocedure('public.buklod_admin_registration_detail_v1(uuid)');
  v_notify oid := to_regprocedure('private.buklod_notify_admin_new_registration_v1()');
  v_found boolean;
begin
  if v_list is null or v_detail is null or v_notify is null then
    raise exception 'BUKLOD admin registration inbox RPC/trigger missing';
  end if;
  if has_function_privilege('anon',v_list,'EXECUTE') or
     has_function_privilege('anon',v_detail,'EXECUTE') or
     has_function_privilege('authenticated',v_notify,'EXECUTE') then
    raise exception 'BUKLOD admin new-user data or private notifier exposed to unprivileged access';
  end if;
  if position('buklod_is_system_admin' in pg_get_functiondef(v_list))=0 or
     position('buklod_is_system_admin' in pg_get_functiondef(v_detail))=0 then
    raise exception 'BUKLOD admin registration RPC lost server-side role validation';
  end if;
  if position('new.id::text' in pg_get_functiondef(v_notify))=0 or
     position('new.full_name' in pg_get_functiondef(v_notify))>0 or
     position('new.mobile' in pg_get_functiondef(v_notify))>0 then
    raise exception 'BUKLOD new-user notification leaked private fields';
  end if;
  select exists(
    select 1 from pg_trigger where tgrelid='public.profiles'::regclass
      and tgname='buklod_notify_admin_new_registration_v1' and not tgisinternal
  ) into v_found;
  if not v_found then
    raise exception 'BUKLOD new member alert trigger missing';
  end if;
  -- Unknown subject must not read another member's private info.
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  begin
    perform public.buklod_admin_recent_registrations_v1(5,null,null);
    raise exception 'Unauthorized registration list exposed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.buklod_admin_registration_detail_v1('11111111-1111-4111-8111-111111111111');
    raise exception 'Unauthorized registration detail exposed';
  exception when insufficient_privilege then null; end;
end;
$test$;
rollback;
