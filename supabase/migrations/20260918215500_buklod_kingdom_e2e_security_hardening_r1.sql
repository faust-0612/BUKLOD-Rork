-- BUKLOD KINGDOM E2E SECURITY HARDENING R1
-- The private schema is shared by other BUKLOD systems. Kingdom tables remain
-- RPC-only even if schema USAGE exists for authenticated users elsewhere.

alter table private.buklod_kingdom_level_progress_v1 enable row level security;
alter table private.buklod_kingdom_wallet_v1 enable row level security;
alter table private.buklod_kingdom_collectibles_v1 enable row level security;
alter table private.buklod_kingdom_result_events_v1 enable row level security;

revoke all on table private.buklod_kingdom_level_progress_v1 from public, anon, authenticated;
revoke all on table private.buklod_kingdom_wallet_v1 from public, anon, authenticated;
revoke all on table private.buklod_kingdom_collectibles_v1 from public, anon, authenticated;
revoke all on table private.buklod_kingdom_result_events_v1 from public, anon, authenticated;

revoke all on function public.get_my_buklod_kingdom_v1() from public, anon;
grant execute on function public.get_my_buklod_kingdom_v1() to authenticated;

revoke all on function public.submit_my_buklod_kingdom_result_v1(text,text,text,integer,integer) from public, anon;
grant execute on function public.submit_my_buklod_kingdom_result_v1(text,text,text,integer,integer) to authenticated;

revoke all on function public.submit_my_buklod_kingdom_result_v2(text,text,text,integer,integer,integer) from public, anon;
grant execute on function public.submit_my_buklod_kingdom_result_v2(text,text,text,integer,integer,integer) to authenticated;

comment on table private.buklod_kingdom_level_progress_v1
is 'RPC-only Kingdom level progression. Direct client access is intentionally denied.';
comment on table private.buklod_kingdom_wallet_v1
is 'RPC-only Kingdom/Game XP wallet. Separate from Circle Points.';
comment on table private.buklod_kingdom_collectibles_v1
is 'RPC-only unique Kingdom collectible ledger.';
comment on table private.buklod_kingdom_result_events_v1
is 'RPC-only idempotency/result ledger for Kingdom submissions.';
