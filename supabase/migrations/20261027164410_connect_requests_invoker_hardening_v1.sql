-- Use the existing participant-scoped RLS policies on both direct tables.
-- Authenticated callers still see only their own request thread IDs.
alter function public.buklod_connect_message_requests_v1() security invoker;
