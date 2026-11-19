-- KL manuscript-only private previews. Scene illustrations are optional (0–12).
-- Preserve the current admin gate, editorial unlock, individual media approval,
-- existing chapters, attached media and release eligibility checks.
-- NO production migration is executed merely by committing this file.
CREATE OR REPLACE FUNCTION public.kl_admin_prepare_preview_v1(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.kl_episodes%rowtype;
  v_total integer;
  v_valid integer;
  v_unique integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v FROM public.kl_episodes
    WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND OR v.manuscript IS NULL OR length(btrim(v.manuscript)) < 30 THEN
    RAISE EXCEPTION 'Complete and save an editable manuscript first';
  END IF;

  -- Unapproved optional photo drafts remain private. For any approved illustration, its
  -- saved passage must be unique and occur exactly once in the manuscript.
  -- Only approved media are eligible for public display; draft photos are excluded.
  SELECT count(*),
         count(*) FILTER (
           WHERE m.paragraph_anchor IS NOT NULL
             AND length(btrim(m.paragraph_anchor)) >= 12
             AND (length(v.manuscript)
                 - length(replace(v.manuscript, m.paragraph_anchor, '')))
                  = length(m.paragraph_anchor)
         ),
         count(DISTINCT m.paragraph_anchor)
    INTO v_total, v_valid, v_unique
    FROM public.kl_episode_media m
    WHERE m.episode_id = p_episode_id
      AND m.media_kind = 'illustration' AND m.approved = true;

  IF v_total > 12 OR v_valid <> v_total OR v_unique <> v_total THEN
    RAISE EXCEPTION 'Uploaded illustrations need distinct valid manuscript placements (maximum 12); remove unfinished photos or finish their placements';
  END IF;

  IF v.preview_prepared_at IS NOT NULL THEN
    RETURN jsonb_build_object('ready', true, 'changed', false,
      'preview_version', v.preview_version,
      'location', 'Community Wall KL Admin card');
  END IF;

  -- Preserve the live RPC's released-chapter engagement/reward guard.
  PERFORM public.kl_admin_unlock_unread_release_v1(p_episode_id);

  UPDATE public.kl_episodes
    SET preview_version = preview_version + 1,
        preview_prepared_at = now()
    WHERE id = p_episode_id;

  RETURN jsonb_build_object('ready', true, 'changed', true,
    'preview_version', v.preview_version + 1,
    'location', 'Community Wall KL Admin card');
END;
$function$;

-- Do not modify EXECUTE ACLs; the existing authenticated caller gate remains.

-- Preserve live admin-role, editorial, schedule and audit logic; exclude ONLY
-- optional unapproved illustration drafts from the media release blocker.
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
 if p_action in ('approve','schedule','release') and exists(
  select 1 from public.kl_episode_media
  where episode_id=p_episode_id and approved=false and media_kind <> 'illustration'
 ) then raise exception 'Approve all non-illustration media before chapter release'; end if;
 -- Unapproved illustration drafts stay private. Only explicitly approved
 -- illustrations may appear to readers, and their anchors must still be valid.
 if p_action in ('approve','schedule','release') and exists(
  select 1 from public.kl_episode_media m
  where m.episode_id=p_episode_id and m.approved=true and m.media_kind='illustration'
   and (m.paragraph_anchor is null or length(btrim(m.paragraph_anchor)) < 12
    or v_row.manuscript is null
    or (length(v_row.manuscript)
     - length(replace(v_row.manuscript,m.paragraph_anchor,''))) <> length(m.paragraph_anchor))
 ) then raise exception 'Approved illustration placement no longer matches manuscript'; end if;
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
