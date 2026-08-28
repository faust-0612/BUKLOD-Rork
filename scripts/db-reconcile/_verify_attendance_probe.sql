SELECT jsonb_build_object(
  'attendance_rpcs', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'proname', p.proname,
      'args', pg_get_function_identity_arguments(p.oid)
    ) ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname ILIKE '%attendance%'
  ),
  'attendance_events_exists', to_regclass('public.attendance_events') IS NOT NULL,
  'attendance_events_columns', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'column_name', column_name,
      'data_type', data_type
    ) ORDER BY ordinal_position), '[]'::jsonb)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_events'
  ),
  'recent_events', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    FROM (
      SELECT id, scope_id, title, is_active, created_at, starts_at
      FROM public.attendance_events
      ORDER BY created_at DESC NULLS LAST
      LIMIT 8
    ) x
  )
) AS attendance_probe;
