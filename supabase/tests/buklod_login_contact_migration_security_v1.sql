-- Run against a disposable production-equivalent database ONLY, never live.
-- This contract deliberately does not create users, send messages or delete data.
begin;
do $$
declare n int;
begin
  if to_regclass('public.buklod_login_contact_challenges_v1') is null then
    raise exception 'Verified contact challenge table missing';
  end if;
  if to_regclass('private.buklod_login_contact_policy_v1') is null then
    raise exception 'Contact migration policy missing';
  end if;
  if to_regclass('private.buklod_contact_notice_delivery_v1') is null then
    raise exception 'Outbound notice audit table missing';
  end if;
  if to_regclass('private.buklod_dormancy_cases_v1') is null then
    raise exception 'Protected dormant case table missing';
  end if;
  if (select monitoring_enabled or automatic_deletion_enabled from private.buklod_dormancy_policy_v1 where singleton) then
    raise exception 'Dormant account deletion or monitoring unexpectedly live';
  end if;
  if (select legacy_reminders_enabled or external_reminders_enabled from private.buklod_login_contact_policy_v1 where singleton) then
    raise exception 'External messages unexpectedly enabled';
  end if;
  if exists(
    select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace
    where s.nspname in ('public','private')
    and c.relname in ('buklod_login_contact_challenges_v1','buklod_dormancy_cases_v1',
       'buklod_contact_notice_delivery_v1')
    and not c.relrowsecurity
  ) then raise exception 'Sensitive contact/case table has RLS disabled'; end if;
  if has_table_privilege('anon','public.buklod_login_contact_challenges_v1','SELECT')
     or has_table_privilege('authenticated','public.buklod_login_contact_challenges_v1','SELECT')
     or has_table_privilege('authenticated','private.buklod_contact_notice_delivery_v1','SELECT') then
    raise exception 'Sensitive contact data accessible to members or anonymous users';
  end if;
  if has_function_privilege('authenticated',
     'public.buklod_complete_legacy_login_contact_v1(uuid,text,text,uuid)','EXECUTE') then
    raise exception 'Unsafe direct profile mutation RPC exposure';
  end if;
  select count(*) into n from pg_trigger
    where tgname='buklod_reject_new_username_signup_v1'
      and tgrelid='auth.users'::regclass and tgenabled <> 'D';
  if n<>1 then raise exception 'Old-client signup must be protected by active auth trigger'; end if;
end $$;
rollback;
