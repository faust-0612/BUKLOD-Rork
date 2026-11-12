-- Admin-only review of generated KL questions and their source evidence.
-- Never give answer keys to member clients or expose protected base tables.
CREATE OR REPLACE FUNCTION public.kl_quiz_admin_review_v1(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $kl$
DECLARE
  v_hash text;
  v_status text;
  v_bank_hash text;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Active System Admin required' USING ERRCODE = '42501';
  END IF;

  SELECT md5(e.manuscript) INTO v_hash
  FROM public.kl_episodes e
  WHERE e.id = p_episode_id AND e.status = 'approved' AND e.approved_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'chapter_unavailable');
  END IF;

  SELECT q.status, q.manuscript_hash INTO v_status, v_bank_hash
  FROM public.kl_quiz_sets q WHERE q.episode_id = p_episode_id;

  IF v_status IS DISTINCT FROM 'ready' OR v_bank_hash IS DISTINCT FROM v_hash THEN
    RETURN jsonb_build_object('ok', true, 'status', 'pending',
      'count', 0, 'questions', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'number', x.item_number,
    'question', x.question_text,
    'options', x.options,
    'correct_index', x.correct_index,
    'evidence', x.evidence
  ) ORDER BY x.item_number), '[]'::jsonb) INTO v_items
  FROM public.kl_quiz_questions x WHERE x.episode_id = p_episode_id;

  RETURN jsonb_build_object('ok', true, 'status', 'ready',
    'count', jsonb_array_length(v_items), 'questions', v_items);
END;
$kl$;
REVOKE ALL ON FUNCTION public.kl_quiz_admin_review_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kl_quiz_admin_review_v1(uuid) TO authenticated;
