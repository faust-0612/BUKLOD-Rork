-- DB-generated idempotency nonce for the original standalone Expo BSOC chat UI.
-- Additive: existing clients may still provide their own UUID nonce.
alter table public.bsoc_case_messages alter column client_nonce set default gen_random_uuid();
