-- BUKLOD EMPIRE ARENA V2 — ISOLATED DEVELOPMENT CHANGESET, NOT APPLIED.
-- Run only in a disposable PostgreSQL staging database first. Production remains unchanged.
-- Non-exposed private schema; service_role-only settlement; never client-mint BP or Diamonds.
-- Rank and Diamond loss are sourced from match holds, never client declarations.

CREATE SCHEMA IF NOT EXISTS buklod_arena;
REVOKE ALL ON SCHEMA buklod_arena FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA buklod_arena TO service_role;

CREATE TABLE IF NOT EXISTS buklod_arena.diamond_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  earned_total integer NOT NULL DEFAULT 0 CHECK (earned_total >= 0),
  lost_total integer NOT NULL DEFAULT 0 CHECK (lost_total >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS buklod_arena.diamond_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('verified_participation','ranked_hold','ranked_refund')),
  source_id uuid NOT NULL,
  delta integer NOT NULL CHECK (delta BETWEEN -1 AND 1 AND delta <> 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type, source_id)
);
CREATE TABLE IF NOT EXISTS buklod_arena.ratings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0)
);
CREATE TABLE IF NOT EXISTS buklod_arena.matches (
  id uuid PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('duel','cluster','grand')),
  map_id text NOT NULL CHECK (map_id IN ('genesis_rift','aurora_foundry','verdant_fracture')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled','aborted')),
  winner text CHECK (winner IN ('A','B','DRAW')),
  finish_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '32 minutes'),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS arena_match_expires_idx ON buklod_arena.matches(expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS buklod_arena.seats (
  match_id uuid NOT NULL REFERENCES buklod_arena.matches(id) ON DELETE CASCADE,
  seat_id text NOT NULL CHECK (seat_id ~ '^[AB][0-4]$'),
  team text NOT NULL CHECK (team IN ('A','B')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hero_id text NOT NULL CHECK (hero_id IN
    ('phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')),
  diamond_stake integer NOT NULL DEFAULT 1 CHECK (diamond_stake = 1),
  PRIMARY KEY (match_id, seat_id),
  UNIQUE (match_id,user_id),
  CHECK (left(seat_id,1) = team)
);
CREATE INDEX IF NOT EXISTS arena_seats_active_user_idx ON buklod_arena.seats(user_id,match_id);

-- Defense in depth even though this schema is not exposed through the Data API.
ALTER TABLE buklod_arena.diamond_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE buklod_arena.diamond_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE buklod_arena.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE buklod_arena.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buklod_arena.seats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA buklod_arena FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA buklod_arena TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA buklod_arena TO service_role;

-- The server obtains account snapshot, not an app-supplied balance/level claim.
CREATE OR REPLACE FUNCTION public.arena_v2_ranked_profile(p_user uuid,p_hero text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, buklod_arena, public
AS $fn$
DECLARE v_diamonds integer; v_rating integer; v_item_level integer:=1;
  v_current integer; v_count integer;
BEGIN
  IF p_user IS NULL OR p_hero NOT IN
    ('phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
    THEN RAISE EXCEPTION 'invalid_user_or_hero'; END IF;
  SELECT balance INTO v_diamonds FROM buklod_arena.diamond_wallets WHERE user_id=p_user;
  SELECT rating INTO v_rating FROM buklod_arena.ratings WHERE user_id=p_user;
  -- Canonical collectible proof: exactly 5 redeemed items per level,
  -- with no skipping of any preceding level, up to 20.
  FOR v_current IN 2..20 LOOP
    SELECT count(DISTINCT item_index) INTO v_count
    FROM public.buklod_character_collectible_state
    WHERE user_id=p_user AND character_id=p_hero AND level_no=v_current
      AND item_index BETWEEN 1 AND 5 AND redeemed_at IS NOT NULL;
    EXIT WHEN v_count<5;
    v_item_level:=v_current;
  END LOOP;
  RETURN jsonb_build_object('user_id',p_user,'diamonds',coalesce(v_diamonds,0),
    'rating',coalesce(v_rating,1000),'eligible',coalesce(v_diamonds,0)>0,
    'verified_item_level',v_item_level);
END; $fn$;

-- One nontransferable Diamond per trusted, already claimed BP event;
-- source IDs cannot be reused and per-user Manila-day grants are capped at 3.
-- No BP modification and no faith-only acquisition requirement.
CREATE OR REPLACE FUNCTION public.arena_v2_award_verified_participation(p_points_ledger_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, buklod_arena, public
AS $fn$
DECLARE v_user uuid; v_type text; v_daily integer; v_balance integer;
BEGIN
  SELECT user_id, activity_type INTO v_user,v_type FROM public.buklod_points_ledger
  WHERE id=p_points_ledger_id AND direction='credit' AND claim_state='claimed' AND points>0
    AND created_at >= now()-interval '90 days'
    AND activity_type IN
      ('r36_engager_comment','r36_creator_impact','community_mutual_support_chain',
       'learning_progress_verification','game_first_qualified','abc_growth_lesson',
       'daily_bible','devotional','reflection_quality_bonus');
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_verified_participation'; END IF;
  INSERT INTO buklod_arena.diamond_wallets(user_id) VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;
  -- Serialize per-user grants and 3/day cap against concurrent claims.
  PERFORM 1 FROM buklod_arena.diamond_wallets WHERE user_id=v_user FOR UPDATE;
  IF EXISTS (SELECT 1 FROM buklod_arena.diamond_events WHERE user_id=v_user
     AND event_type='verified_participation' AND source_id=p_points_ledger_id) THEN
    RETURN jsonb_build_object('awarded',false,'reason','already_claimed');
  END IF;
  SELECT count(*) INTO v_daily FROM buklod_arena.diamond_events
   WHERE user_id=v_user AND event_type='verified_participation'
    AND (created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date;
  IF v_daily >= 3 THEN RETURN jsonb_build_object('awarded',false,'reason','daily_cap'); END IF;
  INSERT INTO buklod_arena.diamond_events(user_id,event_type,source_id,delta)
  VALUES (v_user,'verified_participation',p_points_ledger_id,1);
  UPDATE buklod_arena.diamond_wallets
   SET balance=balance+1, earned_total=earned_total+1,updated_at=now()
   WHERE user_id=v_user RETURNING balance INTO v_balance;
  RETURN jsonb_build_object('awarded',true,'balance',v_balance);
END; $fn$;

-- Every participant deposits exactly one already-earned Diamond as a rank-risk stake.
-- The debit happens ATOMICALLY for both teams. Failed/duplicate/insufficient joins
-- roll back; players cannot forge this RPC using their normal client JWT.
CREATE OR REPLACE FUNCTION public.arena_v2_ranked_open(
  p_match_id uuid,p_mode text,p_map text,p_players jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, buklod_arena, public
AS $fn$
DECLARE v_expected integer; v_count integer; v_user uuid; v_p jsonb;
  v_hero text; v_seat text; v_balance integer;
BEGIN
  v_expected:=case p_mode when 'duel' then 1 when 'cluster' then 3 when 'grand' then 5 else 0 end;
  IF p_match_id IS NULL OR v_expected=0 OR p_map IS NULL OR p_map NOT IN ('genesis_rift','aurora_foundry','verdant_fracture')
     OR jsonb_typeof(p_players) <> 'array' OR jsonb_array_length(p_players) <> 2*v_expected THEN
    RAISE EXCEPTION 'invalid_ranked_match';
  END IF;
  IF EXISTS(SELECT 1 FROM buklod_arena.matches WHERE id=p_match_id) THEN
    RAISE EXCEPTION 'duplicate_match_id';
  END IF;
  SELECT count(DISTINCT x.value->>'user_id') INTO v_count FROM jsonb_array_elements(p_players) x;
  IF v_count<>2*v_expected THEN RAISE EXCEPTION 'duplicate_player'; END IF;
  FOR v_p IN SELECT value FROM jsonb_array_elements(p_players) LOOP
    v_seat:=v_p->>'seat_id'; v_hero:=v_p->>'hero_id';
    IF v_seat !~ ('^[AB][0-'||(v_expected-1)::text||']$')
      OR v_hero NOT IN ('phan','quin','van','christian','lhen','ace','ellusur',
                       'jawo','mitch','niel','angel','vhen','trudice') THEN
      RAISE EXCEPTION 'invalid_seat_or_hero';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'seat_id') FROM jsonb_array_elements(p_players)) <> 2*v_expected THEN
    RAISE EXCEPTION 'duplicate_seat';
  END IF;
  -- Lock wallets in a deterministic order to prevent duplicate concurrent queue reservations.
  FOR v_user IN SELECT (x.value->>'user_id')::uuid FROM jsonb_array_elements(p_players) x ORDER BY 1 LOOP
    SELECT balance INTO v_balance FROM buklod_arena.diamond_wallets WHERE user_id=v_user FOR UPDATE;
    IF coalesce(v_balance,0) < 1 THEN RAISE EXCEPTION 'insufficient_earned_diamonds'; END IF;
    IF EXISTS(
      SELECT 1 FROM buklod_arena.seats s JOIN buklod_arena.matches m ON s.match_id=m.id
      WHERE s.user_id=v_user AND m.status='active') THEN
      RAISE EXCEPTION 'player_already_in_match';
    END IF;
  END LOOP;
  INSERT INTO buklod_arena.matches(id,mode,map_id) VALUES(p_match_id,p_mode,p_map);
  FOR v_p IN SELECT value FROM jsonb_array_elements(p_players) LOOP
    v_user:=(v_p->>'user_id')::uuid; v_seat:=v_p->>'seat_id'; v_hero:=v_p->>'hero_id';
    INSERT INTO buklod_arena.seats(match_id,seat_id,team,user_id,hero_id)
    VALUES(p_match_id,v_seat,left(v_seat,1),v_user,v_hero);
    UPDATE buklod_arena.diamond_wallets SET balance=balance-1,updated_at=now() WHERE user_id=v_user;
    INSERT INTO buklod_arena.diamond_events(user_id,event_type,source_id,delta)
    VALUES(v_user,'ranked_hold',p_match_id,-1);
    INSERT INTO buklod_arena.ratings(user_id) VALUES(v_user) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('accepted',true,'match_id',p_match_id,'reserved',2*v_expected);
END; $fn$;

CREATE OR REPLACE FUNCTION public.arena_v2_ranked_settle(
 p_match_id uuid,p_winner text,p_reason text DEFAULT 'engine_result'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, buklod_arena, public
AS $fn$
DECLARE v_match buklod_arena.matches%rowtype; v_seat record; v_refund boolean;
BEGIN
  SELECT * INTO v_match FROM buklod_arena.matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_match.status='settled' THEN
    RETURN jsonb_build_object('settled',false,'reason','already_settled','winner',v_match.winner);
  END IF;
  IF v_match.status <> 'active' THEN RAISE EXCEPTION 'cannot_settle_inactive_match'; END IF;
  IF p_winner IS NULL OR p_winner NOT IN ('A','B','DRAW') THEN RAISE EXCEPTION 'invalid_winner'; END IF;
  FOR v_seat IN SELECT * FROM buklod_arena.seats WHERE match_id=p_match_id ORDER BY user_id LOOP
    v_refund:=p_winner='DRAW' OR v_seat.team=p_winner;
    IF v_refund THEN
      UPDATE buklod_arena.diamond_wallets SET balance=balance+1,updated_at=now()
      WHERE user_id=v_seat.user_id;
      INSERT INTO buklod_arena.diamond_events(user_id,event_type,source_id,delta)
       VALUES(v_seat.user_id,'ranked_refund',p_match_id,1);
    ELSE
      UPDATE buklod_arena.diamond_wallets SET lost_total=lost_total+1,updated_at=now()
      WHERE user_id=v_seat.user_id;
    END IF;
    IF p_winner<>'DRAW' THEN
      UPDATE buklod_arena.ratings
       SET rating=greatest(0,rating+(case when v_refund then 10 else -10 end)),
           wins=wins+(case when v_refund then 1 else 0 end),
           losses=losses+(case when v_refund then 0 else 1 end)
       WHERE user_id=v_seat.user_id;
    END IF;
  END LOOP;
  UPDATE buklod_arena.matches SET status='settled',winner=p_winner,
    finish_reason=left(coalesce(p_reason,'engine_result'),80),settled_at=now()
  WHERE id=p_match_id;
  RETURN jsonb_build_object('settled',true,'winner',p_winner,'match_id',p_match_id);
END; $fn$;

CREATE OR REPLACE FUNCTION public.arena_v2_ranked_abort(
 p_match_id uuid,p_reason text DEFAULT 'server_interrupted'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, buklod_arena, public
AS $fn$
DECLARE v_match buklod_arena.matches%rowtype; v_seat record;
BEGIN
  SELECT * INTO v_match FROM buklod_arena.matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('aborted',false,'reason','not_found'); END IF;
  IF v_match.status<>'active' THEN
    RETURN jsonb_build_object('aborted',false,'reason','already_finalized');
  END IF;
  FOR v_seat IN SELECT * FROM buklod_arena.seats WHERE match_id=p_match_id ORDER BY user_id LOOP
    UPDATE buklod_arena.diamond_wallets SET balance=balance+1,updated_at=now()
    WHERE user_id=v_seat.user_id;
    INSERT INTO buklod_arena.diamond_events(user_id,event_type,source_id,delta)
    VALUES (v_seat.user_id,'ranked_refund',p_match_id,1);
  END LOOP;
  UPDATE buklod_arena.matches SET status='aborted',finish_reason=left(coalesce(p_reason,'aborted'),80),
    settled_at=now() WHERE id=p_match_id;
  RETURN jsonb_build_object('aborted',true,'match_id',p_match_id);
END; $fn$;

-- Crash recovery: call from a trusted server scheduler; automatically refunds
-- expired, unfinished holds. Does not create Diamonds or change Circle Rank.
CREATE OR REPLACE FUNCTION public.arena_v2_ranked_expire()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, buklod_arena, public
AS $fn$
DECLARE v_match uuid; v_count integer:=0;
BEGIN
  FOR v_match IN SELECT id FROM buklod_arena.matches WHERE status='active'
    AND expires_at < now() ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.arena_v2_ranked_abort(v_match,'match_timeout_refund');
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END; $fn$;

-- Absolute client deny: only trusted backend (service_role) can call privileged
-- public RPCs, even though PostgreSQL defaults to EXECUTE for PUBLIC.
REVOKE ALL ON FUNCTION public.arena_v2_ranked_profile(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.arena_v2_award_verified_participation(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.arena_v2_ranked_open(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.arena_v2_ranked_settle(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.arena_v2_ranked_abort(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.arena_v2_ranked_expire() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arena_v2_ranked_profile(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.arena_v2_award_verified_participation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.arena_v2_ranked_open(uuid,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.arena_v2_ranked_settle(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.arena_v2_ranked_abort(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.arena_v2_ranked_expire() TO service_role;
