-- R17 isolated DEV candidate. No live release until rollback and device/offline E2E QA.
-- All start contracts route to one checked snapshot-aware path.
CREATE OR REPLACE FUNCTION public.buklod_quiz_snapshot_live_session_v1(p_session_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  v_selected uuid[];
  v_expected integer;
  v_count integer;
  v_hash text;
  v_pts numeric;
  v_actor_kind text;
begin
  select ls.* into s
  from public.buklod_quiz_live_sessions ls
  where ls.id=p_session_id
    and (
      ls.faculty_user_id=v_actor
      or (
        ls.status='LIVE'
        and exists(
          select 1 from public.buklod_quiz_live_members m
          where m.session_id=ls.id and m.student_user_id=v_actor and m.status='ADMITTED'
        )
      )
    )
  for update;
  if s.id is null then raise exception 'Live class not found or unauthorized.'; end if;
  v_actor_kind:=case when s.faculty_user_id=v_actor then 'FACULTY' else 'ADMITTED_STUDENT_LEGACY_RECOVERY' end;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  if e.id is null then raise exception 'Exam not found.'; end if;

  select count(*)::int into v_count
  from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id;
  if v_count>0 then return v_count; end if;

  v_selected:=s.selected_question_ids;
  if coalesce(array_length(v_selected,1),0)=0 then
    select array_agg(q.id order by q.sort_order,q.id) into v_selected
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id and q.is_active=true;
  end if;
  v_expected:=coalesce(array_length(v_selected,1),0);
  if s.question_count IS NOT NULL AND s.question_count>0 AND s.question_count<>v_expected THEN raise exception 'Configured question count differs from selected questions; faculty must prepare room again.'; END IF;
  if v_expected<1 then raise exception 'Add at least one active question before starting.'; end if;

  if exists(
    select 1 from unnest(v_selected) x(question_id)
    where not exists(
      select 1 from public.buklod_quiz_questions q
      where q.id=x.question_id and q.exam_id=s.exam_id and q.is_active=true
    )
  ) then raise exception 'One or more selected live questions are missing or inactive.'; end if;

  insert into public.buklod_quiz_live_question_snapshots(
    session_id,question_id,question_type,prompt,options,correct_answer,points,sort_order,
    source_pages,rubric,explanation,snapshot_order
  )
  select s.id,q.id,q.question_type,q.prompt,q.options,q.correct_answer,q.points,q.sort_order,
         q.source_pages,q.rubric,q.explanation,
         coalesce(array_position(v_selected,q.id),row_number() over(order by q.sort_order,q.id)::int)
  from public.buklod_quiz_questions q
  where q.exam_id=s.exam_id and q.id=any(v_selected) and q.is_active=true
  order by coalesce(array_position(v_selected,q.id),q.sort_order),q.id;

  select count(*)::int,coalesce(sum(x.points),0),
         md5(string_agg(
           x.question_id::text||'|'||x.question_type||'|'||x.prompt||'|'||
           coalesce(x.options::text,'')||'|'||coalesce(x.correct_answer::text,'')||'|'||
           x.points::text||'|'||x.snapshot_order::text,
           '||' order by x.snapshot_order,x.question_id
         ))
    into v_count,v_pts,v_hash
  from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id;
  if v_count<>v_expected then raise exception 'Live question snapshot is incomplete.'; end if;

  update public.buklod_quiz_live_sessions ls set
    selected_question_ids=v_selected,question_count=v_count,
    total_score_target=coalesce(nullif(ls.total_score_target,0),v_pts),
    duration_minutes=coalesce(ls.duration_minutes,e.duration_minutes),
    max_attempts=coalesce(ls.max_attempts,e.max_attempts),
    pass_percent=coalesce(ls.pass_percent,e.pass_percent),
    randomize_questions=coalesce(ls.randomize_questions,e.randomize_questions),
    randomize_choices=coalesce(ls.randomize_choices,e.randomize_choices),
    one_question_at_a_time=coalesce(ls.one_question_at_a_time,e.one_question_at_a_time),
    no_backtracking=coalesce(ls.no_backtracking,e.no_backtracking),
    require_fullscreen_web=coalesce(ls.require_fullscreen_web,e.require_fullscreen_web),
    block_screen_capture=coalesce(ls.block_screen_capture,e.block_screen_capture),
    integrity_mode=coalesce(ls.integrity_mode,e.integrity_mode),
    security_preset=coalesce(ls.security_preset,e.security_preset),
    device_policy=coalesce(ls.device_policy,e.device_policy),
    behavior_monitoring=coalesce(ls.behavior_monitoring,e.behavior_monitoring),
    offline_security_mode=coalesce(ls.offline_security_mode,e.offline_security_mode),
    join_policy=coalesce(nullif(ls.join_policy,''),e.default_live_join_policy),
    settings_snapshot=coalesce(ls.settings_snapshot,'{}'::jsonb)||jsonb_build_object(
      'duration_minutes',coalesce(ls.duration_minutes,e.duration_minutes),
      'max_attempts',coalesce(ls.max_attempts,e.max_attempts),
      'pass_percent',coalesce(ls.pass_percent,e.pass_percent),
      'randomize_questions',coalesce(ls.randomize_questions,e.randomize_questions),
      'randomize_choices',coalesce(ls.randomize_choices,e.randomize_choices),
      'one_question_at_a_time',coalesce(ls.one_question_at_a_time,e.one_question_at_a_time),
      'no_backtracking',coalesce(ls.no_backtracking,e.no_backtracking),
      'require_fullscreen_web',coalesce(ls.require_fullscreen_web,e.require_fullscreen_web),
      'block_screen_capture',coalesce(ls.block_screen_capture,e.block_screen_capture),
      'integrity_mode',coalesce(ls.integrity_mode,e.integrity_mode),
      'security_preset',coalesce(ls.security_preset,e.security_preset),
      'device_policy',coalesce(ls.device_policy,e.device_policy),
      'behavior_monitoring',coalesce(ls.behavior_monitoring,e.behavior_monitoring),
      'offline_security_mode',coalesce(ls.offline_security_mode,e.offline_security_mode),
      'join_policy',coalesce(nullif(ls.join_policy,''),e.default_live_join_policy),
      'snapshot_hash',v_hash,'snapshot_question_count',v_count
    ),
    question_snapshot_hash=v_hash,config_locked_at=coalesce(ls.config_locked_at,now()),updated_at=now()
  where ls.id=s.id;

  perform public.buklod_quiz_audit_write_v1(
    s.exam_id,s.section_id,s.id,null,'LIVE_SNAPSHOT_LOCKED',
    jsonb_build_object('question_count',v_count,'snapshot_hash',v_hash,'total_points',v_pts,'actor_kind',v_actor_kind),v_actor
  );
  return v_count;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v3(p_session_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text, question_count integer, total_score_target numeric, randomize_choices boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 actor uuid:=auth.uid();
 s public.buklod_quiz_live_sessions%ROWTYPE;
 e public.buklod_quiz_exams%ROWTYPE;
 a public.buklod_quiz_attempts%ROWTYPE;
 started record;
 n integer;
 assigned_total numeric;
 policy text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first.' USING ERRCODE='42501'; END IF;
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=p_session_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Live class unavailable'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||s.exam_id::text,0));
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_sections sec ON sec.id=ls.section_id AND sec.exam_id=ls.exam_id AND sec.archived_at IS NULL
 WHERE ls.id=p_session_id AND ls.status='LIVE' FOR UPDATE OF ls;
 IF NOT FOUND THEN RAISE EXCEPTION 'Live class unavailable'; END IF;
 SELECT x.* INTO e FROM public.buklod_quiz_exams x WHERE x.id=s.exam_id AND x.status='PUBLISHED' AND x.archived_at IS NULL;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND coalesce(p.is_active,true))
 THEN RAISE EXCEPTION 'Active profile and published exam required'; END IF;
 PERFORM 1 FROM public.buklod_quiz_live_members m WHERE m.session_id=s.id AND m.student_user_id=actor AND m.status='ADMITTED' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Faculty admission required'; END IF;
 PERFORM 1 FROM public.buklod_quiz_roster r WHERE r.exam_id=s.exam_id AND r.section_id=s.section_id AND r.student_user_id=actor AND r.status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active exact class roster required'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.exam_id=s.exam_id AND t.student_user_id=actor AND t.status='STARTED' AND t.live_session_id IS DISTINCT FROM s.id)
 THEN RAISE EXCEPTION 'Another unfinished attempt exists; faculty recovery required'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t WHERE t.live_session_id=s.id AND t.student_user_id=actor AND t.status='STARTED' ORDER BY t.attempt_no DESC,t.id DESC LIMIT 1 FOR UPDATE;
 IF a.id IS NOT NULL AND EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.exam_id=s.exam_id AND t.student_user_id=actor AND t.status='STARTED' AND t.id<>a.id)
 THEN RAISE EXCEPTION 'Multiple unfinished attempts; faculty review required'; END IF;
 policy:=upper(coalesce(nullif(a.security_snapshot->>'device_policy',''),s.device_policy,e.device_policy,'MONITOR'));
 IF policy='LOCK' AND nullif(btrim(coalesce(p_device_token,'')),'') IS NULL THEN RAISE EXCEPTION 'Device token required for locked exam'; END IF;
 IF a.id IS NOT NULL THEN
   -- Never rebuild an historical question set from a mutable question bank.
   SELECT count(*)::integer,coalesce(sum(q.points),0) INTO n,assigned_total FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
   IF n=0 THEN RAISE EXCEPTION 'Existing attempt has no immutable assignments; faculty recovery required'; END IF;
   IF assigned_total IS DISTINCT FROM a.max_score OR (s.question_count>0 AND n<>s.question_count)
   THEN RAISE EXCEPTION 'Existing assignment differs from exam configuration; faculty recovery required'; END IF;
   IF a.expires_at IS NULL THEN RAISE EXCEPTION 'Attempt deadline is missing'; END IF;
   IF a.expires_at<=now() THEN
     IF now()>a.expires_at+interval '2 minutes' AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_offline_leases l
       WHERE l.attempt_id=a.id AND l.student_user_id=actor AND l.used_at IS NULL AND l.sync_grace_expires_at>now())
     THEN RAISE EXCEPTION 'Attempt expired; use submission recovery or contact faculty'; END IF;
     PERFORM public.buklod_quiz_bind_attempt_device_v1(a.id,p_device_token,'LIVE_OFFLINE_RECOVERY');
     INSERT INTO public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
     SELECT a.id,actor,'EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN',jsonb_build_object('expires_at',a.expires_at,'source','LIVE_START_V3')
     WHERE NOT EXISTS(SELECT 1 FROM public.buklod_quiz_events ev WHERE ev.attempt_id=a.id AND ev.event_type='EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN');
     RETURN QUERY SELECT a.id,a.status,a.expires_at,coalesce(s.duration_minutes,e.duration_minutes),
       coalesce(s.one_question_at_a_time,e.one_question_at_a_time),coalesce(s.no_backtracking,e.no_backtracking),
       s.section_id,(SELECT sec.name::text FROM public.buklod_quiz_sections sec WHERE sec.id=s.section_id),
       n,a.max_score,coalesce(s.randomize_choices,e.randomize_choices,false);
     RETURN;
   END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_live_question_snapshots x WHERE x.session_id=s.id) THEN
   IF a.id IS NOT NULL OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.live_session_id=s.id)
   THEN RAISE EXCEPTION 'Room has historical attempts without a snapshot; faculty recovery required'; END IF;
   PERFORM public.buklod_quiz_snapshot_live_session_v1(s.id);
   SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=p_session_id;
 END IF;
 SELECT count(*)::integer INTO n FROM public.buklod_quiz_live_question_snapshots x WHERE x.session_id=s.id;
 IF n<1 OR s.question_count IS DISTINCT FROM n OR nullif(s.question_snapshot_hash,'') IS NULL
 THEN RAISE EXCEPTION 'Room snapshot incomplete'; END IF;
 SELECT * INTO STRICT started FROM public.buklod_quiz_live_start_attempt_v3_core(s.id,p_device_token);
 SELECT t.* INTO STRICT a FROM public.buklod_quiz_attempts t WHERE t.id=started.attempt_id AND t.student_user_id=actor AND t.live_session_id=s.id;
 SELECT count(*)::integer,coalesce(sum(q.points),0) INTO n,assigned_total FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
 IF a.status<>'STARTED' OR n<>s.question_count OR assigned_total IS DISTINCT FROM a.max_score OR a.max_score IS DISTINCT FROM s.total_score_target
 THEN RAISE EXCEPTION 'Attempt assignment postcondition failed'; END IF;
 RETURN QUERY SELECT a.id,a.status,a.expires_at,started.duration_minutes,started.one_question_at_a_time,started.no_backtracking,
   started.section_id,started.section_name,n,a.max_score,coalesce(s.randomize_choices,e.randomize_choices,false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v1(p_session_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT x.attempt_id,x.status,x.expires_at,x.duration_minutes,x.one_question_at_a_time,x.no_backtracking FROM public.buklod_quiz_live_start_attempt_v3(p_session_id,NULL) x; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v2(p_session_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT x.attempt_id,x.status,x.expires_at,x.duration_minutes,x.one_question_at_a_time,x.no_backtracking,x.section_id,x.section_name FROM public.buklod_quiz_live_start_attempt_v3(p_session_id,NULL) x; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_start_attempt_v2(p_exam_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); room uuid; n integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first.' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,min(ls.id::text)::uuid INTO n,room FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_live_members m ON m.session_id=ls.id AND m.student_user_id=actor AND m.status='ADMITTED'
 JOIN public.buklod_quiz_roster r ON r.exam_id=ls.exam_id AND r.section_id=ls.section_id AND r.student_user_id=actor AND r.status='ACTIVE'
 JOIN public.buklod_quiz_sections sec ON sec.id=ls.section_id AND sec.exam_id=ls.exam_id AND sec.archived_at IS NULL
 WHERE ls.exam_id=p_exam_id AND ls.status='LIVE';
 IF n<>1 THEN RAISE EXCEPTION 'Enter the exact active live class code from faculty.'; END IF;
 RETURN QUERY SELECT x.attempt_id,x.status,x.expires_at,x.duration_minutes,x.one_question_at_a_time,x.no_backtracking FROM public.buklod_quiz_live_start_attempt_v3(room,p_device_token) x;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_start_attempt_v1(p_exam_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT * FROM public.buklod_quiz_start_attempt_v2(p_exam_id,NULL); $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v2(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v3(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v3(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_start_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_start_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_start_attempt_v2(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_start_attempt_v2(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v3_core(uuid,text) FROM PUBLIC,anon,authenticated;
