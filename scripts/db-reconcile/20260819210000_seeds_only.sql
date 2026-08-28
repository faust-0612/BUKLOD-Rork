-- SAFE SEED SPLICE for 20260819210000_buklod_rewards_verification_payouts.sql
-- ORIGINAL FILE NOT EXECUTED — point-rule seeds only (no cash RPC bodies).

BEGIN;

INSERT INTO public.buklod_point_rules (
  activity_type,
  label,
  base_points,
  max_points_per_event,
  is_active,
  notes
)
VALUES
  (
    'daily_bible_verification',
    'Daily Bible Reading — Verified',
    2,
    2,
    true,
    'Fixed verification reward for approved Daily Bible Reading. Claim to receive.'
  ),
  (
    'learning_progress_verification',
    'Learning Progress — Verified',
    5,
    5,
    true,
    'Fixed verification reward for approved learning progress. Claim to receive.'
  )
ON CONFLICT (activity_type) DO UPDATE
SET
  label = EXCLUDED.label,
  base_points = EXCLUDED.base_points,
  max_points_per_event = EXCLUDED.max_points_per_event,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  updated_at = now();

COMMIT;
