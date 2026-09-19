-- BUKLOD automatic account recovery hardening
-- Safe to re-apply: additive columns and indexes only.

alter table public.buklod_recovery_otp_challenges
  add column if not exists contact_ciphertext text,
  add column if not exists contact_iv text,
  add column if not exists match_method text;

comment on column public.buklod_recovery_otp_challenges.contact_ciphertext is
  'AES-GCM encrypted recovery delivery destination for server-side OTP verification. Never exposed directly to clients.';
comment on column public.buklod_recovery_otp_challenges.contact_iv is
  'AES-GCM IV for encrypted recovery delivery destination.';
comment on column public.buklod_recovery_otp_challenges.match_method is
  'Recovery resolver used for this challenge: email, mobile, username_birthdate, or identity_birthdate.';

create index if not exists idx_profiles_active_login_identifier
  on public.profiles (login_method, login_identifier)
  where is_active = true;

create index if not exists idx_profiles_active_mobile
  on public.profiles (mobile)
  where is_active = true;

create index if not exists idx_profiles_active_identity_birth
  on public.profiles (lower(first_name), lower(surname), birth_date)
  where is_active = true;

create index if not exists idx_profiles_active_birth_date
  on public.profiles (birth_date)
  where is_active = true and birth_date is not null;

create index if not exists idx_recovery_events_type_subject_created
  on public.buklod_account_recovery_events (event_type, subject_hash, created_at desc)
  where subject_hash is not null;

create index if not exists idx_recovery_events_type_ip_created
  on public.buklod_account_recovery_events (event_type, ip_hash, created_at desc)
  where ip_hash is not null;
