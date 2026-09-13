-- BUKLOD real-email verification authority.
--
-- Canonical rule:
--   * login_method='email' must prove ownership of the exact current Auth email
--     before profiles.is_verified may transition from false -> true.
--   * mobile / username accounts keep their existing synthetic-email auth flow
--     and are NOT blocked by email verification.
--   * email verification and Admin approval remain separate states.
--
-- Delivery is performed by buklod-email-verification-v1 through Resend.

create table if not exists public.buklod_email_verification_dispatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dispatch_token_hash text not null,
  expires_at timestamptz not null,
  delivery_status text not null default 'QUEUED'
    check (delivery_status in ('QUEUED','SENT','FAILED','SKIPPED','EXPIRED')),
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists buklod_email_verification_dispatches_user_created_idx
  on public.buklod_email_verification_dispatches(user_id, created_at desc);

create table if not exists public.buklod_email_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dispatch_id uuid references public.buklod_email_verification_dispatches(id) on delete set null,
  email_hash text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists buklod_email_verification_challenges_user_created_idx
  on public.buklod_email_verification_challenges(user_id, created_at desc);

create table if not exists public.buklod_email_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_hash text not null,
  verified_at timestamptz not null,
  method text not null default 'EMAIL_LINK',
  updated_at timestamptz not null default now()
);

alter table public.buklod_email_verification_dispatches enable row level security;
alter table public.buklod_email_verification_challenges enable row level security;
alter table public.buklod_email_verifications enable row level security;

revoke all on table public.buklod_email_verification_dispatches from anon, authenticated;
revoke all on table public.buklod_email_verification_challenges from anon, authenticated;
revoke all on table public.buklod_email_verifications from anon, authenticated;

grant select, insert, update, delete on table public.buklod_email_verification_dispatches to service_role;
grant select, insert, update, delete on table public.buklod_email_verification_challenges to service_role;
grant select, insert, update, delete on table public.buklod_email_verifications to service_role;

create or replace function public.buklod_email_is_verified_v1(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_login_method text;
  v_email text;
  v_email_hash text;
begin
  if p_user_id is null then
    return false;
  end if;

  select
    lower(coalesce(p.login_method, '')),
    lower(btrim(coalesce(u.email, '')))
  into v_login_method, v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id
    and coalesce(p.is_active, true) = true;

  if not found then
    return false;
  end if;

  -- Synthetic internal emails are not an email-verification requirement.
  if v_login_method <> 'email' then
    return true;
  end if;

  if v_email = ''
     or v_email like '%@buklod.invalid'
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    return false;
  end if;

  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  return exists (
    select 1
    from public.buklod_email_verifications v
    where v.user_id = p_user_id
      and v.email_hash = v_email_hash
      and v.verified_at is not null
  );
end;
$function$;

revoke all on function public.buklod_email_is_verified_v1(uuid) from public, anon, authenticated;
grant execute on function public.buklod_email_is_verified_v1(uuid) to service_role;

create or replace function public.get_buklod_email_verification_status_v1(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_login_method text;
  v_verified boolean := false;
  v_verified_at timestamptz;
  v_allowed boolean := false;
begin
  if v_actor is null or p_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_allowed := v_actor = p_user_id or public.is_system_admin();

  if not v_allowed then
    select exists (
      select 1
      from public.church_join_requests r
      where r.user_id = p_user_id
        and r.status = 'pending'
        and public.can_review_join_request(r.id)
    ) into v_allowed;
  end if;

  if not v_allowed then
    raise exception 'Not authorized to view this verification status';
  end if;

  select lower(coalesce(p.login_method, ''))
  into v_login_method
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_verified := public.buklod_email_is_verified_v1(p_user_id);

  if v_login_method = 'email' then
    select v.verified_at
    into v_verified_at
    from public.buklod_email_verifications v
    join auth.users u on u.id = v.user_id
    where v.user_id = p_user_id
      and v.email_hash = encode(
        extensions.digest(lower(btrim(coalesce(u.email, ''))), 'sha256'),
        'hex'
      )
    limit 1;
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'login_method', nullif(v_login_method, ''),
    'requires_email_verification', v_login_method = 'email',
    'email_verified', v_verified,
    'email_verified_at', v_verified_at
  );
end;
$function$;

revoke all on function public.get_buklod_email_verification_status_v1(uuid) from public, anon;
grant execute on function public.get_buklod_email_verification_status_v1(uuid) to authenticated, service_role;

create or replace function public.buklod_queue_email_verification_v1(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_login_method text;
  v_active boolean;
  v_email text;
  v_dispatch_id uuid;
  v_dispatch_token text;
  v_dispatch_token_hash text;
  v_edge_url text := 'https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-email-verification-v1';
begin
  if p_user_id is null then
    return null;
  end if;

  select
    lower(coalesce(p.login_method, '')),
    coalesce(p.is_active, true),
    lower(btrim(coalesce(u.email, '')))
  into v_login_method, v_active, v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if not found
     or not v_active
     or v_login_method <> 'email'
     or v_email = ''
     or v_email like '%@buklod.invalid'
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    return null;
  end if;

  if public.buklod_email_is_verified_v1(p_user_id) then
    return null;
  end if;

  select d.id
  into v_dispatch_id
  from public.buklod_email_verification_dispatches d
  where d.user_id = p_user_id
    and d.created_at >= now() - interval '60 minutes'
    and d.delivery_status in ('QUEUED','SENT')
  order by d.created_at desc
  limit 1;

  if v_dispatch_id is not null then
    return v_dispatch_id;
  end if;

  v_dispatch_id := gen_random_uuid();
  v_dispatch_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_dispatch_token_hash := encode(extensions.digest(v_dispatch_token, 'sha256'), 'hex');

  insert into public.buklod_email_verification_dispatches (
    id,
    user_id,
    dispatch_token_hash,
    expires_at,
    delivery_status
  ) values (
    v_dispatch_id,
    p_user_id,
    v_dispatch_token_hash,
    now() + interval '30 minutes',
    'QUEUED'
  );

  perform net.http_post(
    url := v_edge_url,
    body := jsonb_build_object(
      'action', 'dispatch',
      'dispatchId', v_dispatch_id,
      'token', v_dispatch_token
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 10000
  );

  return v_dispatch_id;
exception
  when others then
    raise warning 'BUKLOD email verification dispatch skipped for %: %', p_user_id, sqlerrm;
    return null;
end;
$function$;

revoke all on function public.buklod_queue_email_verification_v1(uuid) from public, anon, authenticated;
grant execute on function public.buklod_queue_email_verification_v1(uuid) to service_role;

create or replace function public.buklod_guard_email_before_admin_verification_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if coalesce(new.is_verified, false) = true
     and coalesce(old.is_verified, false) = false
     and lower(coalesce(new.login_method, '')) = 'email'
     and not public.buklod_email_is_verified_v1(new.id)
  then
    raise exception
      'Email verification required before Admin approval. Ask the member to open the newest BUKLOD verification email first.';
  end if;

  return new;
end;
$function$;

revoke all on function public.buklod_guard_email_before_admin_verification_v1() from public, anon, authenticated;

drop trigger if exists buklod_guard_email_before_admin_verification_v1 on public.profiles;
create trigger buklod_guard_email_before_admin_verification_v1
before update of is_verified on public.profiles
for each row
execute function public.buklod_guard_email_before_admin_verification_v1();

create or replace function public.buklod_queue_email_verification_profile_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if lower(coalesce(new.login_method, '')) = 'email' then
    perform public.buklod_queue_email_verification_v1(new.id);
  end if;
  return new;
end;
$function$;

revoke all on function public.buklod_queue_email_verification_profile_v1() from public, anon, authenticated;

drop trigger if exists buklod_queue_email_verification_profile_v1 on public.profiles;
create trigger buklod_queue_email_verification_profile_v1
after insert or update of login_method, login_identifier on public.profiles
for each row
when (lower(coalesce(new.login_method, '')) = 'email')
execute function public.buklod_queue_email_verification_profile_v1();

create or replace function public.buklod_queue_email_verification_join_request_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'pending' then
    perform public.buklod_queue_email_verification_v1(new.user_id);
  end if;
  return new;
end;
$function$;

revoke all on function public.buklod_queue_email_verification_join_request_v1() from public, anon, authenticated;

drop trigger if exists buklod_queue_email_verification_join_request_v1 on public.church_join_requests;
create trigger buklod_queue_email_verification_join_request_v1
after insert or update of status on public.church_join_requests
for each row
when (new.status = 'pending')
execute function public.buklod_queue_email_verification_join_request_v1();

create or replace function public.buklod_invalidate_email_verification_on_auth_email_change_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if lower(btrim(coalesce(new.email, ''))) is distinct from lower(btrim(coalesce(old.email, ''))) then
    delete from public.buklod_email_verifications
    where user_id = new.id;

    update public.profiles
    set
      is_verified = false,
      verified_by = null,
      verified_at = null
    where id = new.id
      and lower(coalesce(login_method, '')) = 'email';

    perform public.buklod_queue_email_verification_v1(new.id);
  end if;

  return new;
end;
$function$;

revoke all on function public.buklod_invalidate_email_verification_on_auth_email_change_v1() from public, anon, authenticated;

drop trigger if exists buklod_invalidate_email_verification_on_auth_email_change_v1 on auth.users;
create trigger buklod_invalidate_email_verification_on_auth_email_change_v1
after update of email on auth.users
for each row
execute function public.buklod_invalidate_email_verification_on_auth_email_change_v1();

create or replace function public.buklod_resend_pending_email_verifications_v1()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row record;
  v_count integer := 0;
  v_dispatch uuid;
begin
  for v_row in
    select distinct p.id as user_id
    from public.church_join_requests r
    join public.profiles p on p.id = r.user_id
    where r.status = 'pending'
      and coalesce(p.is_active, true) = true
      and lower(coalesce(p.login_method, '')) = 'email'
      and not public.buklod_email_is_verified_v1(p.id)
      and not exists (
        select 1
        from public.buklod_email_verification_dispatches d
        where d.user_id = p.id
          and d.created_at >= now() - interval '24 hours'
          and d.delivery_status in ('QUEUED','SENT')
      )
  loop
    v_dispatch := public.buklod_queue_email_verification_v1(v_row.user_id);
    if v_dispatch is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.buklod_resend_pending_email_verifications_v1() from public, anon, authenticated;
grant execute on function public.buklod_resend_pending_email_verifications_v1() to service_role;

-- Keep only one scheduled resend job. It is silent when there are no pending
-- email-based Local membership requests.
do $do$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'buklod-email-verification-pending'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end
$do$;

select cron.schedule(
  'buklod-email-verification-pending',
  '17 */6 * * *',
  'select public.buklod_resend_pending_email_verifications_v1();'
);
