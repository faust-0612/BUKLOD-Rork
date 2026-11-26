-- R18 DEV only; apply after R17, never independently in production.
-- Assigned points and frozen live references take precedence over mutable bank.
CREATE FUNCTION private.buklod_quiz_grading_items_r18(p_attempt_id uuid)
RETURNS TABLE(id uuid,question_type text,correct_answer jsonb,points numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT aq.question_id,CASE WHEN a.live_session_id IS NULL THEN q.question_type ELSE snap.question_type END,
 CASE WHEN a.live_session_id IS NULL THEN q.correct_answer ELSE snap.correct_answer END,aq.points
 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id
 JOIN public.buklod_quiz_questions q ON q.id=aq.question_id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=aq.question_id
 WHERE a.id=p_attempt_id AND (a.live_session_id IS NULL OR snap.question_id IS NOT NULL)
 UNION ALL
 SELECT q.id,q.question_type,q.correct_answer,q.points FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_questions q ON q.exam_id=a.exam_id AND q.is_active=true
 WHERE a.id=p_attempt_id AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=a.id);
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_grading_items_r18(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.buklod_quiz_compute_attempt_internal(p_attempt_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_obj numeric;
  v_man numeric;
  v_max numeric;
  v_pending boolean;
  v_status text;
  v_deduction numeric;
  a public.buklod_quiz_attempts%rowtype;
begin
  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if a.status in ('RELEASED','GRADED') then return a.status; end if;
  if a.status not in ('STARTED','NEEDS_REVIEW') then raise exception 'Attempt cannot be graded'; end if;
  if exists(select 1 from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id) then
    if (select count(*) from private.buklod_quiz_grading_items_r18(a.id))<>(select count(*) from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id) then raise exception 'Immutable grading references incomplete'; end if;
    if exists(select 1 from public.buklod_quiz_responses r where r.attempt_id=a.id and not exists(select 1 from private.buklod_quiz_grading_items_r18(a.id) q where q.id=r.question_id)) then raise exception 'Unassigned response'; end if;
  end if;
  if exists(select 1 from public.buklod_quiz_responses r join private.buklod_quiz_grading_items_r18(a.id) q on q.id=r.question_id where r.attempt_id=a.id and r.manual_score is not null and (r.manual_score<0 or r.manual_score>q.points or r.manual_score::text in ('NaN','Infinity','-Infinity'))) then raise exception 'Manual score out of bounds'; end if;
  update public.buklod_quiz_responses r
     set objective_score = case
       when q.question_type in ('MCQ','TRUE_FALSE') then
         case when nullif(trim(r.answer#>>'{}'),'') is not null and nullif(trim(q.correct_answer#>>'{}'),'') is not null and lower(trim(r.answer#>>'{}')) = lower(trim(q.correct_answer#>>'{}')) then q.points else 0 end
       when q.question_type='SHORT_TEXT' then
         case
           when r.manual_score is not null then 0
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = '' then 0
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}') then q.points
           else 0
         end
       when q.question_type='NUMERIC' then
         case when trim(coalesce(r.answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and trim(coalesce(q.correct_answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and abs((r.answer#>>'{}')::numeric-(q.correct_answer#>>'{}')::numeric)<=0.000001
              then q.points else 0 end
       else null
     end,
     is_correct = case
       when q.question_type in ('MCQ','TRUE_FALSE') then
         nullif(trim(r.answer#>>'{}'),'') is not null and nullif(trim(q.correct_answer#>>'{}'),'') is not null and lower(trim(r.answer#>>'{}')) = lower(trim(q.correct_answer#>>'{}'))
       when q.question_type='SHORT_TEXT' then
         case
           when r.manual_score is not null then
             case when r.manual_score >= q.points then true when r.manual_score <= 0 then false else null end
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = '' then false
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}') then true
           else null
         end
       when q.question_type='NUMERIC' then
         case when trim(coalesce(r.answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and trim(coalesce(q.correct_answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
              then abs((r.answer#>>'{}')::numeric-(q.correct_answer#>>'{}')::numeric)<=0.000001
              else false end
       else case when r.manual_score is null then null when r.manual_score >= q.points then true when r.manual_score <= 0 then false else null end
     end,
     needs_review = case
       when q.question_type='SHORT_TEXT' then
         r.manual_score is null
         and public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') <> ''
         and public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') <> public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}')
       when q.question_type in ('ESSAY','ENUMERATION','MANUAL') then
         r.manual_score is null
         and case
           when r.answer is null or r.answer='null'::jsonb then false
           when jsonb_typeof(r.answer)='string' then nullif(trim(r.answer#>>'{}'),'') is not null
           when jsonb_typeof(r.answer)='array' then jsonb_array_length(r.answer)>0
           when jsonb_typeof(r.answer)='object' then r.answer <> '{}'::jsonb
           else true
         end
       else false
     end
  from private.buklod_quiz_grading_items_r18(p_attempt_id) q
  where q.id = r.question_id
    and r.attempt_id = p_attempt_id;

  select
    coalesce(sum(case when r.manual_score is null then coalesce(r.objective_score,0) else 0 end),0),
    coalesce(sum(coalesce(r.manual_score,0)),0),
    coalesce(sum(q.points),0),
    coalesce(bool_or(r.needs_review and r.manual_score is null),false)
    into v_obj,v_man,v_max,v_pending
  from public.buklod_quiz_responses r
  join private.buklod_quiz_grading_items_r18(p_attempt_id) q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    ;
  if exists(select 1 from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id) then
    select coalesce(sum(q.points),0) into v_max from private.buklod_quiz_grading_items_r18(a.id) q;
    if v_max is distinct from a.max_score then raise exception 'Assigned maximum score mismatch'; end if;
  end if;

  select coalesce(sum(d.deduction_points),0)
    into v_deduction
  from public.buklod_quiz_integrity_deductions d
  where d.attempt_id=p_attempt_id;

  v_status := case when v_pending then 'NEEDS_REVIEW' else 'GRADED' end;

  update public.buklod_quiz_attempts
     set status=v_status,
         objective_score=v_obj,
         manual_score=v_man,
         total_score=greatest(0,v_obj+v_man-v_deduction),
         max_score=v_max,
         submitted_at=coalesce(submitted_at,now()),
         updated_at=now()
   where id=p_attempt_id;

  return v_status;
end;
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_compute_attempt_internal(uuid) FROM PUBLIC,anon,authenticated;

-- Own-attempt write authorization; room lock precedes attempt lock.
CREATE FUNCTION private.buklod_quiz_lock_student_write_r18(p_attempt_id uuid,p_device_token text)
RETURNS public.buklod_quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid(); room uuid; policy text; s public.buklod_quiz_live_sessions%ROWTYPE;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t WHERE t.id=p_attempt_id AND t.student_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
 room:=a.live_session_id;
 IF room IS NOT NULL THEN
   SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=room FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Room unavailable'; END IF;
 END IF;
 SELECT t.* INTO STRICT a FROM public.buklod_quiz_attempts t WHERE t.id=p_attempt_id AND t.student_user_id=actor FOR UPDATE;
 IF a.live_session_id IS DISTINCT FROM room THEN RAISE EXCEPTION 'Attempt moved; refresh'; END IF;
 IF a.status IN ('GRADED','RELEASED','NEEDS_REVIEW') THEN RETURN a; END IF;
 IF a.status<>'STARTED' OR a.expires_at IS NULL THEN RAISE EXCEPTION 'Attempt is not active'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND coalesce(p.is_active,true)) THEN RAISE EXCEPTION 'Active profile required'; END IF;
 IF room IS NOT NULL AND (s.status<>'LIVE' OR NOT EXISTS(
   SELECT 1 FROM public.buklod_quiz_live_members m JOIN public.buklod_quiz_roster r ON r.exam_id=s.exam_id AND r.section_id=s.section_id AND r.student_user_id=m.student_user_id AND r.status='ACTIVE'
   WHERE m.session_id=room AND m.student_user_id=actor AND m.status='ADMITTED')
   OR s.exam_id IS DISTINCT FROM a.exam_id OR s.section_id IS DISTINCT FROM a.section_id)
 THEN RAISE EXCEPTION 'Active admitted class required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id) THEN RAISE EXCEPTION 'Immutable assignment missing; faculty recovery required'; END IF;
 policy:=upper(coalesce(nullif(a.security_snapshot->>'device_policy',''),s.device_policy,(SELECT e.device_policy FROM public.buklod_quiz_exams e WHERE e.id=a.exam_id),'MONITOR'));
 IF policy='LOCK' AND nullif(btrim(coalesce(p_device_token,'')),'') IS NULL THEN RAISE EXCEPTION 'Device token required'; END IF;
 PERFORM public.buklod_quiz_bind_attempt_device_v1(a.id,p_device_token,'STUDENT_WRITE_R18');
 RETURN a;
END;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_lock_student_write_r18(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.buklod_quiz_validate_payload_r18(p_attempt_id uuid,p_answers jsonb,p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE n integer;
BEGIN
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR pg_column_size(p_answers)>2097152 THEN RAISE EXCEPTION 'Invalid answers payload'; END IF;
 n:=jsonb_array_length(p_answers);
 IF n>p_limit THEN RAISE EXCEPTION 'Too many answers'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) j WHERE jsonb_typeof(j)<>'object' OR NOT(j?'answer') OR coalesce(j->>'question_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Invalid answer item'; END IF;
 IF (SELECT count(DISTINCT (j->>'question_id')::uuid) FROM jsonb_array_elements(p_answers) j)<>n THEN RAISE EXCEPTION 'Duplicate question IDs'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) j WHERE NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=p_attempt_id AND q.question_id=(j->>'question_id')::uuid)) THEN RAISE EXCEPTION 'Unassigned question'; END IF;
 RETURN n;
END;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_validate_payload_r18(uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answers_batch_v2(p_attempt_id uuid, p_answers jsonb, p_device_token text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; n integer;
BEGIN
 a:=private.buklod_quiz_lock_student_write_r18(p_attempt_id,p_device_token);
 IF a.status<>'STARTED' THEN RETURN 0; END IF;
 IF a.expires_at<=now() THEN RAISE EXCEPTION 'Time limit ended; use submission recovery'; END IF;
 n:=private.buklod_quiz_validate_payload_r18(a.id,p_answers,50);
 INSERT INTO public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
 SELECT a.id,(j->>'question_id')::uuid,a.student_user_id,j->'answer',now(),now() FROM jsonb_array_elements(p_answers) j
 ON CONFLICT ON CONSTRAINT buklod_quiz_responses_attempt_id_question_id_key DO UPDATE SET answer=excluded.answer,saved_at=now(),updated_at=now();
 RETURN n;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answers_batch_v1(p_attempt_id uuid, p_answers jsonb)
 RETURNS integer
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_save_answers_batch_v2(p_attempt_id,p_answers,NULL); $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answer_v2(p_attempt_id uuid, p_question_id uuid, p_answer jsonb, p_device_token text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_save_answers_batch_v2(p_attempt_id,jsonb_build_array(jsonb_build_object('question_id',p_question_id,'answer',p_answer)),p_device_token)=1; $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answer_v1(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
 RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_save_answer_v2(p_attempt_id,p_question_id,p_answer,NULL); $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v4(p_attempt_id uuid, p_answers jsonb, p_client_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_offline boolean DEFAULT false, p_offline_lease_token text DEFAULT NULL::text, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; n integer; expected integer; lease_ok boolean:=false; result_status text; token_hash text;
BEGIN
 a:=private.buklod_quiz_lock_student_write_r18(p_attempt_id,p_device_token);
 IF a.status<>'STARTED' THEN RETURN QUERY SELECT a.status,a.total_score,a.max_score; RETURN; END IF;
 n:=private.buklod_quiz_validate_payload_r18(a.id,coalesce(p_answers,'[]'::jsonb),500);
 SELECT count(*)::integer INTO expected FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
 IF expected<1 OR (n<>0 AND n<>expected) THEN RAISE EXCEPTION 'Incomplete submission snapshot; retry'; END IF;
 IF a.expires_at<=now() OR coalesce(p_offline,false) THEN
   IF p_client_completed_at IS NULL OR p_client_completed_at<a.started_at-interval '1 minute' OR p_client_completed_at>a.expires_at+interval '2 seconds' OR p_client_completed_at>now()+interval '2 seconds'
   THEN RAISE EXCEPTION 'Invalid completion timestamp'; END IF;
   IF nullif(btrim(coalesce(p_offline_lease_token,'')),'') IS NOT NULL THEN
     token_hash:=encode(extensions.digest(p_offline_lease_token,'sha256'),'hex');
     SELECT EXISTS(SELECT 1 FROM public.buklod_quiz_offline_leases l WHERE l.attempt_id=a.id AND l.student_user_id=a.student_user_id
     AND l.lease_token_hash=token_hash AND l.used_at IS NULL AND l.revoked_at IS NULL
     AND l.issued_at<=a.expires_at AND l.attempt_expires_at=a.expires_at AND l.sync_grace_expires_at>=now()
     AND l.device_hash IS NOT NULL AND l.device_hash=encode(extensions.digest(coalesce(p_device_token,''),'sha256'),'hex')) INTO lease_ok;
   END IF;
   -- Client time is not trusted proof. Require an issued, device-bound lease for late answer writes.
   IF NOT lease_ok THEN RAISE EXCEPTION 'Valid device-bound offline lease required; saved answers preserved'; END IF;
   IF n<>expected THEN RAISE EXCEPTION 'Complete offline snapshot required'; END IF;
 END IF;
 INSERT INTO public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
 SELECT a.id,(j->>'question_id')::uuid,a.student_user_id,j->'answer',now(),now() FROM jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j
 ON CONFLICT ON CONSTRAINT buklod_quiz_responses_attempt_id_question_id_key DO UPDATE SET answer=excluded.answer,saved_at=now(),updated_at=now();
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.answer IS NOT NULL AND r.answer NOT IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) AND nullif(btrim(CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE r.answer::text END),'') IS NOT NULL)
 THEN RAISE EXCEPTION 'Blank submission blocked; attempt remains available for recovery'; END IF;
 INSERT INTO public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer)
 SELECT a.id,q.question_id,a.student_user_id,NULL FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id
 ON CONFLICT ON CONSTRAINT buklod_quiz_responses_attempt_id_question_id_key DO NOTHING;
 result_status:=public.buklod_quiz_compute_attempt_internal(a.id);
 IF result_status NOT IN ('GRADED','NEEDS_REVIEW') THEN RAISE EXCEPTION 'Submission grading failed'; END IF;
 IF lease_ok THEN UPDATE public.buklod_quiz_offline_leases l SET used_at=now(),last_used_at=now() WHERE l.attempt_id=a.id AND l.lease_token_hash=token_hash AND l.used_at IS NULL; IF NOT FOUND THEN RAISE EXCEPTION 'Offline lease already consumed'; END IF; END IF;
 INSERT INTO public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
 VALUES(a.id,a.student_user_id,'ATOMIC_SUBMIT_V4',jsonb_build_object('offline_lease_used',lease_ok,'assigned_question_count',expected,'result_status',result_status));
 RETURN QUERY SELECT t.status,t.total_score,t.max_score FROM public.buklod_quiz_attempts t WHERE t.id=a.id;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v1(p_attempt_id uuid)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT * FROM public.buklod_quiz_submit_attempt_v4(p_attempt_id,'[]'::jsonb,NULL,false,NULL,NULL); $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v2(p_attempt_id uuid, p_answers jsonb)
 RETURNS TABLE(attempt_id uuid, status text, total_score numeric, max_score numeric)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT p_attempt_id,x.status,x.total_score,x.max_score FROM public.buklod_quiz_submit_attempt_v4(p_attempt_id,p_answers,NULL,false,NULL,NULL) x; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_issue_offline_lease_v2(p_attempt_id uuid, p_device_token text DEFAULT NULL::text, p_existing_lease_token text DEFAULT NULL::text)
 RETURNS TABLE(lease_token text, lease_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  declare
    a public.buklod_quiz_attempts%rowtype;
    v_uid uuid := (select auth.uid());
    v_token text;
    v_existing_hash text;
    v_grace timestamptz;
    v_device_hash text;
  begin
    if v_uid is null then raise exception 'Sign in first.'; end if;

    a:=private.buklod_quiz_lock_student_write_r18(p_attempt_id,p_device_token);
    if a.status<>'STARTED' then raise exception 'Attempt is not active.'; end if;
    if length(btrim(coalesce(p_device_token,''))) not between 16 and 200 then raise exception 'Device token required for offline lease'; end if;
    v_device_hash:=encode(extensions.digest(p_device_token,'sha256'),'hex');

    v_grace := a.expires_at + interval '15 minutes';

    if nullif(btrim(coalesce(p_existing_lease_token,'')),'') is not null then
      v_existing_hash := encode(extensions.digest(p_existing_lease_token,'sha256'),'hex');
      if exists(
        select 1
        from public.buklod_quiz_offline_leases l
        where l.attempt_id=a.id
          and l.student_user_id=v_uid
          and l.lease_token_hash=v_existing_hash
          and l.used_at is null and l.revoked_at is null and l.device_hash=v_device_hash and l.attempt_expires_at=a.expires_at
          and l.sync_grace_expires_at > now()
      ) then
        return query select p_existing_lease_token, v_grace;
        return;
      end if;
    end if;

    if a.expires_at <= now() then
      raise exception 'Offline lease cannot be issued after the attempt expires.';
    end if;

    v_token := encode(extensions.gen_random_bytes(32),'hex');

    insert into public.buklod_quiz_offline_leases(
      attempt_id,student_user_id,lease_token_hash,device_hash,issued_at,
      attempt_expires_at,sync_grace_expires_at,used_at
    )
    values(
      a.id,v_uid,encode(extensions.digest(v_token,'sha256'),'hex'),v_device_hash,now(),
      a.expires_at,v_grace,null
    )
    on conflict (attempt_id) do update
    set student_user_id=excluded.student_user_id,
        lease_token_hash=excluded.lease_token_hash,
        device_hash=excluded.device_hash,revoked_at=null,last_used_at=null,
        issued_at=excluded.issued_at,
        attempt_expires_at=excluded.attempt_expires_at,
        sync_grace_expires_at=excluded.sync_grace_expires_at,
        used_at=null;

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      a.id,v_uid,'OFFLINE_LEASE_ISSUED_V2',
      jsonb_build_object(
        'attempt_expires_at',a.expires_at,
        'sync_grace_expires_at',v_grace
      )
    );

    return query select v_token, v_grace;
  end;
  $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answer_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answer_v1(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answer_v2(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answer_v2(uuid,uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answers_batch_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answers_batch_v1(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answers_batch_v2(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answers_batch_v2(uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v2(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v2(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v3(uuid,jsonb,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v3(uuid,jsonb,timestamptz,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v4(uuid,jsonb,timestamptz,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v4(uuid,jsonb,timestamptz,boolean,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_issue_offline_lease_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_issue_offline_lease_v1(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_issue_offline_lease_v2(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_issue_offline_lease_v2(uuid,text,text) TO authenticated;
