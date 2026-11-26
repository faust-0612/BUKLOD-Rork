-- DEV candidate: recovered Quiz RPCs; not authorized for automatic deployment.
CREATE OR REPLACE FUNCTION public.buklod_quiz_finalize_attempt_v2(p_attempt_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_pending integer;
  v_status text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id for update of a;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;

  if v_status in ('RELEASED','GRADED') then return v_status; end if;
  if v_status is distinct from 'NEEDS_REVIEW' then raise exception 'Attempt is not awaiting review.'; end if;
  select count(*) into v_pending
  from public.buklod_quiz_responses r
  join public.buklod_quiz_questions q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true;
  if v_pending>0 then raise exception 'Manual review is still incomplete for % response(s).',v_pending; end if;

  v_status:=public.buklod_quiz_compute_attempt_internal(p_attempt_id);
  return v_status;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_finalize_attempt_v2(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_finalize_attempt_v2(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_release_section_v1(p_exam_id uuid, p_section_id uuid, p_show_violations boolean DEFAULT false, p_show_answers boolean DEFAULT false, p_show_rationale boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid()); v_attempt uuid; v_released integer:=0; v_failed integer:=0; v_pending_review integer:=0; v_in_progress integer:=0;
  v_not_started integer:=0; v_already_released integer:=0; v_total_students integer:=0; v_eligible integer:=0; v_legacy_score_only integer:=0;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id where e.id=p_exam_id and e.owner_user_id=v_actor) then raise exception 'Exam owner access required.'; end if;
  with d as (select * from public.buklod_quiz_record_diagnostics_v1(p_exam_id,p_section_id)), latest as (
    select r.student_user_id,a.status from public.buklod_quiz_roster r left join lateral (
      select ax.status from public.buklod_quiz_attempts ax where ax.exam_id=p_exam_id and ax.section_id=p_section_id and ax.student_user_id=r.student_user_id and ax.status<>'VOID' order by ax.attempt_no desc,ax.created_at desc limit 1
    ) a on true where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  )
  select count(*)::integer,count(*) filter(where l.status is null)::integer,count(*) filter(where l.status='STARTED')::integer,
    count(*) filter(where coalesce(d.pending_review_count,0)>0)::integer,count(*) filter(where l.status='RELEASED')::integer,
    count(*) filter(where coalesce(d.release_eligible,false))::integer,count(*) filter(where coalesce(d.release_eligible,false) and coalesce(d.legacy_score_only,false))::integer
  into v_total_students,v_not_started,v_in_progress,v_pending_review,v_already_released,v_eligible,v_legacy_score_only
  from latest l left join d on d.student_user_id=l.student_user_id;
  for v_attempt in select d.attempt_id from public.buklod_quiz_record_diagnostics_v1(p_exam_id,p_section_id) d where d.release_eligible=true and d.attempt_id is not null loop
    begin if public.buklod_quiz_release_attempt_v2(v_attempt,p_show_violations,p_show_answers,p_show_rationale) then v_released:=v_released+1; else v_failed:=v_failed+1; end if;
    exception when others then v_failed:=v_failed+1; end;
  end loop;
  return jsonb_build_object('ok',true,'total_students',v_total_students,'eligible_count',v_eligible,'released_count',v_released,'failed_count',v_failed,'already_released',v_already_released,'pending_review',v_pending_review,'in_progress',v_in_progress,'not_started',v_not_started,'legacy_score_only_eligible',v_legacy_score_only,'visibility_requested',jsonb_build_object('score',true,'violations',coalesce(p_show_violations,false),'answers',coalesce(p_show_answers,false) or coalesce(p_show_rationale,false),'rationale',coalesce(p_show_rationale,false)),'note','Unavailable legacy answers/rationale/violation details are never fabricated; those records release score only.');
end;$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_release_section_v1(uuid,uuid,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_release_section_v1(uuid,uuid,boolean,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_review_job_start_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS public.buklod_quiz_review_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_job public.buklod_quiz_review_jobs;
  v_attempts uuid[];
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=v_actor) then
    raise exception 'Exam owner access required.';
  end if;
  if not exists(select 1 from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id) then
    raise exception 'Section not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_exam_id::text || ':' || p_section_id::text, 0));
  select j.* into v_job from public.buklod_quiz_review_jobs j
  where j.exam_id=p_exam_id and j.section_id=p_section_id and j.created_by=v_actor and j.status in ('QUEUED','RUNNING')
  order by j.created_at desc limit 1;
  if found then return v_job; end if;

  select coalesce(array_agg(distinct a.id order by a.id), '{}') into v_attempts
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses r on r.attempt_id=a.id
  join public.buklod_quiz_questions q on q.id=r.question_id
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and a.status='NEEDS_REVIEW'
    and r.manual_score is null
    and r.needs_review is true
    and q.exam_id=a.exam_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL');

  insert into public.buklod_quiz_review_jobs(exam_id,section_id,created_by,status,attempt_ids,total_attempts,started_at,heartbeat_at)
  values(p_exam_id,p_section_id,v_actor,case when coalesce(array_length(v_attempts,1),0)=0 then 'COMPLETED' else 'QUEUED' end,
         v_attempts,coalesce(array_length(v_attempts,1),0),case when coalesce(array_length(v_attempts,1),0)>0 then now() end,now())
  returning * into v_job;
  if v_job.total_attempts=0 then
    update public.buklod_quiz_review_jobs set completed_at=now(),updated_at=now() where id=v_job.id returning * into v_job;
  end if;
  return v_job;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_job_start_v1(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_job_start_v1(uuid,uuid) TO authenticated;

