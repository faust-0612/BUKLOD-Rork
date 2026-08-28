SELECT jsonb_build_object(
  'create_def', (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_buklod_attendance_event'
    LIMIT 1
  ),
  'list_active_def', (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'list_buklod_active_attendance_events'
    LIMIT 1
  ),
  'independent_open_def', (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'attendance_get_independent_open_events'
    LIMIT 1
  ),
  'independent_create_def', (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'attendance_create_independent_event'
    LIMIT 1
  )
) AS defs;
