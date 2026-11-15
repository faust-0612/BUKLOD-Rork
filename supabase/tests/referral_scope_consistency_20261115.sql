-- Read-only SQL contract assertions for referral/Community migration. Runs after migrations.
BEGIN;
DO $assert$
DECLARE
 v_suggestion text;
BEGIN
 IF to_regprocedure('public.suggest_buklod_referral_targets_v1(text,integer)') IS NULL
 THEN RAISE EXCEPTION 'Canonical suggestion function missing'; END IF;
 IF to_regprocedure('public.buklod_record_referral_verified_v2(text)') IS NULL
 THEN RAISE EXCEPTION 'Verified idempotent attribution function missing'; END IF;
 IF to_regprocedure('public.get_my_buklod_community_destinations_v1()') IS NULL
 THEN RAISE EXCEPTION 'Destination read function missing'; END IF;
 IF to_regprocedure('public.set_my_buklod_community_destination_v1(uuid)') IS NULL
 THEN RAISE EXCEPTION 'Destination write function missing'; END IF;
 IF has_function_privilege('anon','public.buklod_record_referral_verified_v2(text)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous referral write permission leaked'; END IF;
 IF has_function_privilege('anon','public.set_my_buklod_community_destination_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous destination update permission leaked'; END IF;
 IF NOT has_function_privilege('authenticated','public.buklod_record_referral_verified_v2(text)','EXECUTE')
 THEN RAISE EXCEPTION 'Authenticated referral write permission absent'; END IF;
 IF NOT has_function_privilege('authenticated','public.set_my_buklod_community_destination_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Authenticated destination update permission absent'; END IF;
 IF to_regprocedure('private.buklod_official_referral_guard_v1()') IS NULL
 THEN RAISE EXCEPTION 'Official referral protection missing'; END IF;
 SELECT pg_get_functiondef('public.set_my_buklod_community_destination_v1(uuid)'::regprocedure)
 INTO v_suggestion;
 IF position('v_previous.locked_until>v_now' IN v_suggestion)=0
 THEN RAISE EXCEPTION 'Community destination switch lock removed'; END IF;
END $assert$;
ROLLBACK;
