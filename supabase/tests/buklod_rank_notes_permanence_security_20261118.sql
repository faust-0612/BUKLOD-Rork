-- Read-only regression for public Circle Rank display and permanent Notes.
DO $rank_notes_contract$
DECLARE
  v_rank text;
  v_setter text;
  v_trigger text;
BEGIN
  SELECT pg_get_functiondef('public.get_member_circle_ranks_v1(uuid[])'::regprocedure)
    INTO v_rank;
  SELECT pg_get_functiondef('public.set_buklod_messages_status_note_v1(text)'::regprocedure)
    INTO v_setter;
  SELECT pg_get_functiondef('private.buklod_profile_note_permanent_v1()'::regprocedure)
    INTO v_trigger;

  IF position('auth.uid()' in v_rank) = 0
     OR position('p.is_active=true' in v_rank) = 0
     OR position('buklod_is_platform_official_v1' in v_rank) = 0 THEN
     RAISE EXCEPTION 'Public Circle Rank authentication/active/official exclusion regressed';
  END IF;
  IF position('p.is_verified' in v_rank) > 0 THEN
     RAISE EXCEPTION 'Public Circle Rank improperly requires reward verification';
  END IF;
  IF position('buklod_user_points_balances' in v_rank) = 0
     OR position('buklod_rank_levels' in v_rank) = 0 THEN
     RAISE EXCEPTION 'Public Circle Rank stopped using canonical lifetime points';
  END IF;
  IF position('auth.uid()' in v_setter) = 0
    OR position('char_length(v_note) > 80' in v_setter) = 0
    OR position('v_user' in v_setter) = 0 THEN
     RAISE EXCEPTION 'Notes owner authentication or length validation regressed';
  END IF;
  IF position('quick_note_expires_at := null' in v_trigger) = 0
    OR NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname='buklod_profile_note_permanent_v1'
        AND tgrelid='public.buklod_profile_status'::regclass
        AND tgenabled='O'
    ) THEN
     RAISE EXCEPTION 'Notes permanence trigger missing or inactive';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buklod_profile_status WHERE quick_note_expires_at IS NOT NULL) THEN
     RAISE EXCEPTION 'Some Notes still have expiry timestamps';
  END IF;
END;
$rank_notes_contract$;
