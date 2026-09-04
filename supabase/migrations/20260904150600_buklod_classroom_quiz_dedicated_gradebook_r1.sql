-- BUKLOD Classroom Quiz Dedicated Gradebook R1
-- Additive only: no account, exam, attempt, score, classroom, or final-grade reset.
-- Quiz Dedicated remains source-of-truth; Classroom stores a released grade projection.

create or replace function public.buklod_education_import_quiz_scores_v4(
  p_classroom_id uuid,
  p_exam_id uuid,
  p_section_id uuid default null,
  p_exam_title text default 'BUKLOD Quiz',
  p_points_possible numeric default null,
  p_category_id uuid default null,
  p_strategy text default 'LATEST',
  p_rows jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_title text := nullif(trim(coalesce(p_exam_title,'')), '');
  v_points numeric := p_points_possible;
  v_category_name text;
  v_term_key text;
  v_grade_item_id uuid;
  v_source_ref text;
  v_strategy text := upper(trim(coalesce(p_strategy,'LATEST')));
  v_input_students integer := 0;
  v_active_enrolled integer := 0;
  v_finalized_blocked integer := 0;
  v_synced integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Not authorized to manage this classroom.';
  end if;
  if p_exam_id is null then raise exception 'Quiz exam id is required.'; end if;
  if p_category_id is null then
    raise exception 'Select a Classroom grade category before importing Quiz results.';
  end if;
  if v_strategy not in ('LATEST','HIGHEST') then raise exception 'Strategy must be LATEST or HIGHEST.'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Quiz rows must be a JSON array.'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Quiz import is limited to 5000 released rows per batch.'; end if;

  select gc.name, upper(gc.term_key)
  into v_category_name, v_term_key
  from public.buklod_education_grade_categories gc
  where gc.id = p_category_id and gc.classroom_id = p_classroom_id;
  if v_category_name is null or v_term_key not in ('PRELIM','MIDTERM','SEMIFINALS','FINALS') then
    raise exception 'Grade category not found in this classroom or has an invalid grading term.';
  end if;

  if v_title is null then v_title := 'BUKLOD Quiz'; end if;
  if coalesce(v_points,0) <= 0 then
    select max(nullif((x->>'max_score')::numeric,0)) into v_points from jsonb_array_elements(p_rows) x;
  end if;
  if coalesce(v_points,0) <= 0 then raise exception 'A valid Quiz maximum score is required.'; end if;

  v_source_ref := 'exam:' || p_exam_id::text || ':section:' || coalesce(p_section_id::text,'ALL');

  insert into public.buklod_education_grade_items(
    classroom_id,assessment_id,title,category,points_possible,weight,created_by,
    category_id,item_type,source_system,source_ref,rubric,instructions,term_key
  ) values (
    p_classroom_id,null,v_title,v_category_name,v_points,null,auth.uid(),
    p_category_id,'QUIZ','BUKLOD_QUIZ_DEDICATED',v_source_ref,'{}'::jsonb,
    'Imported from officially released BUKLOD Quiz Dedicated results through Faculty Classroom.',v_term_key
  )
  on conflict (classroom_id,source_system,source_ref)
    where source_system is not null and source_ref is not null
  do update set
    title=excluded.title,
    category=excluded.category,
    points_possible=excluded.points_possible,
    category_id=excluded.category_id,
    item_type='QUIZ',
    term_key=excluded.term_key,
    instructions=excluded.instructions
  returning id into v_grade_item_id;

  select count(distinct nullif(x->>'student_user_id','')::uuid)
  into v_input_students
  from jsonb_array_elements(p_rows) x
  where coalesce(x->>'student_user_id','') <> '';

  with raw as (
    select
      nullif(x->>'student_user_id','')::uuid as student_user_id,
      coalesce(nullif(x->>'total_score','')::numeric,0) as total_score,
      coalesce(nullif(x->>'max_score','')::numeric,0) as max_score,
      coalesce(nullif(x->>'attempt_no','')::integer,1) as attempt_no,
      nullif(x->>'released_at','')::timestamptz as released_at
    from jsonb_array_elements(p_rows) x
    where coalesce(x->>'student_user_id','') <> ''
  ), ranked as (
    select r.*,
      row_number() over (
        partition by r.student_user_id
        order by
          case when v_strategy='HIGHEST' and r.max_score>0 then r.total_score/r.max_score end desc nulls last,
          case when v_strategy='LATEST' then r.released_at end desc nulls last,
          r.released_at desc nulls last,
          r.attempt_no desc
      ) as rn
    from raw r
  ), best as (
    select r.student_user_id,
      case when r.max_score>0 then round((r.total_score/r.max_score)*v_points,4)
           else least(greatest(r.total_score,0),v_points) end as normalized_score
    from ranked r where r.rn=1
  ), enrolled as (
    select b.*
    from best b
    join public.buklod_education_enrollments en
      on en.classroom_id=p_classroom_id
     and en.student_user_id=b.student_user_id
     and en.status='ACTIVE'
  ), eligible as (
    select e.*
    from enrolled e
    where not exists (
      select 1 from public.buklod_education_final_grades fg
      where fg.classroom_id=p_classroom_id
        and fg.student_user_id=e.student_user_id
        and fg.status in ('RELEASED','LOCKED')
    )
  ), existing as (
    select g.id,g.student_user_id,g.score as old_score,g.status as old_status
    from public.buklod_education_grades g
    join eligible e on e.student_user_id=g.student_user_id
    where g.grade_item_id=v_grade_item_id
  ), upserted as (
    insert into public.buklod_education_grades(
      classroom_id,grade_item_id,student_user_id,score,status,feedback,updated_by,updated_at
    )
    select p_classroom_id,v_grade_item_id,e.student_user_id,
      least(greatest(e.normalized_score,0),v_points),'RELEASED',
      'Synchronized from released BUKLOD Quiz Dedicated result (' || v_strategy || ' attempt rule).',
      auth.uid(),pg_catalog.now()
    from eligible e
    on conflict (grade_item_id,student_user_id)
    do update set
      score=excluded.score,status='RELEASED',feedback=excluded.feedback,
      updated_by=auth.uid(),updated_at=pg_catalog.now()
    where public.buklod_education_grades.status <> 'LOCKED'
    returning id,student_user_id,score,status
  ), audited as (
    insert into public.buklod_education_grade_audit(
      grade_id,changed_by,old_score,new_score,old_status,new_status,reason
    )
    select u.id,auth.uid(),e.old_score,u.score,e.old_status,u.status,
      'BUKLOD Quiz Dedicated sync (' || v_strategy || ' attempt rule)'
    from upserted u
    left join existing e on e.student_user_id=u.student_user_id
    where e.id is null or e.old_score is distinct from u.score or e.old_status is distinct from u.status
    returning grade_id
  )
  select
    (select count(*) from enrolled),
    (select count(*) from enrolled) - (select count(*) from eligible),
    (select count(*) from upserted)
  into v_active_enrolled,v_finalized_blocked,v_synced;

  return jsonb_build_object(
    'grade_item_id',v_grade_item_id,
    'exam_title',v_title,
    'strategy',v_strategy,
    'term_key',v_term_key,
    'category_id',p_category_id,
    'category_name',v_category_name,
    'released_students',v_input_students,
    'active_enrolled_students',v_active_enrolled,
    'finalized_students_blocked',v_finalized_blocked,
    'synced',v_synced,
    'not_in_faculty_roster',greatest(v_input_students-v_active_enrolled,0),
    'points_possible',v_points,
    'source_system','BUKLOD_QUIZ_DEDICATED'
  );
end;
$function$;

revoke all on function public.buklod_education_import_quiz_scores_v4(uuid,uuid,uuid,text,numeric,uuid,text,jsonb) from public;
grant execute on function public.buklod_education_import_quiz_scores_v4(uuid,uuid,uuid,text,numeric,uuid,text,jsonb) to authenticated;
