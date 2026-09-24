-- BUKLOD_SUBORGANIZATION_PARENT_GOVERNANCE_V1
-- Canonical rules:
--   * Sub-Organization = ORGANIZATION scope + parent_scope_id.
--   * Active Parent Organization membership is required for Sub-Org create/join/admin.
--   * Losing Parent membership suspends child membership and revokes child roles.
--   * Sub-Org never owns an automatic independent 5%/7% Community Fund.
--   * Sub-Org Admin proposes/operates; Parent Organization governs financial release.
--   * Fund requests retain originating Sub-Org for transparent reporting.

-- ---------------------------------------------------------------------------
-- 1. SCOPE CREATION GUARD
-- ---------------------------------------------------------------------------
create or replace function private.buklod_suborg_scope_parent_guard_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_parent public.buklod_scopes%rowtype;
begin
  if new.scope_type<>'ORGANIZATION' or new.parent_scope_id is null then
    return new;
  end if;

  select *
  into v_parent
  from public.buklod_scopes
  where id=new.parent_scope_id
    and scope_type='ORGANIZATION'
    and parent_scope_id is null
    and status in ('ACTIVE','RESTRICTED');

  if not found then
    raise exception 'A Sub-Organization requires a valid active Parent Organization';
  end if;

  if new.created_by is null then
    raise exception 'Sub-Organization creator is required';
  end if;

  if not exists(
    select 1
    from public.buklod_scope_memberships m
    where m.scope_id=new.parent_scope_id
      and m.user_id=new.created_by
      and m.membership_status='ACTIVE'
      and m.left_at is null
  ) then
    raise exception 'Active Parent Organization membership is required to create a Sub-Organization';
  end if;

  return new;
end
$function$;

drop trigger if exists trg_buklod_suborg_scope_parent_guard_v1
on public.buklod_scopes;

create trigger trg_buklod_suborg_scope_parent_guard_v1
before insert or update of scope_type,parent_scope_id,created_by
on public.buklod_scopes
for each row
execute function private.buklod_suborg_scope_parent_guard_v1();

-- ---------------------------------------------------------------------------
-- 2. CHILD MEMBERSHIP / ROLE GUARDS
-- ---------------------------------------------------------------------------
create or replace function private.buklod_suborg_membership_parent_guard_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_parent uuid;
begin
  if new.membership_status not in ('ACTIVE','PENDING','INVITED') then
    return new;
  end if;

  select s.parent_scope_id
  into v_parent
  from public.buklod_scopes s
  where s.id=new.scope_id
    and s.scope_type='ORGANIZATION'
    and s.parent_scope_id is not null
    and s.status in ('ACTIVE','RESTRICTED');

  if v_parent is null then
    return new;
  end if;

  if not exists(
    select 1
    from public.buklod_scope_memberships parent_membership
    where parent_membership.scope_id=v_parent
      and parent_membership.user_id=new.user_id
      and parent_membership.membership_status='ACTIVE'
      and parent_membership.left_at is null
  ) then
    raise exception 'Active Parent Organization membership is required before joining its Sub-Organization';
  end if;

  return new;
end
$function$;

drop trigger if exists trg_buklod_suborg_membership_parent_guard_v1
on public.buklod_scope_memberships;

create trigger trg_buklod_suborg_membership_parent_guard_v1
before insert or update of scope_id,user_id,membership_status
on public.buklod_scope_memberships
for each row
execute function private.buklod_suborg_membership_parent_guard_v1();

create or replace function private.buklod_suborg_role_parent_guard_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_parent uuid;
begin
  if new.status<>'ACTIVE' then
    return new;
  end if;

  select s.parent_scope_id
  into v_parent
  from public.buklod_scopes s
  where s.id=new.scope_id
    and s.scope_type='ORGANIZATION'
    and s.parent_scope_id is not null
    and s.status in ('ACTIVE','RESTRICTED');

  if v_parent is null then
    return new;
  end if;

  if not exists(
    select 1
    from public.buklod_scope_memberships parent_membership
    where parent_membership.scope_id=v_parent
      and parent_membership.user_id=new.user_id
      and parent_membership.membership_status='ACTIVE'
      and parent_membership.left_at is null
  ) then
    raise exception 'Active Parent Organization membership is required for a Sub-Organization role';
  end if;

  return new;
end
$function$;

drop trigger if exists trg_buklod_suborg_role_parent_guard_v1
on public.buklod_scope_role_assignments;

create trigger trg_buklod_suborg_role_parent_guard_v1
before insert or update of scope_id,user_id,status
on public.buklod_scope_role_assignments
for each row
execute function private.buklod_suborg_role_parent_guard_v1();

-- ---------------------------------------------------------------------------
-- 3. PARENT MEMBERSHIP LOSS CASCADE
-- ---------------------------------------------------------------------------
create or replace function private.buklod_parent_membership_loss_cascade_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_parent_scope uuid;
  v_user uuid;
  v_old_status text;
  v_new_status text;
  v_is_root_org boolean:=false;
  v_person uuid;
begin
  v_parent_scope:=old.scope_id;
  v_user:=old.user_id;
  v_old_status:=old.membership_status;
  v_new_status:=case when tg_op='DELETE' then null else new.membership_status end;

  if v_old_status<>'ACTIVE' then
    return coalesce(new,old);
  end if;

  if tg_op<>'DELETE' and v_new_status='ACTIVE' then
    return new;
  end if;

  select exists(
    select 1
    from public.buklod_scopes s
    where s.id=v_parent_scope
      and s.scope_type='ORGANIZATION'
      and s.parent_scope_id is null
  )
  into v_is_root_org;

  if not v_is_root_org then
    return coalesce(new,old);
  end if;

  update public.buklod_scope_memberships child_membership
  set membership_status='SUSPENDED',
      left_at=coalesce(child_membership.left_at,now()),
      updated_at=now()
  where child_membership.user_id=v_user
    and child_membership.membership_status in ('ACTIVE','PENDING','INVITED')
    and exists(
      select 1
      from public.buklod_scopes child_scope
      where child_scope.id=child_membership.scope_id
        and child_scope.scope_type='ORGANIZATION'
        and child_scope.parent_scope_id=v_parent_scope
    );

  update public.buklod_scope_role_assignments child_role
  set status='REVOKED',
      revoked_at=coalesce(child_role.revoked_at,now()),
      updated_at=now()
  where child_role.user_id=v_user
    and child_role.status='ACTIVE'
    and exists(
      select 1
      from public.buklod_scopes child_scope
      where child_scope.id=child_role.scope_id
        and child_scope.scope_type='ORGANIZATION'
        and child_scope.parent_scope_id=v_parent_scope
    );

  select private.buklod_pf_person_for_user_v2(v_user)
  into v_person;

  if v_person is not null then
    update private.buklod_pf_community_designations d
    set effective_to=now(),
        close_reason='PARENT_MEMBERSHIP_ENDED'
    where d.person_id=v_person
      and d.effective_to is null
      and (
        d.scope_id=v_parent_scope
        or exists(
          select 1
          from public.buklod_scopes child_scope
          where child_scope.id=d.scope_id
            and child_scope.parent_scope_id=v_parent_scope
        )
      );
  end if;

  return coalesce(new,old);
end
$function$;

drop trigger if exists trg_buklod_parent_membership_loss_cascade_v1
on public.buklod_scope_memberships;

create trigger trg_buklod_parent_membership_loss_cascade_v1
after update of membership_status or delete
on public.buklod_scope_memberships
for each row
execute function private.buklod_parent_membership_loss_cascade_v1();

-- ---------------------------------------------------------------------------
-- 4. COMMUNITY FUND REQUEST ORIGIN
-- ---------------------------------------------------------------------------
alter table private.buklod_pf_community_fund_requests
  add column if not exists parent_organization_id uuid
    references public.buklod_scopes(id) on delete restrict;

alter table private.buklod_pf_community_fund_requests
  add column if not exists originating_suborganization_id uuid
    references public.buklod_scopes(id) on delete restrict;

create index if not exists idx_buklod_pf_fund_request_parent_origin
  on private.buklod_pf_community_fund_requests(
    parent_organization_id,
    originating_suborganization_id,
    created_at desc
  );

create or replace function private.buklod_pf_reserve_community_request_v3(
  p_scope_id uuid,
  p_requested_by uuid,
  p_title text,
  p_purpose text,
  p_amount_centavos bigint,
  p_project_date date,
  p_benefits_requester boolean,
  p_parent_organization_id uuid,
  p_originating_suborganization_id uuid
)
returns private.buklod_pf_community_fund_requests
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_cfg private.buklod_pf_config%rowtype;
  v_available bigint;
  v_eligible integer;
  v_row private.buklod_pf_community_fund_requests%rowtype;
begin
  select *
  into v_cfg
  from private.buklod_pf_config
  where singleton=true;

  v_available:=greatest(
    private.buklod_pf_community_balance_centavos_v3(p_scope_id,'AVAILABLE'),
    0
  );

  if p_amount_centavos<=0 then
    raise exception 'Positive request amount required';
  end if;

  if p_amount_centavos>v_available then
    raise exception 'Community Fund balance is insufficient';
  end if;

  select count(*)::integer
  into v_eligible
  from private.buklod_pf_persons p
  where private.buklod_pf_is_eligible_community_voter_v3(
    p.person_id,
    p_scope_id,
    case when coalesce(p_benefits_requester,false)
      then p_requested_by
      else null
    end
  );

  insert into private.buklod_pf_community_fund_requests(
    scope_id,
    requested_by,
    title,
    purpose,
    amount_centavos,
    project_date,
    benefits_requester,
    status,
    eligible_voter_count,
    quorum_bps,
    approval_bps,
    policy_version,
    parent_organization_id,
    originating_suborganization_id
  )
  values(
    p_scope_id,
    p_requested_by,
    left(trim(p_title),180),
    left(trim(p_purpose),2000),
    p_amount_centavos,
    p_project_date,
    coalesce(p_benefits_requester,false),
    'VOTING',
    v_eligible,
    v_cfg.vote_quorum_bps,
    v_cfg.vote_approval_bps,
    v_cfg.policy_version,
    p_parent_organization_id,
    p_originating_suborganization_id
  )
  returning *
  into v_row;

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    request_id,description,metadata
  )
  values(
    p_scope_id,
    'AVAILABLE',
    'DEBIT',
    p_amount_centavos,
    'REQUEST_RESERVE',
    'fund-request-available:'||v_row.id::text,
    v_row.id,
    'Reserve Community Fund for member-governed request',
    jsonb_build_object(
      'title',v_row.title,
      'parent_organization_id',p_parent_organization_id,
      'originating_suborganization_id',p_originating_suborganization_id
    )
  );

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    request_id,description,metadata
  )
  values(
    p_scope_id,
    'RESERVED',
    'CREDIT',
    p_amount_centavos,
    'REQUEST_RESERVE',
    'fund-request-reserved:'||v_row.id::text,
    v_row.id,
    'Reserved Community Fund for member-governed request',
    jsonb_build_object(
      'title',v_row.title,
      'parent_organization_id',p_parent_organization_id,
      'originating_suborganization_id',p_originating_suborganization_id
    )
  );

  return v_row;
end
$function$;

-- Direct root Organization / Cluster request keeps existing public signature.
create or replace function public.create_buklod_community_fund_request_v3(
  p_scope_id uuid,
  p_title text,
  p_purpose text,
  p_amount_php numeric,
  p_project_date date,
  p_benefits_requester boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_scope public.buklod_scopes%rowtype;
  v_amount bigint;
  v_row private.buklod_pf_community_fund_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_scope
  from public.buklod_scopes
  where id=p_scope_id
    and status='ACTIVE';

  if not found
     or v_scope.scope_type not in ('CLUSTER','ORGANIZATION')
     or (
       v_scope.scope_type='ORGANIZATION'
       and v_scope.parent_scope_id is not null
     ) then
    raise exception 'Active root Organization or Cluster required';
  end if;

  if not public.buklod_actor_can_manage_scope_v1(p_scope_id) then
    raise exception 'Scope admin permission required';
  end if;

  if trim(coalesce(p_title,''))=''
     or trim(coalesce(p_purpose,''))='' then
    raise exception 'Project title and purpose are required';
  end if;

  v_amount:=round(coalesce(p_amount_php,0)*100)::bigint;

  v_row:=private.buklod_pf_reserve_community_request_v3(
    p_scope_id,
    v_uid,
    p_title,
    p_purpose,
    v_amount,
    p_project_date,
    p_benefits_requester,
    case when v_scope.scope_type='ORGANIZATION'
      then v_scope.id
      else null
    end,
    null
  );

  return to_jsonb(v_row);
end
$function$;

create or replace function public.create_buklod_suborganization_fund_request_v3(
  p_originating_suborganization_id uuid,
  p_title text,
  p_purpose text,
  p_amount_php numeric,
  p_project_date date,
  p_benefits_requester boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_child public.buklod_scopes%rowtype;
  v_parent public.buklod_scopes%rowtype;
  v_amount bigint;
  v_row private.buklod_pf_community_fund_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_child
  from public.buklod_scopes
  where id=p_originating_suborganization_id
    and scope_type='ORGANIZATION'
    and parent_scope_id is not null
    and status='ACTIVE';

  if not found then
    raise exception 'Active Sub-Organization required';
  end if;

  select *
  into v_parent
  from public.buklod_scopes
  where id=v_child.parent_scope_id
    and scope_type='ORGANIZATION'
    and parent_scope_id is null
    and status='ACTIVE';

  if not found then
    raise exception 'Parent Organization is not active';
  end if;

  if not exists(
    select 1
    from public.buklod_scope_memberships m
    where m.scope_id=v_parent.id
      and m.user_id=v_uid
      and m.membership_status='ACTIVE'
      and m.left_at is null
  ) then
    raise exception 'Active Parent Organization membership is required';
  end if;

  if not exists(
    select 1
    from public.buklod_scope_memberships m
    where m.scope_id=v_child.id
      and m.user_id=v_uid
      and m.membership_status='ACTIVE'
      and m.left_at is null
  ) then
    raise exception 'Active Sub-Organization membership is required';
  end if;

  if not public.buklod_actor_can_manage_scope_v1(v_child.id) then
    raise exception 'Sub-Organization Admin permission required';
  end if;

  if trim(coalesce(p_title,''))=''
     or trim(coalesce(p_purpose,''))='' then
    raise exception 'Project title and purpose are required';
  end if;

  v_amount:=round(coalesce(p_amount_php,0)*100)::bigint;

  v_row:=private.buklod_pf_reserve_community_request_v3(
    v_parent.id,
    v_uid,
    p_title,
    p_purpose,
    v_amount,
    p_project_date,
    p_benefits_requester,
    v_parent.id,
    v_child.id
  );

  return to_jsonb(v_row);
end
$function$;

-- ---------------------------------------------------------------------------
-- 5. SUB-ORG FUND VISIBILITY WITHOUT A SECOND WALLET
-- ---------------------------------------------------------------------------
create or replace function public.get_buklod_suborganization_community_fund_v3(
  p_suborganization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_child public.buklod_scopes%rowtype;
  v_parent public.buklod_scopes%rowtype;
  v_requests jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_child
  from public.buklod_scopes
  where id=p_suborganization_id
    and scope_type='ORGANIZATION'
    and parent_scope_id is not null
    and status not in ('DELETED','ARCHIVED');

  if not found then
    raise exception 'Sub-Organization not found';
  end if;

  select *
  into v_parent
  from public.buklod_scopes
  where id=v_child.parent_scope_id;

  if not exists(
    select 1
    from public.buklod_scope_memberships m
    where m.scope_id=v_child.id
      and m.user_id=v_uid
      and m.membership_status='ACTIVE'
      and m.left_at is null
  )
  and not public.buklod_actor_can_manage_scope_v1(v_parent.id) then
    raise exception 'Sub-Organization membership or Parent Admin access required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'title',r.title,
    'purpose',r.purpose,
    'amount_php',round(r.amount_centavos::numeric/100,2),
    'project_date',r.project_date,
    'status',r.status,
    'eligible_voter_count',r.eligible_voter_count,
    'yes_votes',(
      select count(*)
      from private.buklod_pf_community_fund_votes v
      where v.request_id=r.id
        and v.vote='YES'
    ),
    'no_votes',(
      select count(*)
      from private.buklod_pf_community_fund_votes v
      where v.request_id=r.id
        and v.vote='NO'
    ),
    'released_at',r.released_at,
    'proof_url',r.proof_url,
    'liquidation_status',r.liquidation_status
  ) order by r.created_at desc),'[]'::jsonb)
  into v_requests
  from private.buklod_pf_community_fund_requests r
  where r.originating_suborganization_id=v_child.id
    and r.parent_organization_id=v_parent.id;

  return jsonb_build_object(
    'suborganization_id',v_child.id,
    'suborganization_name',v_child.name,
    'parent_organization_id',v_parent.id,
    'parent_organization_name',v_parent.name,
    'fund_owner','PARENT_ORGANIZATION',
    'available_parent_fund_php',round(
      greatest(
        private.buklod_pf_community_balance_centavos_v3(v_parent.id,'AVAILABLE'),
        0
      )::numeric/100,
      2
    ),
    'reserved_parent_fund_php',round(
      greatest(
        private.buklod_pf_community_balance_centavos_v3(v_parent.id,'RESERVED'),
        0
      )::numeric/100,
      2
    ),
    'spent_parent_fund_php',round(
      greatest(
        private.buklod_pf_community_balance_centavos_v3(v_parent.id,'SPENT'),
        0
      )::numeric/100,
      2
    ),
    'requests',v_requests
  );
end
$function$;

-- Sub-Org Admin may upload proof for its own originated released request.
create or replace function public.submit_buklod_community_fund_proof_v3(
  p_request_id uuid,
  p_proof_url text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_request private.buklod_pf_community_fund_requests%rowtype;
  v_url text:=nullif(left(trim(coalesce(p_proof_url,'')),1000),'');
  v_allowed boolean:=false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_url is null then
    raise exception 'Proof URL is required';
  end if;

  select *
  into v_request
  from private.buklod_pf_community_fund_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'Fund request not found';
  end if;

  v_allowed:=public.buklod_actor_can_manage_scope_v1(v_request.scope_id);

  if not v_allowed
     and v_request.originating_suborganization_id is not null then
    v_allowed:=
      public.buklod_actor_can_manage_scope_v1(
        v_request.originating_suborganization_id
      )
      and exists(
        select 1
        from public.buklod_scope_memberships parent_membership
        where parent_membership.scope_id=v_request.parent_organization_id
          and parent_membership.user_id=v_uid
          and parent_membership.membership_status='ACTIVE'
          and parent_membership.left_at is null
      );
  end if;

  if not v_allowed then
    raise exception 'Parent or originating Sub-Organization Admin permission required';
  end if;

  if v_request.status<>'RELEASED' then
    raise exception 'Proof may be submitted only after release';
  end if;

  update private.buklod_pf_community_fund_requests
  set proof_url=v_url,
      liquidation_status='SUBMITTED',
      updated_at=now()
  where id=v_request.id
  returning *
  into v_request;

  return to_jsonb(v_request);
end
$function$;

-- ---------------------------------------------------------------------------
-- 6. PRIVILEGES
-- ---------------------------------------------------------------------------
revoke execute on function private.buklod_suborg_scope_parent_guard_v1()
  from public,anon,authenticated;
revoke execute on function private.buklod_suborg_membership_parent_guard_v1()
  from public,anon,authenticated;
revoke execute on function private.buklod_suborg_role_parent_guard_v1()
  from public,anon,authenticated;
revoke execute on function private.buklod_parent_membership_loss_cascade_v1()
  from public,anon,authenticated;
revoke execute on function private.buklod_pf_reserve_community_request_v3(
  uuid,uuid,text,text,bigint,date,boolean,uuid,uuid
) from public,anon,authenticated;

revoke execute on function public.create_buklod_suborganization_fund_request_v3(
  uuid,text,text,numeric,date,boolean
) from public,anon,authenticated;
grant execute on function public.create_buklod_suborganization_fund_request_v3(
  uuid,text,text,numeric,date,boolean
) to authenticated;

revoke execute on function public.get_buklod_suborganization_community_fund_v3(uuid)
  from public,anon,authenticated;
grant execute on function public.get_buklod_suborganization_community_fund_v3(uuid)
  to authenticated;

revoke execute on function public.create_buklod_community_fund_request_v3(
  uuid,text,text,numeric,date,boolean
) from public,anon,authenticated;
grant execute on function public.create_buklod_community_fund_request_v3(
  uuid,text,text,numeric,date,boolean
) to authenticated;

revoke execute on function public.submit_buklod_community_fund_proof_v3(uuid,text)
  from public,anon,authenticated;
grant execute on function public.submit_buklod_community_fund_proof_v3(uuid,text)
  to authenticated;
