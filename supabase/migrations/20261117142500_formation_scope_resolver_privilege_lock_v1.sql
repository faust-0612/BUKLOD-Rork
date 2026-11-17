-- Keep cluster-resolution details behind the authenticated canonical submission RPCs.
-- This helper accepts a user_id and must not be callable as a standalone Data API RPC.
revoke all on function public.buklod_resolve_auto_submission_scope_v1(text,uuid)
from public,anon,authenticated;
grant execute on function public.buklod_resolve_auto_submission_scope_v1(text,uuid)
to service_role;
