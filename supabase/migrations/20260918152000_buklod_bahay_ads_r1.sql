-- BUKLOD Bahay Ads R1
-- Optional rewarded Garden boost. Non-cash, non-transferable, max 3 grants/user/home/day.

create table if not exists public.buklod_home_ad_rewards (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_kind text not null default 'GARDEN_ENERGY' check (reward_kind in ('GARDEN_ENERGY')),
  reward_token text not null,
  reward_date date not null default (timezone('Asia/Manila',now()))::date,
  created_at timestamptz not null default now(),
  unique(user_id,reward_token)
);

create index if not exists buklod_home_ad_rewards_daily_idx
on public.buklod_home_ad_rewards(home_id,user_id,reward_date);

alter table public.buklod_home_ad_rewards enable row level security;

drop policy if exists "Bahay users read own ad rewards" on public.buklod_home_ad_rewards;
create policy "Bahay users read own ad rewards"
on public.buklod_home_ad_rewards
for select to authenticated
using(user_id=(select auth.uid()) and public.buklod_home_is_member(home_id));

revoke insert,update,delete on public.buklod_home_ad_rewards from anon,authenticated;
grant select on public.buklod_home_ad_rewards to authenticated;

create or replace function public.buklod_home_rewarded_ad_grant_v1(
  p_home_id uuid,
  p_reward_token text
) returns table(granted boolean,remaining_today integer,garden_energy integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (timezone('Asia/Manila',now()))::date;
  v_count integer;
  v_energy integer;
  v_token text := left(btrim(coalesce(p_reward_token,'')),120);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.buklod_home_is_member(p_home_id) then raise exception 'Home membership required'; end if;
  if v_token='' then raise exception 'Reward token required'; end if;

  select count(*) into v_count
  from public.buklod_home_ad_rewards
  where home_id=p_home_id and user_id=v_user and reward_date=v_today;

  if v_count >= 3 then
    select h.garden_energy into v_energy from public.buklod_homes h where h.id=p_home_id;
    return query select false,0,coalesce(v_energy,0);
    return;
  end if;

  begin
    insert into public.buklod_home_ad_rewards(home_id,user_id,reward_token,reward_date)
    values(p_home_id,v_user,v_token,v_today);
  exception when unique_violation then
    select h.garden_energy into v_energy from public.buklod_homes h where h.id=p_home_id;
    return query select false,greatest(0,3-v_count),coalesce(v_energy,0);
    return;
  end;

  update public.buklod_homes
  set garden_energy=garden_energy+1,updated_at=now()
  where id=p_home_id
  returning buklod_homes.garden_energy into v_energy;

  return query select true,greatest(0,2-v_count),coalesce(v_energy,0);
end $$;

revoke all on function public.buklod_home_rewarded_ad_grant_v1(uuid,text) from public,anon;
grant execute on function public.buklod_home_rewarded_ad_grant_v1(uuid,text) to authenticated;
