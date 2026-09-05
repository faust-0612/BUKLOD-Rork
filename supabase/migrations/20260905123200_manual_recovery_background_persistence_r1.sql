begin;

-- BUKLOD_MANUAL_RECOVERY_BACKGROUND_R1
-- Manual review is server-authoritative. A member does not need to keep the
-- Forgot Password screen open while a System Admin reviews the request.

create or replace function public.buklod_keep_manual_recovery_alive_r1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('pending', 'code_issued') then
    new.client_token_expires_at := greatest(
      coalesce(new.client_token_expires_at, now()),
      now() + interval '7 days'
    );
  end if;

  if new.status = 'code_issued' and new.recovery_code_expires_at is not null then
    new.recovery_code_expires_at := greatest(
      new.recovery_code_expires_at,
      now() + interval '24 hours'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_buklod_keep_manual_recovery_alive_r1
  on public.buklod_account_recovery_requests;
create trigger trg_buklod_keep_manual_recovery_alive_r1
before insert or update on public.buklod_account_recovery_requests
for each row
execute function public.buklod_keep_manual_recovery_alive_r1();

create or replace function public.buklod_keep_admin_recovery_code_alive_r1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.used_at is null then
    new.expires_at := greatest(
      coalesce(new.expires_at, now()),
      now() + interval '24 hours'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_buklod_keep_admin_recovery_code_alive_r1
  on public.buklod_admin_recovery_codes;
create trigger trg_buklod_keep_admin_recovery_code_alive_r1
before insert or update of expires_at, used_at
on public.buklod_admin_recovery_codes
for each row
execute function public.buklod_keep_admin_recovery_code_alive_r1();

-- Bring currently waiting reviews under the same background-safe policy.
update public.buklod_account_recovery_requests
set client_token_expires_at = greatest(
      coalesce(client_token_expires_at, now()),
      now() + interval '7 days'
    )
where status = 'pending';

update public.buklod_account_recovery_requests
set client_token_expires_at = greatest(
      coalesce(client_token_expires_at, now()),
      now() + interval '7 days'
    ),
    recovery_code_expires_at = case
      when recovery_code_expires_at is null then null
      else greatest(recovery_code_expires_at, now() + interval '24 hours')
    end
where status = 'code_issued';

update public.buklod_admin_recovery_codes
set expires_at = greatest(
      coalesce(expires_at, now()),
      now() + interval '24 hours'
    )
where used_at is null;

commit;
