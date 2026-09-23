
-- BUKLOD BSOC R9: staff onboarding, training progress, app-operator scope foundation.

create table if not exists public.bsoc_app_operator_scopes (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  primary key(user_id,app_id),
  check (char_length(trim(app_id)) between 2 and 80)
);

alter table public.bsoc_app_operator_scopes enable row level security;

drop policy if exists "BSOC app scope self read" on public.bsoc_app_operator_scopes;
create policy "BSOC app scope self read"
on public.bsoc_app_operator_scopes for select to authenticated
using (user_id=(select auth.uid()) or public.buklod_is_system_admin());

create or replace function public.buklod_bsoc_role_catalog_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not public.buklod_bsoc_can('bsoc.staff.read') then
    raise exception 'BUKLOD BSOC staff-read permission required';
  end if;

  return jsonb_build_object(
    'roles',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'role_key',r.role_key,
          'display_name',r.display_name,
          'description',r.description,
          'permissions',coalesce((
            select jsonb_agg(rp.permission_key order by rp.permission_key)
            from public.buklod_role_permissions rp
            where rp.role_key=r.role_key and rp.permission_key like 'bsoc.%'
          ),'[]'::jsonb)
        )
        order by r.role_key
      )
      from public.buklod_scope_roles r
      where r.role_key like 'BSOC_%'
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.buklod_bsoc_role_catalog_v1() from public, anon;
grant execute on function public.buklod_bsoc_role_catalog_v1() to authenticated;

create or replace function public.buklod_bsoc_staff_candidate_lookup_v1(
  p_query text,
  p_limit integer default 20
)
returns table(
  user_id uuid,
  full_name text,
  username text,
  masked_mobile text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  q text := lower(trim(coalesce(p_query,'')));
  lim integer := greatest(1,least(coalesce(p_limit,20),50));
begin
  if auth.uid() is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if length(q)<2 or length(q)>80 then
    raise exception 'Search requires 2 to 80 characters';
  end if;

  return query
  select p.id,
         p.full_name,
         p.username,
         case
           when p.mobile is null or length(regexp_replace(p.mobile,'\D','','g'))<4 then null
           else left(regexp_replace(p.mobile,'\D','','g'),2)
                || repeat('•',greatest(length(regexp_replace(p.mobile,'\D','','g'))-4,2))
                || right(regexp_replace(p.mobile,'\D','','g'),2)
         end,
         coalesce(p.is_active,true)
  from public.profiles p
  where lower(coalesce(p.full_name,'')) like '%'||q||'%'
     or lower(coalesce(p.username,'')) like '%'||q||'%'
     or lower(coalesce(p.login_identifier,'')) = q
  order by
    case when lower(coalesce(p.username,''))=q then 0 else 1 end,
    coalesce(p.full_name,p.username,'')
  limit lim;
end;
$$;

revoke all on function public.buklod_bsoc_staff_candidate_lookup_v1(text,integer) from public, anon;
grant execute on function public.buklod_bsoc_staff_candidate_lookup_v1(text,integer) to authenticated;

create or replace function public.buklod_bsoc_set_app_operator_scope_v1(
  p_user_id uuid,
  p_app_id text,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  app_key text := upper(trim(coalesce(p_app_id,'')));
  reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if reason is null then raise exception 'Reason is required'; end if;
  if length(app_key)<2 or length(app_key)>80 then raise exception 'Valid app ID required'; end if;

  if not exists(
    select 1
    from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=p_user_id and ra.role_key='BSOC_APP_OPERATOR'
      and ra.status='ACTIVE' and s.scope_type='SYSTEM' and s.status='ACTIVE'
  ) then
    raise exception 'Active BSOC_APP_OPERATOR role required';
  end if;

  if coalesce(p_enabled,false) then
    insert into public.bsoc_app_operator_scopes(user_id,app_id,is_active,granted_by,granted_at,revoked_by,revoked_at)
    values(p_user_id,app_key,true,actor,now(),null,null)
    on conflict(user_id,app_id) do update set
      is_active=true,granted_by=actor,granted_at=now(),revoked_by=null,revoked_at=null;
  else
    update public.bsoc_app_operator_scopes
    set is_active=false,revoked_by=actor,revoked_at=now()
    where user_id=p_user_id and app_id=app_key;
  end if;

  insert into public.bsoc_support_action_audit(
    actor_id,action_type,target_user_id,scope,reason,result,verification
  ) values(
    actor,
    case when coalesce(p_enabled,false) then 'BSOC_APP_SCOPE_ASSIGN' else 'BSOC_APP_SCOPE_REVOKE' end,
    p_user_id,
    app_key,
    reason,
    'applied',
    jsonb_build_object('app_id',app_key,'enabled',coalesce(p_enabled,false))::text
  );

  return jsonb_build_object('ok',true,'user_id',p_user_id,'app_id',app_key,'enabled',coalesce(p_enabled,false));
end;
$$;

revoke all on function public.buklod_bsoc_set_app_operator_scope_v1(uuid,text,boolean,text) from public, anon;
grant execute on function public.buklod_bsoc_set_app_operator_scope_v1(uuid,text,boolean,text) to authenticated;

create or replace function public.buklod_bsoc_can_app_v1(
  p_app_id text,
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  app_key text := upper(trim(coalesce(p_app_id,'')));
  perm text := lower(trim(coalesce(p_permission_key,'')));
begin
  if actor is null or app_key='' then return false; end if;
  if public.buklod_is_system_admin() then return true; end if;
  if not public.buklod_bsoc_can(perm) then return false; end if;

  if exists(
    select 1
    from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    where ra.user_id=actor and ra.role_key='BSOC_APP_OPERATOR'
      and ra.status='ACTIVE' and s.scope_type='SYSTEM' and s.status='ACTIVE'
  ) then
    return exists(
      select 1 from public.bsoc_app_operator_scopes a
      where a.user_id=actor and a.app_id=app_key and a.is_active
    );
  end if;

  return true;
end;
$$;

revoke all on function public.buklod_bsoc_can_app_v1(text,text) from public, anon;
grant execute on function public.buklod_bsoc_can_app_v1(text,text) to authenticated;

create or replace function public.buklod_bsoc_training_progress_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.buklod_bsoc_can('bsoc.training.read') then
    raise exception 'BUKLOD BSOC training permission required';
  end if;

  return jsonb_build_object(
    'readiness',coalesce((
      select jsonb_build_object(
        'training_status',r.training_status,
        'certification_version',r.certification_version,
        'certified_at',r.certified_at,
        'production_access_enabled',r.production_access_enabled
      )
      from public.bsoc_operator_readiness r
      where r.user_id=actor
    ),jsonb_build_object(
      'training_status','NOT_STARTED',
      'certification_version',null,
      'certified_at',null,
      'production_access_enabled',false
    )),
    'modules',coalesce((
      select jsonb_agg(jsonb_build_object(
        'module_key',p.module_key,
        'status',p.status,
        'score',p.score,
        'attempts',p.attempts,
        'completed_at',p.completed_at,
        'updated_at',p.updated_at
      ) order by p.module_key)
      from public.bsoc_training_progress p
      where p.user_id=actor
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.buklod_bsoc_training_progress_v1() from public, anon;
grant execute on function public.buklod_bsoc_training_progress_v1() to authenticated;

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
begin
  if actor is null or not public.buklod_bsoc_can('bsoc.training.read') then
    raise exception 'BUKLOD BSOC training permission required';
  end if;
  if length(module_key)<2 or length(module_key)>80 then raise exception 'Valid module key required'; end if;
  if st not in ('NOT_STARTED','IN_PROGRESS','COMPLETED','PASSED','FAILED') then raise exception 'Invalid training status'; end if;
  if p_score is not null and (p_score<0 or p_score>100) then raise exception 'Score must be 0 to 100'; end if;

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
