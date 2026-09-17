-- BUKLOD SOS Release Performance R3
-- Targeted to the emergency-help path only. No behavior or authorization change.

-- Emergency fan-out reads only recent users who explicitly enabled nearby
-- safety alerts. A partial timestamp index keeps this scan bounded as the
-- presence table grows.
create index if not exists buklod_help_presence_safety_recent_idx
  on public.buklod_help_presence (updated_at desc)
  where safety_alerts_enabled = true;

-- The response PK starts with request_id, so responder-centric FK / history
-- operations need their own leading responder_id index.
create index if not exists buklod_help_responses_responder_idx
  on public.buklod_help_responses (responder_id, updated_at desc);

-- Keep the exact existing ownership semantics while evaluating auth.uid()
-- once per statement rather than once per row.
alter policy buklod_help_presence_own
  on public.buklod_help_presence
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy buklod_help_requests_creator_insert
  on public.buklod_help_requests
  with check (creator_id = (select auth.uid()));

alter policy buklod_help_requests_creator_select
  on public.buklod_help_requests
  using (creator_id = (select auth.uid()));

alter policy buklod_help_requests_creator_update
  on public.buklod_help_requests
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

alter policy buklod_help_responses_own_select
  on public.buklod_help_responses
  using (responder_id = (select auth.uid()));

alter policy buklod_help_responses_own_write
  on public.buklod_help_responses
  using (responder_id = (select auth.uid()))
  with check (responder_id = (select auth.uid()));
