-- Read-only postdeploy verification: never display tokens or modify money.
do $security$
declare v_check oid:=to_regprocedure('public.buklod_authorize_admob_cron_token_v1(text)');
        v_send oid:=to_regprocedure('private.buklod_admob_internal_cron_dispatch_v1()');
begin
  if v_check is null or v_send is null then raise exception 'AdMob Cron bridge missing'; end if;
  if has_function_privilege('anon',v_check,'EXECUTE')
     or has_function_privilege('authenticated',v_check,'EXECUTE')
     or not has_function_privilege('service_role',v_check,'EXECUTE')
     or has_function_privilege('anon',v_send,'EXECUTE')
     or has_function_privilege('authenticated',v_send,'EXECUTE')
     or has_function_privilege('service_role',v_send,'EXECUTE') then
    raise exception 'AdMob cron bridge privileged function ACL failure';
  end if;
  if has_table_privilege('anon','private.buklod_admob_internal_cron_auth_v1','SELECT')
     or has_table_privilege('authenticated','private.buklod_admob_internal_cron_auth_v1','SELECT') then
    raise exception 'AdMob cron auth digest publicly readable';
  end if;
  if not exists(select 1 from vault.secrets where name='BUKLOD_ADMOB_INTERNAL_SCHEDULER_KEY')
     or not exists(select 1 from private.buklod_admob_internal_cron_auth_v1) then
    raise exception 'AdMob cron credential was not created securely';
  end if;
  if public.buklod_authorize_admob_cron_token_v1('0000000000000000000000000000000000000000000000000000000000000000') then
    raise exception 'Unprivileged cron token incorrectly accepted';
  end if;
end;
$security$;
