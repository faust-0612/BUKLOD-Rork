-- BUKLOD AdMob hourly provider sync, dedicated least-privilege schedule authentication.
-- The only generated scheduler secret lives encrypted in Supabase Vault.
-- NEVER store or log the secret, set client-readable RLS, or touch Finance V3 cash.
create table if not exists private.buklod_admob_internal_cron_auth_v1 (
  singleton boolean primary key default true check (singleton),
  token_sha256 bytea not null check (octet_length(token_sha256)=32),
  created_at timestamptz not null default now()
);
alter table private.buklod_admob_internal_cron_auth_v1 enable row level security;
revoke all on private.buklod_admob_internal_cron_auth_v1 from public, anon, authenticated;

do $setup_admob_cron$
declare v_token text;
begin
  if exists(select 1 from private.buklod_admob_internal_cron_auth_v1) then
    if not exists(select 1 from vault.secrets where name='BUKLOD_ADMOB_INTERNAL_SCHEDULER_KEY') then
      raise exception 'Scheduler credential digest exists without Vault secret';
    end if;
  else
    if exists(select 1 from vault.secrets where name='BUKLOD_ADMOB_INTERNAL_SCHEDULER_KEY') then
      raise exception 'Vault scheduler secret exists without matching credential digest';
    end if;
    v_token:=encode(extensions.gen_random_bytes(32),'hex');
    perform vault.create_secret(
      v_token,
      'BUKLOD_ADMOB_INTERNAL_SCHEDULER_KEY',
      'Encrypted 256-bit hourly AdMob revenue bridge token; never use for user cash or GitHub'
    );
    insert into private.buklod_admob_internal_cron_auth_v1(singleton,token_sha256)
    values(true,pg_catalog.sha256(pg_catalog.convert_to(v_token,'UTF8')));
  end if;
end;
$setup_admob_cron$;

create or replace function public.buklod_authorize_admob_cron_token_v1(p_token text)
returns boolean
language plpgsql stable security definer set search_path to ''
as $function$
declare v_hash bytea;
begin
  -- Only the server-side Edge Function service-role client may check tokens.
  if coalesce((select auth.role()),'') <> 'service_role' then return false; end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return false; end if;
  select a.token_sha256 into v_hash
  from private.buklod_admob_internal_cron_auth_v1 a where singleton=true;
  return v_hash is not null and v_hash=pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'));
end;
$function$;
revoke all on function public.buklod_authorize_admob_cron_token_v1(text) from public,anon,authenticated;
grant execute on function public.buklod_authorize_admob_cron_token_v1(text) to service_role;

-- Keep the scheduled DB job command free of bearer tokens or OAuth secrets.
-- Only PostgreSQL's trusted cron owner can call this dispatcher.
create or replace function private.buklod_admob_internal_cron_dispatch_v1()
returns bigint
language plpgsql volatile security definer set search_path to ''
as $function$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name='BUKLOD_ADMOB_INTERNAL_SCHEDULER_KEY';
  if v_token is null or v_token !~ '^[0-9a-f]{64}$' then
    raise exception 'AdMob scheduler Vault credential missing or invalid';
  end if;
  select net.http_post(
    url:='https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-admob-cron-bridge-v1',
    headers:=jsonb_build_object(
      'Authorization','Bearer '||v_token,
      'Content-Type','application/json'
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=90000
  ) into v_request_id;
  return v_request_id;
end;
$function$;
revoke all on function private.buklod_admob_internal_cron_dispatch_v1() from public,anon,authenticated,service_role;

comment on function public.buklod_authorize_admob_cron_token_v1(text) is
'Service role only: compare the encrypted-Vault cron sender token against a private SHA256 digest. This grants no financial write privilege.';
comment on function private.buklod_admob_internal_cron_dispatch_v1() is
'Postgres cron owner only: send encrypted-Vault bearer to the dedicated AdMob Edge bridge. Never place secrets in cron.job SQL.';
