-- KL released-reader compatibility for approved illustration anchors spanning
-- blank-line-separated paragraphs. The editor stores one exact unique passage
-- (which may include multiple paragraphs), but old published readers match
-- each anchor only within one rendered paragraph. Preserve the saved anchor,
-- approvals, storage paths, releases and all reader activity. Return a derived,
-- unique final-paragraph segment for 'after' (first for 'before') ONLY in the
-- reader media API, so existing APK/web builds can display approved scenes.
--
-- SECURITY: retain the original definer role gate and released-only public rule.
CREATE OR REPLACE FUNCTION public.kl_episode_media_v1(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_episode public.kl_episodes%rowtype;
  v_admin boolean;
  v_media jsonb;
BEGIN
  SELECT * INTO v_episode FROM public.kl_episodes WHERE id = p_episode_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  v_admin := coalesce((
    SELECT p.role::text = 'system_admin' AND p.is_active
    FROM public.profiles p WHERE p.id = auth.uid()
  ), false);

  IF NOT v_admin AND NOT (
    v_episode.status = 'approved'
    AND v_episode.approved_at IS NOT NULL
    AND v_episode.release_at <= now()
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'kind', m.media_kind,
      'placement', m.placement,
      'path', m.storage_path,
      'anchor', CASE
        WHEN m.media_kind = 'illustration'
          AND m.paragraph_anchor IS NOT NULL
          AND cardinality(parts.blocks) > 1
          AND length(fragment.text) >= 12
          -- A changed manuscript or ambiguous segment must fail closed.
          AND (length(v_episode.manuscript)
             - length(replace(v_episode.manuscript, m.paragraph_anchor, '')))
             = length(m.paragraph_anchor)
          AND (length(v_episode.manuscript)
             - length(replace(v_episode.manuscript, fragment.text, '')))
             = length(fragment.text)
        THEN fragment.text
        ELSE m.paragraph_anchor
      END,
      'side', m.placement_side,
      'effect', m.effect,
      'intensity', m.effect_intensity
    ) ORDER BY m.placement, m.media_kind
  ), '[]'::jsonb)
  INTO v_media
  FROM public.kl_episode_media m
  CROSS JOIN LATERAL (
    SELECT regexp_split_to_array(
      replace(coalesce(m.paragraph_anchor, ''), E'\r\n', E'\n'),
      E'\n{2,}'
    ) AS blocks
  ) parts
  CROSS JOIN LATERAL (
    SELECT btrim(CASE WHEN m.placement_side = 'before'
      THEN parts.blocks[1]
      ELSE parts.blocks[cardinality(parts.blocks)]
    END) AS text
  ) fragment
  WHERE m.episode_id = p_episode_id
    AND (m.approved OR v_admin);

  RETURN v_media;
END;
$function$;
