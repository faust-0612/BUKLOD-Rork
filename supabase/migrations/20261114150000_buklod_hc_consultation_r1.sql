-- BUKLOD Health Center: source-only R1 online consultation backend.
-- Do NOT deploy to production or enable the patient/professional doors until isolated
-- integration QA, clinical review, verified license checks and account auth exist.
-- No organization/system-admin role inherits patient clinical access.
create extension if not exists pgcrypto;
create table if not exists public.buklod_hc_professional_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profession text not null check (profession in ('physician','registered_nurse','pharmacist','midwife','psychologist','other')),
  license_number text not null check (length(trim(license_number)) between 4 and 80),
  license_expires_on date not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint hc_pending_unreviewed check (status <> 'pending' or reviewed_at is null)
);
create table if not exists public.buklod_hc_verified_professionals (
  user_id uuid primary key references public.buklod_hc_professional_applications(user_id) on delete cascade,
  authorized boolean not null default false,
  verified_at timestamptz,
  valid_until timestamptz,
  revoked_at timestamptz,
  constraint hc_verified_active_must_expire check (authorized = false or (verified_at is not null and valid_until is not null))
);
create table if not exists public.buklod_hc_consultation_cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  clinician_id uuid references public.buklod_hc_verified_professionals(user_id),
  topic text not null check (topic in ('general','medicines','mental','sleep','pregnancy','child','other')),
  status text not null default 'waiting' check (status in ('waiting','open','closed')),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint hc_waiting_unassigned check (status <> 'waiting' or clinician_id is null),
  constraint hc_open_assigned check (status <> 'open' or clinician_id is not null)
);
create table if not exists public.buklod_hc_consultation_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.buklod_hc_consultation_cases(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  client_nonce uuid not null,
  created_at timestamptz not null default now(),
  unique (case_id, sender_id, client_nonce)
);
create index if not exists buklod_hc_cases_patient_id_idx on public.buklod_hc_consultation_cases(patient_id, created_at desc);
create index if not exists buklod_hc_cases_clinician_id_idx on public.buklod_hc_consultation_cases(clinician_id, created_at desc) where clinician_id is not null;
create index if not exists buklod_hc_messages_case_id_idx on public.buklod_hc_consultation_messages(case_id, created_at);
-- Explicit Data API grants. Never open these tables to anon or PUBLIC.
revoke all on public.buklod_hc_professional_applications, public.buklod_hc_verified_professionals,
  public.buklod_hc_consultation_cases, public.buklod_hc_consultation_messages from public, anon, authenticated;
grant select on public.buklod_hc_professional_applications to authenticated;
grant insert (user_id, profession, license_number, license_expires_on) on public.buklod_hc_professional_applications to authenticated;
grant select on public.buklod_hc_verified_professionals to authenticated;
grant select on public.buklod_hc_consultation_cases to authenticated;
grant insert (patient_id, topic, consent_at) on public.buklod_hc_consultation_cases to authenticated;
grant select on public.buklod_hc_consultation_messages to authenticated;
grant insert (case_id, sender_id, body, client_nonce) on public.buklod_hc_consultation_messages to authenticated;
alter table public.buklod_hc_professional_applications enable row level security;
alter table public.buklod_hc_verified_professionals enable row level security;
alter table public.buklod_hc_consultation_cases enable row level security;
alter table public.buklod_hc_consultation_messages enable row level security;
create policy hc_app_owner_read on public.buklod_hc_professional_applications for select to authenticated
  using (user_id = (select auth.uid()));
create policy hc_app_owner_apply on public.buklod_hc_professional_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and license_expires_on > current_date);
create policy hc_verified_self_read on public.buklod_hc_verified_professionals for select to authenticated
  using (user_id = (select auth.uid()));
-- Clinician must be manually approved in service-role-only registry, current and unrevoked.
-- This check runs in caller RLS context and does not trust user-editable metadata.
create policy hc_cases_participant_read on public.buklod_hc_consultation_cases for select to authenticated
  using (
    patient_id = (select auth.uid())
    or (
      clinician_id = (select auth.uid())
      and exists (
        select 1 from public.buklod_hc_verified_professionals v
        where v.user_id = (select auth.uid()) and v.authorized = true
          and v.revoked_at is null and v.valid_until > now()
      )
    )
  );
create policy hc_cases_patient_create on public.buklod_hc_consultation_cases for insert to authenticated
  with check (patient_id = (select auth.uid()) and clinician_id is null and status = 'waiting' and consent_at <= now());
create policy hc_messages_participant_read on public.buklod_hc_consultation_messages for select to authenticated
  using (
    exists (
      select 1 from public.buklod_hc_consultation_cases c
      where c.id = case_id
    )
  );
create policy hc_messages_participant_write on public.buklod_hc_consultation_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.buklod_hc_consultation_cases c
      where c.id = case_id and (
        (c.patient_id = (select auth.uid()) and c.status in ('waiting','open'))
        or (c.clinician_id = (select auth.uid()) and c.status = 'open' and exists (
          select 1 from public.buklod_hc_verified_professionals v
          where v.user_id = (select auth.uid()) and v.authorized = true
            and v.revoked_at is null and v.valid_until > now()
        ))
      )
    )
  );
-- No patient/professional UPDATE or DELETE policies. Credential approval,
-- clinician assignment, closure, moderation and retention are privileged
-- audited server operations to be supplied and verified before enabling the UI.
