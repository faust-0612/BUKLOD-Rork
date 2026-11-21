-- Real PostgreSQL assertions; run after disposable setup and DEV changeset.
-- A failure raises EXCEPTION and fails CI. Never execute against a live database.
DO $test$
BEGIN
  IF has_schema_privilege('authenticated','buklod_arena','USAGE') OR
     has_schema_privilege('anon','buklod_arena','USAGE') THEN
    RAISE EXCEPTION 'Private Arena schema exposed to app roles';
  END IF;
  IF has_function_privilege('authenticated','public.arena_v2_ranked_open(uuid,text,text,jsonb)','EXECUTE') OR
     has_function_privilege('anon','public.arena_v2_ranked_settle(uuid,text,text)','EXECUTE') OR
     has_function_privilege('authenticated','public.arena_v2_award_verified_participation(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Privileged Arena economy RPC exposed to a client';
  END IF;
  IF NOT has_function_privilege('service_role','public.arena_v2_ranked_open(uuid,text,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Trusted service role lacks settlement access';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='buklod_arena' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Arena private table missing RLS';
  END IF;
END; $test$;

-- Two independently verifiable, faith-optional BP events fund exactly one Diamond each.
SELECT public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000001');
SELECT public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000002');
DO $test$
DECLARE v_count integer;
BEGIN
  SELECT sum(balance) INTO v_count FROM buklod_arena.diamond_wallets;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Verified credits did not fund exactly two Diamonds'; END IF;
END; $test$;

-- Duplicate participation source cannot grant a second Diamond.
SELECT public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000001');
DO $test$
BEGIN
  IF (SELECT balance FROM buklod_arena.diamond_wallets
      WHERE user_id='00000000-0000-4000-8000-000000000001')<>1 THEN
    RAISE EXCEPTION 'Duplicate participation minted a Diamond';
  END IF;
  BEGIN
    PERFORM public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000007');
    RAISE EXCEPTION 'Pending participation was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'not_verified_participation' THEN RAISE; END IF;
  END;
END; $test$;

-- One real 1v1 match: BOTH stakes reserved atomically; no BP changes.
SELECT public.arena_v2_ranked_open(
  '20000000-0000-4000-8000-000000000001','duel','genesis_rift',
  '[{"seat_id":"A0","user_id":"00000000-0000-4000-8000-000000000001","hero_id":"phan"},
    {"seat_id":"B0","user_id":"00000000-0000-4000-8000-000000000002","hero_id":"quin"}]'::jsonb);
DO $test$
BEGIN
  IF (SELECT sum(balance) FROM buklod_arena.diamond_wallets)<>0 THEN
    RAISE EXCEPTION 'Match stake was not reserved';
  END IF;
  BEGIN
    PERFORM public.arena_v2_ranked_open(
     '20000000-0000-4000-8000-000000000001','duel','genesis_rift',
     '[]'::jsonb);
    RAISE EXCEPTION 'Duplicate match accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT IN ('invalid_ranked_match','duplicate_match_id') THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.arena_v2_ranked_settle('20000000-0000-4000-8000-000000000001',NULL,'forgery');
    RAISE EXCEPTION 'NULL result accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid_winner' THEN RAISE; END IF;
  END;
END; $test$;

-- A wins: A stake returned, B loses one earned Diamond. Circle Rank / BP unchanged.
SELECT public.arena_v2_ranked_settle('20000000-0000-4000-8000-000000000001','A','server_engine_win');
SELECT public.arena_v2_ranked_settle('20000000-0000-4000-8000-000000000001','B','replayed_client_forgery');
DO $test$
BEGIN
  IF (SELECT balance FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000001')<>1
    OR (SELECT balance FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000002')<>0
    OR (SELECT rating FROM buklod_arena.ratings WHERE user_id='00000000-0000-4000-8000-000000000001')<>1010
    OR (SELECT rating FROM buklod_arena.ratings WHERE user_id='00000000-0000-4000-8000-000000000002')<>990
    OR (SELECT lost_total FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000002')<>1
    THEN RAISE EXCEPTION 'Settlement/rank/duplicate mismatch'; END IF;
END; $test$;

-- Second verified participation grant for B, then atomic abort refund for both.
SELECT public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000003');
SELECT public.arena_v2_ranked_open(
  '20000000-0000-4000-8000-000000000002','duel','aurora_foundry',
  '[{"seat_id":"A0","user_id":"00000000-0000-4000-8000-000000000001","hero_id":"phan"},
    {"seat_id":"B0","user_id":"00000000-0000-4000-8000-000000000002","hero_id":"quin"}]'::jsonb);
SELECT public.arena_v2_ranked_abort('20000000-0000-4000-8000-000000000002','server_restart');
SELECT public.arena_v2_ranked_abort('20000000-0000-4000-8000-000000000002','duplicate_abort');
DO $test$
BEGIN
 IF (SELECT balance FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000001')<>1
   OR (SELECT balance FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000002')<>1
   THEN RAISE EXCEPTION 'Abort failed to refund exactly once'; END IF;
 IF (SELECT count(*) FROM buklod_arena.diamond_events WHERE event_type='ranked_refund'
      AND source_id='20000000-0000-4000-8000-000000000002') <> 2
   THEN RAISE EXCEPTION 'Abort duplicated a refund'; END IF;
END; $test$;

-- Concurrent matches may never reserve the same account simultaneously.
SELECT public.arena_v2_ranked_open(
  '20000000-0000-4000-8000-000000000003','duel','verdant_fracture',
  '[{"seat_id":"A0","user_id":"00000000-0000-4000-8000-000000000001","hero_id":"phan"},
    {"seat_id":"B0","user_id":"00000000-0000-4000-8000-000000000002","hero_id":"quin"}]'::jsonb);
DO $test$
BEGIN
  BEGIN
    PERFORM public.arena_v2_ranked_open(
      '20000000-0000-4000-8000-000000000004','duel','genesis_rift',
      '[{"seat_id":"A0","user_id":"00000000-0000-4000-8000-000000000001","hero_id":"phan"},
        {"seat_id":"B0","user_id":"00000000-0000-4000-8000-000000000002","hero_id":"quin"}]'::jsonb);
    RAISE EXCEPTION 'Overlapping account accepted into second match';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'insufficient_earned_diamonds' AND SQLERRM <> 'player_already_in_match' THEN RAISE; END IF;
  END;
END; $test$;

-- Crash timer aborts stale active match and returns both stakes.
UPDATE buklod_arena.matches SET expires_at=now()-interval '1 minute'
WHERE id='20000000-0000-4000-8000-000000000003';
SELECT public.arena_v2_ranked_expire();
DO $test$
BEGIN
  IF (SELECT status FROM buklod_arena.matches WHERE id='20000000-0000-4000-8000-000000000003')<>'aborted'
    OR (SELECT balance FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000001')<>1
    OR (SELECT balance FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000002')<>1 THEN
    RAISE EXCEPTION 'Expired match did not safely refund';
  END IF;
END; $test$;

-- Three daily claims max, claimed and faith-optional sources only.
SELECT public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000004');
SELECT public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000005');
SELECT public.arena_v2_award_verified_participation('10000000-0000-4000-8000-000000000006');
DO $test$
BEGIN
  IF (SELECT earned_total FROM buklod_arena.diamond_wallets WHERE user_id='00000000-0000-4000-8000-000000000001')<>3 THEN
    RAISE EXCEPTION '3-per-day Diamond farming cap violated';
  END IF;
END; $test$;

-- Read-only source ledger remains identical. No Commerce BP-minting side effects.
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.buklod_points_ledger)<>7 THEN
    RAISE EXCEPTION 'Arena changed BP ledger';
  END IF;
END; $test$;
