-- Read-only SQL security assertions. Run AFTER staging SOS migration.
-- Does not send alerts, access private coordinates, or create sample users.
DO $sos_rescue_security$
BEGIN
  IF to_regprocedure('public.buklod_help_get_rescue_coordinates(uuid)') IS NULL
    OR to_regprocedure('public.buklod_help_get_emergency_for_viewer(uuid)') IS NULL
    OR to_regprocedure('public.buklod_help_refresh_opted_in_presence(double precision,double precision)') IS NULL
    OR to_regprocedure('public.buklod_help_register_emergency_channel(text)') IS NULL
  THEN
    RAISE EXCEPTION 'SOS rescue RPCs not installed';
  END IF;

  IF has_table_privilege('authenticated','public.buklod_help_requests','INSERT')
    OR has_table_privilege('authenticated','public.buklod_help_requests','UPDATE')
    OR has_table_privilege('authenticated','public.buklod_help_responses','INSERT')
    OR has_table_privilege('authenticated','public.buklod_help_presence','UPDATE')
  THEN
    RAISE EXCEPTION 'Unsafe direct SOS write privilege remains';
  END IF;

  IF has_function_privilege('anon','public.buklod_help_get_rescue_coordinates(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.buklod_help_get_emergency_for_viewer(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.buklod_help_refresh_opted_in_presence(double precision,double precision)','EXECUTE')
    OR has_function_privilege('anon','public.buklod_help_register_emergency_channel(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Anonymous SOS rescue RPC access remains';
  END IF;

  IF NOT has_function_privilege('authenticated','public.buklod_help_get_rescue_coordinates(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.buklod_help_get_emergency_for_viewer(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.buklod_help_refresh_opted_in_presence(double precision,double precision)','EXECUTE')
  THEN
    RAISE EXCEPTION 'SOS responder functions unavailable to authenticated users';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN ('buklod_help_requests','buklod_help_responses','buklod_help_presence')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'SOS protected table row level security disabled';
  END IF;
END;
$sos_rescue_security$;
