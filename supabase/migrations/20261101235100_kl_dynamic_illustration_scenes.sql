-- Additive KL-only expansion from 3 to 12 illustration slots per chapter.
-- Preserve existing UUIDs, manuscripts, media, media approvals, and release times.
-- CREATE OR REPLACE retains function owner and existing EXECUTE ACLs.

-- Expanded slots for kl_admin_media_save_v1. Keep existing privileged admin gate and release approval semantics.
CREATE OR REPLACE FUNCTION public.kl_admin_media_save_v1(p_episode_id uuid, p_kind text, p_placement integer, p_path text, p_approved boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role::text='system_admin' and is_active=true) then raise exception 'Story admin access denied'; end if;
 if p_kind not in ('cover','illustration','music','ambient') or p_placement<0 or p_placement>12 or (p_kind='illustration' and p_placement=0) or (p_kind<>'illustration' and p_placement<>0)
 or p_path !~ '^episodes/[a-f0-9-]+/[a-zA-Z0-9_./-]+$' or position('..' in p_path)>0
 or split_part(p_path,'/',2)<>p_episode_id::text then raise exception 'Invalid media metadata'; end if;
 if not exists(select 1 from public.kl_episodes where id=p_episode_id and release_at is null) then raise exception 'Chapter not editable'; end if;
 if not exists(select 1 from storage.objects where bucket_id='kl-publishing' and name=p_path) then raise exception 'Upload file before saving metadata'; end if;
 select storage_path into v_old from public.kl_episode_media where episode_id=p_episode_id and media_kind=p_kind and placement=p_placement;
 insert into public.kl_episode_media(episode_id,media_kind,placement,storage_path,approved,paragraph_anchor,effect,effect_intensity)
 values(p_episode_id,p_kind,p_placement,p_path,false,null,'none',30)
 on conflict(episode_id,media_kind,placement) do update
 set storage_path=excluded.storage_path,approved=false,
 paragraph_anchor=case when public.kl_episode_media.storage_path=excluded.storage_path then public.kl_episode_media.paragraph_anchor else null end,
 effect=case when public.kl_episode_media.storage_path=excluded.storage_path then public.kl_episode_media.effect else 'none' end;
 update public.kl_episodes set preview_prepared_at=null,approved_at=null,approved_by=null,status='draft' where id=p_episode_id;
 return jsonb_build_object('ok',true);
end $function$;

-- Expanded slots for kl_admin_place_media_v1. Keep existing privileged admin gate and release approval semantics.
CREATE OR REPLACE FUNCTION public.kl_admin_place_media_v1(p_episode_id uuid, p_kind text, p_placement integer, p_anchor text, p_side text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_manuscript text;
  v_current public.kl_episode_media%rowtype;
  v_anchor text := btrim(coalesce(p_anchor, ''));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT manuscript INTO v_manuscript FROM public.kl_episodes
    WHERE id = p_episode_id AND release_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not editable'; END IF;
  IF p_kind <> 'illustration' OR p_placement NOT BETWEEN 1 AND 12
      OR p_side NOT IN ('before', 'after') OR length(v_anchor) < 12
      OR v_manuscript IS NULL
      OR (length(v_manuscript) - length(replace(v_manuscript, v_anchor, ''))) <> length(v_anchor) THEN
    RAISE EXCEPTION 'Use one exact, unique passage from the saved manuscript for this scene';
  END IF;
  IF EXISTS (
      SELECT 1 FROM public.kl_episode_media
      WHERE episode_id = p_episode_id AND media_kind = 'illustration'
        AND placement <> p_placement AND paragraph_anchor = v_anchor
  ) THEN
    RAISE EXCEPTION 'Each illustration must use a different manuscript passage';
  END IF;
  SELECT * INTO v_current FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = 'illustration' AND placement = p_placement
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Illustration not uploaded'; END IF;
  IF v_current.paragraph_anchor IS NOT DISTINCT FROM v_anchor
      AND v_current.placement_side IS NOT DISTINCT FROM p_side THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'approved', v_current.approved);
  END IF;
  UPDATE public.kl_episode_media SET paragraph_anchor = v_anchor,
      placement_side = p_side, approved = false WHERE id = v_current.id;
  UPDATE public.kl_episodes SET preview_prepared_at = NULL,
      approved_at = NULL, approved_by = NULL, status = 'draft' WHERE id = p_episode_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', false);
END;
$function$;

-- Expanded slots for kl_admin_prepare_preview_v1. Keep existing privileged admin gate and release approval semantics.
CREATE OR REPLACE FUNCTION public.kl_admin_prepare_preview_v1(p_episode_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.kl_episodes%rowtype; v_count integer; v_unique_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO v FROM public.kl_episodes WHERE id = p_episode_id AND release_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v.manuscript IS NULL OR length(btrim(v.manuscript)) < 30 THEN
    RAISE EXCEPTION 'Complete and save an editable manuscript first';
  END IF;
  SELECT count(*), count(DISTINCT paragraph_anchor)
    INTO v_count, v_unique_count
    FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = 'illustration'
      AND paragraph_anchor IS NOT NULL
      AND (length(v.manuscript) - length(replace(v.manuscript, paragraph_anchor, ''))) = length(paragraph_anchor);
  IF v_count < 2 OR v_count > 12 OR v_count <> v_unique_count THEN
    RAISE EXCEPTION 'Place 2 to 12 illustrations at distinct valid manuscript passages first';
  END IF;
  IF v.preview_prepared_at IS NOT NULL THEN
    RETURN jsonb_build_object('ready', true, 'changed', false,
      'preview_version', v.preview_version, 'location', 'Community Wall KL Admin card');
  END IF;
  UPDATE public.kl_episodes SET preview_version = preview_version + 1,
      preview_prepared_at = now() WHERE id = p_episode_id;
  RETURN jsonb_build_object('ready', true, 'changed', true,
      'preview_version', v.preview_version + 1, 'location', 'Community Wall KL Admin card');
END;
$function$;

-- Expanded slots for kl_admin_scene_effect_v1. Keep existing privileged admin gate and release approval semantics.
CREATE OR REPLACE FUNCTION public.kl_admin_scene_effect_v1(p_episode_id uuid, p_placement integer, p_effect text, p_intensity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_current public.kl_episode_media%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_effect NOT IN ('none','rain','fog','fireflies','embers','lightning')
      OR p_intensity NOT BETWEEN 0 AND 100 OR p_placement NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Invalid scene effect';
  END IF;
  PERFORM 1 FROM public.kl_episodes WHERE id = p_episode_id AND release_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not editable'; END IF;
  SELECT * INTO v_current FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = 'illustration' AND placement = p_placement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Illustration not uploaded'; END IF;
  IF v_current.effect IS NOT DISTINCT FROM p_effect
      AND v_current.effect_intensity IS NOT DISTINCT FROM p_intensity THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'approved', v_current.approved);
  END IF;
  UPDATE public.kl_episode_media SET effect = p_effect,
      effect_intensity = p_intensity, approved = false WHERE id = v_current.id;
  UPDATE public.kl_episodes SET preview_prepared_at = NULL,
      approved_at = NULL, approved_by = NULL, status = 'draft' WHERE id = p_episode_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', false);
END;
$function$;
