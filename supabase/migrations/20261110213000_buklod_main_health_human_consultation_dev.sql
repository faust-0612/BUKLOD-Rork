-- DEV ONLY. Main Home Health Center human consultation (PH); no production application.
-- Sensitive records are in private schema, no exposed table grants.
-- Identifiers/PRC proofs are verified offline by authorized reviewers; do not store ID images here.
create table if not exists private.buklod_health_identities_v1(
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text not null check(length(legal_name) between 5 and 150),
  status text not null default 'PENDING' check(status in ('PENDING','VERIFIED','REJECTED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
  evidence_method text,review_reference text
);
create table if not exists private.buklod_health_professionals_v1(
  user_id uuid primary key references auth.users(id) on delete cascade,
  profession text not null check(profession in ('PHYSICIAN','NURSE','PHARMACIST','MIDWIFE','OTHER')),
  prc_license_number text not null check(length(prc_license_number) between 5 and 24),
  license_expires_on date not null,
  status text not null default 'PENDING' check(status in ('PENDING','VERIFIED','REJECTED','SUSPENDED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
  verification_reference text
);
create table if not exists private.buklod_health_consultations_v1(
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id),
  professional_id uuid references auth.users(id),
  service text not null check(service in ('HEALTH_ADVICE','PHYSICIAN_CONSULT')),
  concern text not null check(length(concern) between 20 and 1500),
  symptom_duration text check(length(symptom_duration)<=120),
  location_city text check(length(location_city)<=120),
  urgent_screen_clear boolean not null check(urgent_screen_clear),
  consent_version text not null check(consent_version='PH_TELEHEALTH_V1'),
  consent_at timestamptz not null default now(),
  status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','REFERRED','CLOSED')),
  referral_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists buklod_health_consults_client_v1 on private.buklod_health_consultations_v1(client_id,created_at desc);
create index if not exists buklod_health_consults_professional_v1 on private.buklod_health_consultations_v1(professional_id,created_at desc);
create index if not exists buklod_health_consults_queue_v1 on private.buklod_health_consultations_v1(service,created_at asc) where status='OPEN' and professional_id is null;
create table if not exists private.buklod_health_consult_notes_v1(
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references private.buklod_health_consultations_v1(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  kind text not null check(kind in ('CLIENT_QUESTION','PROFESSIONAL_ADVICE','CARE_PLAN','FOLLOW_UP','REFERRAL')),
  message text not null check(length(message) between 2 and 2400),
  created_at timestamptz not null default now()
);
create index if not exists buklod_health_consult_notes_case_v1 on private.buklod_health_consult_notes_v1(consultation_id,created_at asc);
create table if not exists private.buklod_health_review_audit_v1(
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id),
  review_kind text not null check(review_kind in ('IDENTITY','PROFESSIONAL')),
  outcome text not null check(outcome in ('VERIFIED','REJECTED')),
  review_reference text not null,
  created_at timestamptz not null default now()
);
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'buklod_health_identities_v1','buklod_health_professionals_v1',
    'buklod_health_consultations_v1','buklod_health_consult_notes_v1',
    'buklod_health_review_audit_v1'
  ] loop
    execute format('alter table private.%I enable row level security',v_table);
    execute format('revoke all on private.%I from public,anon,authenticated',v_table);
  end loop;
end $$;

create or replace function public.buklod_health_card_register_identity_v1(p_legal_name text)
returns jsonb language plpgsql security definer set search_path=''
as $f$
declare v_actor uuid := auth.uid(); v_name text:=btrim(coalesce(p_legal_name,''));
begin
  if v_actor is null then raise exception 'Sign in required'; end if;
  if length(v_name) not between 5 and 150 or v_name !~ '^[[:alpha:] .,''-]+$'
    then raise exception 'Enter your complete legal name'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and is_active=true)
    then raise exception 'Active BUKLOD account required'; end if;
  if exists(select 1 from private.buklod_health_identities_v1 where user_id=v_actor and status='VERIFIED')
    then raise exception 'Identity already verified; contact support to correct it'; end if;
  insert into private.buklod_health_identities_v1(user_id,legal_name,status)
  values(v_actor,v_name,'PENDING')
  on conflict(user_id) do update set legal_name=excluded.legal_name,status='PENDING',
    submitted_at=now(),reviewed_at=null,reviewed_by=null,evidence_method=null,review_reference=null;
  return jsonb_build_object('status','PENDING','identity_method','INDEPENDENT_IDENTITY_REVIEW');
end;$f$;

create or replace function public.buklod_health_card_register_professional_v1(
  p_profession text,p_prc_license_number text,p_license_expires_on date
) returns jsonb language plpgsql security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_profession text:=upper(btrim(coalesce(p_profession,'')));
  v_license text:=upper(regexp_replace(btrim(coalesce(p_prc_license_number,'')),'[[:space:]-]+','','g'));
begin
  if v_actor is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from private.buklod_health_identities_v1
    where user_id=v_actor and status='VERIFIED')
  then raise exception 'Independent legal identity verification required first'; end if;
  if v_profession not in ('PHYSICIAN','NURSE','PHARMACIST','MIDWIFE','OTHER')
    then raise exception 'Invalid professional category'; end if;
  if v_license !~ '^[A-Z0-9]{5,24}$' then raise exception 'Enter PRC license number'; end if;
  if p_license_expires_on is null or p_license_expires_on<=current_date
    or p_license_expires_on>(current_date+interval '8 years')::date
  then raise exception 'A current, plausible PRC license expiry date is required'; end if;
  insert into private.buklod_health_professionals_v1(
    user_id,profession,prc_license_number,license_expires_on,status
  ) values (v_actor,v_profession,v_license,p_license_expires_on,'PENDING')
  on conflict(user_id) do update set profession=excluded.profession,prc_license_number=excluded.prc_license_number,
    license_expires_on=excluded.license_expires_on,status='PENDING',submitted_at=now(),
    reviewed_at=null,reviewed_by=null,verification_reference=null;
  return jsonb_build_object('status','PENDING','review','PRC_INDEPENDENT_MANUAL_CHECK');
end;$f$;

create or replace function public.buklod_health_card_admin_review_v1(
  p_user_id uuid,p_kind text,p_approve boolean,p_method text,p_reference text
) returns jsonb language plpgsql security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_kind text:=upper(btrim(coalesce(p_kind,'')));
  v_method text:=upper(btrim(coalesce(p_method,'')));v_ref text:=btrim(coalesce(p_reference,''));
  v_count integer;
begin
  if v_actor is null or not public.buklod_is_system_admin() then
    raise exception 'System administrator verification required'; end if;
  if p_user_id=v_actor then raise exception 'Independent reviewer required'; end if;
  if p_approve is null or v_kind not in ('IDENTITY','PROFESSIONAL')
    or length(v_ref) not between 20 and 300 then raise exception 'Review details required'; end if;
  -- Reference must be a non-sensitive internal verification ticket, NOT a full ID or medical record.
  if v_ref ~* '(password|otp|mpin|full government id image)' then
    raise exception 'Sensitive documents must not be pasted as review notes'; end if;
  if v_kind='IDENTITY' then
    if v_method not in ('SECURE_ID_VIDEO_REVIEW','AUTHORIZED_KYC','VERIFIED_IN_PERSON')
      then raise exception 'Reliable independent identity method required'; end if;
    update private.buklod_health_identities_v1
      set status=case when p_approve then 'VERIFIED' else 'REJECTED' end,
        reviewed_by=v_actor,reviewed_at=now(),evidence_method=v_method,review_reference=v_ref
      where user_id=p_user_id and status='PENDING';
  else
    if v_method<>'PRC_OFFICIAL_VERIFICATION' then
      raise exception 'Independently verify PRC credentials at the official PRC service'; end if;
    if p_approve and not exists(select 1 from private.buklod_health_identities_v1
      where user_id=p_user_id and status='VERIFIED') then
      raise exception 'Professional legal identity not yet verified'; end if;
    update private.buklod_health_professionals_v1
      set status=case when p_approve then 'VERIFIED' else 'REJECTED' end,
        reviewed_by=v_actor,reviewed_at=now(),verification_reference=v_ref
      where user_id=p_user_id and status='PENDING' and
        (not p_approve or license_expires_on>current_date);
  end if;
  get diagnostics v_count = row_count;
  if v_count<>1 then raise exception 'Pending submission not found or license expired'; end if;
  insert into private.buklod_health_review_audit_v1
    (reviewer_id,target_user_id,review_kind,outcome,review_reference)
  values(v_actor,p_user_id,v_kind,case when p_approve then 'VERIFIED' else 'REJECTED' end,v_ref);
  return jsonb_build_object('status',case when p_approve then 'VERIFIED' else 'REJECTED' end);
end;$f$;

create or replace function public.buklod_health_card_open_consult_v1(
  p_service text,p_concern text,p_symptom_duration text,p_location_city text,
  p_red_flags boolean,p_informed_consent boolean
) returns uuid language plpgsql security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_service text:=upper(btrim(coalesce(p_service,'')));
  v_concern text:=btrim(coalesce(p_concern,''));v_id uuid;
begin
  if v_actor is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from private.buklod_health_identities_v1
    where user_id=v_actor and status='VERIFIED') then
    raise exception 'Independent client identity verification required'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and is_active=true
    and birth_date is not null and birth_date<=current_date-interval '18 years') then
    raise exception 'Adult-only trial. Guardian-assisted pediatric pathway not yet active'; end if;
  if v_service not in ('HEALTH_ADVICE','PHYSICIAN_CONSULT') then
    raise exception 'Invalid consultation type'; end if;
  if length(v_concern) not between 20 and 1500 or length(coalesce(p_symptom_duration,''))>120
    or length(coalesce(p_location_city,''))>120 then raise exception 'Complete the structured intake'; end if;
  if p_red_flags is distinct from false then
    raise exception 'Urgent warning signs require emergency or in-person care'; end if;
  if p_informed_consent is distinct from true then raise exception 'Specific telehealth consent required'; end if;
  -- Bound case spam and duplicate requests; lock per client while checking.
  perform pg_advisory_xact_lock(hashtext(v_actor::text),2511);
  if (select count(*) from private.buklod_health_consultations_v1
    where client_id=v_actor and status in ('OPEN','IN_PROGRESS'))>=3 then
    raise exception 'Three consultations already active; close one before starting another'; end if;
  insert into private.buklod_health_consultations_v1(
    client_id,service,concern,symptom_duration,location_city,urgent_screen_clear,
    consent_version,consent_at
  ) values(v_actor,v_service,v_concern,nullif(btrim(coalesce(p_symptom_duration,'')),''),
    nullif(btrim(coalesce(p_location_city,'')),''),true,'PH_TELEHEALTH_V1',now())
  returning id into v_id;
  return v_id;
end;$f$;

create or replace function public.buklod_health_card_claim_consult_v1(p_consult_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_profession text;v_service text;v_count integer;
begin
  if v_actor is null then raise exception 'Sign in required'; end if;
  select profession into v_profession from private.buklod_health_professionals_v1
    where user_id=v_actor and status='VERIFIED' and license_expires_on>=current_date;
  if v_profession is null then raise exception 'Current verified PRC professional required'; end if;
  select service into v_service from private.buklod_health_consultations_v1
    where id=p_consult_id and status='OPEN' and professional_id is null;
  if v_service is null then raise exception 'Consultation no longer available'; end if;
  if v_service='PHYSICIAN_CONSULT' and v_profession<>'PHYSICIAN' then
    raise exception 'Medical consultation is physician-only'; end if;
  update private.buklod_health_consultations_v1
    set professional_id=v_actor,status='IN_PROGRESS',updated_at=now()
    where id=p_consult_id and status='OPEN' and professional_id is null;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'Already accepted by another professional'; end if;
  return jsonb_build_object('status','IN_PROGRESS','claimed_by',v_actor);
end;$f$;

create or replace function public.buklod_health_card_post_note_v1(
  p_consult_id uuid,p_kind text,p_message text
) returns uuid language plpgsql security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_case private.buklod_health_consultations_v1%rowtype;
  v_kind text:=upper(btrim(coalesce(p_kind,'')));v_message text:=btrim(coalesce(p_message,''));
  v_is_prof boolean;v_note_id uuid;
begin
  if v_actor is null then raise exception 'Sign in required'; end if;
  select * into v_case from private.buklod_health_consultations_v1 where id=p_consult_id;
  if not found or (v_case.client_id<>v_actor and v_case.professional_id is distinct from v_actor) then
    raise exception 'Consultation not accessible'; end if;
  if v_case.status not in ('IN_PROGRESS') then raise exception 'Consultation is not active'; end if;
  if length(v_message) not between 2 and 2400 then raise exception 'Message must be 2-2400 characters'; end if;
  if v_kind not in ('CLIENT_QUESTION','PROFESSIONAL_ADVICE','CARE_PLAN','FOLLOW_UP','REFERRAL') then
    raise exception 'Invalid clinical note type'; end if;
  v_is_prof := (v_actor=v_case.professional_id);
  if v_is_prof then
    if not exists(select 1 from private.buklod_health_professionals_v1
      where user_id=v_actor and status='VERIFIED' and license_expires_on>=current_date)
    then raise exception 'License not current; consultation paused for safe reassignment'; end if;
    if v_kind='CLIENT_QUESTION' then raise exception 'Only clients may submit patient questions'; end if;
  else
    if v_kind not in ('CLIENT_QUESTION','FOLLOW_UP') then raise exception 'Clinical plans require a professional'; end if;
  end if;
  insert into private.buklod_health_consult_notes_v1(consultation_id,author_id,kind,message)
  values(p_consult_id,v_actor,v_kind,v_message) returning id into v_note_id;
  if v_kind='REFERRAL' then
    update private.buklod_health_consultations_v1
      set status='REFERRED',referral_note=v_message,updated_at=now()
      where id=p_consult_id;
  end if;
  return v_note_id;
end;$f$;

create or replace function public.buklod_health_card_close_consult_v1(p_consult_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_count integer;
begin
  if v_actor is null then raise exception 'Sign in required'; end if;
  update private.buklod_health_consultations_v1
    set status='CLOSED',updated_at=now()
    where id=p_consult_id and status='IN_PROGRESS'
      and (client_id=v_actor or professional_id=v_actor);
  get diagnostics v_count=row_count;
  return v_count=1;
end;$f$;

create or replace function public.buklod_health_card_get_notes_v1(p_consult_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from private.buklod_health_consultations_v1
    where id=p_consult_id and (client_id=v_actor or professional_id=v_actor))
  then raise exception 'Consultation not accessible'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'kind',n.kind,'message',n.message,'created_at',n.created_at,
    'mine',n.author_id=v_actor
  ) order by n.created_at asc),'[]'::jsonb) into v_result from
    (select * from private.buklod_health_consult_notes_v1
      where consultation_id=p_consult_id order by created_at desc limit 100) n;
  return v_result;
end;$f$;

create or replace function public.buklod_health_card_dashboard_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $f$
declare v_actor uuid:=auth.uid();v_identity jsonb;v_prof jsonb;v_cases jsonb;
  v_queue jsonb;v_pending_identities jsonb;v_pending_professionals jsonb;v_admin boolean;
  v_profession text;
begin
  if v_actor is null then raise exception 'Sign in required'; end if;
  v_admin:=public.buklod_is_system_admin();
  select jsonb_build_object('status',status,'legal_name',legal_name,'submitted_at',submitted_at,
    'evidence_method',case when status='VERIFIED' then evidence_method else null end)
    into v_identity from private.buklod_health_identities_v1 where user_id=v_actor;
  select jsonb_build_object('status',status,'profession',profession,'expires_on',license_expires_on,
    'days_to_expire',(license_expires_on-current_date),'license_number',prc_license_number)
    into v_prof from private.buklod_health_professionals_v1 where user_id=v_actor;
  v_profession:=v_prof->>'profession';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'service',c.service,'concern',c.concern,'status',c.status,
    'professional_name',p.full_name,'professional_role',hp.profession,
    'license_number',case when hp.status='VERIFIED' and hp.license_expires_on>=current_date
      then hp.prc_license_number else null end,
    'license_current',coalesce(hp.status='VERIFIED' and hp.license_expires_on>=current_date,false),
    'client_name',case when c.professional_id=v_actor then cp.full_name else null end,
    'created_at',c.created_at,'referral_note',c.referral_note
  ) order by c.created_at desc),'[]'::jsonb) into v_cases
  from (select * from private.buklod_health_consultations_v1
    where client_id=v_actor or professional_id=v_actor
    order by created_at desc limit 30) c
    left join public.profiles p on p.id=c.professional_id
    left join public.profiles cp on cp.id=c.client_id
    left join private.buklod_health_professionals_v1 hp on hp.user_id=c.professional_id;
  if v_prof->>'status'='VERIFIED' and (v_prof->>'days_to_expire')::int>=0 then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'service',q.service,'created_at',q.created_at)
      order by q.created_at asc),'[]'::jsonb) into v_queue
    from (select id,service,created_at from private.buklod_health_consultations_v1
      where status='OPEN' and professional_id is null
        and (service='HEALTH_ADVICE' or v_profession='PHYSICIAN')
      order by created_at asc limit 20) q;
  end if;
  if v_admin then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.user_id,'name',x.legal_name,'submitted_at',x.submitted_at
    ) order by x.submitted_at asc),'[]'::jsonb)
    into v_pending_identities from
      (select * from private.buklod_health_identities_v1
        where status='PENDING' order by submitted_at asc limit 20) x;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.user_id,'name',p.full_name,'profession',x.profession,
      'license_number',x.prc_license_number,'expires_on',x.license_expires_on
    ) order by x.submitted_at asc),'[]'::jsonb)
    into v_pending_professionals from
      (select * from private.buklod_health_professionals_v1
        where status='PENDING' order by submitted_at asc limit 20) x
      left join public.profiles p on p.id=x.user_id;
  end if;
  return jsonb_build_object('identity',v_identity,'professional',v_prof,'consultations',v_cases,
    'queue',coalesce(v_queue,'[]'::jsonb),'admin',v_admin,
    'pending_identities',case when v_admin then coalesce(v_pending_identities,'[]'::jsonb) else '[]'::jsonb end,
    'pending_professionals',case when v_admin then coalesce(v_pending_professionals,'[]'::jsonb) else '[]'::jsonb end,
    'cost','FREE','data_owner','PRIVATE_HEALTH_SERVICE');
end;$f$;

revoke all on function public.buklod_health_card_register_identity_v1(text) from public,anon,authenticated;
revoke all on function public.buklod_health_card_register_professional_v1(text,text,date) from public,anon,authenticated;
revoke all on function public.buklod_health_card_admin_review_v1(uuid,text,boolean,text,text) from public,anon,authenticated;
revoke all on function public.buklod_health_card_open_consult_v1(text,text,text,text,boolean,boolean) from public,anon,authenticated;
revoke all on function public.buklod_health_card_claim_consult_v1(uuid) from public,anon,authenticated;
revoke all on function public.buklod_health_card_post_note_v1(uuid,text,text) from public,anon,authenticated;
revoke all on function public.buklod_health_card_close_consult_v1(uuid) from public,anon,authenticated;
revoke all on function public.buklod_health_card_get_notes_v1(uuid) from public,anon,authenticated;
revoke all on function public.buklod_health_card_dashboard_v1() from public,anon,authenticated;
grant execute on function public.buklod_health_card_register_identity_v1(text) to authenticated;
grant execute on function public.buklod_health_card_register_professional_v1(text,text,date) to authenticated;
grant execute on function public.buklod_health_card_admin_review_v1(uuid,text,boolean,text,text) to authenticated;
grant execute on function public.buklod_health_card_open_consult_v1(text,text,text,text,boolean,boolean) to authenticated;
grant execute on function public.buklod_health_card_claim_consult_v1(uuid) to authenticated;
grant execute on function public.buklod_health_card_post_note_v1(uuid,text,text) to authenticated;
grant execute on function public.buklod_health_card_close_consult_v1(uuid) to authenticated;
grant execute on function public.buklod_health_card_get_notes_v1(uuid) to authenticated;
grant execute on function public.buklod_health_card_dashboard_v1() to authenticated;
