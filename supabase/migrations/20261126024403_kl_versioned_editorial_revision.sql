-- Versioned KL editorial text; assessment manuscript and reader records remain immutable.
CREATE TABLE private.kl_editorial_revisions_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.kl_episodes(id),
  base_hash text NOT NULL,
  base_release_at timestamptz NOT NULL,
  title text NOT NULL,
  manuscript text NOT NULL CHECK (length(btrim(manuscript)) BETWEEN 30 AND 200000),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','superseded')),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  prepared_at timestamptz,
  published_at timestamptz,
  published_by uuid
);
ALTER TABLE private.kl_editorial_revisions_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.kl_editorial_revisions_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE UNIQUE INDEX kl_editorial_one_draft_v1 ON private.kl_editorial_revisions_v1(episode_id) WHERE state='draft';
CREATE UNIQUE INDEX kl_editorial_one_published_v1 ON private.kl_editorial_revisions_v1(episode_id) WHERE state='published';

-- Only matching release generations are visible; a reopened/replaced baseline cannot revive stale text.
CREATE FUNCTION private.kl_editorial_current_v1(p_episode_id uuid, p_include_draft boolean)
RETURNS private.kl_editorial_revisions_v1 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
  SELECT r.* FROM private.kl_editorial_revisions_v1 r
  JOIN public.kl_episodes e ON e.id=r.episode_id
  WHERE r.episode_id=p_episode_id AND e.status='approved' AND e.approved_at IS NOT NULL
    AND e.release_at<=now() AND e.release_at=r.base_release_at AND md5(e.manuscript)=r.base_hash
    AND (r.state='published' OR (p_include_draft AND r.state='draft'))
  ORDER BY (r.state='draft') DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.kl_editorial_current_v1(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kl_admin_save_content_v1(p_episode_id uuid, p_title text, p_manuscript text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_existing public.kl_episodes%rowtype; v_revision private.kl_editorial_revisions_v1%rowtype; v_id uuid;
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
  IF v_existing.status='approved' AND v_existing.approved_at IS NOT NULL AND v_existing.release_at<=now() THEN
    IF length(p_manuscript)>200000 THEN RAISE EXCEPTION 'Manuscript exceeds 200000 characters'; END IF;
    SELECT * INTO v_revision FROM private.kl_editorial_current_v1(p_episode_id,true);
    IF coalesce(v_revision.title,v_existing.title)=left(btrim(p_title),250)
      AND coalesce(v_revision.manuscript,v_existing.manuscript)=p_manuscript THEN
      RETURN jsonb_build_object('ok',true,'changed',false,'editorial_revision',v_revision.state='draft','revision_id',v_revision.id);
    END IF;
    UPDATE private.kl_editorial_revisions_v1 SET state='superseded' WHERE episode_id=p_episode_id AND state='draft';
    INSERT INTO private.kl_editorial_revisions_v1(episode_id,base_hash,base_release_at,title,manuscript,actor_id)
      VALUES(p_episode_id,md5(v_existing.manuscript),v_existing.release_at,left(btrim(p_title),250),p_manuscript,auth.uid())
      RETURNING id INTO v_id;
    INSERT INTO public.kl_admin_audit(episode_id,actor_id,action,notes)
      VALUES(p_episode_id,auth.uid(),'editorial_revision_saved','Private version '||v_id::text||'; released assessment and rewards retained');
    RETURN jsonb_build_object('ok',true,'changed',true,'editorial_revision',true,'revision_id',v_id,'published_unchanged',true);
  END IF;
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

CREATE OR REPLACE FUNCTION public.kl_admin_preview_v1(p_episode_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=auth.uid();v_data jsonb; v_revision private.kl_editorial_revisions_v1%rowtype;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_uid AND role::text='system_admin' AND is_active=true) THEN RAISE EXCEPTION 'Story admin access denied'; END IF;
 SELECT jsonb_build_object('id',id,'title',title,'episode_number',episode_number,'status',status,'manuscript',manuscript,'revision_notes',revision_notes,'release_at',release_at,'approved_at',approved_at) INTO v_data FROM public.kl_episodes WHERE id=p_episode_id;
 SELECT * INTO v_revision FROM private.kl_editorial_current_v1(p_episode_id,true);
 IF v_revision.id IS NOT NULL THEN
   v_data:=v_data||jsonb_build_object('title',v_revision.title,'manuscript',v_revision.manuscript,
     'editorial_revision',v_revision.state='draft','revision_id',v_revision.id,'editorial_prepared',v_revision.prepared_at IS NOT NULL);
 END IF;
 RETURN v_data;
END $function$;

CREATE OR REPLACE FUNCTION public.kl_admin_preview_bundle_v1(p_episode_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.kl_episodes%rowtype; v_media jsonb; v_revision private.kl_editorial_revisions_v1%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO v FROM public.kl_episodes WHERE id = p_episode_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not found'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'kind', media_kind, 'placement', placement, 'path', storage_path,
      'anchor', paragraph_anchor, 'side', placement_side,
      'effect', effect, 'intensity', effect_intensity, 'approved', approved
    ) ORDER BY media_kind, placement), '[]'::jsonb) INTO v_media
    FROM public.kl_episode_media WHERE episode_id = p_episode_id;
  SELECT * INTO v_revision FROM private.kl_editorial_current_v1(p_episode_id,true);
  RETURN jsonb_build_object('title', coalesce(v_revision.title,v.title), 'manuscript', coalesce(v_revision.manuscript,v.manuscript),
      'editorial_revision',v_revision.state='draft','revision_id',v_revision.id,
      'version', v.preview_version, 'media', v_media, 'status', v.status,
      'prepared', CASE WHEN v_revision.state='draft' THEN v_revision.prepared_at IS NOT NULL ELSE v.preview_prepared_at IS NOT NULL END);
END;
$function$;

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
  v_revision private.kl_editorial_revisions_v1%rowtype;
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

  SELECT * INTO v_revision FROM private.kl_editorial_current_v1(p_episode_id,true);
  IF v_revision.state='draft' THEN
    UPDATE private.kl_editorial_revisions_v1 SET prepared_at=coalesce(prepared_at,now()) WHERE id=v_revision.id;
    RETURN jsonb_build_object('ready',true,'changed',v_revision.prepared_at IS NULL,
      'editorial_revision',true,'revision_id',v_revision.id,'preview_version',v.preview_version);
  END IF;

  -- Zero uploaded illustrations is valid. For any uploaded illustration, its
  -- saved passage must be unique and occur exactly once in the manuscript.
  -- Checking all uploaded rows prevents an unfinished scene from being silently
  -- omitted from the preview or approved release.
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
      AND m.media_kind = 'illustration';

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

CREATE OR REPLACE FUNCTION public.kl_read_episode_v1(p_episode_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.kl_episodes%rowtype; v_revision private.kl_editorial_revisions_v1%rowtype;
begin
 select * into v from public.kl_episodes where id=p_episode_id FOR SHARE;
 if not found or v.status<>'approved' or v.approved_at is null or v.release_at is null or v.release_at>now() then
 return jsonb_build_object('readable',false,'content','[]'::jsonb);
 end if;
 if auth.uid() is not null then
   insert into public.kl_reading_sessions(user_id,episode_id) values(auth.uid(),p_episode_id)
   on conflict(user_id,episode_id) do nothing;
 end if;
 SELECT * INTO v_revision FROM private.kl_editorial_current_v1(p_episode_id,false);
 return jsonb_build_object('readable',true,'title',v.title,'episode_number',v.episode_number,'content',jsonb_build_array(jsonb_build_object('text',coalesce(v_revision.manuscript,v.manuscript))));
end $function$;

-- Explicit, preview-bound publication of compatible literary corrections.
-- Exact evidence and unique scene anchors must survive; changed assessments/scene mappings need a separate reviewed workflow.
CREATE FUNCTION public.kl_admin_publish_editorial_revision_v1(p_episode_id uuid,p_revision_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v public.kl_episodes%rowtype;
  r private.kl_editorial_revisions_v1%rowtype;
  v_bad_quiz integer;
  v_bad_media integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role::text='system_admin' AND is_active=true)
    THEN RAISE EXCEPTION 'Active System Admin required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.kl_episodes WHERE id=p_episode_id FOR UPDATE;
  IF NOT FOUND OR v.status<>'approved' OR v.approved_at IS NULL OR v.release_at IS NULL OR v.release_at>now()
    THEN RAISE EXCEPTION 'Chapter is not released'; END IF;
  SELECT * INTO r FROM private.kl_editorial_current_v1(p_episode_id,true);
  IF r.id IS DISTINCT FROM p_revision_id OR r.state IS DISTINCT FROM 'draft' OR r.prepared_at IS NULL
    THEN RAISE EXCEPTION 'Save and prepare this exact editorial revision first'; END IF;
  IF r.title IS DISTINCT FROM v.title THEN RAISE EXCEPTION 'Editorial title changes require separate review'; END IF;
  IF length(btrim(r.manuscript))<100 THEN RAISE EXCEPTION 'Complete manuscript required'; END IF;
  -- Lock baseline quiz bank through the episode lock, shared with quiz generation.
  IF NOT EXISTS(SELECT 1 FROM public.kl_quiz_sets WHERE episode_id=v.id AND status='ready' AND manuscript_hash=md5(v.manuscript))
      OR (SELECT count(*) FROM public.kl_quiz_questions WHERE episode_id=v.id)<>5
    THEN RAISE EXCEPTION 'Existing verified quiz bank is not ready'; END IF;
  SELECT count(*) INTO v_bad_quiz FROM public.kl_quiz_questions q WHERE q.episode_id=v.id
    AND (q.evidence IS NULL OR length(btrim(q.evidence))<15 OR position(q.evidence IN r.manuscript)=0);
  SELECT count(*) INTO v_bad_media FROM public.kl_episode_media m WHERE m.episode_id=v.id
    AND (NOT m.approved OR (m.media_kind='illustration' AND
      (m.paragraph_anchor IS NULL OR length(btrim(m.paragraph_anchor))<12 OR
       length(r.manuscript)-length(replace(r.manuscript,m.paragraph_anchor,''))<>length(m.paragraph_anchor))));
  IF v_bad_quiz>0 OR v_bad_media>0 THEN
    RETURN jsonb_build_object('ok',false,'reason','compatibility_review_required','quiz_evidence_conflicts',v_bad_quiz,'media_conflicts',v_bad_media,'draft_retained',true);
  END IF;
  UPDATE private.kl_editorial_revisions_v1 SET state='superseded' WHERE episode_id=v.id AND state='published';
  UPDATE private.kl_editorial_revisions_v1 SET state='published',published_at=now(),published_by=auth.uid() WHERE id=r.id;
  INSERT INTO public.kl_admin_audit(episode_id,actor_id,action,notes)
    VALUES(v.id,auth.uid(),'editorial_revision_published','Editorial presentation version '||r.id::text||'; original assessment hash retained');
  RETURN jsonb_build_object('ok',true,'published',true,'revision_id',r.id);
END $$;
REVOKE ALL ON FUNCTION public.kl_admin_publish_editorial_revision_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.kl_admin_publish_editorial_revision_v1(uuid,uuid) TO authenticated;
