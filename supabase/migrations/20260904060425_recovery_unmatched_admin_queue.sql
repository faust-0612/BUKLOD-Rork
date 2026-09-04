alter table public.buklod_account_recovery_requests alter column user_id drop not null;
alter table public.buklod_account_recovery_requests alter column username drop not null;

alter table public.buklod_account_recovery_requests add column if not exists match_status text not null default 'matched';
alter table public.buklod_account_recovery_requests add column if not exists submitted_identifier text;
alter table public.buklod_account_recovery_requests add column if not exists submitted_first_name text;
alter table public.buklod_account_recovery_requests add column if not exists submitted_middle_name text;
alter table public.buklod_account_recovery_requests add column if not exists submitted_surname text;
alter table public.buklod_account_recovery_requests add column if not exists submitted_birth_date date;
alter table public.buklod_account_recovery_requests add column if not exists subject_hash text;

alter table public.buklod_account_recovery_requests drop constraint if exists buklod_account_recovery_requests_status_check;
alter table public.buklod_account_recovery_requests add constraint buklod_account_recovery_requests_status_check check (status = any (array['pending'::text,'code_issued'::text,'completed'::text,'cancelled'::text,'rejected'::text]));

alter table public.buklod_account_recovery_requests drop constraint if exists buklod_account_recovery_requests_match_status_check;
alter table public.buklod_account_recovery_requests add constraint buklod_account_recovery_requests_match_status_check check (match_status = any (array['matched'::text,'needs_match'::text]));

create unique index if not exists buklod_one_pending_recovery_request_per_subject on public.buklod_account_recovery_requests(subject_hash) where status='pending' and subject_hash is not null;
create index if not exists buklod_recovery_requests_match_status_idx on public.buklod_account_recovery_requests(status,match_status,created_at desc);

comment on column public.buklod_account_recovery_requests.submitted_identifier is 'Admin-only recovery request input; table is service-role only and protected by RLS.';
