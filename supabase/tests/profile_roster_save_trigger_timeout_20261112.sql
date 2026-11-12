-- Run AFTER the companion migration on an isolated DB/rollback-safe session.
-- Verifies the exact server-side trigger and eligibility gate, without editing user data.
begin;
do $roster_latency_test$
declare
  body text;
  roster_trigger text;
begin
  select pg_get_functiondef('public.buklod_classroom_roster_profile_arrival_sync_v1()'::regprocedure) into body;
  if position('elsif v_score >= 0.97 then' in body)=0 or
     position('v_second := 0;' in body)=0 then
    raise exception 'Roster competitor scan not protected by strict-fuzzy threshold';
  end if;
  if position('PROFILE_SYNC_USERNAME_EXACT' in body)=0 or
     position('PROFILE_SYNC_OFFICIAL_TOKEN_EXACT' in body)=0 or
     position('PROFILE_SYNC_OFFICIAL_STRICT_FUZZY' in body)=0 or
     position('(v_score-v_second) >= 0.15' in body)=0 then
    raise exception 'Classroom exact, token or strict-fuzzy matching changed';
  end if;
  if position('buklod_education_enrollments' in body)=0 or
     position('buklod_classroom_roster_intents_v1' in body)=0 then
    raise exception 'Classroom enrollment or review logic missing';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid='public.buklod_classroom_roster_profile_arrival_sync_v1()'::regprocedure) then
    raise exception 'Classroom roster trigger privileges changed';
  end if;
  select pg_get_triggerdef(t.oid) into roster_trigger
  from pg_trigger t where t.tgrelid='public.profiles'::regclass and t.tgname='buklod_classroom_roster_profile_identity_change_sync_r5' and not t.tgisinternal;
  if roster_trigger is null or position('old.full_name IS DISTINCT FROM new.full_name' in roster_trigger)=0 then
    raise exception 'Identity change trigger missing or no longer skips identical names';
  end if;
  raise notice 'BUKLOD Profile roster latency trigger contract PASS';
end $roster_latency_test$;
rollback;
