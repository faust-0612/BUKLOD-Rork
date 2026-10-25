-- Preserve existing Android 1.3.2 RPC names while enforcing leadership authorization.
-- This migration deliberately does not revoke authenticated EXECUTE on legacy endpoints.
-- It changes only the entry authorization of report v1/v2/v3, retaining existing report bodies.
DO $guard$
DECLARE
  fn text;
  olddef text;
  newdef text;
  anchor text := E'begin\n';
  guard text := E'begin\n  if auth.uid() is null or p_scope_id is null or not (\n    public.buklod_is_exact_scope_admin_v1(p_scope_id, auth.uid())\n    or exists (\n      select 1 from public.buklod_scopes s\n      join public.buklod_scope_role_assignments ra on ra.scope_id = s.id\n      where s.id = p_scope_id and s.scope_type = ''CLUSTER''\n        and s.status not in (''SUSPENDED'', ''DELETED'')\n        and ra.user_id = auth.uid() and ra.status = ''ACTIVE''\n        and upper(ra.role_key) in (''ADMIN'', ''CLUSTER_ADMIN'', ''CLUSTER_HEAD'', ''PASTOR'', ''MENTOR'')\n    )\n    or (\n      exists (select 1 from public.buklod_scopes s where s.id = p_scope_id and s.scope_type = ''CLUSTER'' and s.status not in (''SUSPENDED'', ''DELETED''))\n      and public.buklod_user_has_functional_approver_role(p_scope_id, auth.uid())\n    )\n  ) then\n    raise exception ''Not authorized to view this scope report'' using errcode = ''42501'';\n  end if;\n';
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'buklod_scope_faith_monitoring_summary_v1',
    'buklod_scope_faith_monitoring_summary_v2',
    'buklod_scope_faith_monitoring_summary_v3'
  ] LOOP
    SELECT pg_get_functiondef(p.oid) INTO olddef
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = fn
      AND pg_get_function_identity_arguments(p.oid) = 'p_scope_id uuid';
    IF olddef IS NULL THEN RAISE EXCEPTION 'Missing report function %', fn; END IF;
    IF position('Not authorized to view this scope report' in olddef) > 0 THEN
      CONTINUE;
    END IF;
    IF position(anchor in olddef) = 0 THEN
      RAISE EXCEPTION 'Unexpected report function structure: %', fn;
    END IF;
    IF position('SECURITY DEFINER' in upper(olddef)) = 0 THEN
      RAISE EXCEPTION 'Unexpected security mode for report function: %', fn;
    END IF;
    newdef := overlay(olddef placing guard from position(anchor in olddef) for length(anchor));
    EXECUTE newdef;
  END LOOP;
END;
$guard$;
