-- Read-only gate. Run after deploying the admin RPC ACL migration
-- and after future migrations that create/replace privileged functions.
-- Any returned row is a release blocker until reviewed.
SELECT p.proname AS exposed_function,
       pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND p.proname LIKE 'admin\_%' ESCAPE '\'
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY p.proname, signature;
