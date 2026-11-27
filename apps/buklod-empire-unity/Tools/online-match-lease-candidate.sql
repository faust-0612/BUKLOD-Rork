-- DEV ONLY. Apply after online-match-settlement-candidate.sql in a disposable isolated DB.
-- Private worker interface; no public grants, no MAIN application.
begin;
alter table empire_rewards.match_authority add column lease_until timestamptz;
create table empire_rewards.active_online_seat (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 match_id uuid not null references empire_rewards.match_authority(match_id) on delete restrict
);
create index active_online_seat_match on empire_rewards.active_online_seat(match_id);
alter table empire_rewards.active_online_seat enable row level security;

-- One transaction for wallet reservation, lease and exclusive participation.
-- A lost response may be retried with the identical match, host and draft.
create function empire_rewards.reserve_leased(mid uuid,host uuid,mode_name text,actions jsonb) returns timestamptz
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype; deadline timestamptz; state_now text;
begin
 if mid is null or host is null then raise exception 'Invalid host or match'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('empire_online:'||mid::text,0));
 select * into a from empire_rewards.match_authority where match_id=mid for update;
 if found then
  if a.host_id<>host or a.lease_until is null or a.lease_until<=clock_timestamp() then raise exception 'Host lease unavailable'; end if;
  select state into strict state_now from empire_stones.match where id=mid;
  if state_now not in ('reserved','started') then raise exception 'Terminal match'; end if;
  perform empire_rewards.reserve_online(mid,host,mode_name,actions);
  return a.lease_until;
 end if;
 perform empire_rewards.reserve_online(mid,host,mode_name,actions);
 -- Unique seat constraint rejects cross-match concurrency, rolling back every debit.
 insert into empire_rewards.active_online_seat(user_id,match_id)
 select user_id,mid from empire_stones.match_action where match_id=mid and action='pick' order by user_id;
 deadline:=clock_timestamp()+interval '30 seconds';
 update empire_rewards.match_authority set lease_until=deadline where match_id=mid;
 return deadline;
end $$;

create function empire_rewards.require_lease(mid uuid,host uuid) returns void
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype;
begin
 select * into strict a from empire_rewards.match_authority where match_id=mid for update;
 if host is null or a.host_id<>host or a.lease_until is null or a.lease_until<=clock_timestamp()
 then raise exception 'Host lease lost'; end if;
end $$;

create function empire_rewards.renew_online(mid uuid,host uuid) returns timestamptz
language plpgsql set search_path='' as $$
declare deadline timestamptz; state_now text;
begin
 perform empire_rewards.require_lease(mid,host);
 select state into strict state_now from empire_stones.match where id=mid for update;
 if state_now not in ('reserved','started') then raise exception 'Terminal match'; end if;
 deadline:=clock_timestamp()+interval '30 seconds';
 update empire_rewards.match_authority set lease_until=deadline where match_id=mid;
 return deadline;
end $$;

create function empire_rewards.start_leased(mid uuid,host uuid) returns void
language plpgsql set search_path='' as $$
begin
 perform empire_rewards.require_lease(mid,host);
 if (select count(*) from empire_rewards.active_online_seat where match_id=mid)<>10 then raise exception 'Seat fence missing'; end if;
 perform empire_rewards.start_online(mid,host);
end $$;

create function empire_rewards.finish_leased(mid uuid,host uuid,winner_team int,end_reason text,replay_sha256 text,participants jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype; receipt jsonb;
begin
 select * into strict a from empire_rewards.match_authority where match_id=mid for update;
 if host is null or a.host_id<>host then raise exception 'Wrong match host'; end if;
 -- Completed evidence retries remain readable after expiry, but cannot mutate rewards.
 if a.final_evidence is null then perform empire_rewards.require_lease(mid,host); end if;
 receipt:=empire_rewards.finish_online(mid,host,winner_team,end_reason,replay_sha256,participants);
 delete from empire_rewards.active_online_seat where match_id=mid;
 return receipt;
end $$;

create function empire_rewards.abort_leased(mid uuid,host uuid) returns void
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype; state_now text;
begin
 select * into strict a from empire_rewards.match_authority where match_id=mid for update;
 if host is null or a.host_id<>host then raise exception 'Wrong match host'; end if;
 select state into strict state_now from empire_stones.match where id=mid;
 if state_now not in ('invalid','cancelled') then perform empire_rewards.require_lease(mid,host); end if;
 perform empire_rewards.abort_online(mid,host);
 delete from empire_rewards.active_online_seat where match_id=mid;
end $$;

-- Trusted scheduled recovery only. At most ONE match per transaction to preserve lock order.
-- A worker must reconcile expired reservations before accepting new seats.
create function empire_rewards.recover_expired_online() returns uuid
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype; state_now text;
begin
 select x.* into a from empire_rewards.match_authority x
 where x.lease_until<=clock_timestamp() and
 exists(select 1 from empire_rewards.active_online_seat s where s.match_id=x.match_id)
 order by x.lease_until,x.match_id limit 1 for update of x skip locked;
 if not found then return null; end if;
 select state into strict state_now from empire_stones.match where id=a.match_id for update;
 if state_now in ('reserved','started') then perform empire_rewards.abort_online(a.match_id,a.host_id);
 elsif state_now not in ('cancelled','invalid','completed') then raise exception 'Unknown terminal state'; end if;
 delete from empire_rewards.active_online_seat where match_id=a.match_id;
 return a.match_id;
end $$;
revoke all on all tables in schema empire_rewards from public,anon,authenticated;
revoke all on all functions in schema empire_rewards from public,anon,authenticated;
-- Never grant the unfenced legacy functions to the runtime worker.
commit;
