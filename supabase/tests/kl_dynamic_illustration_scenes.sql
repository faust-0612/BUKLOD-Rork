-- Read-only schema/security contract for dynamic KL illustrations.
DO $kl_scene_expansion_guard$
DECLARE
  media_fn text := pg_get_functiondef('public.kl_admin_media_save_v1(uuid,text,integer,text,boolean)'::regprocedure);
  place_fn text := pg_get_functiondef('public.kl_admin_place_media_v1(uuid,text,integer,text,text)'::regprocedure);
  effect_fn text := pg_get_functiondef('public.kl_admin_scene_effect_v1(uuid,integer,text,integer)'::regprocedure);
  preview_fn text := pg_get_functiondef('public.kl_admin_prepare_preview_v1(uuid)'::regprocedure);
BEGIN
  IF position('p_placement>12' IN media_fn) = 0
    OR position('p_placement=0' IN media_fn) = 0
    OR position('BETWEEN 1 AND 12' IN place_fn) = 0
    OR position('BETWEEN 1 AND 12' IN effect_fn) = 0
    OR position('placement <> p_placement' IN place_fn) = 0
    OR position('paragraph_anchor = v_anchor' IN place_fn) = 0
    OR position('v_count > 12' IN preview_fn) = 0
    OR position('v_count < 2' IN preview_fn) = 0
    OR position('count(DISTINCT paragraph_anchor)' IN preview_fn) = 0
    OR position('v_count <> v_unique_count' IN preview_fn) = 0
    THEN RAISE EXCEPTION 'KL dynamic illustration range not applied consistently'; END IF;
  IF NOT (media_fn LIKE '%SECURITY DEFINER%' AND media_fn LIKE '%auth.uid()%' AND media_fn LIKE '%system_admin%' AND media_fn LIKE '%is_active%')
      OR NOT (place_fn LIKE '%SECURITY DEFINER%' AND place_fn LIKE '%auth.uid()%' AND place_fn LIKE '%system_admin%' AND place_fn LIKE '%is_active%')
      OR NOT (effect_fn LIKE '%SECURITY DEFINER%' AND effect_fn LIKE '%auth.uid()%' AND effect_fn LIKE '%system_admin%' AND effect_fn LIKE '%is_active%')
      OR NOT (preview_fn LIKE '%SECURITY DEFINER%' AND preview_fn LIKE '%auth.uid()%' AND preview_fn LIKE '%system_admin%' AND preview_fn LIKE '%is_active%')
    THEN RAISE EXCEPTION 'KL admin authorization regression'; END IF;
  IF position('SET search_path TO' IN media_fn) = 0
      OR position('SET search_path TO' IN place_fn) = 0
      OR position('SET search_path TO' IN effect_fn) = 0
      OR position('SET search_path TO' IN preview_fn) = 0
    THEN RAISE EXCEPTION 'KL SECURITY DEFINER search_path must remain fixed'; END IF;
  IF has_function_privilege('anon', 'public.kl_admin_media_save_v1(uuid,text,integer,text,boolean)', 'EXECUTE')
      OR has_function_privilege('anon', 'public.kl_admin_place_media_v1(uuid,text,integer,text,text)', 'EXECUTE')
      OR has_function_privilege('anon', 'public.kl_admin_scene_effect_v1(uuid,integer,text,integer)', 'EXECUTE')
      OR has_function_privilege('anon', 'public.kl_admin_prepare_preview_v1(uuid)', 'EXECUTE')
    THEN RAISE EXCEPTION 'KL admin RPC unexpectedly callable by anon'; END IF;
END
$kl_scene_expansion_guard$;
