-- BUKLOD Classroom / Faculty entitlement R2
-- Individual Faculty bundle: ₱299 monthly OR ₱1,999 yearly.
-- Student core Classroom/Attendance/Quiz usage remains free.
-- Existing active legacy faculty assignments are grandfathered without fabricating payment rows.
-- No Quiz attempts/scores/responses or Classroom grades are reset.

update public.buklod_focus_app_subscription_config
set annual_amount_php = 1999,
    billing_interval = 'YEARLY',
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'bundle_code','BUKLOD_FACULTY',
      'bundle_scope','INDIVIDUAL_FACULTY_USER',
      'monthly_amount_php',299,
      'monthly_term_months',1,
      'yearly_amount_php',1999,
      'yearly_term_months',12,
      'pricing_display','₱299/month OR ₱1,999/year',
      'plans_are_distinct',true,
      'payment_choice_required',true,
      'auto_convert_monthly_to_yearly',false,
      'included_apps',jsonb_build_array('classroom','attendance','quiz'),
      'included_app_labels',jsonb_build_array('BUKLOD Classroom','BUKLOD Attendance','BUKLOD Quiz'),
      'classroom_faculty_included',true,
      'attendance_faculty_included',true,
      'quiz_examiner_included',true,
      'student_subscription_required',false,
      'separate_payment_per_included_app',false
    ),
    updated_at = now()
where lower(focus_app_code)='faculty';

-- Preserve access for pre-commercialization active faculty assignments.
-- This is an entitlement migration, NOT a fabricated payment record.
insert into public.buklod_user_focus_app_entitlements(
  user_id,focus_app_code,status,source,activated_at,expires_at,metadata
)
select
  f.faculty_user_id,
  'faculty',
  'ACTIVE',
  'MIGRATION',
  min(f.assigned_at),
  null,
  jsonb_build_object(
    'grandfathered',true,
    'migration_key','CLASSROOM_FACULTY_ENTITLEMENT_R2',
    'basis','ACTIVE_LEGACY_CLASSROOM_FACULTY_ASSIGNMENT',
    'payment_record_present_in_current_connect_db',false,
    'do_not_charge_again_for_migration_access',true,
    'included_apps',jsonb_build_array('classroom','attendance','quiz')
  )
from public.buklod_education_classroom_faculty f
where upper(f.status)='ACTIVE'
  and f.ended_at is null
group by f.faculty_user_id
on conflict(user_id,focus_app_code) do nothing;

create or replace function public.buklod_submit_personal_focus_app_payment_v2(
  p_focus_app_code text,
  p_plan_code text,
  p_gcash_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_code text := lower(coalesce(nullif(btrim(p_focus_app_code),''),''));
  v_plan text := upper(coalesce(nullif(btrim(p_plan_code),''),'YEARLY'));
  v_ref text := nullif(btrim(coalesce(p_gcash_reference,'')),'');
  v_cfg public.buklod_focus_app_subscription_config%rowtype;
  v_amount numeric;
  v_term_months integer;
  v_existing uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_code='' then raise exception 'Focus App is required'; end if;
  if v_ref is null then raise exception 'GCash reference is required'; end if;

  select * into v_cfg
  from public.buklod_focus_app_subscription_config
  where focus_app_code=v_code and is_active=true;
  if not found then raise exception 'Focus App is unavailable'; end if;

  if v_code='faculty' then
    if v_plan='MONTHLY' then
      v_amount := 299;
      v_term_months := 1;
    elsif v_plan='YEARLY' then
      v_amount := 1999;
      v_term_months := 12;
    else
      raise exception 'BUKLOD Faculty plan must be MONTHLY or YEARLY';
    end if;
  else
    if v_plan <> 'YEARLY' then
      raise exception 'This Focus App currently supports YEARLY payment only';
    end if;
    v_amount := v_cfg.annual_amount_php;
    v_term_months := 12;
  end if;

  if public.buklod_can_use_personal_focus_app_v1(v_code) then
    raise exception 'This Focus App is already active on your account';
  end if;

  select id into v_existing
  from public.buklod_user_focus_app_payment_requests
  where user_id=v_user
    and focus_app_code=v_code
    and status='pending_admin'
  order by created_at desc
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'request_id',v_existing,
      'status','pending_admin',
      'already_pending',true
    );
  end if;

  insert into public.buklod_user_focus_app_payment_requests(
    user_id,focus_app_code,gcash_reference,amount_php,currency,metadata
  ) values (
    v_user,v_code,v_ref,v_amount,v_cfg.currency,
    jsonb_build_object(
      'scope_model','USER',
      'purchase_mode','ONE_BY_ONE',
      'plan_code',v_plan,
      'term_months',v_term_months,
      'bundle_code',case when v_code='faculty' then 'BUKLOD_FACULTY' else null end,
      'included_apps',case when v_code='faculty' then jsonb_build_array('classroom','attendance','quiz') else '[]'::jsonb end
    )
  ) returning id into v_id;

  return jsonb_build_object(
    'request_id',v_id,
    'status','pending_admin',
    'focus_app_code',v_code,
    'plan_code',v_plan,
    'term_months',v_term_months,
    'amount_php',v_amount,
    'currency',v_cfg.currency,
    'scope_model','USER'
  );
end;
$$;

revoke all on function public.buklod_submit_personal_focus_app_payment_v2(text,text,text) from public;
grant execute on function public.buklod_submit_personal_focus_app_payment_v2(text,text,text) to authenticated;

-- Backward-compatible yearly wrapper for older clients.
create or replace function public.buklod_submit_personal_focus_app_payment_v1(
  p_focus_app_code text,
  p_gcash_reference text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.buklod_submit_personal_focus_app_payment_v2(
    p_focus_app_code,
    'YEARLY',
    p_gcash_reference
  );
$$;

revoke all on function public.buklod_submit_personal_focus_app_payment_v1(text,text) from public;
grant execute on function public.buklod_submit_personal_focus_app_payment_v1(text,text) to authenticated;

-- Approval now honors the selected payment term instead of always adding one year.
create or replace function public.buklod_admin_review_focus_app_payment_v1(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.buklod_user_focus_app_payment_requests%rowtype;
  v_ent public.buklod_user_focus_app_entitlements%rowtype;
  v_plan text;
  v_term_months integer;
  v_expected_amount numeric;
  v_new_expiry timestamptz;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_is_system_admin() then raise exception 'System administrator access required'; end if;

  select * into v_row
  from public.buklod_user_focus_app_payment_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Personal Focus App payment request not found'; end if;
  if v_row.status <> 'pending_admin' then raise exception 'Payment request is no longer pending'; end if;

  if not coalesce(p_approve,false) then
    update public.buklod_user_focus_app_payment_requests
    set status='rejected',reviewed_by=v_actor,reviewed_at=now(),
        admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),updated_at=now()
    where id=v_row.id;
    return jsonb_build_object('request_id',v_row.id,'status','rejected','scope_model','USER');
  end if;

  v_plan := upper(coalesce(nullif(v_row.metadata->>'plan_code',''),'YEARLY'));
  v_term_months := coalesce(nullif(v_row.metadata->>'term_months','')::integer,
    case when lower(v_row.focus_app_code)='faculty' and v_plan='MONTHLY' then 1 else 12 end);

  if lower(v_row.focus_app_code)='faculty' then
    if v_plan='MONTHLY' then v_expected_amount:=299; v_term_months:=1;
    elsif v_plan='YEARLY' then v_expected_amount:=1999; v_term_months:=12;
    else raise exception 'Invalid BUKLOD Faculty plan';
    end if;
    if v_row.amount_php is distinct from v_expected_amount then
      raise exception 'BUKLOD Faculty payment amount does not match selected plan';
    end if;
  end if;

  select * into v_ent
  from public.buklod_user_focus_app_entitlements
  where user_id=v_row.user_id and focus_app_code=v_row.focus_app_code
  for update;

  if found and v_ent.status='ACTIVE' and v_ent.expires_at is null
     and v_ent.source in ('MANUAL','COMPLIMENTARY','MIGRATION') then
    v_new_expiry := null;
  elsif found and v_ent.status='ACTIVE' and v_ent.expires_at > now() then
    v_new_expiry := v_ent.expires_at + make_interval(months => v_term_months);
  else
    v_new_expiry := now() + make_interval(months => v_term_months);
  end if;

  insert into public.buklod_user_focus_app_entitlements(
    user_id,focus_app_code,status,source,activated_at,expires_at,
    last_payment_request_id,granted_by,metadata
  ) values (
    v_row.user_id,v_row.focus_app_code,'ACTIVE','PAYMENT',now(),v_new_expiry,
    v_row.id,v_actor,
    jsonb_build_object(
      'latest_gcash_reference',v_row.gcash_reference,
      'plan_code',v_plan,
      'term_months',v_term_months,
      'latest_amount_php',v_row.amount_php,
      'included_apps',case when lower(v_row.focus_app_code)='faculty'
        then jsonb_build_array('classroom','attendance','quiz') else '[]'::jsonb end
    )
  )
  on conflict(user_id,focus_app_code) do update set
    status='ACTIVE',
    source='PAYMENT',
    activated_at=case when public.buklod_user_focus_app_entitlements.status='ACTIVE'
      then public.buklod_user_focus_app_entitlements.activated_at else now() end,
    expires_at=v_new_expiry,
    last_payment_request_id=v_row.id,
    granted_by=v_actor,
    metadata=coalesce(public.buklod_user_focus_app_entitlements.metadata,'{}'::jsonb) || jsonb_build_object(
      'latest_gcash_reference',v_row.gcash_reference,
      'plan_code',v_plan,
      'term_months',v_term_months,
      'latest_amount_php',v_row.amount_php,
      'included_apps',case when lower(v_row.focus_app_code)='faculty'
        then jsonb_build_array('classroom','attendance','quiz') else '[]'::jsonb end
    ),
    updated_at=now();

  update public.buklod_user_focus_app_payment_requests
  set status='approved',reviewed_by=v_actor,reviewed_at=now(),
      admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),updated_at=now()
  where id=v_row.id;

  return jsonb_build_object(
    'request_id',v_row.id,
    'status','approved',
    'focus_app_code',v_row.focus_app_code,
    'user_id',v_row.user_id,
    'plan_code',v_plan,
    'term_months',v_term_months,
    'valid_until',v_new_expiry,
    'scope_model','USER'
  );
end;
$$;

-- Faculty permissions now require BOTH an active Faculty entitlement and an active class assignment.
create or replace function public.buklod_education_faculty_permissions_v2(
  p_classroom_id uuid,
  p_user_id uuid default auth.uid()
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.buklod_is_system_admin() then
      jsonb_build_object(
        'MANAGE_CLASSROOM',true,'MANAGE_FACULTY',true,'MANAGE_ROSTER',true,
        'MANAGE_MATERIALS',true,'MANAGE_ATTENDANCE',true,'MANAGE_ASSESSMENTS',true,
        'MANAGE_GRADEBOOK',true,'RELEASE_GRADES',true,'MANAGE_LIVE',true,
        'MANAGE_DISCUSSIONS',true,'SYSTEM_ADMIN',true
      )
    when not public.buklod_is_active_faculty_focus_user_v1(p_user_id) then '{}'::jsonb
    else coalesce((
      select public.buklod_education_faculty_role_permissions_v1(f.faculty_role)
             || coalesce(f.metadata->'permissions','{}'::jsonb)
      from public.buklod_education_classroom_faculty f
      where f.classroom_id=p_classroom_id
        and f.faculty_user_id=p_user_id
        and upper(f.status)='ACTIVE'
        and f.ended_at is null
      limit 1
    ),'{}'::jsonb)
  end;
$$;

-- Direct assignment calls cannot bypass the paid Faculty entitlement rule.
create or replace function public.buklod_education_assign_classroom_faculty_v2(
  p_classroom_id uuid,
  p_faculty_user_id uuid,
  p_role text,
  p_permissions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_role text:=upper(btrim(coalesce(p_role,'')));
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if v_role='PRIMARY_FACULTY' then v_role:='PRIMARY'; end if;
  if v_role not in ('PRIMARY','TEACHER','CO_TEACHER','ASSISTANT') then
    raise exception 'Invalid faculty role.';
  end if;
  if not public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_FACULTY',v_actor) then
    raise exception 'Primary Faculty permission required.';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_faculty_user_id and p.is_active=true) then
    raise exception 'Target faculty needs an active BUKLOD account.';
  end if;
  if not public.buklod_is_active_faculty_focus_user_v1(p_faculty_user_id) then
    raise exception 'Target user needs an active BUKLOD Faculty entitlement (₱299/month or ₱1,999/year).';
  end if;
  if v_role='PRIMARY' and exists(
    select 1 from public.buklod_education_classroom_faculty f
    where f.classroom_id=p_classroom_id
      and upper(f.status)='ACTIVE'
      and f.faculty_role='PRIMARY'
      and f.faculty_user_id<>p_faculty_user_id
  ) then
    raise exception 'Use Transfer Primary Faculty to replace the current Primary Faculty.';
  end if;

  select to_jsonb(f) into v_before
  from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id and f.faculty_user_id=p_faculty_user_id;

  insert into public.buklod_education_classroom_faculty(
    classroom_id,faculty_user_id,faculty_role,status,assigned_by,assigned_at,ended_at,metadata
  ) values (
    p_classroom_id,p_faculty_user_id,v_role,'ACTIVE',v_actor,now(),null,
    jsonb_build_object(
      'permissions',coalesce(p_permissions,'{}'::jsonb),
      'assignment_model','PAID_FACULTY_ENTITLEMENT_PLUS_ASSIGNMENT'
    )
  )
  on conflict(classroom_id,faculty_user_id) do update set
    faculty_role=excluded.faculty_role,
    status='ACTIVE',
    assigned_by=v_actor,
    assigned_at=now(),
    ended_at=null,
    metadata=coalesce(public.buklod_education_classroom_faculty.metadata,'{}'::jsonb)
      || jsonb_build_object(
        'permissions',coalesce(p_permissions,'{}'::jsonb),
        'assignment_model','PAID_FACULTY_ENTITLEMENT_PLUS_ASSIGNMENT'
      ),
    updated_at=now();

  select to_jsonb(f) into v_after
  from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id and f.faculty_user_id=p_faculty_user_id;

  insert into public.buklod_foundation_audit_logs(
    actor_id,action,target_user_id,role_key,scope_type,scope_id,before_state,after_state,reason
  ) values (
    v_actor,'CLASSROOM_FACULTY_ASSIGN',p_faculty_user_id,v_role,
    'EDUCATION_CLASSROOM',p_classroom_id,v_before,v_after,
    'Faculty assignment updated. Active BUKLOD Faculty entitlement plus active classroom assignment is required; classroom data remains with classroom_id.'
  );

  return jsonb_build_object(
    'classroom_id',p_classroom_id,
    'faculty_user_id',p_faculty_user_id,
    'role',v_role,
    'status','ACTIVE',
    'permissions',public.buklod_education_faculty_permissions_v2(p_classroom_id,p_faculty_user_id)
  );
end;
$$;

-- Classroom access: entitled assigned faculty OR active enrolled student.
create or replace function private.buklod_classroom_can_access(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.buklod_education_classrooms c
    where c.id=p_classroom_id
      and c.status='ACTIVE'
      and (
        (
          public.buklod_is_active_faculty_focus_user_v1((select auth.uid()))
          and exists(
            select 1
            from public.buklod_education_classroom_faculty f
            where f.classroom_id=c.id
              and f.faculty_user_id=(select auth.uid())
              and upper(f.status)='ACTIVE'
              and f.ended_at is null
          )
        )
        or exists(
          select 1
          from public.buklod_education_enrollments e
          where e.classroom_id=c.id
            and e.student_user_id=(select auth.uid())
            and upper(e.status)='ACTIVE'
        )
      )
  );
$$;

create or replace function public.buklod_classroom_context_v1(p_classroom_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid:=auth.uid();
  v jsonb;
  v_is_faculty boolean;
  v_is_student boolean;
  v_faculty_role text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.buklod_classroom_can_access(p_classroom_id) then
    raise exception 'Classroom access required';
  end if;

  select exists(
    select 1 from public.buklod_education_classroom_faculty f
    where f.classroom_id=p_classroom_id
      and f.faculty_user_id=v_uid
      and upper(f.status)='ACTIVE'
      and f.ended_at is null
  ) and public.buklod_is_active_faculty_focus_user_v1(v_uid)
  into v_is_faculty;

  select exists(
    select 1 from public.buklod_education_enrollments e
    where e.classroom_id=p_classroom_id
      and e.student_user_id=v_uid
      and upper(e.status)='ACTIVE'
  ) into v_is_student;

  select f.faculty_role into v_faculty_role
  from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id
    and f.faculty_user_id=v_uid
    and upper(f.status)='ACTIVE'
    and f.ended_at is null
  limit 1;

  select jsonb_build_object(
    'id',c.id,'name',c.name,'subject_code',c.subject_code,'section_name',c.section_name,
    'school_year',c.school_year,'term',c.term,'description',c.description,
    'classroom_mode',c.classroom_mode,'classroom_plan',c.classroom_plan,
    'free_live_minutes',c.free_live_minutes,'allow_student_posts',c.allow_student_posts,
    'allow_student_chat',c.allow_student_chat,'allow_student_uploads',c.allow_student_uploads,
    'role',case when v_is_faculty then 'FACULTY' else 'STUDENT' end,
    'roles',case when v_is_faculty and v_is_student then jsonb_build_array('FACULTY','STUDENT')
                 when v_is_faculty then jsonb_build_array('FACULTY')
                 else jsonb_build_array('STUDENT') end,
    'dual_role',v_is_faculty and v_is_student,
    'is_faculty',v_is_faculty,
    'is_student',v_is_student,
    'faculty_role',v_faculty_role,
    'faculty_permissions',case when v_is_faculty
      then public.buklod_education_faculty_permissions_v2(p_classroom_id,v_uid)
      else '{}'::jsonb end,
    'faculty_user_id',c.faculty_user_id
  ) into v
  from public.buklod_education_classrooms c
  where c.id=p_classroom_id;

  return v;
end;
$$;

-- Old clients keep student-first behavior; faculty assignments are no longer tied to c.faculty_user_id.
create or replace function public.buklod_classroom_my_classes_v1()
returns table(
  classroom_id uuid,
  classroom_name text,
  subject_code text,
  section_name text,
  school_year text,
  term text,
  classroom_mode text,
  classroom_plan text,
  role_key text,
  status text,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid)
  select
    c.id,c.name,c.subject_code,c.section_name,c.school_year,c.term,
    c.classroom_mode,c.classroom_plan,
    case
      when exists(
        select 1 from public.buklod_education_enrollments e
        where e.classroom_id=c.id and e.student_user_id=me.uid and upper(e.status)='ACTIVE'
      ) then 'STUDENT'
      else 'FACULTY'
    end,
    c.status,c.updated_at
  from public.buklod_education_classrooms c
  cross join me
  where me.uid is not null
    and c.status='ACTIVE'
    and (
      exists(
        select 1 from public.buklod_education_enrollments e
        where e.classroom_id=c.id and e.student_user_id=me.uid and upper(e.status)='ACTIVE'
      )
      or (
        public.buklod_is_active_faculty_focus_user_v1(me.uid)
        and exists(
          select 1 from public.buklod_education_classroom_faculty f
          where f.classroom_id=c.id and f.faculty_user_id=me.uid
            and upper(f.status)='ACTIVE' and f.ended_at is null
        )
      )
    )
  order by c.updated_at desc,c.created_at desc;
$$;

create or replace function public.buklod_classroom_my_classes_v2()
returns table(
  classroom_id uuid,
  classroom_name text,
  subject_code text,
  section_name text,
  school_year text,
  term text,
  classroom_mode text,
  classroom_plan text,
  role_key text,
  faculty_role text,
  faculty_permissions jsonb,
  is_student boolean,
  is_faculty boolean,
  dual_role boolean,
  status text,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  x as (
    select c.*,
      exists(
        select 1 from public.buklod_education_enrollments e
        where e.classroom_id=c.id and e.student_user_id=me.uid and upper(e.status)='ACTIVE'
      ) as is_student,
      (
        public.buklod_is_active_faculty_focus_user_v1(me.uid)
        and exists(
          select 1 from public.buklod_education_classroom_faculty f
          where f.classroom_id=c.id and f.faculty_user_id=me.uid
            and upper(f.status)='ACTIVE' and f.ended_at is null
        )
      ) as is_faculty,
      (
        select f.faculty_role
        from public.buklod_education_classroom_faculty f
        where f.classroom_id=c.id and f.faculty_user_id=me.uid
          and upper(f.status)='ACTIVE' and f.ended_at is null
        limit 1
      ) as faculty_role
    from public.buklod_education_classrooms c
    cross join me
    where me.uid is not null and c.status='ACTIVE'
  )
  select
    x.id,x.name,x.subject_code,x.section_name,x.school_year,x.term,
    x.classroom_mode,x.classroom_plan,
    case when x.is_faculty and x.is_student then 'DUAL'
         when x.is_faculty then 'FACULTY' else 'STUDENT' end,
    x.faculty_role,
    case when x.is_faculty then public.buklod_education_faculty_permissions_v2(x.id,auth.uid()) else '{}'::jsonb end,
    x.is_student,x.is_faculty,(x.is_student and x.is_faculty),x.status,x.updated_at
  from x
  where x.is_student or x.is_faculty
  order by x.updated_at desc,x.created_at desc;
$$;

revoke all on function public.buklod_classroom_my_classes_v2() from public;
grant execute on function public.buklod_classroom_my_classes_v2() to authenticated;

create or replace function public.buklod_education_faculty_my_classrooms_v1()
returns table(
  id uuid,
  name text,
  subject_code text,
  section_name text,
  school_year text,
  term text,
  status text,
  faculty_role text,
  faculty_permissions jsonb
)
language sql
security definer
set search_path = ''
as $$
  select
    c.id,c.name,c.subject_code,c.section_name,c.school_year,c.term,c.status,
    f.faculty_role,
    public.buklod_education_faculty_permissions_v2(c.id,auth.uid())
  from public.buklod_education_classroom_faculty f
  join public.buklod_education_classrooms c on c.id=f.classroom_id
  where f.faculty_user_id=auth.uid()
    and upper(f.status)='ACTIVE'
    and f.ended_at is null
    and c.status='ACTIVE'
    and public.buklod_is_active_faculty_focus_user_v1(auth.uid())
  order by c.updated_at desc,c.created_at desc;
$$;

revoke all on function public.buklod_education_faculty_my_classrooms_v1() from public;
grant execute on function public.buklod_education_faculty_my_classrooms_v1() to authenticated;

create or replace function public.buklod_my_classroom_launcher_access_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() uid), x as (
    select
      public.buklod_is_active_faculty_focus_user_v1(me.uid) as has_faculty_entitlement,
      exists(
        select 1 from public.buklod_education_classroom_faculty f
        where f.faculty_user_id=me.uid and upper(f.status)='ACTIVE' and f.ended_at is null
      ) as has_faculty_assignment,
      exists(
        select 1 from public.buklod_education_enrollments e
        join public.buklod_education_classrooms c on c.id=e.classroom_id
        where e.student_user_id=me.uid and upper(e.status)='ACTIVE' and c.status='ACTIVE'
      ) as has_student_enrollment
    from me
  )
  select jsonb_build_object(
    'show_launcher',has_faculty_entitlement or has_student_enrollment,
    'has_faculty_entitlement',has_faculty_entitlement,
    'has_faculty_assignment',has_faculty_assignment,
    'has_student_enrollment',has_student_enrollment,
    'dual_role',has_faculty_entitlement and has_student_enrollment,
    'default_view',case when has_student_enrollment then 'STUDENT'
                        when has_faculty_entitlement then 'FACULTY' else null end,
    'faculty_pricing',jsonb_build_object(
      'monthly_php',299,'monthly_months',1,
      'yearly_php',1999,'yearly_months',12,
      'included_apps',jsonb_build_array('classroom','attendance','quiz')
    )
  ) from x;
$$;

revoke all on function public.buklod_my_classroom_launcher_access_v1() from public;
grant execute on function public.buklod_my_classroom_launcher_access_v1() to authenticated;

create or replace function public.buklod_education_monetization_policy_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object('policy_key',p.policy_key,'is_active',p.is_active,'config',p.config,'updated_at',p.updated_at)
    from public.buklod_education_monetization_policy p
    where p.is_active=true
    order by p.updated_at desc
    limit 1
  ),'{}'::jsonb);
$$;

revoke all on function public.buklod_education_monetization_policy_v1() from public;
grant execute on function public.buklod_education_monetization_policy_v1() to authenticated;

-- Reduce direct exposure while preserving SECURITY DEFINER RPC access.
-- RLS is intentionally not auto-enabled here because doing so without a complete policy set can break production access.
revoke all on table public.buklod_education_classroom_faculty from anon, authenticated;
revoke all on table public.buklod_education_monetization_policy from anon, authenticated;
