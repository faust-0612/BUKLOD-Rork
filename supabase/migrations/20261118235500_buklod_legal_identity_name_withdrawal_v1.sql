-- BUKLOD MAIN: government-ID legal name verification and cash withdrawal protection.
-- Membership is_verified is not ID verification. No Season 2 or money-switch activation.
-- Apply to Main staging first after reconciling all live payout signatures.
create table if not exists private.buklod_legal_identity_v1(
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check(status in ('PENDING','VERIFIED','REJECTED')),
 first_name text not null,middle_name text,surname text not null,suffix text,
 legal_full_name text not null,
 id_type text not null check(id_type in ('PHILSYS','PASSPORT','DRIVERS_LICENSE','UMID','POSTAL_ID','OTHER_GOV_ID')),
 document_path text not null,
 consented_at timestamptz not null default now(),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
 verified_at timestamptz,rejected_reason text,
 revision integer not null default 1
);
alter table private.buklod_legal_identity_v1 enable row level security;
revoke all on private.buklod_legal_identity_v1 from public,anon,authenticated;
create index if not exists buklod_legal_identity_pending_idx
 on private.buklod_legal_identity_v1(status,submitted_at);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buklod-identity-private','buklod-identity-private',false,7340032,array['image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=7340032,
 allowed_mime_types=array['image/jpeg','image/png'];

-- Identity approval is reserved for the protected OFFICIAL_SYSTEM_ADMIN.
create or replace function public.buklod_identity_is_reviewer_v1()
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.buklod_foundation_protected_principals pp
  where pp.principal_key='OFFICIAL_SYSTEM_ADMIN' and pp.protected=true
   and pp.user_id=(select auth.uid())
 );
$$;
revoke all on function public.buklod_identity_is_reviewer_v1() from public,anon;
grant execute on function public.buklod_identity_is_reviewer_v1() to authenticated;

drop policy if exists buklod_identity_owner_insert_v1 on storage.objects;
create policy buklod_identity_owner_insert_v1 on storage.objects
for insert to authenticated with check(
 bucket_id='buklod-identity-private'
 and split_part(name,'/',1)=(select auth.uid())::text
 and name ~ ('^'||(select auth.uid())::text||'/[0-9a-fA-F-]{36}\.(jpg|png)$')
);
drop policy if exists buklod_identity_private_read_v1 on storage.objects;
create policy buklod_identity_private_read_v1 on storage.objects
for select to authenticated using(
 bucket_id='buklod-identity-private' and
 (split_part(name,'/',1)=(select auth.uid())::text
  or public.buklod_identity_is_reviewer_v1())
);
-- No UPDATE or DELETE grant/policy for client-owned ID photos.

create or replace function private.buklod_legal_full_name_v1(
 p_first text,p_middle text,p_surname text,p_suffix text)
returns text language sql stable set search_path=''
as $$
 select pg_catalog.concat_ws(' ',nullif(btrim(p_first),''),nullif(btrim(p_middle),''),
  nullif(btrim(p_surname),''),nullif(btrim(p_suffix),''))
$$;
revoke all on function private.buklod_legal_full_name_v1(text,text,text,text)
from public,anon,authenticated;

create or replace function public.get_my_buklod_identity_status_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid());v_row private.buklod_legal_identity_v1%rowtype;
begin
 if v_uid is null then raise exception 'Login required' using errcode='28000'; end if;
 select * into v_row from private.buklod_legal_identity_v1 where user_id=v_uid;
 return jsonb_build_object(
  'status',coalesce(v_row.status,'UNVERIFIED'),'submitted_at',v_row.submitted_at,
  'verified_at',v_row.verified_at,'rejected_reason',v_row.rejected_reason,
  'legal_full_name',case when v_row.status='VERIFIED' then v_row.legal_full_name else null end
 );
end;$$;
revoke all on function public.get_my_buklod_identity_status_v1() from public,anon;
grant execute on function public.get_my_buklod_identity_status_v1() to authenticated;

create or replace function public.submit_my_buklod_identity_v1(
 p_first_name text,p_middle_name text,p_surname text,p_suffix text,
 p_id_type text,p_document_path text,p_privacy_consent boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid());
 v_first text:=btrim(coalesce(p_first_name,'')),v_middle text:=nullif(btrim(coalesce(p_middle_name,'')),'');
 v_last text:=btrim(coalesce(p_surname,'')),v_suffix text:=nullif(btrim(coalesce(p_suffix,'')),'');
 v_name text;v_row private.buklod_legal_identity_v1%rowtype;
begin
 if v_uid is null then raise exception 'Login required' using errcode='28000'; end if;
 if coalesce(p_privacy_consent,false) is not true then
  raise exception 'Government ID processing consent is required' using errcode='42501'; end if;
 if private.buklod_is_platform_official_v1(v_uid) then raise exception 'Official identity cannot submit a personal ID'; end if;
 if not exists(select 1 from public.profiles where id=v_uid and is_active=true)
  then raise exception 'Active profile required'; end if;
 if length(v_first) not between 2 and 80 or length(v_last) not between 2 and 80
  or length(coalesce(v_middle,''))>80 or length(coalesce(v_suffix,''))>32
  or v_first !~ '^[[:alpha:] .''-]+$'
  or v_last !~ '^[[:alpha:] .''-]+$'
  or coalesce(v_middle,'') !~ '^[[:alpha:] .''-]*$'
  or coalesce(v_suffix,'') !~ '^[[:alpha:] .''-]*$'
  then raise exception 'Full legal name as printed on government ID is required'; end if;
 if p_id_type not in ('PHILSYS','PASSPORT','DRIVERS_LICENSE','UMID','POSTAL_ID','OTHER_GOV_ID')
  then raise exception 'Valid government ID type required'; end if;
 if p_document_path is null or
   p_document_path !~ ('^'||v_uid::text||'/[0-9a-fA-F-]{36}\.(jpg|png)$')
  then raise exception 'Invalid private ID document path'; end if;
 if not exists(select 1 from storage.objects o
  where o.bucket_id='buklod-identity-private'
   and o.name=p_document_path and o.created_at>now()-interval '24 hours')
  then raise exception 'Recent private ID photo not found'; end if;
 v_name:=private.buklod_legal_full_name_v1(v_first,v_middle,v_last,v_suffix);
 perform 1 from public.profiles where id=v_uid for update;
 -- A verified member can replace an ID, but repeated pending uploads are bounded.
 if exists(select 1 from private.buklod_legal_identity_v1 i
  where i.user_id=v_uid and i.status='PENDING'
   and i.submitted_at>now()-interval '10 minutes') then
   raise exception 'A verification is already pending; wait before resubmitting'
   using errcode='42501';
 end if;
 insert into private.buklod_legal_identity_v1
 (user_id,status,first_name,middle_name,surname,suffix,legal_full_name,
  id_type,document_path,consented_at,submitted_at,reviewed_at,reviewed_by,verified_at,rejected_reason,revision)
 values(v_uid,'PENDING',v_first,v_middle,v_last,v_suffix,v_name,
  p_id_type,p_document_path,now(),now(),null,null,null,null,1)
 on conflict(user_id) do update
 set status='PENDING',first_name=excluded.first_name,middle_name=excluded.middle_name,
  surname=excluded.surname,suffix=excluded.suffix,legal_full_name=excluded.legal_full_name,
  id_type=excluded.id_type,document_path=excluded.document_path,
  consented_at=now(),submitted_at=now(),reviewed_at=null,reviewed_by=null,verified_at=null,
  rejected_reason=null,revision=private.buklod_legal_identity_v1.revision+1
 returning * into v_row;
 return jsonb_build_object('status',v_row.status,'submitted_at',v_row.submitted_at);
end;$$;
revoke all on function public.submit_my_buklod_identity_v1(text,text,text,text,text,text,boolean)
from public,anon;
grant execute on function public.submit_my_buklod_identity_v1(text,text,text,text,text,text,boolean)
to authenticated;

create or replace function public.admin_list_buklod_identity_pending_v1(p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.buklod_identity_is_reviewer_v1()
  then raise exception 'Admin permission required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x) from(
  select user_id,legal_full_name,id_type,document_path,submitted_at,revision
  from private.buklod_legal_identity_v1 where status='PENDING'
  order by submitted_at,id_type limit least(greatest(p_limit,1),50)
 )x),'[]'::jsonb);
end;$$;
revoke all on function public.admin_list_buklod_identity_pending_v1(integer)
from public,anon;
grant execute on function public.admin_list_buklod_identity_pending_v1(integer)
to authenticated;

create or replace function public.admin_review_buklod_identity_v1(
 p_user_id uuid,p_revision integer,p_approve boolean,
 p_observed_id_name text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_row private.buklod_legal_identity_v1%rowtype;v_observed text;
begin
 if not public.buklod_identity_is_reviewer_v1()
  then raise exception 'Admin permission required' using errcode='42501'; end if;
 if p_user_id=(select auth.uid()) then raise exception 'Self review forbidden'; end if;
 perform 1 from public.profiles where id=p_user_id for update;
 select * into v_row from private.buklod_legal_identity_v1
  where user_id=p_user_id and revision=p_revision and status='PENDING' for update;
 if not found then raise exception 'ID was already reviewed or replaced'; end if;
 if p_approve then
  v_observed:=lower(regexp_replace(btrim(coalesce(p_observed_id_name,'')),'[[:space:]]+',' ','g'));
  if v_observed='' or
    v_observed<>lower(regexp_replace(v_row.legal_full_name,'[[:space:]]+',' ','g'))
   then raise exception 'Name printed on ID must exactly match requested legal name'; end if;
  update private.buklod_legal_identity_v1
  set status='VERIFIED',verified_at=now(),reviewed_at=now(),
   reviewed_by=(select auth.uid()),rejected_reason=null where user_id=p_user_id;
  update public.profiles set first_name=v_row.first_name,middle_name=v_row.middle_name,
   surname=v_row.surname,suffix=v_row.suffix,full_name=v_row.legal_full_name where id=p_user_id;
 else
  if length(btrim(coalesce(p_reason,'')))<8
   then raise exception 'Provide member-facing rejection reason'; end if;
  update private.buklod_legal_identity_v1
  set status='REJECTED',verified_at=null,reviewed_at=now(),
   reviewed_by=(select auth.uid()),rejected_reason=left(btrim(p_reason),300)
  where user_id=p_user_id;
 end if;
 return jsonb_build_object('user_id',p_user_id,
  'status',case when p_approve then 'VERIFIED' else 'REJECTED' end);
end;$$;
revoke all on function public.admin_review_buklod_identity_v1(uuid,integer,boolean,text,text)
from public,anon;
grant execute on function public.admin_review_buklod_identity_v1(uuid,integer,boolean,text,text)
to authenticated;

-- DB trigger blocks every direct profile name edit, not just the newest screen.
create or replace function private.buklod_legal_name_profile_guard_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if private.buklod_is_platform_official_v1(new.id) then return new; end if;
 if (new.first_name,new.middle_name,new.surname,new.suffix,new.full_name)
  is not distinct from (old.first_name,old.middle_name,old.surname,old.suffix,old.full_name)
  then return new; end if;
 if not exists(select 1 from private.buklod_legal_identity_v1 i
  where i.user_id=new.id and i.status='VERIFIED'
   and i.first_name is not distinct from new.first_name
   and i.middle_name is not distinct from new.middle_name
   and i.surname is not distinct from new.surname
   and i.suffix is not distinct from new.suffix
   and i.legal_full_name is not distinct from new.full_name)
  then raise exception 'Changing your real name requires government ID verification'
   using errcode='42501'; end if;
 return new;
end;$$;
revoke all on function private.buklod_legal_name_profile_guard_v1()
from public,anon,authenticated;
drop trigger if exists aa_buklod_legal_name_profile_guard_v1 on public.profiles;
create trigger aa_buklod_legal_name_profile_guard_v1
before update of first_name,middle_name,surname,suffix,full_name
on public.profiles for each row execute function private.buklod_legal_name_profile_guard_v1();

-- New verified identity must exactly equal current legal profile, active membership
-- and never platform official. Re-check on each request and payout.
create or replace function private.buklod_require_legal_identity_for_withdrawal_v1(p_uid uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_uid is null or private.buklod_is_platform_official_v1(p_uid) or not exists(
  select 1 from public.profiles p join private.buklod_legal_identity_v1 i on i.user_id=p.id
  where p.id=p_uid and p.is_active=true and p.is_verified=true
   and i.status='VERIFIED' and i.verified_at is not null
   and i.first_name is not distinct from p.first_name
   and i.middle_name is not distinct from p.middle_name
   and i.surname is not distinct from p.surname
   and i.suffix is not distinct from p.suffix
   and i.legal_full_name is not distinct from p.full_name)
  then raise exception 'Approved membership and government ID verification are required to withdraw'
    using errcode='42501'; end if;
end;$$;
revoke all on function private.buklod_require_legal_identity_for_withdrawal_v1(uuid)
from public,anon,authenticated;

-- We wrap existing canonical money logic: never recreate or bypass balances,
-- minimums, idempotency, payout snapshotting, or finance activation switches.
do $preflight$
begin
 if to_regprocedure('public.request_my_buklod_pf_withdrawal_v2(text,text,text,text)') is null
  or to_regprocedure('public.get_my_buklod_pf_payout_profile_v2()') is null
  or to_regprocedure('public.admin_get_buklod_pf_withdrawal_payout_details_v2(uuid)') is null
  or to_regprocedure('public.admin_mark_buklod_pf_withdrawal_paid_v2(uuid,text)') is null
  or to_regprocedure('public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text)') is null
  or to_regprocedure('public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(uuid,text)') is null
 then raise exception 'Payout API signatures differ: reconcile Main before migration'; end if;
 if to_regprocedure('public.request_my_buklod_pf_withdrawal_v2_unverified_legacy(text,text,text,text)') is not null
 then raise exception 'Payout API already wrapped: manual reconciliation required'; end if;
end $preflight$;

alter function public.request_my_buklod_pf_withdrawal_v2(text,text,text,text)
rename to request_my_buklod_pf_withdrawal_v2_unverified_legacy;
revoke all on function public.request_my_buklod_pf_withdrawal_v2_unverified_legacy(text,text,text,text)
from public,anon,authenticated;
create function public.request_my_buklod_pf_withdrawal_v2(
 p_payout_method text,p_payout_profile_ref text,p_destination_masked text,p_request_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid());v_account jsonb;v_name text;
begin
 perform 1 from public.profiles where id=v_uid for update;
 perform private.buklod_require_legal_identity_for_withdrawal_v1(v_uid);
 v_account:=pg_catalog.to_jsonb(public.get_my_buklod_pf_payout_profile_v2());
 select legal_full_name into v_name from private.buklod_legal_identity_v1 where user_id=v_uid;
 if v_account is null or
  lower(regexp_replace(btrim(coalesce(v_account->>'account_name','')),'[[:space:]]+',' ','g'))
   <> lower(regexp_replace(btrim(v_name),'[[:space:]]+',' ','g'))
  then raise exception 'Payout account name must match approved government ID'
    using errcode='42501'; end if;
 return public.request_my_buklod_pf_withdrawal_v2_unverified_legacy(
  p_payout_method,p_payout_profile_ref,p_destination_masked,p_request_key);
end;$$;
revoke all on function public.request_my_buklod_pf_withdrawal_v2(text,text,text,text) from public,anon;
grant execute on function public.request_my_buklod_pf_withdrawal_v2(text,text,text,text) to authenticated;

alter function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text)
rename to request_my_buklod_r38_referral_withdrawal_v1_unverified_legacy;
revoke all on function public.request_my_buklod_r38_referral_withdrawal_v1_unverified_legacy(text,text,text,text)
from public,anon,authenticated;
create function public.request_my_buklod_r38_referral_withdrawal_v1(
 p_payout_method text,p_payout_profile_ref text,p_destination_masked text,p_request_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_approved_name text; v_payout_name text;
begin
 perform 1 from public.profiles where id=v_uid for update;
 perform private.buklod_require_legal_identity_for_withdrawal_v1(v_uid);
 select legal_full_name into v_approved_name from private.buklod_legal_identity_v1 where user_id=v_uid;
 select account_name into v_payout_name from private.buklod_r38_payout_profiles
   where user_id=v_uid and status='ACTIVE' for update;
 if v_payout_name is null or
  lower(regexp_replace(btrim(v_payout_name),'[[:space:]]+',' ','g')) <>
  lower(regexp_replace(btrim(v_approved_name),'[[:space:]]+',' ','g')) then
   raise exception 'GCash name must match verified legal name' using errcode='42501';
 end if;
 return public.request_my_buklod_r38_referral_withdrawal_v1_unverified_legacy(
  p_payout_method,p_payout_profile_ref,p_destination_masked,p_request_key);
end;$$;
revoke all on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) from public,anon;
grant execute on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) to authenticated;

alter function public.admin_get_buklod_pf_withdrawal_payout_details_v2(uuid)
rename to admin_get_buklod_pf_withdrawal_payout_details_v2_unverified_legacy;
alter function public.admin_mark_buklod_pf_withdrawal_paid_v2(uuid,text)
rename to admin_mark_buklod_pf_withdrawal_paid_v2_unverified_legacy;
revoke all on function public.admin_get_buklod_pf_withdrawal_payout_details_v2_unverified_legacy(uuid)
from public,anon,authenticated;
revoke all on function public.admin_mark_buklod_pf_withdrawal_paid_v2_unverified_legacy(uuid,text)
from public,anon,authenticated;

create function public.admin_get_buklod_pf_withdrawal_payout_details_v2(p_withdrawal_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_result jsonb;v_uid uuid;v_name text;
begin
 if not public.buklod_identity_is_reviewer_v1()
  then raise exception 'Admin required' using errcode='42501'; end if;
 v_result:=public.admin_get_buklod_pf_withdrawal_payout_details_v2_unverified_legacy(p_withdrawal_id);
 v_uid:=(v_result->>'user_id')::uuid;
 -- Serializes payout with name-change submission/revocation.
 perform 1 from public.profiles where id=v_uid for update;
 perform private.buklod_require_legal_identity_for_withdrawal_v1(v_uid);
 select legal_full_name into v_name from private.buklod_legal_identity_v1 where user_id=v_uid;
 -- Check original frozen payout snapshot as well as current verified identity.
 if v_result->>'account_name' is null or
    lower(regexp_replace(btrim(v_result->>'account_name'),'[[:space:]]+',' ','g')) <>
    lower(regexp_replace(btrim(v_name),'[[:space:]]+',' ','g')) then
   raise exception 'Frozen payout beneficiary does not match verified ID'
     using errcode='42501';
 end if;
 return v_result;
end;$$;
revoke all on function public.admin_get_buklod_pf_withdrawal_payout_details_v2(uuid) from public,anon;
grant execute on function public.admin_get_buklod_pf_withdrawal_payout_details_v2(uuid) to authenticated;

create function public.admin_mark_buklod_pf_withdrawal_paid_v2(
 p_withdrawal_id uuid,p_transaction_ref text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_check jsonb;
begin
 v_check:=public.admin_get_buklod_pf_withdrawal_payout_details_v2(p_withdrawal_id);
 return public.admin_mark_buklod_pf_withdrawal_paid_v2_unverified_legacy(p_withdrawal_id,p_transaction_ref);
end;$$;
revoke all on function public.admin_mark_buklod_pf_withdrawal_paid_v2(uuid,text) from public,anon;
grant execute on function public.admin_mark_buklod_pf_withdrawal_paid_v2(uuid,text) to authenticated;

alter function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(uuid,text)
rename to admin_mark_buklod_r38_referral_withdrawal_paid_v1_unverified_legacy;
revoke all on function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1_unverified_legacy(uuid,text)
from public,anon,authenticated;
create function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(
 p_withdrawal_id uuid,p_transaction_ref text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid;v_snapshot text;v_name text;
begin
 if not public.buklod_identity_is_reviewer_v1()
  then raise exception 'Admin required' using errcode='42501'; end if;
 select user_id,payout_account_name_snapshot into v_uid,v_snapshot
 from private.buklod_r38_referral_withdrawals
 where id=p_withdrawal_id for update;
 perform 1 from public.profiles where id=v_uid for update;
 perform private.buklod_require_legal_identity_for_withdrawal_v1(v_uid);
 select legal_full_name into v_name from private.buklod_legal_identity_v1 where user_id=v_uid;
 if v_snapshot is null or lower(regexp_replace(btrim(v_snapshot),'[[:space:]]+',' ','g')) <>
    lower(regexp_replace(btrim(v_name),'[[:space:]]+',' ','g')) then
   raise exception 'Frozen payout account name does not match government ID'
     using errcode='42501';
 end if;
 return public.admin_mark_buklod_r38_referral_withdrawal_paid_v1_unverified_legacy(
  p_withdrawal_id,p_transaction_ref);
end;$$;
revoke all on function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(uuid,text) from public,anon;
grant execute on function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(uuid,text) to authenticated;
notify pgrst,'reload schema';
