
-- Season 2 marketing ONLY. No BUKLOD gameplay, points, finance or Expo OTA.
create table private.buklod_s2_promo_events_2026 (
  event_key text primary key,
  scheduled_at timestamptz not null unique,
  title text not null,
  body text not null,
  home_message text not null check (char_length(home_message)<=2000),
  published_at timestamptz,
  enqueued_count integer not null default 0
);
create table private.buklod_s2_promo_home_state_2026(
  singleton boolean primary key default true check(singleton),
  original_message text not null,
  original_active boolean not null,
  original_updated_by uuid,
  last_message text,
  last_at timestamptz,
  admin_override boolean not null default false,
  closed_at timestamptz,
  restored boolean not null default false
);
create table private.buklod_s2_promo_deliveries_2026(
  event_key text not null references private.buklod_s2_promo_events_2026(event_key),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  queued_at timestamptz not null default now(),
  primary key(event_key,user_id)
);
alter table private.buklod_s2_promo_events_2026 enable row level security;
alter table private.buklod_s2_promo_home_state_2026 enable row level security;
alter table private.buklod_s2_promo_deliveries_2026 enable row level security;
revoke all on private.buklod_s2_promo_events_2026 from public,anon,authenticated;
revoke all on private.buklod_s2_promo_home_state_2026 from public,anon,authenticated;
revoke all on private.buklod_s2_promo_deliveries_2026 from public,anon,authenticated;

insert into private.buklod_s2_promo_events_2026(event_key,scheduled_at,title,body,home_message) values
('reveal','2026-11-22 10:00:00+08','BUKLOD Season 2: Rise Together',
 'May bagong kabanata sa BUKLOD! Rise Together - Ang Panibagong Yugto ay target sa December 6. Abangan ang 13 Character Guides. Preview pa lamang; wala pang live rewards.',
 'SEASON 2 REVEAL | RISE TOGETHER - ANG PANIBAGONG YUGTO. Target: December 6! Bagong adventures at 13 Character Guides. Preview lamang; walang live mission o reward.'),
('paths','2026-11-29 10:00:00+08','BUKLOD Season 2: Your adventure',
 'Explorer, Creator, o Together? Kilalanin ang tatlong optional paths. December 6 ang target premiere; walang sapilitang participation o live item unlock.',
 'SEASON 2 | CHOOSE YOUR JOURNEY: Explorer, Creator o Together. Optional at open sa lahat; December 6 ang target opening. Wala pang gameplay unlock.'),
('prepare','2026-12-03 10:00:00+08','BUKLOD Season 2: Preparation',
 'Tatlong araw na lang sa December 6 target. Abangan ang rules at verified release update. Mananatili ang earned BP, Character levels at items.',
 'SEASON 2 | PREPARE FOR DECEMBER 6. Panatilihin ang iyong lifetime BP, Character levels at earned items. Optional ang Season challenges; verified launch pa rin ang kailangan.'),
('countdown','2026-12-05 10:00:00+08','BUKLOD Season 2: Target tomorrow',
 'Bukas ang target premiere ng Rise Together! Aabisuhan ka kapag verified ang release; hindi pa unlocked ang preview items at missions.',
 'SEASON 2 | TARGET TOMORROW: DECEMBER 6. Rise Together - Ang Panibagong Yugto! Maghintay sa verified launch announcement bago ituring na live ang missions at rewards.'),
('target','2026-12-06 10:00:00+08','BUKLOD Season 2: Launch status',
 'December 6 ang target premiere. Hintayin ang hiwalay na verified live-launch announcement; hindi awtomatikong aktibo ang missions, badges at rewards dahil lang sa petsa.',
 'SEASON 2 | DECEMBER 6 TARGET. Maghintay sa official verified-launch update. Hindi pa awtomatikong unlocked ang Season 2 missions, badges at items.');

create or replace function private.buklod_s2_promo_tick_2026()
returns jsonb language plpgsql security definer set search_path='' as $body$
declare
  v_now timestamptz:=clock_timestamp();
  v_day date:=(v_now at time zone 'Asia/Manila')::date;
  v_time time:=(v_now at time zone 'Asia/Manila')::time;
  e record; b record; s record; u record;
  nid uuid; cnt integer:=0;
begin
  if not pg_try_advisory_xact_lock(2026,1206) then return jsonb_build_object('status','locked');end if;
  if v_day>date '2026-12-07' then
    perform cron.unschedule('buklod-season2-production-promos-2026');
    return jsonb_build_object('status','ended');
  end if;
  if v_time<time '10:00' or v_time>=time '18:00' then return jsonb_build_object('status','quiet_hours');end if;

  if v_day>=date '2026-12-07' then
    select * into s from private.buklod_s2_promo_home_state_2026 where singleton for update;
    if found and s.closed_at is null then
      select * into b from public.buklod_system_announcement_boards where slot='public_home' for update;
      if found and not s.admin_override and b.message is not distinct from s.last_message and b.updated_at is not distinct from s.last_at then
        update public.buklod_system_announcement_boards
        set message=s.original_message,is_active=s.original_active,updated_by=s.original_updated_by,updated_at=v_now
        where slot='public_home';
        update private.buklod_s2_promo_home_state_2026 set closed_at=v_now,restored=true where singleton;
      else
        update private.buklod_s2_promo_home_state_2026 set closed_at=v_now,admin_override=true where singleton;
      end if;
    end if;
    return jsonb_build_object('status','closed');
  end if;

  select * into e from private.buklod_s2_promo_events_2026
    where (scheduled_at at time zone 'Asia/Manila')::date=v_day and scheduled_at<=v_now
    order by scheduled_at limit 1;
  if not found then return jsonb_build_object('status','not_due','day',v_day);end if;

  if e.published_at is null then
    select * into b from public.buklod_system_announcement_boards where slot='public_home' for update;
    if not found then raise exception 'Required Public Home announcement board missing';end if;
    insert into private.buklod_s2_promo_home_state_2026(singleton,original_message,original_active,original_updated_by)
      values(true,b.message,b.is_active,b.updated_by) on conflict(singleton) do nothing;
    select * into s from private.buklod_s2_promo_home_state_2026 where singleton for update;
    if not s.admin_override then
      if s.last_message is not null and
         (b.message is distinct from s.last_message or b.updated_at is distinct from s.last_at) then
         update private.buklod_s2_promo_home_state_2026 set admin_override=true where singleton;
      else
         update public.buklod_system_announcement_boards
           set message=e.home_message,is_active=true,updated_by=null,updated_at=v_now where slot='public_home';
         update private.buklod_s2_promo_home_state_2026 set last_message=e.home_message,last_at=v_now where singleton;
      end if;
    end if;
    update private.buklod_s2_promo_events_2026 set published_at=v_now where event_key=e.event_key;
  end if;

  -- Existing device token indicates OS notification permission; respect
  -- announcement opt-out. Only Manila daytime; max 20 per 15 minutes.
  for u in
    select p.id from public.profiles p
    left join public.notification_preferences pref on pref.user_id=p.id
    where p.is_active=true and p.user_deactivated_at is null
      and (pref.user_id is null or pref.announcements=true)
      and exists(select 1 from public.device_tokens dt
        where dt.user_id=p.id and dt.expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[')
      and not exists(select 1 from private.buklod_s2_promo_deliveries_2026 d
        where d.event_key=e.event_key and d.user_id=p.id)
    order by p.id limit 20
  loop
    insert into private.buklod_s2_promo_deliveries_2026(event_key,user_id)
      values(e.event_key,u.id) on conflict do nothing;
    if found then
      nid:=public.queue_notification(u.id,e.title,e.body,'announcement_season2',
        jsonb_build_object('source','buklod_season2_promo_2026','milestone',e.event_key,
          'dedupe_key','season2-promo-2026:'||e.event_key,'season2_content_live',false));
      if nid is null then raise exception 'Failed to enqueue opted-in notification';end if;
      update private.buklod_s2_promo_deliveries_2026 set notification_id=nid
        where event_key=e.event_key and user_id=u.id;
      cnt:=cnt+1;
    end if;
  end loop;
  update private.buklod_s2_promo_events_2026 set enqueued_count=enqueued_count+cnt where event_key=e.event_key;
  return jsonb_build_object('status','active','event',e.event_key,'queued',cnt,'day',v_day);
end;
$body$;
revoke all on function private.buklod_s2_promo_tick_2026() from public,anon,authenticated;
select cron.schedule('buklod-season2-production-promos-2026',
 '0,15,30,45 2-9 * * *','select private.buklod_s2_promo_tick_2026();');
