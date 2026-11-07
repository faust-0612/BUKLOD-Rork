-- Run only after additive BUKLOD Living Greetings migration in an isolated database.
-- Privacy, schema and scheduler checks are read-only and rolled back.
begin;
do $assert$
begin
 if to_regclass('public.buklod_living_greeting_preferences_v1') is null
    or to_regclass('private.buklod_living_greeting_events_v1') is null
    or to_regclass('private.buklod_living_greeting_delivery_v1') is null then
   raise exception 'Living greetings schema missing';
 end if;
 if not exists(select 1 from pg_class where oid='public.buklod_living_greeting_preferences_v1'::regclass and relrowsecurity)
  or not exists(select 1 from pg_class where oid='private.buklod_living_greeting_delivery_v1'::regclass and relrowsecurity) then
   raise exception 'Living greetings RLS missing';
 end if;
 if has_table_privilege('anon','public.buklod_living_greeting_preferences_v1','SELECT')
    or has_table_privilege('authenticated','private.buklod_living_greeting_delivery_v1','SELECT') then
   raise exception 'Living greetings sensitive data exposed';
 end if;
 if not exists (select 1 from pg_policies
   where schemaname='public' and tablename='buklod_living_greeting_preferences_v1'
   and policyname='living_greeting_own_update') then
   raise exception 'Account-owner birthday privacy policy missing';
 end if;
 if has_function_privilege('anon','public.buklod_my_living_greetings_v1()','EXECUTE')
    or has_function_privilege('anon','public.buklod_set_my_birthday_sharing_v1(boolean)','EXECUTE') then
   raise exception 'Anonymous birthday API exposure';
 end if;
 if not exists(select 1 from pg_trigger
   where tgrelid='public.buklod_scope_memberships'::regclass
     and tgname='buklod_living_member_welcome_v1' and not tgisinternal) then
   raise exception 'Canonical Cluster/Organization welcome trigger missing';
 end if;
 if not exists(select 1 from pg_trigger
   where tgrelid='public.kl_episodes'::regclass
     and tgname='buklod_living_kl_release_trigger_v1' and not tgisinternal) then
   raise exception 'Approved KL episode release trigger missing';
 end if;
 if not exists(select 1 from cron.job where jobname='buklod-living-greetings-daily-v1')
    or not exists(select 1 from cron.job where jobname='buklod-living-greetings-dispatch-v1') then
   raise exception 'Scheduled daily and bounded delivery jobs missing';
 end if;
end;
$assert$;
rollback;
