-- Non-destructive regression of the published KL reader's compatibility RPC.
-- Uses real approved production fixtures for S1 chapters 2-4.
BEGIN;
DO $test$
DECLARE
  v_episode record;
  v_media jsonb;
  v_item jsonb;
  v_expected integer;
  v_seen integer;
  v_matches integer;
  v_recovered integer := 0;
  v_original text;
  v_path text;
  v_side text;
  v_effect text;
  v_kind text;
  v_anchor text;
  v_placement integer;
BEGIN
  FOR v_episode IN
    SELECT id, episode_number, manuscript FROM public.kl_episodes
    WHERE season_number = 1 AND episode_number IN (2,3,4)
    ORDER BY episode_number
  LOOP
    v_media := public.kl_episode_media_v1(v_episode.id);
    SELECT count(*) INTO v_expected FROM public.kl_episode_media
      WHERE episode_id = v_episode.id AND approved = true;

    IF jsonb_typeof(v_media) <> 'array'
      OR jsonb_array_length(v_media) <> v_expected THEN
      RAISE EXCEPTION 'Chapter % exposed % instead of % approved assets',
        v_episode.episode_number, jsonb_array_length(v_media), v_expected;
    END IF;
    v_seen := 0;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_media)
    LOOP
      v_kind := v_item ->> 'kind';
      v_placement := (v_item ->> 'placement')::integer;
      v_path := v_item ->> 'path';
      v_anchor := v_item ->> 'anchor';

      SELECT paragraph_anchor, placement_side, effect
        INTO v_original, v_side, v_effect
        FROM public.kl_episode_media
        WHERE episode_id = v_episode.id AND media_kind = v_kind
          AND placement = v_placement AND approved = true
          AND storage_path = v_path;

      IF NOT FOUND OR v_item ->> 'side' IS DISTINCT FROM v_side
        OR v_item ->> 'effect' IS DISTINCT FROM v_effect THEN
        RAISE EXCEPTION 'Chapter % media %:% changed approval/path/side/effect',
          v_episode.episode_number, v_kind, v_placement;
      END IF;

      IF v_kind = 'illustration' THEN
        SELECT count(*) INTO v_matches
        FROM regexp_split_to_table(
          replace(v_episode.manuscript,E'\r\n',E'\n'),E'\n{2,}'
        ) AS paragraph(text)
        WHERE position(v_anchor in btrim(paragraph.text)) > 0;

        IF v_matches <> 1 THEN
          RAISE EXCEPTION 'Released S1 chapter % illustration % matches % paragraphs',
            v_episode.episode_number, v_placement, v_matches;
        END IF;
        IF v_anchor IS DISTINCT FROM v_original THEN
          IF position(v_original in v_episode.manuscript) = 0
            OR position(v_anchor in v_original) = 0 THEN
            RAISE EXCEPTION 'Chapter % illustration % resolved to unrelated text',
              v_episode.episode_number, v_placement;
          END IF;
          v_recovered := v_recovered + 1;
        END IF;
        v_seen := v_seen + 1;
      END IF;
    END LOOP;

    IF (v_episode.episode_number = 2 AND v_seen <> 4)
      OR (v_episode.episode_number = 3 AND v_seen <> 5)
      OR (v_episode.episode_number = 4 AND v_seen <> 5) THEN
      RAISE EXCEPTION 'Approved illustration inventory unexpectedly changed for chapter %',
        v_episode.episode_number;
    END IF;
  END LOOP;

  IF v_recovered <> 4 THEN
    RAISE EXCEPTION 'Expected 4 cross-paragraph scene recoveries, observed %', v_recovered;
  END IF;

  IF public.kl_episode_media_v1('aa000001-0000-4000-8000-000000000002'::uuid)
    <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Unreleased Chapter 1 media leaked to non-admin reader';
  END IF;

  RAISE NOTICE 'PASS: 14 approved illustrations map to 14 unique reader paragraphs; 4 formerly hidden scenes recovered; unpublished access remains guarded';
END;
$test$;
ROLLBACK;
