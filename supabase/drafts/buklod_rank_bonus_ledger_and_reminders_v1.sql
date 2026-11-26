-- RELEASE CANDIDATE ONLY. Not an applied migration. Promote via Supabase CLI
-- after isolated DB tests, real cosmetic catalog/SSV integration and release approval.
begin;
create table if not exists private.buklod_rank_bonus_catalog_v1 (
  bonus_key text primary key check (bonus_key ~ '^[a-z0-9-]{1,80}$'),
  required_rank_order integer not null unique check (required_rank_order between 1 and 40),
  title text not null check (char_length(title) between 1 and 120),
  enabled boolean not null default false
);
alter table private.buklod_rank_bonus_catalog_v1 enable row level security;
revoke all on private.buklod_rank_bonus_catalog_v1 from public,anon,authenticated;

create table if not exists public.buklod_rank_bonus_ledger_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  bonus_key text not null references private.buklod_rank_bonus_catalog_v1(bonus_key),
  rank_order integer not null check (rank_order between 1 and 40),
  title text not null,
  available_at timestamptz not null default now(),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  primary key (user_id,bonus_key),
  check (redeemed_at is null or revoked_at is null)
);
alter table public.buklod_rank_bonus_ledger_v1 enable row level security;
revoke all on public.buklod_rank_bonus_ledger_v1 from public,anon,authenticated;
grant select on public.buklod_rank_bonus_ledger_v1 to authenticated;
create policy rank_bonus_own_read_v1 on public.buklod_rank_bonus_ledger_v1
  for select to authenticated using (user_id=(select auth.uid()));
create index if not exists rank_bonus_pending_v1
  on public.buklod_rank_bonus_ledger_v1(user_id,available_at)
  where redeemed_at is null and revoked_at is null;

create table if not exists public.buklod_rank_bonus_preferences_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminders_enabled boolean not null default false,
  snoozed_until timestamptz
);
alter table public.buklod_rank_bonus_preferences_v1 enable row level security;
revoke all on public.buklod_rank_bonus_preferences_v1 from public,anon,authenticated;
grant select,insert,update on public.buklod_rank_bonus_preferences_v1 to authenticated;
create policy rank_bonus_pref_read_v1 on public.buklod_rank_bonus_preferences_v1
  for select to authenticated using (user_id=(select auth.uid()));
create policy rank_bonus_pref_insert_v1 on public.buklod_rank_bonus_preferences_v1
  for insert to authenticated with check (user_id=(select auth.uid()));
create policy rank_bonus_pref_update_v1 on public.buklod_rank_bonus_preferences_v1
  for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create table if not exists private.buklod_rank_bonus_reminder_cursor_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_reminder_at timestamptz not null
);
alter table private.buklod_rank_bonus_reminder_cursor_v1 enable row level security;
revoke all on private.buklod_rank_bonus_reminder_cursor_v1 from public,anon,authenticated;

-- No catalog entries are enabled by this candidate: never advertise a nonexistent reward.
-- Future activation must supply a verified usable cosmetic and signed reward grant.
create or replace function private.buklod_rank_bonus_sync_v1(p_user_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_rank integer; v_count integer;
begin
  if not exists (select 1 from public.profiles p where p.id=p_user_id and p.is_active and p.is_verified) then return 0; end if;
  select max(h.rank_order) into v_rank from public.buklod_rank_history h
    where h.user_id=p_user_id and h.trigger_ledger_id is not null
      and h.achievement_source <> 'baseline';
  if v_rank is null then return 0; end if;
  insert into public.buklod_rank_bonus_ledger_v1(user_id,bonus_key,rank_order,title)
    select p_user_id,c.bonus_key,c.required_rank_order,c.title
      from private.buklod_rank_bonus_catalog_v1 c where c.enabled and c.required_rank_order<=v_rank
    on conflict(user_id,bonus_key) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end $$;
revoke all on function private.buklod_rank_bonus_sync_v1(uuid) from public,anon,authenticated;

-- No extra trigger on the live points claim path: batch sync avoids making a
-- cosmetic subsystem a dependency of financial/points transactions.
create or replace function private.buklod_rank_bonus_sync_batch_v1(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_count integer:=0;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('buklod:rank-bonus:sync:v1',0)) then return 0; end if;
  for v_user in
    select p.id from public.profiles p where p.is_active and p.is_verified
      and exists (select 1 from private.buklod_rank_bonus_catalog_v1 c where c.enabled
        and exists (select 1 from public.buklod_rank_history h where h.user_id=p.id
          and h.rank_order>=c.required_rank_order and h.trigger_ledger_id is not null and h.achievement_source<>'baseline')
        and not exists(select 1 from public.buklod_rank_bonus_ledger_v1 b where b.user_id=p.id and b.bonus_key=c.bonus_key))
    order by p.id limit greatest(1,least(coalesce(p_limit,100),200))
  loop
    v_count:=v_count+private.buklod_rank_bonus_sync_v1(v_user);
  end loop;
  return v_count;
end $$;
revoke all on function private.buklod_rank_bonus_sync_batch_v1(integer) from public,anon,authenticated;

-- Existing owner-only notification queue; consent is explicit and the cadence
-- cursor and queue insert commit together. Manila quiet hours (08:00–21:00).
create or replace function private.buklod_rank_bonus_remind_v1(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_count integer; v_sent integer:=0; v_notification uuid;
begin
  if extract(hour from now() at time zone 'Asia/Manila') not between 8 and 20 then return 0; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('buklod:rank-bonus:remind:v1',0)) then return 0; end if;
  for v_user in
    select pref.user_id from public.buklod_rank_bonus_preferences_v1 pref
      join public.profiles p on p.id=pref.user_id and p.is_active and p.is_verified
      left join private.buklod_rank_bonus_reminder_cursor_v1 cur on cur.user_id=pref.user_id
    where pref.reminders_enabled and (pref.snoozed_until is null or pref.snoozed_until<=now())
      and (cur.last_reminder_at is null or cur.last_reminder_at<=now()-interval '72 hours')
      and exists(select 1 from public.buklod_rank_bonus_ledger_v1 b
        join private.buklod_rank_bonus_catalog_v1 c on c.bonus_key=b.bonus_key and c.enabled
        where b.user_id=pref.user_id and b.redeemed_at is null and b.revoked_at is null
        and b.available_at<=now()-interval '24 hours')
    order by cur.last_reminder_at nulls first,pref.user_id
    limit greatest(1,least(coalesce(p_limit,100),200))
    for update of pref skip locked
  loop
    -- Lock pending rows during the enqueue transaction; future SSV redemption
    -- must update the same ledger rows and obey this lock.
    perform 1 from public.buklod_rank_bonus_ledger_v1 b
      where b.user_id=v_user and b.redeemed_at is null and b.revoked_at is null for update;
    select count(*) into v_count from public.buklod_rank_bonus_ledger_v1 b
      join private.buklod_rank_bonus_catalog_v1 c on c.bonus_key=b.bonus_key and c.enabled
      where b.user_id=v_user and b.redeemed_at is null and b.revoked_at is null;
    if v_count=0 then continue; end if;
    v_notification:=public.queue_notification(v_user,
      'May bonus collection ka pang naghihintay!',
      'May '||v_count::text||' cosmetic bonus(es) ka pang hindi nare-redeem. Balikan ang iyong collections kapag handa ka.',
      'rank_bonus_reminder',
      pg_catalog.jsonb_build_object('route','/points/progression','source','buklod_rank_bonus_v1'));
    if v_notification is null then continue; end if;
    insert into private.buklod_rank_bonus_reminder_cursor_v1(user_id,last_reminder_at)
      values(v_user,now()) on conflict(user_id) do update set last_reminder_at=excluded.last_reminder_at;
    v_sent:=v_sent+1;
  end loop;
  return v_sent;
end $$;
revoke all on function private.buklod_rank_bonus_remind_v1(integer) from public,anon,authenticated;
-- Cron deliberately not registered until queue consent/routing, real reward catalog,
-- signed rewarded-ad SSV, runtime tests and exact RC are verified.
commit;
