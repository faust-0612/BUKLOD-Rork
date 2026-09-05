-- BUKLOD Classroom Access Architecture R2
-- Faculty tools FREE; student core FREE; optional Student Plus PAID.
-- No exam attempt, score, attendance, enrollment, submission, or grade reset.

-- -----------------------------------------------------------------------------
-- 1. Commercial policy: Faculty free, Student Plus optional paid add-on.
-- -----------------------------------------------------------------------------
insert into public.buklod_focus_app_subscription_config(
  focus_app_code,display_name,annual_amount_php,currency,gcash_number,billing_interval,is_active,metadata,updated_at
) values (
  'faculty','BUKLOD Faculty',0,'PHP','09811646218','YEARLY',true,
  jsonb_build_object(
    'pricing_display','FREE',
    'faculty_side_free',true,
    'payment_required',false,
    'included_apps',jsonb_build_array('classroom','attendance','quiz'),
    'classroom_faculty_included',true,
    'attendance_faculty_included',true,
    'quiz_examiner_included',true,
    'student_subscription_required',false
  ),now()
)
on conflict(focus_app_code) do update set
  display_name=excluded.display_name,
  annual_amount_php=0,
  is_active=true,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.buklod_focus_app_subscription_config(
  focus_app_code,display_name,annual_amount_php,currency,gcash_number,billing_interval,is_active,metadata,updated_at
) values (
  'student_plus','BUKLOD Student Plus',499,'PHP','09811646218','YEARLY',true,
  jsonb_build_object(
    'pricing_display','₱59/month OR ₱499/year',
    'monthly_amount_php',59,
    'yearly_amount_php',499,
    'monthly_term_months',1,
    'yearly_term_months',12,
    'student_core_free',true,
    'optional_add_on',true,
    'never_required_for',jsonb_build_array('classroom_enrollment','materials','submissions','attendance','quiz_taking','released_grades','discussions','messaging'),
    'features',jsonb_build_array(
      'GRADE_FORECAST',
      'TARGET_GRADE_CALCULATOR',
      'WEAK_AREA_INSIGHTS',
      'CROSS_CLASS_STUDY_PLANNER',
      'DEADLINE_RADAR',
      'REVIEWER_CHECKLISTS',
      'PERSONAL_PROGRESS_ANALYTICS'
    )
  ),now()
)
on conflict(focus_app_code) do update set
  display_name=excluded.display_name,
  annual_amount_php=excluded.annual_amount_php,
  is_active=true,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.buklod_education_monetization_policy(policy_key,is_active,config,updated_at)
values(
  'EDUCATION_CORE',true,
  jsonb_build_object(
    'faculty_side','FREE',
    'student_core','FREE',
    'student_plus','PAID_OPTIONAL',
    'student_plus_monthly_php',59,
    'student_plus_yearly_php',499,
    'no_ads_during',jsonb_build_array('ACTIVE_EXAM','SECURE_QUIZ','ATTENDANCE_CHECKIN'),
    'core_student_features',jsonb_build_array('ENROLLMENT','MATERIALS','SUBMISSIONS','ATTENDANCE','QUIZ','GRADES','DISCUSSIONS','MESSAGING'),
    'paid_student_features',jsonb_build_array('GRADE_FORECAST','TARGET_GRADE_CALCULATOR','WEAK_AREA_INSIGHTS','STUDY_PLANNER','DEADLINE_RADAR','REVIEWER_CHECKLISTS','PROGRESS_ANALYTICS')
  ),now()
)
on conflict(policy_key) do update set is_active=true,config=excluded.config,updated_at=now();

-- -----------------------------------------------------------------------------
-- 2. Multi-faculty assignment model. Classroom remains the data container.
-- -----------------------------------------------------------------------------
create unique index if not exists uq_buklod_education_classroom_faculty_class_user
  on public.buklod_education_classroom_faculty(classroom_id,faculty_user_id);
create unique index if not exists uq_buklod_education_classroom_faculty_active_primary
  on public.buklod_education_classroom_faculty(classroom_id)
  where status='ACTIVE' and faculty_role='PRIMARY';

create or replace function public.buklod_education_faculty_role_permissions_v1(p_role text)
returns jsonb language sql immutable set search_path=''
as $$ select case upper(coalesce(p_role,''))
  when 'PRIMARY' then jsonb_build_object('MANAGE_CLASSROOM',true,'MANAGE_FACULTY',true,'MANAGE_ROSTER',true,'MANAGE_MATERIALS',true,'MANAGE_ATTENDANCE',true,'MANAGE_ASSESSMENTS',true,'MANAGE_GRADEBOOK',true,'RELEASE_GRADES',true,'MANAGE_LIVE',true,'MANAGE_DISCUSSIONS',true)
  when 'TEACHER' then jsonb_build_object('MANAGE_CLASSROOM',true,'MANAGE_FACULTY',false,'MANAGE_ROSTER',true,'MANAGE_MATERIALS',true,'MANAGE_ATTENDANCE',true,'MANAGE_ASSESSMENTS',true,'MANAGE_GRADEBOOK',true,'RELEASE_GRADES',true,'MANAGE_LIVE',true,'MANAGE_DISCUSSIONS',true)
  when 'CO_TEACHER' then jsonb_build_object('MANAGE_CLASSROOM',true,'MANAGE_FACULTY',false,'MANAGE_ROSTER',true,'MANAGE_MATERIALS',true,'MANAGE_ATTENDANCE',true,'MANAGE_ASSESSMENTS',true,'MANAGE_GRADEBOOK',true,'RELEASE_GRADES',false,'MANAGE_LIVE',true,'MANAGE_DISCUSSIONS',true)
  when 'ASSISTANT' then jsonb_build_object('MANAGE_CLASSROOM',false,'MANAGE_FACULTY',false,'MANAGE_ROSTER',false,'MANAGE_MATERIALS',true,'MANAGE_ATTENDANCE',true,'MANAGE_ASSESSMENTS',false,'MANAGE_GRADEBOOK',false,'RELEASE_GRADES',false,'MANAGE_LIVE',false,'MANAGE_DISCUSSIONS',true)
  else '{}'::jsonb end; $$;

create or replace function public.buklod_education_faculty_permissions_v2(p_classroom_id uuid,p_user_id uuid default auth.uid())
returns jsonb language sql stable security definer set search_path=''
as $$ select case
  when public.buklod_is_system_admin() then jsonb_build_object('MANAGE_CLASSROOM',true,'MANAGE_FACULTY',true,'MANAGE_ROSTER',true,'MANAGE_MATERIALS',true,'MANAGE_ATTENDANCE',true,'MANAGE_ASSESSMENTS',true,'MANAGE_GRADEBOOK',true,'RELEASE_GRADES',true,'MANAGE_LIVE',true,'MANAGE_DISCUSSIONS',true,'SYSTEM_ADMIN',true)
  else coalesce((select public.buklod_education_faculty_role_permissions_v1(f.faculty_role)||coalesce(f.metadata->'permissions','{}'::jsonb)
    from public.buklod_education_classroom_faculty f
    where f.classroom_id=p_classroom_id and f.faculty_user_id=p_user_id and f.status='ACTIVE' limit 1),'{}'::jsonb)
  end; $$;
revoke all on function public.buklod_education_faculty_permissions_v2(uuid,uuid) from public,anon;
grant execute on function public.buklod_education_faculty_permissions_v2(uuid,uuid) to authenticated;

create or replace function public.buklod_education_faculty_has_permission_v2(p_classroom_id uuid,p_permission text,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((public.buklod_education_faculty_permissions_v2(p_classroom_id,p_user_id)->>upper(btrim(coalesce(p_permission,''))))::boolean,false); $$;
revoke all on function public.buklod_education_faculty_has_permission_v2(uuid,text,uuid) from public,anon;
grant execute on function public.buklod_education_faculty_has_permission_v2(uuid,text,uuid) to authenticated;

create or replace function public.buklod_education_is_active_classroom_faculty(p_classroom_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=''
as $$ select public.buklod_is_system_admin() or exists(
  select 1 from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id and f.faculty_user_id=p_user_id and f.status='ACTIVE'
); $$;

-- Backward-compatible helper used by existing Faculty RPCs.
create or replace function public.buklod_education_is_faculty_owner_v2(p_classroom_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select public.buklod_is_system_admin() or public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_CLASSROOM',auth.uid()); $$;

create or replace function public.buklod_education_active_classroom_faculty_v1(p_classroom_id uuid)
returns table(faculty_user_id uuid,faculty_role text,assigned_at timestamptz)
language sql stable security definer set search_path=''
as $$ select f.faculty_user_id,f.faculty_role,f.assigned_at
from public.buklod_education_classroom_faculty f
where f.classroom_id=p_classroom_id and f.status='ACTIVE'
order by case f.faculty_role when 'PRIMARY' then 0 when 'TEACHER' then 1 when 'CO_TEACHER' then 2 else 3 end,f.assigned_at; $$;
revoke all on function public.buklod_education_active_classroom_faculty_v1(uuid) from public,anon;
grant execute on function public.buklod_education_active_classroom_faculty_v1(uuid) to authenticated;

create or replace function public.buklod_education_assign_classroom_faculty_v2(p_classroom_id uuid,p_faculty_user_id uuid,p_role text,p_permissions jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=auth.uid(); v_role text:=upper(btrim(coalesce(p_role,''))); v_before jsonb; v_after jsonb;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if v_role='PRIMARY_FACULTY' then v_role:='PRIMARY'; end if;
  if v_role not in ('PRIMARY','TEACHER','CO_TEACHER','ASSISTANT') then raise exception 'Invalid faculty role.'; end if;
  if not public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_FACULTY',v_actor) then raise exception 'Primary Faculty permission required.'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_faculty_user_id and p.is_active=true) then raise exception 'Target faculty needs an active BUKLOD account.'; end if;
  if v_role='PRIMARY' and exists(select 1 from public.buklod_education_classroom_faculty f where f.classroom_id=p_classroom_id and f.status='ACTIVE' and f.faculty_role='PRIMARY' and f.faculty_user_id<>p_faculty_user_id) then raise exception 'Use Transfer Primary Faculty to replace the current Primary Faculty.'; end if;
  select to_jsonb(f) into v_before from public.buklod_education_classroom_faculty f where f.classroom_id=p_classroom_id and f.faculty_user_id=p_faculty_user_id;
  insert into public.buklod_education_classroom_faculty(classroom_id,faculty_user_id,faculty_role,status,assigned_by,assigned_at,ended_at,metadata)
  values(p_classroom_id,p_faculty_user_id,v_role,'ACTIVE',v_actor,now(),null,jsonb_build_object('permissions',coalesce(p_permissions,'{}'::jsonb),'assignment_model','FREE_FACULTY_PLUS_ASSIGNMENT'))
  on conflict(classroom_id,faculty_user_id) do update set faculty_role=excluded.faculty_role,status='ACTIVE',assigned_by=v_actor,assigned_at=now(),ended_at=null,metadata=coalesce(public.buklod_education_classroom_faculty.metadata,'{}'::jsonb)||jsonb_build_object('permissions',coalesce(p_permissions,'{}'::jsonb),'assignment_model','FREE_FACULTY_PLUS_ASSIGNMENT'),updated_at=now();
  select to_jsonb(f) into v_after from public.buklod_education_classroom_faculty f where f.classroom_id=p_classroom_id and f.faculty_user_id=p_faculty_user_id;
  insert into public.buklod_foundation_audit_logs(actor_id,action,target_user_id,role_key,scope_type,scope_id,before_state,after_state,reason)
  values(v_actor,'CLASSROOM_FACULTY_ASSIGN',p_faculty_user_id,v_role,'EDUCATION_CLASSROOM',p_classroom_id,v_before,v_after,'Faculty assignment updated. Faculty tools are free; classroom data remains with classroom_id.');
  return jsonb_build_object('classroom_id',p_classroom_id,'faculty_user_id',p_faculty_user_id,'role',v_role,'status','ACTIVE','permissions',public.buklod_education_faculty_permissions_v2(p_classroom_id,p_faculty_user_id));
end; $$;
revoke all on function public.buklod_education_assign_classroom_faculty_v2(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.buklod_education_assign_classroom_faculty_v2(uuid,uuid,text,jsonb) to authenticated;

create or replace function public.buklod_education_end_classroom_faculty_v2(p_classroom_id uuid,p_faculty_user_id uuid,p_reason text default null)
returns boolean language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=auth.uid(); v_before jsonb; v_role text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_FACULTY',v_actor) then raise exception 'Primary Faculty permission required.'; end if;
  select to_jsonb(f),f.faculty_role into v_before,v_role from public.buklod_education_classroom_faculty f where f.classroom_id=p_classroom_id and f.faculty_user_id=p_faculty_user_id and f.status='ACTIVE';
  if v_before is null then return false; end if;
  if v_role='PRIMARY' then raise exception 'Primary Faculty cannot be removed directly. Transfer Primary Faculty first.'; end if;
  update public.buklod_education_classroom_faculty set status='REMOVED',ended_at=now(),updated_at=now() where classroom_id=p_classroom_id and faculty_user_id=p_faculty_user_id;
  insert into public.buklod_foundation_audit_logs(actor_id,action,target_user_id,role_key,scope_type,scope_id,before_state,after_state,reason)
  values(v_actor,'CLASSROOM_FACULTY_END',p_faculty_user_id,v_role,'EDUCATION_CLASSROOM',p_classroom_id,v_before,jsonb_build_object('status','REMOVED','ended_at',now()),nullif(btrim(coalesce(p_reason,'')),''));
  return true;
end; $$;
revoke all on function public.buklod_education_end_classroom_faculty_v2(uuid,uuid,text) from public,anon;
grant execute on function public.buklod_education_end_classroom_faculty_v2(uuid,uuid,text) to authenticated;

create or replace function public.buklod_education_transfer_primary_faculty_v1(p_classroom_id uuid,p_new_primary_user_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=auth.uid(); v_old_primary uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_FACULTY',v_actor) then raise exception 'Primary Faculty permission required.'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_new_primary_user_id and p.is_active=true) then raise exception 'New Primary Faculty needs an active BUKLOD account.'; end if;
  select f.faculty_user_id into v_old_primary from public.buklod_education_classroom_faculty f where f.classroom_id=p_classroom_id and f.status='ACTIVE' and f.faculty_role='PRIMARY' limit 1;
  if v_old_primary=p_new_primary_user_id then return jsonb_build_object('classroom_id',p_classroom_id,'primary_faculty_user_id',p_new_primary_user_id,'changed',false); end if;
  if v_old_primary is not null then update public.buklod_education_classroom_faculty set faculty_role='TEACHER',updated_at=now() where classroom_id=p_classroom_id and faculty_user_id=v_old_primary; end if;
  insert into public.buklod_education_classroom_faculty(classroom_id,faculty_user_id,faculty_role,status,assigned_by,assigned_at,ended_at,metadata)
  values(p_classroom_id,p_new_primary_user_id,'PRIMARY','ACTIVE',v_actor,now(),null,jsonb_build_object('assignment_model','FREE_FACULTY_PLUS_ASSIGNMENT'))
  on conflict(classroom_id,faculty_user_id) do update set faculty_role='PRIMARY',status='ACTIVE',assigned_by=v_actor,assigned_at=now(),ended_at=null,updated_at=now();
  update public.buklod_education_classrooms set faculty_user_id=p_new_primary_user_id,updated_at=now() where id=p_classroom_id;
  insert into public.buklod_foundation_audit_logs(actor_id,action,target_user_id,role_key,scope_type,scope_id,before_state,after_state,reason)
  values(v_actor,'CLASSROOM_PRIMARY_FACULTY_TRANSFER',p_new_primary_user_id,'PRIMARY','EDUCATION_CLASSROOM',p_classroom_id,jsonb_build_object('old_primary_faculty_user_id',v_old_primary),jsonb_build_object('new_primary_faculty_user_id',p_new_primary_user_id,'old_primary_new_role','TEACHER'),coalesce(nullif(btrim(coalesce(p_reason,'')),''),'Primary Faculty transfer; classroom records remain in place.'));
  return jsonb_build_object('classroom_id',p_classroom_id,'old_primary_faculty_user_id',v_old_primary,'primary_faculty_user_id',p_new_primary_user_id,'changed',true,'data_transferred',false,'classroom_persisted',true);
end; $$;
revoke all on function public.buklod_education_transfer_primary_faculty_v1(uuid,uuid,text) from public,anon;
grant execute on function public.buklod_education_transfer_primary_faculty_v1(uuid,uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Dual-role launcher + My Classes.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_classroom_launcher_access_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_uid uuid:=auth.uid(); v_faculty boolean:=false; v_student boolean:=false; v_plus boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  select exists(select 1 from public.buklod_education_classroom_faculty f join public.buklod_education_classrooms c on c.id=f.classroom_id and c.status='ACTIVE' where f.faculty_user_id=v_uid and f.status='ACTIVE') into v_faculty;
  select exists(select 1 from public.buklod_education_enrollments e join public.buklod_education_classrooms c on c.id=e.classroom_id and c.status='ACTIVE' where e.student_user_id=v_uid and e.status='ACTIVE') into v_student;
  select exists(select 1 from public.buklod_user_focus_app_entitlements e where e.user_id=v_uid and e.focus_app_code='student_plus' and e.status='ACTIVE' and (e.expires_at is null or e.expires_at>now())) into v_plus;
  return jsonb_build_object('show_launcher',v_faculty or v_student,'can_faculty_view',v_faculty,'can_student_view',v_student,'dual_role',v_faculty and v_student,'default_view',case when v_faculty then 'FACULTY' when v_student then 'STUDENT' else null end,'faculty_free',true,'student_core_free',true,'student_plus_active',v_plus,'student_plus_pricing',jsonb_build_object('monthly_php',59,'yearly_php',499));
end; $$;
revoke all on function public.buklod_classroom_launcher_access_v1() from public,anon;
grant execute on function public.buklod_classroom_launcher_access_v1() to authenticated;

create or replace function public.buklod_classroom_student_plus_access_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_uid uuid:=auth.uid(); v_active boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  select exists(select 1 from public.buklod_user_focus_app_entitlements e where e.user_id=v_uid and e.focus_app_code='student_plus' and e.status='ACTIVE' and (e.expires_at is null or e.expires_at>now())) into v_active;
  return jsonb_build_object(
    'active',v_active,
    'monthly_php',59,
    'yearly_php',499,
    'core_free',true,
    'features',jsonb_build_array('GRADE_FORECAST','TARGET_GRADE_CALCULATOR','WEAK_AREA_INSIGHTS','CROSS_CLASS_STUDY_PLANNER','DEADLINE_RADAR','REVIEWER_CHECKLISTS','PERSONAL_PROGRESS_ANALYTICS')
  );
end; $$;
revoke all on function public.buklod_classroom_student_plus_access_v1() from public,anon;
grant execute on function public.buklod_classroom_student_plus_access_v1() to authenticated;

create or replace function public.buklod_classroom_my_classes_v2(p_view text default null)
returns table(classroom_id uuid,classroom_name text,subject_code text,section_name text,school_year text,term text,classroom_mode text,classroom_plan text,role_key text,faculty_role text,can_faculty_view boolean,can_student_view boolean,status text,updated_at timestamptz)
language sql stable security definer set search_path=''
as $$ with me as(select auth.uid() uid),eligible as(
  select c.id,c.name,c.subject_code,c.section_name,c.school_year,c.term,c.classroom_mode,c.classroom_plan,c.status,c.updated_at,f.faculty_role,(f.faculty_user_id is not null) faculty_view,(e.student_user_id is not null) student_view
  from public.buklod_education_classrooms c cross join me
  left join public.buklod_education_classroom_faculty f on f.classroom_id=c.id and f.faculty_user_id=me.uid and f.status='ACTIVE'
  left join public.buklod_education_enrollments e on e.classroom_id=c.id and e.student_user_id=me.uid and e.status='ACTIVE'
  where me.uid is not null and c.status='ACTIVE' and (f.faculty_user_id is not null or e.student_user_id is not null))
select id,name,subject_code,section_name,school_year,term,classroom_mode,classroom_plan,
  case when upper(coalesce(p_view,''))='STUDENT' and student_view then 'STUDENT' when upper(coalesce(p_view,''))='FACULTY' and faculty_view then 'FACULTY' when faculty_view then 'FACULTY' else 'STUDENT' end,
  faculty_role,faculty_view,student_view,status,updated_at
from eligible
where (p_view is null or btrim(p_view)='') or (upper(p_view)='FACULTY' and faculty_view) or (upper(p_view)='STUDENT' and student_view)
order by updated_at desc; $$;
revoke all on function public.buklod_classroom_my_classes_v2(text) from public,anon;
grant execute on function public.buklod_classroom_my_classes_v2(text) to authenticated;

create or replace function public.buklod_classroom_my_classes_v1()
returns table(classroom_id uuid,classroom_name text,subject_code text,section_name text,school_year text,term text,classroom_mode text,classroom_plan text,role_key text,status text,updated_at timestamptz)
language sql security definer set search_path=''
as $$ select x.classroom_id,x.classroom_name,x.subject_code,x.section_name,x.school_year,x.term,x.classroom_mode,x.classroom_plan,x.role_key,x.status,x.updated_at from public.buklod_classroom_my_classes_v2(null) x; $$;
revoke all on function public.buklod_classroom_my_classes_v1() from public,anon;
grant execute on function public.buklod_classroom_my_classes_v1() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. New class creation remains free for active BUKLOD faculty accounts.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_education_create_classroom_with_owner_v1(p_name text,p_subject_code text default null,p_section_name text default null)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_user_id uuid:=auth.uid(); v_name text:=nullif(trim(coalesce(p_name,'')),''); v_classroom_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.is_active=true) then raise exception 'Active BUKLOD account required'; end if;
  if v_name is null then raise exception 'Class/subject name is required'; end if;
  perform public.buklod_foundation_provision_creator_internal_v1(v_user_id,'FACULTY_WORKSPACE',v_user_id,'FACULTY','EDUCATION',null,'ACTIVE','FACULTY_CLASSROOM_CREATE',jsonb_build_object('creator_self_service',true,'faculty_pricing','FREE'));
  insert into public.buklod_education_classrooms(faculty_user_id,name,subject_code,section_name,status,grading_terms,grading_policy,passing_percent)
  values(v_user_id,v_name,nullif(trim(coalesce(p_subject_code,'')),''),nullif(trim(coalesce(p_section_name,'')),''),'ACTIVE',public.buklod_education_default_grading_terms_v1(),public.buklod_education_default_grading_policy_v1(),75) returning id into v_classroom_id;
  insert into public.buklod_education_classroom_faculty(classroom_id,faculty_user_id,faculty_role,status,assigned_by,metadata)
  values(v_classroom_id,v_user_id,'PRIMARY','ACTIVE',v_user_id,jsonb_build_object('source','CLASSROOM_CREATE','assignment_model','FREE_FACULTY_PLUS_ASSIGNMENT'))
  on conflict(classroom_id,faculty_user_id) do update set faculty_role='PRIMARY',status='ACTIVE',ended_at=null,updated_at=now();
  perform public.buklod_education_apply_default_grading_template_v1(v_classroom_id,false);
  insert into public.buklod_foundation_audit_logs(actor_id,action,target_user_id,role_key,scope_type,scope_id,after_state,reason)
  values(v_user_id,'CLASSROOM_CREATE',v_user_id,'PRIMARY','EDUCATION_CLASSROOM',v_classroom_id,jsonb_build_object('persistent_container',true,'faculty_pricing','FREE'),'Classroom created as persistent container; creator assigned as Primary Faculty.');
  return v_classroom_id;
end; $$;

-- -----------------------------------------------------------------------------
-- 5. Restrict direct client writes to assignment/policy tables.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_education_monetization_policy_v1()
returns jsonb language sql stable security definer set search_path=''
as $$ select coalesce((select jsonb_build_object('policy_key',p.policy_key,'is_active',p.is_active,'config',p.config) from public.buklod_education_monetization_policy p where p.policy_key='EDUCATION_CORE' and p.is_active=true limit 1),'{}'::jsonb); $$;
revoke all on function public.buklod_education_monetization_policy_v1() from public,anon;
grant execute on function public.buklod_education_monetization_policy_v1() to authenticated;

revoke all privileges on table public.buklod_education_classroom_faculty from anon,authenticated;
revoke all privileges on table public.buklod_education_monetization_policy from anon,authenticated;
revoke all on function public.buklod_education_is_active_classroom_faculty(uuid,uuid) from public,anon;
grant execute on function public.buklod_education_is_active_classroom_faculty(uuid,uuid) to authenticated;
revoke all on function public.buklod_education_is_faculty_owner_v2(uuid) from public,anon;
grant execute on function public.buklod_education_is_faculty_owner_v2(uuid) to authenticated;
