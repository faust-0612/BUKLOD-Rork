-- BSOC personnel invitations: original staff RBAC remains authoritative.
-- A one-time access code activates ONLY a preapproved, identity-bound BSOC role.
-- Codes never replace BUKLOD authentication or operator certification.
create table if not exists public.bsoc_personnel_invites_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.buklod_scope_roles(role_key),
  code_hash bytea not null unique,
  issued_by uuid not null references auth.users(id),
  reason text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  constraint bsoc_invite_reason check (char_length(reason) between 8 and 500),
  constraint bsoc_invite_valid_expiry check (expires_at>created_at),
  constraint bsoc_invite_not_both check (redeemed_at is null or revoked_at is null)
);
create index if not exists bsoc_personnel_invites_user_active_v1
 on public.bsoc_personnel_invites_v1(user_id,created_at desc)
 where redeemed_at is null and revoked_at is null;
alter table public.bsoc_personnel_invites_v1 enable row level security;
revoke all on public.bsoc_personnel_invites_v1 from public,anon,authenticated;
-- Do not expose hashes or identities using direct table queries.

create table if not exists public.bsoc_invite_attempt_limits_v1 (
 user_id uuid primary key references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(),
 attempts integer not null default 0
);
alter table public.bsoc_invite_attempt_limits_v1 enable row level security;
revoke all on public.bsoc_invite_attempt_limits_v1 from public,anon,authenticated;

create or replace function public.buklod_bsoc_issue_personnel_code_v1(
 p_user_id uuid,p_role_key text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 k text := upper(btrim(coalesce(p_role_key,'')));
 why text := btrim(coalesce(p_reason,''));
 plain text;
 invite_id uuid;
 deadline timestamptz := now()+interval '24 hours';
begin
 if actor is null or not public.buklod_is_system_admin() then
   raise exception 'Only System Admin can authorize BSOC personnel' using errcode='42501';
 end if;
 if p_user_id is null or p_user_id=actor then
   raise exception 'Select another existing BUKLOD member';
 end if;
 if length(why)<8 or length(why)>500 then raise exception 'Provide 8–500 characters explaining the authorization';end if;
 if k not in ('BSOC_SUPPORT_MANAGER','BSOC_SUPPORT_AGENT','BSOC_MODERATION_MANAGER',
    'BSOC_MODERATOR','BSOC_ORG_SUPPORT','BSOC_APP_OPERATOR','BSOC_SECURITY_OPERATOR','BSOC_AUDITOR') then
   raise exception 'Unsupported BSOC personnel role';
 end if;
 if not exists(select 1 from public.profiles p where p.id=p_user_id and coalesce(p.is_active,true)) then
   raise exception 'Selected member is missing or inactive';
 end if;
 -- Avoid parallel issuance causing multiple valid invitations for the same member.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,19217));
 update public.bsoc_personnel_invites_v1
    set revoked_at=now()
  where user_id=p_user_id and redeemed_at is null and revoked_at is null;
 plain := 'BSOC-' || upper(pg_catalog.encode(extensions.gen_random_bytes(16),'hex'));
 insert into public.bsoc_personnel_invites_v1(user_id,role_key,code_hash,issued_by,reason,expires_at)
 values(p_user_id,k,extensions.digest(plain,'sha256'),actor,why,deadline)
 returning id into invite_id;
 insert into public.bsoc_support_action_audit(actor_id,action_type,target_user_id,scope,reason,result,verification)
 values(actor,'BSOC_PERSONNEL_INVITE',p_user_id,'SYSTEM',why,'issued',
        pg_catalog.jsonb_build_object('invite_id',invite_id,'role_key',k,'expires_at',deadline)::text);
 return pg_catalog.jsonb_build_object('ok',true,'invite_id',invite_id,'role_key',k,
  'access_code',plain,'expires_at',deadline,'message','Share securely with this member only. Code expires in 24h and can be used once.');
end;
$$;
revoke all on function public.buklod_bsoc_issue_personnel_code_v1(uuid,text,text) from public,anon;
grant execute on function public.buklod_bsoc_issue_personnel_code_v1(uuid,text,text) to authenticated;

create or replace function public.buklod_bsoc_redeem_personnel_code_v1(
 p_code text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 clean_code text:=upper(btrim(coalesce(p_code,'')));
 attempt_total integer;
 invitation record;
 scope_id uuid;
begin
 if actor is null then raise exception 'BUKLOD sign-in required' using errcode='42501';end if;
 if not exists(select 1 from public.profiles p where p.id=actor and coalesce(p.is_active,true)) then
   raise exception 'Active member account required' using errcode='42501';
 end if;
 -- An attempted redemption is rate-limited even if the code does not exist.
 insert into public.bsoc_invite_attempt_limits_v1(user_id,started_at,attempts)
 values(actor,now(),1)
 on conflict(user_id) do update
 set attempts=case when public.bsoc_invite_attempt_limits_v1.started_at < now()-interval '15 minutes'
       then 1 else public.bsoc_invite_attempt_limits_v1.attempts+1 end,
     started_at=case when public.bsoc_invite_attempt_limits_v1.started_at < now()-interval '15 minutes'
       then now() else public.bsoc_invite_attempt_limits_v1.started_at end
 returning attempts into attempt_total;
 if attempt_total>8 then return pg_catalog.jsonb_build_object('ok',false,'error','too_many_attempts');end if;
 if length(clean_code)<>37 or clean_code !~ '^BSOC-[A-F0-9]{32}$' then
   return pg_catalog.jsonb_build_object('ok',false,'error','invalid_or_expired_code');
 end if;
 select * into invitation from public.bsoc_personnel_invites_v1 i
 where i.code_hash=extensions.digest(clean_code,'sha256')
   and i.user_id=actor and i.redeemed_at is null and i.revoked_at is null and i.expires_at>now()
 for update;
 if not found then return pg_catalog.jsonb_build_object('ok',false,'error','invalid_or_expired_code');end if;
 select s.id into scope_id from public.buklod_scopes s
 where s.scope_type='SYSTEM' and s.status='ACTIVE'
 order by s.created_at limit 1;
 if scope_id is null then return pg_catalog.jsonb_build_object('ok',false,'error','system_scope_unavailable');end if;
 update public.bsoc_personnel_invites_v1 set redeemed_at=now()
 where id=invitation.id and redeemed_at is null and revoked_at is null;
 insert into public.buklod_scope_role_assignments(scope_id,user_id,role_key,status,assigned_by,revoked_at,updated_at)
 values(scope_id,actor,invitation.role_key,'ACTIVE',invitation.issued_by,null,now())
 on conflict(scope_id,user_id,role_key) do update
 set status='ACTIVE',assigned_by=excluded.assigned_by,revoked_at=null,updated_at=now();
 insert into public.bsoc_operator_readiness(user_id) values(actor) on conflict(user_id) do nothing;
 insert into public.bsoc_support_action_audit(actor_id,action_type,target_user_id,scope,reason,result,verification)
 values(actor,'BSOC_PERSONNEL_CODE_REDEEM',actor,'SYSTEM','Redeemed System Admin-approved access invitation',
 'applied',pg_catalog.jsonb_build_object('invite_id',invitation.id,'role_key',invitation.role_key)::text);
 return pg_catalog.jsonb_build_object('ok',true,'role_key',invitation.role_key,
  'training_required',true,'message','Role assigned. Complete BSOC operator training before privileged production actions.');
end;
$$;
revoke all on function public.buklod_bsoc_redeem_personnel_code_v1(text) from public,anon;
grant execute on function public.buklod_bsoc_redeem_personnel_code_v1(text) to authenticated;

create or replace function public.buklod_bsoc_revoke_personnel_code_v1(
 p_invite_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; why text:=btrim(coalesce(p_reason,''));
begin
 if actor is null or not public.buklod_is_system_admin() then raise exception 'System Admin required' using errcode='42501';end if;
 if length(why)<8 then raise exception 'Reason must be at least 8 characters';end if;
 update public.bsoc_personnel_invites_v1 set revoked_at=now()
 where id=p_invite_id and revoked_at is null and redeemed_at is null returning user_id into target;
 if target is null then return jsonb_build_object('ok',false,'error','invite_not_pending');end if;
 insert into public.bsoc_support_action_audit(actor_id,action_type,target_user_id,scope,reason,result,verification)
 values(actor,'BSOC_PERSONNEL_INVITE_REVOKE',target,'SYSTEM',why,'applied',
        pg_catalog.jsonb_build_object('invite_id',p_invite_id)::text);
 return pg_catalog.jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.buklod_bsoc_revoke_personnel_code_v1(uuid,text) from public,anon;
grant execute on function public.buklod_bsoc_revoke_personnel_code_v1(uuid,text) to authenticated;
