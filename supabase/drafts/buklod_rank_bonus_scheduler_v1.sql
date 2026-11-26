-- DEV candidate only; apply after ledger, redemption and style migrations.
-- Requires pg_cron. Keep disabled until isolated DB tests, queue delivery and
-- actual signed AdMob callbacks pass; never couple to BP claims.
begin;
create table private.buklod_rank_bonus_scheduler_v1(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
alter table private.buklod_rank_bonus_scheduler_v1 enable row level security;
revoke all on private.buklod_rank_bonus_scheduler_v1 from public,anon,authenticated;
insert into private.buklod_rank_bonus_scheduler_v1(singleton,enabled) values(true,false);
create or replace function private.buklod_rank_bonus_tick_v1()
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.buklod_rank_bonus_scheduler_v1 where singleton and enabled) then return;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('buklod:rank-bonus:tick:v1',0)) then return;end if;
 if not exists(select 1 from private.buklod_rank_bonus_catalog_v1 where enabled) then return;end if;
 perform private.buklod_rank_bonus_sync_batch_v1(100);
 perform private.buklod_rank_bonus_remind_v1(100);
 -- Keep all consumed sessions / transaction IDs for replay protection.
 -- Preserve a generous window for delayed signed callbacks.
 delete from private.buklod_rank_bonus_ad_sessions_v1 where id in (
  select s.id from private.buklod_rank_bonus_ad_sessions_v1 s
   where s.consumed_at is null and s.expires_at<now()-interval '30 days'
   and not exists(select 1 from private.buklod_rank_bonus_ad_events_v1 e where e.session_id=s.id)
   order by s.expires_at limit 100 for update of s skip locked
 );
end $$;
revoke all on function private.buklod_rank_bonus_tick_v1() from public,anon,authenticated;
select cron.schedule('buklod-rank-bonus-v1','*/15 * * * *','select private.buklod_rank_bonus_tick_v1()');
commit;
