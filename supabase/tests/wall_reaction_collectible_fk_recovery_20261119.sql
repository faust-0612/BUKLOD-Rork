-- Read-only post-migration contract, safe to run against isolated staging.
-- Explicitly do not run as a live production user reaction simulation.
DO $buklod_wall_reaction_recovery_test$
DECLARE
  f text;
BEGIN
  SELECT pg_get_functiondef('private.buklod_character_record_public_metric_v3(uuid,text,text,text,timestamptz,jsonb)'::regprocedure) INTO f;
  IF position('private.buklod_eval_special_collectibles_v2(p_user_id,null)' IN replace(f,' ',''))=0 THEN
    RAISE EXCEPTION 'Wall reaction FK regression: public event ID still passed as legacy award FK';
  END IF;
  IF position('private.buklod_eval_special_collectibles_v2(p_user_id,v_event_id)' IN replace(f,' ',''))>0 THEN
    RAISE EXCEPTION 'Wall reaction FK regression: wrong event provenance restored';
  END IF;
  IF position('v_cap := case v_metric' IN f)=0
    OR position('on conflict do nothing' IN lower(f))=0
    OR position('v_count >= v_cap' IN f)=0
    OR position('private.buklod_character_public_metrics_v3' IN f)=0
    OR position('private.buklod_character_public_events_v3' IN f)=0
  THEN
    RAISE EXCEPTION 'Character metric cap / dedup / progress logic must remain intact';
  END IF;
  IF has_function_privilege('anon','private.buklod_character_record_public_metric_v3(uuid,text,text,text,timestamptz,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','private.buklod_character_record_public_metric_v3(uuid,text,text,text,timestamptz,jsonb)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Character metric helper must remain inaccessible to clients';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='private.buklod_special_collectible_awards_v2'::regclass
      AND conname='buklod_special_collectible_awards_v2_trigger_event_id_fkey'
      AND confrelid='private.buklod_achievement_events_v2'::regclass
  ) THEN
    RAISE EXCEPTION 'Existing legacy collectible-award FK must be preserved';
  END IF;
END
$buklod_wall_reaction_recovery_test$;
