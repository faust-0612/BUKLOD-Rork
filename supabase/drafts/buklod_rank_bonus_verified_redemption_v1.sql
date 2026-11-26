-- DEV candidate; apply only after buklod_rank_bonus_ledger_and_reminders_v1.sql.
-- No user-callable grant RPC. Only the verified provider callback service can redeem.
begin;
create table private.buklod_rank_bonus_ad_sessions_v1(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 bonus_key text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '2 hours'),
 consumed_at timestamptz,
 foreign key(user_id,bonus_key) references public.buklod_rank_bonus_ledger_v1(user_id,bonus_key) on delete cascade
);
create index rank_bonus_ad_sessions_recent_v1 on private.buklod_rank_bonus_ad_sessions_v1(user_id,created_at desc);
create table private.buklod_rank_bonus_ad_events_v1(
 transaction_id text primary key check(transaction_id ~ '^[0-9A-Fa-f]{16,128}$'),
 session_id uuid not null unique references private.buklod_rank_bonus_ad_sessions_v1(id) on delete cascade,
 signed_reward_at timestamptz not null,
 received_at timestamptz not null default now()
);
alter table private.buklod_rank_bonus_ad_sessions_v1 enable row level security;
alter table private.buklod_rank_bonus_ad_events_v1 enable row level security;
revoke all on private.buklod_rank_bonus_ad_sessions_v1,private.buklod_rank_bonus_ad_events_v1 from public,anon,authenticated;

-- These internal entrypoints are exposed only to the service-role worker.
-- No client-provided user ID is trusted by the Edge begin endpoint.
create or replace function public.buklod_begin_rank_bonus_ad_v1(p_user_id uuid,p_bonus_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'not authorized';end if;
 if p_user_id is null or private.buklod_is_platform_official_v1(p_user_id) then raise exception 'not eligible';end if;
 if not exists(select 1 from public.profiles p where p.id=p_user_id and p.is_active and p.is_verified) then raise exception 'not eligible';end if;
 -- Serialize all session issuance for one account (including different bonuses).
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rank-bonus-ad:'||p_user_id::text,0));
 perform 1 from public.buklod_rank_bonus_ledger_v1 b join private.buklod_rank_bonus_catalog_v1 c on c.bonus_key=b.bonus_key
 where b.user_id=p_user_id and b.bonus_key=p_bonus_key and c.enabled
  and b.redeemed_at is null and b.revoked_at is null and b.available_at<=now() for update of b;
 if not found then raise exception 'bonus unavailable';end if;
 if exists(select 1 from private.buklod_rank_bonus_ad_sessions_v1 s where s.user_id=p_user_id and s.created_at>now()-interval '20 seconds')
 or (select count(*) from private.buklod_rank_bonus_ad_sessions_v1 s where s.user_id=p_user_id and s.created_at>now()-interval '10 minutes')>=10
 then raise exception 'retry later';end if;
 insert into private.buklod_rank_bonus_ad_sessions_v1(user_id,bonus_key) values(p_user_id,p_bonus_key) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.buklod_begin_rank_bonus_ad_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.buklod_begin_rank_bonus_ad_v1(uuid,text) to service_role;

create or replace function public.buklod_redeem_rank_bonus_verified_v1(p_session_id uuid,p_transaction_id text,p_signed_reward_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_session private.buklod_rank_bonus_ad_sessions_v1%rowtype;
 v_bonus public.buklod_rank_bonus_ledger_v1%rowtype;
 v_existing uuid;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'not authorized';end if;
 if p_transaction_id is null or p_transaction_id !~ '^[0-9A-Fa-f]{16,128}$' or p_signed_reward_at is null then return false;end if;
 p_transaction_id:=pg_catalog.lower(p_transaction_id);
 select * into v_session from private.buklod_rank_bonus_ad_sessions_v1 where id=p_session_id for update;
 if not found then return false;end if;
 -- Verified retries receive success only for the original session/transaction.
 select session_id into v_existing from private.buklod_rank_bonus_ad_events_v1 where transaction_id=p_transaction_id;
 if found then return v_existing=p_session_id;end if;
 if v_session.consumed_at is not null or p_signed_reward_at<v_session.created_at-interval '30 seconds'
  or p_signed_reward_at>v_session.expires_at or p_signed_reward_at>now()+interval '5 minutes' then return false;end if;
 select * into v_bonus from public.buklod_rank_bonus_ledger_v1
   where user_id=v_session.user_id and bonus_key=v_session.bonus_key for update;
 if not found or v_bonus.revoked_at is not null then return false;end if;
 -- Different sessions may race the same transaction: only one can insert.
 insert into private.buklod_rank_bonus_ad_events_v1(transaction_id,session_id,signed_reward_at)
 values(p_transaction_id,p_session_id,p_signed_reward_at) on conflict do nothing;
 if not found then
  select session_id into v_existing from private.buklod_rank_bonus_ad_events_v1 where transaction_id=p_transaction_id;
  return coalesce(v_existing=p_session_id,false);
 end if;
 update public.buklod_rank_bonus_ledger_v1 set redeemed_at=now()
 where user_id=v_session.user_id and bonus_key=v_session.bonus_key and redeemed_at is null and revoked_at is null;
 update private.buklod_rank_bonus_ad_sessions_v1 set consumed_at=now() where id=p_session_id;
 return true;
end $$;
revoke all on function public.buklod_redeem_rank_bonus_verified_v1(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.buklod_redeem_rank_bonus_verified_v1(uuid,text,timestamptz) to service_role;
-- No BP/QMP, cash, transferable item, or rank mutation. No scheduled job.
commit;
