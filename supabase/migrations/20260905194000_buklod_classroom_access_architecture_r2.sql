-- BUKLOD Classroom Access Architecture R2
-- Separate Focus App access model:
-- - faculty entitlement is user-scoped (`faculty`)
-- - classroom management requires entitlement + active assignment
-- - student access requires active classroom enrollment
-- - classroom remains the persistent data container across faculty changes
-- - legacy faculty_user_id is retained only for compatibility, not authority
-- - no exam attempt, score, attendance, enrollment, submission, or grade reset

-- -----------------------------------------------------------------------------
-- 1. Preserve current faculty access during transition.
--    Existing active assigned faculty are grandfathered into the new entitlement
--    so enforcement cannot unexpectedly lock out current classes.
-- -----------------------------------------------------------------------------
insert into public.buklod_user_focus_app_entitlements(
  user_id,
  focus_app_code,
  status,
  source,
  activated_at,
  expires_at,
  granted_by,
  metadata
)
select distinct
  f.faculty_user_id,
  'faculty',
  'ACTIVE',
  'MIGRATION',
  now(),
  null,
  f.assigned_by,
  jsonb_build_object(
    'migration', 'CLASSROOM_ACCESS_ARCHITECTURE_R2',
    'grandfathered_existing_faculty', true,
    'pricing_model', 'PHP_299_MONTHLY_OR_1999_YEARLY',
    'included_services', jsonb_build_array('classroom','attendance','quiz')
  )
from public.buklod_education_classroom_faculty f
where f.status='ACTIVE'
on conflict (user_id, focus_app_code) do nothing;

-- One assignment record per faculty per classroom. Historical status stays on row.
create unique index if not exists uq_buklod_education_classroom_faculty_class_user
  on public.buklod_education_classroom_faculty(classroom_id, faculty_user_id);

-- Exactly one ACTIVE PRIMARY assignment per classroom.
create unique index if not exists uq_buklod_education_classroom_faculty_active_primary
  on public.buklod_education_classroom_faculty(classroom_id)
  where status='ACTIVE' and faculty_role='PRIMARY';

-- -----------------------------------------------------------------------------
-- 2. Entitlement authority.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_education_has_active_faculty_entitlement_v1(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    public.buklod_is_system_admin()
    or exists (
      select 1
      from public.buklod_user_focus_app_entitlements e
      where e.user_id=p_user_id
        and e.focus_app_code='faculty'
        and e.status='ACTIVE'
        and (e.expires_at is null or e.expires_at > now())
    );
$$;

revoke all on function public.buklod_education_has_active_faculty_entitlement_v1(uuid) from public, anon;
grant execute on function public.buklod_education_has_active_faculty_entitlement_v1(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Default role permissions + per-assignment overrides.
--    DB key PRIMARY is displayed in UI as "Primary Faculty".
-- -----------------------------------------------------------------------------
create or replace function public.buklod_education_faculty_role_permissions_v1(p_role text)
returns jsonb
language sql
immutable
set search_path=''
as $$
  select case upper(coalesce(p_role,''))
    when 'PRIMARY' then jsonb_build_object(
      'MANAGE_CLASSROOM',true,
      'MANAGE_FACULTY',true,
      'MANAGE_ROSTER',true,
      'MANAGE_MATERIALS',true,
      'MANAGE_ATTENDANCE',true,
      'MANAGE_ASSESSMENTS',true,
      'MANAGE_GRADEBOOK',true,
      'RELEASE_GRADES',true,
      'MANAGE_LIVE',true,
      'MANAGE_DISCUSSIONS',true
    )
    when 'TEACHER' then jsonb_build_object(
      'MANAGE_CLASSROOM',true,
      'MANAGE_FACULTY',false,
      'MANAGE_ROSTER',true,
      'MANAGE_MATERIALS',true,
      'MANAGE_ATTENDANCE',true,
      'MANAGE_ASSESSMENTS',true,
      'MANAGE_GRADEBOOK',true,
      'RELEASE_GRADES',true,
      'MANAGE_LIVE',true,
      'MANAGE_DISCUSSIONS',true
    )
    when 'CO_TEACHER' then jsonb_build_object(
      'MANAGE_CLASSROOM',true,
      'MANAGE_FACULTY',false,
      'MANAGE_ROSTER',true,
      'MANAGE_MATERIALS',true,
      'MANAGE_ATTENDANCE',true,
      'MANAGE_ASSESSMENTS',true,
      'MANAGE_GRADEBOOK',true,
      'RELEASE_GRADES',false,
      'MANAGE_LIVE',true,
      'MANAGE_DISCUSSIONS',true
    )
    when 'ASSISTANT' then jsonb_build_object(
      'MANAGE_CLASSROOM',false,
      'MANAGE_FACULTY',false,
      'MANAGE_ROSTER',false,
      'MANAGE_MATERIALS',true,
      'MANAGE_ATTENDANCE',true,
      'MANAGE_ASSESSMENTS',false,
      'MANAGE_GRADEBOOK',false,
      'RELEASE_GRADES',false,
      'MANAGE_LIVE',false,
      'MANAGE_DISCUSSIONS',true
    )
    else '{}'::jsonb
  end;
$$;

create or replace function public.buklod_education_faculty_permissions_v2(
  p_classroom_id uuid,
  p_user_id uuid default auth.uid()
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select case
    when public.buklod_is_system_admin() then jsonb_build_object(
      'MANAGE_CLASSROOM',true,'MANAGE_FACULTY',true,'MANAGE_ROSTER',true,
      'MANAGE_MATERIALS',true,'MANAGE_ATTENDANCE',true,'MANAGE_ASSESSMENTS',true,
      'MANAGE_GRADEBOOK',true,'RELEASE_GRADES',true,'MANAGE_LIVE',true,
      'MANAGE_DISCUSSIONS',true,'SYSTEM_ADMIN',true
    )
    when not public.buklod_education_has_active_faculty_entitlement_v1(p_user_id) then '{}'::jsonb
    else coalesce((
      select public.buklod_education_faculty_role_permissions_v1(f.faculty_role)
             || coalesce(f.metadata->'permissions','{}'::jsonb)
      from public.buklod_education_classroom_faculty f
      where f.classroom_id=p_classroom_id
        and f.faculty_user_id=p_user_id
        and f.status='ACTIVE'
      limit 1
    ), '{}'::jsonb)
  end;
$$;

revoke all on function public.buklod_education_faculty_permissions_v2(uuid,uuid) from public, anon;
grant execute on function public.buklod_education_faculty_permissions_v2(uuid,uuid) to authenticated;

create or replace function public.buklod_education_faculty_has_permission_v2(
  p_classroom_id uuid,
  p_permission text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (public.buklod_education_faculty_permissions_v2(p_classroom_id,p_user_id)
      ->> upper(btrim(coalesce(p_permission,''))))::boolean,
    false
  );
$$;

revoke all on function public.buklod_education_faculty_has_permission_v2(uuid,text,uuid) from public, anon;
grant execute on function public.buklod_education_faculty_has_permission_v2(uuid,text,uuid) to authenticated;

-- Existing helper now means active assignment + active Faculty entitlement.
create or replace function public.buklod_education_is_active_classroom_faculty(
  p_classroom_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.buklod_is_system_admin()
    or (
      public.buklod_education_has_active_faculty_entitlement_v1(p_user_id)
      and exists (
        select 1
        from public.buklod_education_classroom_faculty f
        where f.classroom_id=p_classroom_id
          and f.faculty_user_id=p_user_id
          and f.status='ACTIVE'
      )
    );
$$;

-- Backward-compatible function name used by existing Classroom RPCs.
-- Authority is no longer c.faculty_user_id; it is entitlement + assignment + permission.
create or replace function public.buklod_education_is_faculty_owner_v2(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.buklod_is_system_admin()
    or public.buklod_education_faculty_has_permission_v2(
      p_classroom_id,
      'MANAGE_CLASSROOM',
      auth.uid()
    );
$$;

-- -----------------------------------------------------------------------------
-- 4. Multi-faculty listing and controlled assignment management.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_education_active_classroom_faculty_v1(p_classroom_id uuid)
returns table(
  faculty_user_id uuid,
  faculty_role text,
  assigned_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select f.faculty_user_id, f.faculty_role, f.assigned_at
  from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id
    and f.status='ACTIVE'
    and public.buklod_education_has_active_faculty_entitlement_v1(f.faculty_user_id)
  order by case f.faculty_role when 'PRIMARY' then 0 when 'TEACHER' then 1 when 'CO_TEACHER' then 2 else 3 end,
           f.assigned_at;
$$;

revoke all on function public.buklod_education_active_classroom_faculty_v1(uuid) from public, anon;
grant execute on function public.buklod_education_active_classroom_faculty_v1(uuid) to authenticated;

create or replace function public.buklod_education_assign_classroom_faculty_v2(
  p_classroom_id uuid,
  p_faculty_user_id uuid,
  p_role text,
  p_permissions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := upper(btrim(coalesce(p_role,'')));
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if v_role='PRIMARY_FACULTY' then v_role := 'PRIMARY'; end if;
  if v_role not in ('PRIMARY','TEACHER','CO_TEACHER','ASSISTANT') then
    raise exception 'Invalid faculty role.';
  end if;
  if not public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_FACULTY',v_actor) then
    raise exception 'Primary Faculty permission required.';
  end if;
  if not public.buklod_education_has_active_faculty_entitlement_v1(p_faculty_user_id) then
    raise exception 'Target user needs an active BUKLOD Faculty subscription before classroom assignment.';
  end if;
  if v_role='PRIMARY' and exists (
    select 1 from public.buklod_education_classroom_faculty f
    where f.classroom_id=p_classroom_id and f.status='ACTIVE' and f.faculty_role='PRIMARY'
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
    jsonb_build_object('permissions',coalesce(p_permissions,'{}'::jsonb),'assignment_model','ENTITLEMENT_PLUS_ASSIGNMENT')
  )
  on conflict (classroom_id,faculty_user_id) do update set
    faculty_role=excluded.faculty_role,
    status='ACTIVE',
    assigned_by=v_actor,
    assigned_at=now(),
    ended_at=null,
    metadata=coalesce(public.buklod_education_classroom_faculty.metadata,'{}'::jsonb)
      || jsonb_build_object('permissions',coalesce(p_permissions,'{}'::jsonb),'assignment_model','ENTITLEMENT_PLUS_ASSIGNMENT'),
    updated_at=now();

  select to_jsonb(f) into v_after
  from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id and f.faculty_user_id=p_faculty_user_id;

  insert into public.buklod_foundation_audit_logs(
    actor_id,action,target_user_id,role_key,scope_type,scope_id,before_state,after_state,reason
  ) values (
    v_actor,'CLASSROOM_FACULTY_ASSIGN',p_faculty_user_id,v_role,'EDUCATION_CLASSROOM',p_classroom_id,
    v_before,v_after,'Faculty assignment updated; classroom data ownership remains with the classroom.'
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

revoke all on function public.buklod_education_assign_classroom_faculty_v2(uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.buklod_education_assign_classroom_faculty_v2(uuid,uuid,text,jsonb) to authenticated;

create or replace function public.buklod_education_end_classroom_faculty_v2(
  p_classroom_id uuid,
  p_faculty_user_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_role text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_FACULTY',v_actor) then
    raise exception 'Primary Faculty permission required.';
  end if;

  select to_jsonb(f),f.faculty_role into v_before,v_role
  from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id and f.faculty_user_id=p_faculty_user_id and f.status='ACTIVE';

  if v_before is null then return false; end if;
  if v_role='PRIMARY' then
    raise exception 'Primary Faculty cannot be removed directly. Transfer Primary Faculty first.';
  end if;

  update public.buklod_education_classroom_faculty
  set status='REMOVED',ended_at=now(),updated_at=now()
  where classroom_id=p_classroom_id and faculty_user_id=p_faculty_user_id;

  insert into public.buklod_foundation_audit_logs(
    actor_id,action,target_user_id,role_key,scope_type,scope_id,before_state,after_state,reason
  ) values (
    v_actor,'CLASSROOM_FACULTY_END',p_faculty_user_id,v_role,'EDUCATION_CLASSROOM',p_classroom_id,
    v_before,jsonb_build_object('status','REMOVED','ended_at',now()),nullif(btrim(coalesce(p_reason,'')),'')
  );
  return true;
end;
$$;

revoke all on function public.buklod_education_end_classroom_faculty_v2(uuid,uuid,text) from public, anon;
grant execute on function public.buklod_education_end_classroom_faculty_v2(uuid,uuid,text) to authenticated;

create or replace function public.buklod_education_transfer_primary_faculty_v1(
  p_classroom_id uuid,
  p_new_primary_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_old_primary uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_education_faculty_has_permission_v2(p_classroom_id,'MANAGE_FACULTY',v_actor) then
    raise exception 'Primary Faculty permission required.';
  end if;
  if not public.buklod_education_has_active_faculty_entitlement_v1(p_new_primary_user_id) then
    raise exception 'New Primary Faculty needs an active BUKLOD Faculty subscription.';
  end if;

  select f.faculty_user_id into v_old_primary
  from public.buklod_education_classroom_faculty f
  where f.classroom_id=p_classroom_id and f.status='ACTIVE' and f.faculty_role='PRIMARY'
  limit 1;

  if v_old_primary=p_new_primary_user_id then
    return jsonb_build_object('classroom_id',p_classroom_id,'primary_faculty_user_id',p_new_primary_user_id,'changed',false);
  end if;

  if v_old_primary is not null then
    update public.buklod_education_classroom_faculty
    set faculty_role='TEACHER',updated_at=now()
    where classroom_id=p_classroom_id and faculty_user_id=v_old_primary;
  end if;

  insert into public.buklod_education_classroom_faculty(
    classroom_id,faculty_user_id,faculty_role,status,assigned_by,assigned_at,ended_at,metadata
  ) values (
    p_classroom_id,p_new_primary_user_id,'PRIMARY','ACTIVE',v_actor,now(),null,
    jsonb_build_object('assignment_model','ENTITLEMENT_PLUS_ASSIGNMENT')
  )
  on conflict (classroom_id,faculty_user_id) do update set
    faculty_role='PRIMARY',status='ACTIVE',assigned_by=v_actor,assigned_at=now(),ended_at=null,updated_at=now();

  -- Compatibility pointer only. Classroom data stays on classroom_id.
  update public.buklod_education_classrooms
  set faculty_user_id=p_new_primary_user_id,updated_at=now()
  where id=p_classroom_id;

  insert into public.buklod_foundation_audit_logs(
    actor_id,action,target_user_id,role_key,scope_type,scope_id,before_state,after_state,reason
  ) values (
    v_actor,'CLASSROOM_PRIMARY_FACULTY_TRANSFER',p_new_primary_user_id,'PRIMARY','EDUCATION_CLASSROOM',p_classroom_id,
    jsonb_build_object('old_primary_faculty_user_id',v_old_primary),
    jsonb_build_object('new_primary_faculty_user_id',p_new_primary_user_id,'old_primary_new_role','TEACHER'),
    coalesce(nullif(btrim(coalesce(p_reason,'')),''),'Primary Faculty transfer; classroom records remain in place.')
  );

  return jsonb_build_object(
    'classroom_id',p_classroom_id,
    'old_primary_faculty_user_id',v_old_primary,
    'primary_faculty_user_id',p_new_primary_user_id,
    'changed',true,
    'data_transferred',false,
    'classroom_persisted',true
  );
end;
$$;

revoke all on function public.buklod_education_transfer_primary_faculty_v1(uuid,uuid,text) from public, anon;
grant execute on function public.buklod_education_transfer_primary_faculty_v1(uuid,uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Dual-role launcher + My Classes v2.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_classroom_launcher_access_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_faculty boolean := false;
  v_student boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;

  v_faculty := public.buklod_education_has_active_faculty_entitlement_v1(v_uid);
  select exists(
    select 1 from public.buklod_education_enrollments e
    join public.buklod_education_classrooms c on c.id=e.classroom_id and c.status='ACTIVE'
    where e.student_user_id=v_uid and e.status='ACTIVE'
  ) into v_student;

  return jsonb_build_object(
    'show_launcher',v_faculty or v_student,
    'can_faculty_view',v_faculty,
    'can_student_view',v_student,
    'dual_role',v_faculty and v_student,
    'default_view',case when v_faculty then 'FACULTY' when v_student then 'STUDENT' else null end,
    'faculty_entitlement','faculty',
    'faculty_pricing',jsonb_build_object('monthly_php',299,'yearly_php',1999),
    'student_core_free',true
  );
end;
$$;

revoke all on function public.buklod_classroom_launcher_access_v1() from public, anon;
grant execute on function public.buklod_classroom_launcher_access_v1() to authenticated;

create or replace function public.buklod_classroom_my_classes_v2(p_view text default null)
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
  can_faculty_view boolean,
  can_student_view boolean,
  status text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  with me as (select auth.uid() uid), eligible as (
    select
      c.id,c.name,c.subject_code,c.section_name,c.school_year,c.term,c.classroom_mode,c.classroom_plan,c.status,c.updated_at,
      f.faculty_role,
      (f.faculty_user_id is not null and public.buklod_education_has_active_faculty_entitlement_v1(me.uid)) as faculty_view,
      (e.student_user_id is not null) as student_view
    from public.buklod_education_classrooms c
    cross join me
    left join public.buklod_education_classroom_faculty f
      on f.classroom_id=c.id and f.faculty_user_id=me.uid and f.status='ACTIVE'
    left join public.buklod_education_enrollments e
      on e.classroom_id=c.id and e.student_user_id=me.uid and e.status='ACTIVE'
    where me.uid is not null
      and c.status='ACTIVE'
      and (f.faculty_user_id is not null or e.student_user_id is not null)
  )
  select
    id,name,subject_code,section_name,school_year,term,classroom_mode,classroom_plan,
    case
      when upper(coalesce(p_view,''))='STUDENT' and student_view then 'STUDENT'
      when upper(coalesce(p_view,''))='FACULTY' and faculty_view then 'FACULTY'
      when faculty_view then 'FACULTY'
      else 'STUDENT'
    end,
    faculty_role,
    faculty_view,
    student_view,
    status,
    updated_at
  from eligible
  where (p_view is null or btrim(p_view)='')
     or (upper(p_view)='FACULTY' and faculty_view)
     or (upper(p_view)='STUDENT' and student_view)
  order by updated_at desc;
$$;

revoke all on function public.buklod_classroom_my_classes_v2(text) from public, anon;
grant execute on function public.buklod_classroom_my_classes_v2(text) to authenticated;

-- Keep v1 working for old clients, but remove single-owner authority.
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
set search_path=''
as $$
  select x.classroom_id,x.classroom_name,x.subject_code,x.section_name,x.school_year,x.term,
         x.classroom_mode,x.classroom_plan,x.role_key,x.status,x.updated_at
  from public.buklod_classroom_my_classes_v2(null) x;
$$;

-- -----------------------------------------------------------------------------
-- 6. New-class creation: entitlement required, creator becomes Primary Faculty.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_education_create_classroom_with_owner_v1(
  p_name text,
  p_subject_code text default null,
  p_section_name text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(trim(coalesce(p_name,'')),'');
  v_classroom_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.is_active=true) then
    raise exception 'Active BUKLOD account required';
  end if;
  if not public.buklod_education_has_active_faculty_entitlement_v1(v_user_id) then
    raise exception 'Active BUKLOD Faculty subscription required (₱299/month or ₱1,999/year).';
  end if;
  if v_name is null then raise exception 'Class/subject name is required'; end if;

  perform public.buklod_foundation_provision_creator_internal_v1(
    v_user_id,'FACULTY_WORKSPACE',v_user_id,'FACULTY','EDUCATION',null,
    'ACTIVE','FACULTY_CLASSROOM_CREATE',jsonb_build_object('creator_self_service',true,'entitlement','faculty')
  );

  insert into public.buklod_education_classrooms(
    faculty_user_id,name,subject_code,section_name,status,grading_terms,grading_policy,passing_percent
  ) values (
    v_user_id,v_name,nullif(trim(coalesce(p_subject_code,'')),''),nullif(trim(coalesce(p_section_name,'')),''),
    'ACTIVE',public.buklod_education_default_grading_terms_v1(),public.buklod_education_default_grading_policy_v1(),75
  ) returning id into v_classroom_id;

  insert into public.buklod_education_classroom_faculty(
    classroom_id,faculty_user_id,faculty_role,status,assigned_by,metadata
  ) values (
    v_classroom_id,v_user_id,'PRIMARY','ACTIVE',v_user_id,
    jsonb_build_object('source','CLASSROOM_CREATE','assignment_model','ENTITLEMENT_PLUS_ASSIGNMENT')
  )
  on conflict (classroom_id,faculty_user_id) do update set
    faculty_role='PRIMARY',status='ACTIVE',ended_at=null,updated_at=now();

  perform public.buklod_education_apply_default_grading_template_v1(v_classroom_id,false);

  insert into public.buklod_foundation_audit_logs(
    actor_id,action,target_user_id,role_key,scope_type,scope_id,after_state,reason
  ) values (
    v_user_id,'CLASSROOM_CREATE',v_user_id,'PRIMARY','EDUCATION_CLASSROOM',v_classroom_id,
    jsonb_build_object('persistent_container',true,'faculty_entitlement','faculty'),
    'Classroom created as persistent container; creator assigned as Primary Faculty.'
  );

  return v_classroom_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Safe monetization-policy read RPC; remove direct client table writes.
--    RLS is intentionally NOT enabled here. Direct table privileges are removed
--    and clients use SECURITY DEFINER RPCs instead.
-- -----------------------------------------------------------------------------
create or replace function public.buklod_education_monetization_policy_v1()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select jsonb_build_object('policy_key',p.policy_key,'is_active',p.is_active,'config',p.config)
    from public.buklod_education_monetization_policy p
    where p.policy_key='EDUCATION_CORE' and p.is_active=true
    limit 1
  ), '{}'::jsonb);
$$;

revoke all on function public.buklod_education_monetization_policy_v1() from public, anon;
grant execute on function public.buklod_education_monetization_policy_v1() to authenticated;

revoke all privileges on table public.buklod_education_classroom_faculty from anon, authenticated;
revoke all privileges on table public.buklod_education_monetization_policy from anon, authenticated;

-- Explicitly keep controlled RPCs available to authenticated users only.
revoke all on function public.buklod_classroom_my_classes_v1() from public, anon;
grant execute on function public.buklod_classroom_my_classes_v1() to authenticated;
revoke all on function public.buklod_education_is_active_classroom_faculty(uuid,uuid) from public, anon;
grant execute on function public.buklod_education_is_active_classroom_faculty(uuid,uuid) to authenticated;
revoke all on function public.buklod_education_is_faculty_owner_v2(uuid) from public, anon;
grant execute on function public.buklod_education_is_faculty_owner_v2(uuid) to authenticated;
