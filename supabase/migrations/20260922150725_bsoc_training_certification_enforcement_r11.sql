
-- BUKLOD BSOC R11: enforce canonical training completion before certification/production access.

create or replace function public.buklod_bsoc_training_mark_progress_v1(
  p_module_key text,
  p_status text,
  p_score numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  module_key text := upper(trim(coalesce(p_module_key,'')));
  st text := upper(trim(coalesce(p_status,'')));
  allowed_modules constant text[] := array[
    'CORE_MISSION',
    'ROLE_BOUNDARIES',
    'CASE_WORKFLOW',
    'DIAGNOSTICS_RECOVERY',
    'APP_TROUBLESHOOTING',
    'INCIDENT_MODERATION',
    'SECURITY_PRIVACY',
    'RELEASE_FINANCE_BOUNDARIES',
    'SHIFT_QUALITY',
    'PRACTICAL_CERTIFICATION',
    'TRACK_SUPPORT',
    'TRACK_MODERATION',
    'TRACK_ORGANIZATIONS',
    'TRACK_APP_OPERATIONS',
    'TRACK_SECURITY',
    'TRACK_AUDIT'
  ];
begin
  if actor is null or not public.buklod_bsoc_can('bsoc.training.read') then
    raise exception 'BUKLOD BSOC training permission required';
  end if;

  if not (module_key = any(allowed_modules)) then
    raise exception 'Unknown BSOC training module';
  end if;

  if st not in ('NOT_STARTED','IN_PROGRESS','COMPLETED','PASSED','FAILED') then
    raise exception 'Invalid training status';
  end if;

  if p_score is not null and (p_score<0 or p_score>100) then
    raise exception 'Score must be 0 to 100';
  end if;

  if st='PASSED' and (p_score is null or p_score<80) then
    raise exception 'Passing score is 80 or higher';
  end if;

  insert into public.bsoc_training_progress(user_id,module_key,status,score,attempts,completed_at,updated_at)
  values(
    actor,module_key,st,p_score,
    case when st in ('PASSED','FAILED') then 1 else 0 end,
    case when st in ('COMPLETED','PASSED') then now() else null end,
    now()
  )
  on conflict(user_id,module_key) do update set
    status=excluded.status,
    score=coalesce(excluded.score,public.bsoc_training_progress.score),
    attempts=public.bsoc_training_progress.attempts
      + case when excluded.status in ('PASSED','FAILED') then 1 else 0 end,
    completed_at=case
      when excluded.status in ('COMPLETED','PASSED') then coalesce(public.bsoc_training_progress.completed_at,now())
      else public.bsoc_training_progress.completed_at
    end,
    updated_at=now();

  insert into public.bsoc_operator_readiness(user_id,training_status,production_access_enabled,updated_at)
  values(actor,'IN_PROGRESS',false,now())
  on conflict(user_id) do update set
    training_status=case
      when public.bsoc_operator_readiness.training_status='CERTIFIED'
        then public.bsoc_operator_readiness.training_status
      else 'IN_PROGRESS'
    end,
    updated_at=now();

  return jsonb_build_object('ok',true,'module_key',module_key,'status',st,'score',p_score);
end;
$$;

revoke all on function public.buklod_bsoc_training_mark_progress_v1(text,text,numeric) from public, anon;
grant execute on function public.buklod_bsoc_training_mark_progress_v1(text,text,numeric) to authenticated;

create or replace function public.buklod_bsoc_training_requirements_v1(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  target uuid := coalesce(p_user_id,actor);
  required text[] := array[
    'CORE_MISSION',
    'ROLE_BOUNDARIES',
    'CASE_WORKFLOW',
    'DIAGNOSTICS_RECOVERY',
    'APP_TROUBLESHOOTING',
    'INCIDENT_MODERATION',
    'SECURITY_PRIVACY',
    'RELEASE_FINANCE_BOUNDARIES',
    'SHIFT_QUALITY',
    'PRACTICAL_CERTIFICATION'
  ];
  tracks text[] := array[]::text[];
  missing text[];
  complete boolean := false;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if target is distinct from actor and not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;

  if exists(
    select 1 from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=target and ra.status='ACTIVE' and s.scope_type='SYSTEM'
      and ra.role_key in ('BSOC_SUPPORT_AGENT','BSOC_SUPPORT_MANAGER')
  ) then tracks:=array_append(tracks,'TRACK_SUPPORT'); end if;

  if exists(
    select 1 from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=target and ra.status='ACTIVE' and s.scope_type='SYSTEM'
      and ra.role_key in ('BSOC_MODERATOR','BSOC_MODERATION_MANAGER')
  ) then tracks:=array_append(tracks,'TRACK_MODERATION'); end if;

  if exists(
    select 1 from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=target and ra.status='ACTIVE' and s.scope_type='SYSTEM'
      and ra.role_key='BSOC_ORG_SUPPORT'
  ) then tracks:=array_append(tracks,'TRACK_ORGANIZATIONS'); end if;

  if exists(
    select 1 from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=target and ra.status='ACTIVE' and s.scope_type='SYSTEM'
      and ra.role_key='BSOC_APP_OPERATOR'
  ) then tracks:=array_append(tracks,'TRACK_APP_OPERATIONS'); end if;

  if exists(
    select 1 from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=target and ra.status='ACTIVE' and s.scope_type='SYSTEM'
      and ra.role_key='BSOC_SECURITY_OPERATOR'
  ) then tracks:=array_append(tracks,'TRACK_SECURITY'); end if;

  if exists(
    select 1 from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=target and ra.status='ACTIVE' and s.scope_type='SYSTEM'
      and ra.role_key='BSOC_AUDITOR'
  ) then tracks:=array_append(tracks,'TRACK_AUDIT'); end if;

  required := required || tracks;

  select coalesce(array_agg(req order by req),array[]::text[])
  into missing
  from unnest(required) req
  where not exists(
    select 1
    from public.bsoc_training_progress tp
    where tp.user_id=target
      and tp.module_key=req
      and (
        (req='PRACTICAL_CERTIFICATION' and tp.status='PASSED' and coalesce(tp.score,0)>=80)
        or (req<>'PRACTICAL_CERTIFICATION' and tp.status in ('COMPLETED','PASSED'))
      )
  );

  complete := coalesce(array_length(missing,1),0)=0 and coalesce(array_length(required,1),0)>0;

  return jsonb_build_object(
    'user_id',target,
    'required_modules',to_jsonb(required),
    'missing_modules',to_jsonb(missing),
    'complete',complete,
    'passing_score',80
  );
end;
$$;

revoke all on function public.buklod_bsoc_training_requirements_v1(uuid) from public, anon;
grant execute on function public.buklod_bsoc_training_requirements_v1(uuid) to authenticated;

create or replace function public.buklod_bsoc_set_operator_readiness_v1(
  p_user_id uuid,
  p_training_status text,
  p_production_access_enabled boolean,
  p_certification_version text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  st text := upper(trim(coalesce(p_training_status,'')));
  reason text := nullif(trim(coalesce(p_reason,'')),'');
  requirements jsonb;
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if st not in ('NOT_STARTED','IN_PROGRESS','CERTIFIED','SUSPENDED') then
    raise exception 'Invalid training status';
  end if;
  if reason is null then
    raise exception 'Reason is required';
  end if;

  if st='CERTIFIED' or coalesce(p_production_access_enabled,false) then
    requirements := public.buklod_bsoc_training_requirements_v1(p_user_id);
    if not coalesce((requirements->>'complete')::boolean,false) then
      raise exception 'Required BSOC training is incomplete: %',
        coalesce(requirements->'missing_modules','[]'::jsonb)::text;
    end if;
  end if;

  if coalesce(p_production_access_enabled,false) and st <> 'CERTIFIED' then
    raise exception 'Production access requires CERTIFIED status';
  end if;

  insert into public.bsoc_operator_readiness(
    user_id,training_status,certification_version,certified_at,certified_by,
    production_access_enabled,note,updated_at
  ) values(
    p_user_id,st,nullif(trim(coalesce(p_certification_version,'')),''),
    case when st='CERTIFIED' then now() else null end,
    case when st='CERTIFIED' then actor else null end,
    coalesce(p_production_access_enabled,false),reason,now()
  )
  on conflict(user_id) do update set
    training_status=excluded.training_status,
    certification_version=excluded.certification_version,
    certified_at=excluded.certified_at,
    certified_by=excluded.certified_by,
    production_access_enabled=excluded.production_access_enabled,
    note=excluded.note,
    updated_at=now();

  insert into public.bsoc_support_action_audit(
    actor_id,action_type,target_user_id,scope,reason,result,verification
  ) values(
    actor,'BSOC_OPERATOR_READINESS',p_user_id,'SYSTEM',reason,'applied',
    jsonb_build_object(
      'training_status',st,
      'production_access_enabled',coalesce(p_production_access_enabled,false),
      'certification_version',nullif(trim(coalesce(p_certification_version,'')),''),
      'requirements',requirements
    )::text
  );

  return jsonb_build_object(
    'ok',true,
    'user_id',p_user_id,
    'training_status',st,
    'production_access_enabled',coalesce(p_production_access_enabled,false),
    'requirements',requirements
  );
end;
$$;

revoke all on function public.buklod_bsoc_set_operator_readiness_v1(uuid,text,boolean,text,text) from public, anon;
grant execute on function public.buklod_bsoc_set_operator_readiness_v1(uuid,text,boolean,text,text) to authenticated;
