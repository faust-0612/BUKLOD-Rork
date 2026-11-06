-- KL unlocked unread published chapters, 2026-11-07.
-- No application/OTA changes. Live functions copied from current Supabase definition;
-- changes scoped to guard, audit, row locking and reader accounting.
-- Public chapter disappears from reader immediately after first valid editor mutation,
-- then must go through the existing preview/approval/release workflow again.
-- Never discard reader progress, awards or editorial audit.
-- Limited, audited reopening: requires a signed-in active system admin.
-- A released chapter stays public until a real editor mutation; first mutation
-- atomically revokes its release only if no tracked reader activity exists.
CREATE OR REPLACE FUNCTION public.kl_admin_unlock_unread_release_v1(p_episode_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_episode public.kl_episodes%rowtype;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor AND p.role::text = 'system_admin' AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Story admin access denied';
  END IF;
  SELECT * INTO v_episode FROM public.kl_episodes
  WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not found'; END IF;
  IF v_episode.release_at IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.kl_reading_sessions WHERE episode_id = p_episode_id)
    OR EXISTS (SELECT 1 FROM public.kl_story_achievements WHERE episode_id = p_episode_id)
    OR EXISTS (SELECT 1 FROM public.kl_episode_comments WHERE episode_id = p_episode_id)
    OR EXISTS (SELECT 1 FROM public.buklod_points_ledger
               WHERE source_id = p_episode_id AND (activity_type LIKE 'kl_%' OR source_key LIKE 'kl:%'))
  THEN
    RAISE EXCEPTION 'Released chapter protected: reader activity or rewards exist';
  END IF;
  UPDATE public.kl_episodes
    SET status = 'draft', release_at = NULL, approved_at = NULL,
        approved_by = NULL, preview_prepared_at = NULL, reviewed_at = now()
    WHERE id = p_episode_id;
  INSERT INTO public.kl_admin_audit(episode_id,actor_id,action,notes)
  VALUES (p_episode_id,v_actor,'reopen_unread',
    'Unreleased unread chapter before editorial change; previous release_at=' || v_episode.release_at::text);
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.kl_admin_unlock_unread_release_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- kl_admin_save_content_v1
CREATE OR REPLACE FUNCTION public.kl_admin_save_content_v1(p_episode_id uuid, p_title text, p_manuscript text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_existing public.kl_episodes%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF length(btrim(coalesce(p_title, ''))) < 3 OR length(btrim(coalesce(p_manuscript, ''))) < 30 THEN
    RAISE EXCEPTION 'Title or manuscript too short';
  END IF;
  SELECT * INTO v_existing FROM public.kl_episodes
    WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter missing'; END IF;
  IF v_existing.title IS NOT DISTINCT FROM left(btrim(p_title), 250)
      AND v_existing.manuscript IS NOT DISTINCT FROM p_manuscript THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;
  PERFORM public.kl_admin_unlock_unread_release_v1(p_episode_id);
  UPDATE public.kl_episodes SET title = left(btrim(p_title), 250),
      manuscript = p_manuscript, status = 'draft', approved_at = NULL,
      approved_by = NULL, preview_prepared_at = NULL
    WHERE id = p_episode_id;
  UPDATE public.kl_episode_media SET approved = false
    WHERE episode_id = p_episode_id AND media_kind = 'illustration'
      AND (paragraph_anchor IS NULL OR
        (length(p_manuscript) - length(replace(p_manuscript, paragraph_anchor, '')))
        <> length(paragraph_anchor));
  RETURN jsonb_build_object('ok', true, 'changed', true);
END;
$function$;

-- kl_admin_media_save_v1
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
 if not exists(select 1 from public.kl_episodes where id=p_episode_id) then raise exception 'Chapter not editable'; end if;
 if not exists(select 1 from storage.objects where bucket_id='kl-publishing' and name=p_path) then raise exception 'Upload file before saving metadata'; end if;
 perform public.kl_admin_unlock_unread_release_v1(p_episode_id);
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

-- kl_admin_place_media_v1
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
    WHERE id = p_episode_id FOR UPDATE;
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
  PERFORM public.kl_admin_unlock_unread_release_v1(p_episode_id);
  UPDATE public.kl_episode_media SET paragraph_anchor = v_anchor,
      placement_side = p_side, approved = false WHERE id = v_current.id;
  UPDATE public.kl_episodes SET preview_prepared_at = NULL,
      approved_at = NULL, approved_by = NULL, status = 'draft' WHERE id = p_episode_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', false);
END;
$function$;

-- kl_admin_scene_effect_v1
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
  PERFORM 1 FROM public.kl_episodes WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not editable'; END IF;
  SELECT * INTO v_current FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = 'illustration' AND placement = p_placement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Illustration not uploaded'; END IF;
  IF v_current.effect IS NOT DISTINCT FROM p_effect
      AND v_current.effect_intensity IS NOT DISTINCT FROM p_intensity THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'approved', v_current.approved);
  END IF;
  PERFORM public.kl_admin_unlock_unread_release_v1(p_episode_id);
  UPDATE public.kl_episode_media SET effect = p_effect,
      effect_intensity = p_intensity, approved = false WHERE id = v_current.id;
  UPDATE public.kl_episodes SET preview_prepared_at = NULL,
      approved_at = NULL, approved_by = NULL, status = 'draft' WHERE id = p_episode_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', false);
END;
$function$;

-- kl_admin_media_approve_v1
CREATE OR REPLACE FUNCTION public.kl_admin_media_approve_v1(p_episode_id uuid, p_kind text, p_placement integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_manuscript text;
  v_current public.kl_episode_media%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Story admin access denied';
  END IF;
  SELECT manuscript INTO v_manuscript FROM public.kl_episodes
    WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not editable'; END IF;
  SELECT * INTO v_current FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = p_kind AND placement = p_placement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Media not found'; END IF;
  IF p_kind = 'illustration' AND (
      v_current.paragraph_anchor IS NULL OR length(btrim(v_current.paragraph_anchor)) < 12
      OR v_manuscript IS NULL
      OR (length(v_manuscript) - length(replace(v_manuscript, v_current.paragraph_anchor, '')))
          <> length(v_current.paragraph_anchor)) THEN
    RAISE EXCEPTION 'Save a valid, unique paragraph placement for this scene before approval';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects
      WHERE bucket_id = 'kl-publishing' AND name = v_current.storage_path) THEN
    RAISE EXCEPTION 'Private media file missing; re-upload before approval';
  END IF;
  IF v_current.approved THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'approved', true);
  END IF;
  PERFORM public.kl_admin_unlock_unread_release_v1(p_episode_id);
  UPDATE public.kl_episode_media SET approved = true WHERE id = v_current.id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', true);
END;
$function$;

-- kl_admin_prepare_preview_v1
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
  SELECT * INTO v FROM public.kl_episodes WHERE id = p_episode_id FOR UPDATE;
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
  PERFORM public.kl_admin_unlock_unread_release_v1(p_episode_id);
  UPDATE public.kl_episodes SET preview_version = preview_version + 1,
      preview_prepared_at = now() WHERE id = p_episode_id;
  RETURN jsonb_build_object('ready', true, 'changed', true,
      'preview_version', v.preview_version + 1, 'location', 'Community Wall KL Admin card');
END;
$function$;

-- kl_admin_action_v1
CREATE OR REPLACE FUNCTION public.kl_admin_action_v1(p_episode_id uuid, p_action text, p_notes text DEFAULT NULL::text, p_manila_date text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_row public.kl_episodes%rowtype; v_when timestamptz;
begin
 if not exists(select 1 from public.profiles where id=v_uid and role::text='system_admin' and is_active=true) then raise exception 'Story admin access denied'; end if;
 if p_action not in ('approve','reject','revise','schedule','release','pause','resume') then raise exception 'Unsupported action'; end if;
 select * into v_row from public.kl_episodes where id=p_episode_id for update;
 if not found then raise exception 'Episode not found'; end if;
 if p_action in ('approve','schedule','release') and v_row.preview_prepared_at is null then raise exception 'Prepare preview in Profile before approval or release'; end if;
 if p_action in ('approve','schedule','release') and exists(select 1 from public.kl_episode_media where episode_id=p_episode_id and approved=false) then raise exception 'Approve all chapter media in Community Wall admin first'; end if;
 if p_action='approve' then
  if length(trim(coalesce(v_row.manuscript,'')))<100 then raise exception 'Complete manuscript required'; end if;
  if v_row.release_at is not null and v_row.release_at<=now() then raise exception 'Already released'; end if;
  update public.kl_episodes set status='approved',approved_at=now(),approved_by=v_uid,revision_notes=null,reviewed_at=now() where id=p_episode_id;
 elsif p_action in ('reject','revise') then
  if length(trim(coalesce(p_notes,'')))<5 then raise exception 'Rejection feedback required'; end if;
  if v_row.release_at is not null then perform public.kl_admin_unlock_unread_release_v1(p_episode_id); end if;
  update public.kl_episodes set status='draft',revision_notes=trim(p_notes),reviewed_at=now(),release_at=null,approved_at=null,approved_by=null,preview_prepared_at=null where id=p_episode_id;
 elsif p_action='schedule' then
  if v_row.status<>'approved' then raise exception 'Approve before scheduling'; end if;
  if p_manila_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Use YYYY-MM-DD'; end if;
  v_when:=(p_manila_date||' 06:00:00 Asia/Manila')::timestamptz;
  if v_when<=now() then raise exception 'Release must be in the future'; end if;
  update public.kl_episodes set release_at=v_when where id=p_episode_id;
 elsif p_action='release' then
  if v_row.status<>'approved' or v_row.approved_at is null then raise exception 'Approve before release'; end if;
  if length(trim(coalesce(v_row.manuscript,'')))<100 then raise exception 'Complete manuscript required'; end if;
  if v_row.release_at is not null and v_row.release_at<=now() then raise exception 'Chapter already released'; end if;
  update public.kl_episodes set release_at=now() where id=p_episode_id;
 elsif p_action='pause' then
  update public.kl_episodes set status='paused' where id=p_episode_id;
 elsif p_action='resume' then
  if v_row.approved_at is null then raise exception 'Cannot resume without approval'; end if;
  update public.kl_episodes set status='approved' where id=p_episode_id;
 end if;
 insert into public.kl_admin_audit(episode_id,actor_id,action,notes) values(p_episode_id,v_uid,p_action,left(p_notes,2000));
 return jsonb_build_object('ok',true,'action',p_action,'episode_id',p_episode_id,'message','Saved on server');
end $function$;

-- kl_read_episode_v1
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
 if auth.uid() is not null then
   insert into public.kl_reading_sessions(user_id,episode_id) values(auth.uid(),p_episode_id)
   on conflict(user_id,episode_id) do nothing;
 end if;
 return jsonb_build_object('readable',true,'title',v.title,'episode_number',v.episode_number,'content',jsonb_build_array(jsonb_build_object('text',v.manuscript)));
end $function$;

-- kl_reading_progress_v1
CREATE OR REPLACE FUNCTION public.kl_reading_progress_v1(p_episode_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid(); v_session public.kl_reading_sessions%rowtype; v_episode public.kl_episodes%rowtype; v_awarded boolean:=false; v_season_count integer; v_finished integer;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 select * into v_episode from public.kl_episodes where id=p_episode_id and status='approved' and approved_at is not null and release_at<=now() FOR SHARE;
 if not found then raise exception 'Chapter not released'; end if;
 if p_action='start' then
  insert into public.kl_reading_sessions(user_id,episode_id) values(v_user,p_episode_id)
  on conflict(user_id,episode_id) do nothing;
 elsif p_action='ping' then
  update public.kl_reading_sessions set last_ping_at=now(),ping_count=least(10000,ping_count+1)
  where user_id=v_user and episode_id=p_episode_id and completed_at is null and last_ping_at<=now()-interval '15 seconds';
 elsif p_action='complete' then
  select * into v_session from public.kl_reading_sessions where user_id=v_user and episode_id=p_episode_id for update;
  if not found or v_session.started_at>now()-interval '90 seconds' or v_session.ping_count<2 then
   return jsonb_build_object('completed',false,'reason','reading_engagement_not_verified');
  end if;
  if v_session.completed_at is null then
   update public.kl_reading_sessions set completed_at=now() where user_id=v_user and episode_id=p_episode_id;
   perform public.buklod_award_verification_points_v1(v_user,7,'kl_episode_completion','kl:episode:'||v_user||':'||p_episode_id,p_episode_id,'KL first verified chapter completion',null);
   v_awarded:=true;
  end if;
  select count(*) into v_season_count from public.kl_episodes where season_number=v_episode.season_number and status='approved' and release_at<=now();
  select count(*) into v_finished from public.kl_reading_sessions s join public.kl_episodes e on e.id=s.episode_id where s.user_id=v_user and s.completed_at is not null and e.season_number=v_episode.season_number and e.status='approved' and e.release_at<=now();
  if v_season_count=30 and v_finished=30 then
   perform public.buklod_award_verification_points_v1(v_user,10,'kl_season_completion','kl:season:'||v_user||':'||v_episode.season_number,p_episode_id,'KL first full season completion',null);
   insert into public.kl_story_achievements(user_id,achievement_key,episode_id)
   values(v_user,'kl:season:'||v_episode.season_number,p_episode_id) on conflict do nothing;
  end if;
 else raise exception 'Invalid reading action';
 end if;
 return jsonb_build_object('ok',true,'new_completion',v_awarded,'points_awarded',case when v_awarded then 7 else 0 end);
end $function$;
