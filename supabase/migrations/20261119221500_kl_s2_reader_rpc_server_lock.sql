-- S2 source-only hardening: old clients must not bypass chapter order via
-- existing reading sessions or directly fetch private scene media paths.
-- Both replacements retain the live RPC signatures/return contracts, approval,
-- release checks, exact manuscript formatting and existing function grants.
-- The S2 rollout flag remains disabled before owner-authorized activation.
CREATE OR REPLACE FUNCTION public.kl_read_episode_v1(p_episode_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.kl_episodes%rowtype;
begin
 select * into v from public.kl_episodes where id=p_episode_id FOR SHARE;
 if not found or v.status<>'approved' or v.approved_at is null or v.release_at is null or v.release_at>now() then
 return jsonb_build_object('readable',false,'content','[]'::jsonb);
 end if;
 -- S2 chapter lock is enforced BEFORE any manuscript content is returned,
 -- including sessions opened on old app builds (ON CONFLICT DO NOTHING).
 if private.kl_s2_rewards_enabled_v1()
    AND NOT private.kl_s2_previous_chapter_complete_v1(auth.uid(),p_episode_id) then
   return jsonb_build_object('readable',false,'content','[]'::jsonb,'reason','previous_chapter_required');
 end if;
 if auth.uid() is not null then
   insert into public.kl_reading_sessions(user_id,episode_id) values(auth.uid(),p_episode_id)
   on conflict(user_id,episode_id) do nothing;
 end if;
 return jsonb_build_object('readable',true,'title',v.title,'episode_number',v.episode_number,'content',jsonb_build_array(jsonb_build_object('text',v.manuscript)));
end $function$


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

  -- Locked readers cannot obtain image/audio storage paths via old app RPCs.
  IF NOT v_admin AND private.kl_s2_rewards_enabled_v1()
    AND NOT private.kl_s2_previous_chapter_complete_v1(auth.uid(),p_episode_id) THEN
    RETURN '[]'::jsonb;
  END IF;

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
$function$

