#!/usr/bin/env bash
# Disposable-only real PostgreSQL concurrent reservation regression.
# Never run against the live BUKLOD database or on a remote PGHOST.
set -euo pipefail

if [[ "${PGDATABASE:-}" != "arena_isolated" ]] || [[ "${PGHOST:-}" != "localhost" ]] || [[ "${PGPORT:-}" != "5432" ]]; then
  echo 'BLOCK: disposable PostgreSQL CI database required' >&2
  exit 2
fi

one="$(mktemp)"
two="$(mktemp)"
trap 'rm -f "$one" "$two"' EXIT

# Both competing games include the SAME two legitimate users, with one earned
# Diamond remaining for B. Only one two-player reservation can commit.
# PostgreSQL constructs JSON from SQL literals, so Bash cannot strip the
# JSON double quotes when the query is passed through psql -c.
players="jsonb_build_array(jsonb_build_object('seat_id','A0','user_id','00000000-0000-4000-8000-000000000001','hero_id','phan'),jsonb_build_object('seat_id','B0','user_id','00000000-0000-4000-8000-000000000002','hero_id','quin'))"
first="SELECT public.arena_v2_ranked_open('20000000-0000-4000-8000-000000000006','duel','genesis_rift',$players)"
second="SELECT public.arena_v2_ranked_open('20000000-0000-4000-8000-000000000007','duel','genesis_rift',$players)"

psql -v ON_ERROR_STOP=1 -c "$first" >"$one" 2>&1 &
p1=$!
psql -v ON_ERROR_STOP=1 -c "$second" >"$two" 2>&1 &
p2=$!

code1=0
code2=0
wait "$p1" || code1=$?
wait "$p2" || code2=$?

if [[ "$code1" -eq "$code2" ]]; then
  echo 'BLOCK: concurrent reservations did not produce exactly one successful commit' >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 <<'SQL'
DO $test$
DECLARE v_count integer; v_held integer;
BEGIN
  SELECT count(*) INTO v_count FROM buklod_arena.matches
  WHERE id IN ('20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000007')
    AND status='active';
  SELECT count(*) INTO v_held FROM buklod_arena.diamond_events
  WHERE event_type='ranked_hold' AND source_id IN
    ('20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000007');
  IF v_count<>1 OR v_held<>2
    OR (SELECT balance FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000002')<>0
    THEN RAISE EXCEPTION 'Concurrent reservation duplicated or lost a Diamond';
  END IF;
END; $test$;
SELECT public.arena_v2_ranked_recover_orphans();
DO $test$
BEGIN
  IF (SELECT balance FROM buklod_arena.diamond_wallets
    WHERE user_id='00000000-0000-4000-8000-000000000002')<>1 THEN
    RAISE EXCEPTION 'Concurrent reservation recovery lost escrow'; END IF;
END; $test$;
SQL

echo 'PASS: real PostgreSQL two-session wallet race, exactly one commit, one denial, no duplicate Diamond and full refund'
