-- BUKLOD Quiz R10 backend security parity: DEV-only candidate, NOT APPLIED.
-- Dedicated project audited 2026-11-07: anon=false, authenticated=true,
-- service_role=true for all three functions. Main currently anon=true.
-- Apply ONLY after RC preflight and owner-approved migration gate.
-- This changes EXECUTE grants only; no function body, identity, data, or
-- live source database modifications. Source role privileges are the model.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.buklod_quiz_faculty_live_room_v2(uuid)') IS NULL
     OR to_regprocedure('public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[])') IS NULL
     OR to_regprocedure('public.buklod_quiz_live_control_v3(uuid,text)') IS NULL
  THEN
    RAISE EXCEPTION 'BUKLOD Quiz security parity: expected signatures missing; abort';
  END IF;
END
$preflight$;

REVOKE EXECUTE ON FUNCTION public.buklod_quiz_faculty_live_room_v2(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buklod_quiz_live_control_v3(uuid,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_live_room_v2(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_control_v3(uuid,text) TO authenticated, service_role;

DO $verify$
DECLARE
  signature text;
  fn regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
      'public.buklod_quiz_faculty_live_room_v2(uuid)',
      'public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[])',
      'public.buklod_quiz_live_control_v3(uuid,text)'
  ] LOOP
    fn := to_regprocedure(signature);
    IF fn IS NULL
       OR has_function_privilege('anon',fn,'EXECUTE')
       OR NOT has_function_privilege('authenticated',fn,'EXECUTE')
       OR NOT has_function_privilege('service_role',fn,'EXECUTE')
    THEN
      RAISE EXCEPTION 'BUKLOD Quiz security parity failure: %',signature;
    END IF;
  END LOOP;
END
$verify$;

COMMIT;
