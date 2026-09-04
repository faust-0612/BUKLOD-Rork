alter table public.buklod_account_recovery_requests
  add column if not exists client_token_hash text,
  add column if not exists client_token_expires_at timestamptz,
  add column if not exists recovery_code_ciphertext text,
  add column if not exists recovery_code_iv text,
  add column if not exists recovery_code_expires_at timestamptz,
  add column if not exists recovery_code_retrieved_at timestamptz;

create unique index if not exists buklod_account_recovery_requests_client_token_hash_uidx
  on public.buklod_account_recovery_requests (client_token_hash)
  where client_token_hash is not null;

create index if not exists buklod_account_recovery_requests_client_token_expiry_idx
  on public.buklod_account_recovery_requests (client_token_expires_at)
  where client_token_hash is not null;

alter table public.buklod_account_recovery_requests
  drop constraint if exists buklod_account_recovery_requests_code_cipher_pair_check;

alter table public.buklod_account_recovery_requests
  add constraint buklod_account_recovery_requests_code_cipher_pair_check
  check (
    (recovery_code_ciphertext is null and recovery_code_iv is null)
    or
    (recovery_code_ciphertext is not null and recovery_code_iv is not null)
  );

comment on column public.buklod_account_recovery_requests.client_token_hash is
  'Hash of the private recovery-session token returned only to the requesting client. Plaintext token is never stored.';

comment on column public.buklod_account_recovery_requests.recovery_code_ciphertext is
  'Short-lived encrypted one-time recovery code for automatic in-app delivery after admin verification.';
