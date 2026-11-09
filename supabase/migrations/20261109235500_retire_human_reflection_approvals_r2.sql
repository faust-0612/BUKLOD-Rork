-- BUKLOD 2026-11-09: disable legacy human reflection approval and protect reward RPCs.
-- Preserve report/monitor access and non-reflection evidence verification.

CREATE OR REPLACE FUNCTION public.reviewer_get_daily_bible_monitor_v3(p_assignment_id uuid)
 RETURNS TABLE(assignment_id uuid, reading_date date, bible_reference text, user_id uuid, full_name text, church_id uuid, church_name text, submission_id uuid, bible_text text, bible_photo_path text, chapter_questions_fil jsonb, chapter_questions_en jsonb, question_answers jsonb, answer_language text, reflection_text text, reflection_photo_path text, submission_status text, submitted_at timestamp with time zone, submitted_on_time boolean, has_bible_photo boolean, has_reflection_photo boolean, reviewer_can_act boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  actor_is_system_admin boolean := public.buklod_is_system_admin();
  actor_has_scope boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.buklod_scopes s
    where s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED')
      and public.buklod_is_formation_scope_approver_v1(s.id, actor)
  ) into actor_has_scope;

  if not actor_is_system_admin and not actor_has_scope then
    raise exception 'Formation monitoring access required';
  end if;

  return query
  with submitted_rows as (
    select
      a.id::uuid as assignment_id,
      a.reading_date::date as reading_date,
      a.bible_reference::text as bible_reference,
      sub.user_id::uuid as user_id,
      coalesce(p.full_name, 'BUKLOD Member')::text as full_name,
      p.church_id::uuid as church_id,
      coalesce(c.name, 'No Local')::text as church_name,
      sub.id::uuid as submission_id,
      sub.bible_text::text as bible_text,
      sub.bible_photo_path::text as bible_photo_path,
      coalesce(a.chapter_questions_fil, '[]'::jsonb)::jsonb as chapter_questions_fil,
      coalesce(a.chapter_questions_en, '[]'::jsonb)::jsonb as chapter_questions_en,
      coalesce(sub.question_answers, '[]'::jsonb)::jsonb as question_answers,
      coalesce(sub.answer_language::text, 'fil')::text as answer_language,
      sub.answer_text::text as reflection_text,
      sub.reflection_photo_path::text as reflection_photo_path,
      (
        case
          when sub.status::text = 'approved' then 'approved'
          when sub.status::text = 'rejected' then 'revision_required'
          when sub.id is not null and appr.status::text = 'EVALUATING' then 'ai_checking'
          when sub.id is not null and appr.status::text = 'PENDING' then 'ai_checked_pending_review'
          else 'submitted'
        end
      )::text as submission_status,
      sub.submitted_at::timestamptz as submitted_at,
      coalesce(sub.submitted_on_time, false)::boolean as submitted_on_time,
      (
        sub.bible_photo_path is not null
        and exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'daily-bible-evidence'
            and o.name = sub.bible_photo_path
        )
      )::boolean as has_bible_photo,
      (
        sub.reflection_photo_path is not null
        and exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'daily-bible-evidence'
            and o.name = sub.reflection_photo_path
        )
      )::boolean as has_reflection_photo,
      false::boolean as reviewer_can_act
    from public.daily_bible_submissions sub
    join public.daily_bible_assignments a on a.id = sub.assignment_id
    join public.profiles p on p.id = sub.user_id
    left join public.churches c on c.id = p.church_id
    left join lateral (
      select fa.id, fa.scope_id, fa.status
      from public.buklod_scope_formation_approvals_v2 fa
      where fa.learner_id = sub.user_id
        and fa.item_kind = 'DAILY_READING'
        and fa.item_id = sub.id
        and (sub.cluster_id is null or fa.scope_id = sub.cluster_id)
      order by fa.created_at desc
      limit 1
    ) appr on true
    where sub.assignment_id = p_assignment_id
      and (
        actor_is_system_admin
        or (
          sub.cluster_id is not null
          and public.buklod_is_formation_scope_approver_v1(sub.cluster_id, actor)
        )
        or (
          sub.cluster_id is null
          and appr.scope_id is not null
          and public.buklod_is_formation_scope_approver_v1(appr.scope_id, actor)
        )
      )
  ),
  roster_rows as (
    select
      r.assignment_id::uuid,
      r.reading_date::date,
      r.bible_reference::text,
      r.user_id::uuid,
      r.full_name::text,
      r.church_id::uuid,
      r.church_name::text,
      r.submission_id::uuid,
      r.bible_text::text,
      r.bible_photo_path::text,
      r.chapter_questions_fil::jsonb,
      r.chapter_questions_en::jsonb,
      r.question_answers::jsonb,
      r.answer_language::text,
      r.reflection_text::text,
      r.reflection_photo_path::text,
      r.submission_status::text,
      r.submitted_at::timestamptz,
      r.submitted_on_time::boolean,
      r.has_bible_photo::boolean,
      r.has_reflection_photo::boolean,
      r.reviewer_can_act::boolean
    from public.reviewer_get_daily_bible_monitor_legacy_cluster_visibility_r1(
      p_assignment_id
    ) r
    where r.submission_id is null
  )
  select * from submitted_rows
  union all
  select * from roster_rows;
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_approve_cluster_formation_item_v1(p_cluster_id uuid, p_learner_id uuid, p_item_kind text, p_item_id text, p_approve boolean, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_kind text := upper(COALESCE(NULLIF(btrim(p_item_kind), ''), ''));
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF v_kind IN ('DAILY_READING','DEVOTION_WORD','LESSON') THEN
    RAISE EXCEPTION 'Formation reflection approval is AI-only. No Cluster, Pastor, Mentor, or Admin approval is allowed.';
  END IF;

  IF v_kind NOT IN ('DAILY_READING', 'DEVOTION_WORD', 'LESSON', 'CCP', 'DISCIPLESHIP', 'MENTORING') THEN
    RAISE EXCEPTION 'Unsupported approval item';
  END IF;

  IF v_user = p_learner_id AND NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'Members cannot approve their own completion';
  END IF;

  IF NOT public.buklod_is_cluster_approver(p_cluster_id, v_user) THEN
    RAISE EXCEPTION 'Approval requires Cluster Head, Mentor, or Pastor authority in this Cluster';
  END IF;

  IF NOT public.buklod_user_is_active_scope_member(p_cluster_id, p_learner_id) THEN
    RAISE EXCEPTION 'Learner is not an active member of this Cluster';
  END IF;

  IF NOT public.buklod_scope_is_active_lifecycle(p_cluster_id) THEN
    RAISE EXCEPTION 'This Cluster is not active';
  END IF;

  UPDATE public.buklod_cluster_formation_approvals
  SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      approver_id = v_user,
      remarks = NULLIF(btrim(COALESCE(p_remarks, '')), ''),
      decided_at = now(),
      updated_at = now()
  WHERE cluster_id = p_cluster_id
    AND learner_id = p_learner_id
    AND item_kind = v_kind
    AND item_id = NULLIF(btrim(p_item_id), '')
    AND status = 'PENDING'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO public.buklod_cluster_formation_approvals (
      cluster_id, learner_id, approver_id, item_kind, item_id, status, remarks, decided_at
    )
    VALUES (
      p_cluster_id,
      p_learner_id,
      v_user,
      v_kind,
      NULLIF(btrim(p_item_id), ''),
      CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      NULLIF(btrim(COALESCE(p_remarks, '')), ''),
      now()
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'approval_id', v_id, 'status', CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_member_lesson_attempt(
  p_attempt_id uuid,p_approve boolean,p_admin_note text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
BEGIN
  RAISE EXCEPTION 'Manual lesson approval is retired. BUKLOD AI validates the five required responses and awards points automatically.';
END;
$body$;

CREATE OR REPLACE FUNCTION public.pastor_validate_learning_progress_v2(
  p_progress_id uuid,p_pastor_note text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
BEGIN
  RAISE EXCEPTION 'Pastor/Mentor approval of lesson reflections is retired. Submit using the learner''s automatic validation flow.';
END;
$body$;

-- These helpers must run only from trusted server-side functions and triggers.
REVOKE EXECUTE ON FUNCTION public.buklod_payout_daily_bible_rewards_v1(uuid,uuid,uuid,text,date,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.buklod_award_rule_mapped_points_v1(uuid,text,text,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.record_member_lesson_completion(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_review_member_lesson_attempt(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.buklod_finalize_auto_formation_v1(uuid,text,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
