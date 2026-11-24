-- SALIKSIK R3: full manuscript unlocked only after verified nine-part completion.
-- No changes to existing points claims, QMP, member rollout flag or private storage ACLs.
-- Original redistribution requires an explicit, audited source-rights declaration;
-- otherwise the member receives the full published/authorized study manuscript.
ALTER TABLE public.saliksik_sources
 ADD COLUMN IF NOT EXISTS original_member_download_allowed boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS original_download_rights_basis text,
 ADD COLUMN IF NOT EXISTS original_download_rights_updated_by uuid REFERENCES auth.users(id),
 ADD COLUMN IF NOT EXISTS original_download_rights_updated_at timestamptz;

-- Admin may confirm rights once per source; this is NOT approval of individual learners.
CREATE OR REPLACE FUNCTION public.saliksik_admin_set_original_rights_v1(
 p_source_id uuid, p_allowed boolean, p_basis text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_system_admin()
 THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 IF p_allowed IS NULL OR length(btrim(coalesce(p_basis,''))) NOT BETWEEN 20 AND 500
 THEN RAISE EXCEPTION 'source_rights_declaration_required'; END IF;
 UPDATE public.saliksik_sources
 SET original_member_download_allowed=p_allowed,
  original_download_rights_basis=btrim(p_basis),
  original_download_rights_updated_by=auth.uid(),
  original_download_rights_updated_at=now()
 WHERE id=p_source_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'source_missing'; END IF;
 RETURN jsonb_build_object('ok',true,'allowed',p_allowed);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_admin_original_rights_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_system_admin()
 THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((
   SELECT jsonb_object_agg(s.id::text,s.original_member_download_allowed)
   FROM public.saliksik_sources s
 ),'{}'::jsonb);
END $fn$;

-- Sole entitlement authority. Never accept a user_id from the client.
-- Caller must be authenticated and have finished all nine immutable investigations.
-- Claiming pending BUKLOD Points is NOT a manuscript requirement.
CREATE OR REPLACE FUNCTION public.saliksik_manuscript_access_v1(p_collection_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_user uuid:=auth.uid();
 v_title text; v_version int; v_status text;
 v_original_allowed boolean; v_original_path text; v_original_name text;
 v_count int; v_completed int; v_chapters jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout r WHERE r.id AND r.member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released' USING ERRCODE='42501'; END IF;
 SELECT c.title,c.version,c.status,s.original_member_download_allowed,
        s.storage_path,s.file_name
 INTO v_title,v_version,v_status,v_original_allowed,v_original_path,v_original_name
 FROM public.saliksik_collections c
 JOIN public.saliksik_sources s ON s.id=c.source_id
 WHERE c.id=p_collection_id;
 IF NOT FOUND OR v_status<>'published'
 THEN RAISE EXCEPTION 'collection_not_available' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.saliksik_series_mastery m
   WHERE m.collection_id=p_collection_id AND m.version=v_version AND m.user_id=v_user
 ) THEN RAISE EXCEPTION 'complete_collection_first' USING ERRCODE='42501'; END IF;
 SELECT count(*),count(m.investigation_id)
 INTO v_count,v_completed
 FROM public.saliksik_investigations i
 LEFT JOIN public.saliksik_mastery m ON m.investigation_id=i.id
   AND m.user_id=v_user AND m.version=i.version
 WHERE i.collection_id=p_collection_id AND i.status='published';
 IF v_count<>9 OR v_completed<>9 OR
   (SELECT count(*) FROM public.saliksik_investigations i
     WHERE i.collection_id=p_collection_id AND i.status='published' AND i.tier='master')<>1
 THEN RAISE EXCEPTION 'complete_collection_first' USING ERRCODE='42501'; END IF;

 SELECT jsonb_agg(jsonb_build_object(
   'sequence',i.sequence,'title',i.title,'summary',i.summary,
   'lesson_text',i.lesson_text,'scripture_refs',i.scripture_refs
 ) ORDER BY i.sequence) INTO v_chapters
 FROM public.saliksik_investigations i
 WHERE i.collection_id=p_collection_id AND i.status='published';

 RETURN jsonb_build_object(
   'collection_id',p_collection_id,'title',v_title,'version',v_version,
   'author_disclosure',(
      SELECT c.author_disclosure FROM public.saliksik_collections c WHERE c.id=p_collection_id
   ),
   'original_available',v_original_allowed,
   'original_storage_path',CASE WHEN v_original_allowed THEN v_original_path ELSE NULL END,
   'original_file_name',CASE WHEN v_original_allowed THEN v_original_name ELSE NULL END,
   'chapters',v_chapters
 );
END $fn$;

-- Public functions start as executable by PUBLIC unless explicitly revoked.
REVOKE ALL ON FUNCTION public.saliksik_admin_set_original_rights_v1(uuid,boolean,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.saliksik_admin_original_rights_v1()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.saliksik_manuscript_access_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saliksik_admin_set_original_rights_v1(uuid,boolean,text)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.saliksik_admin_original_rights_v1()
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.saliksik_manuscript_access_v1(uuid)
 TO authenticated;
