-- BUKLOD IGPAT R62 extension — Squad and Last Man Standing meaningful events.

create or replace function public.buklod_igpat_notify_squad_member_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare squad_name text;
begin
  if new.status='INVITED' and (tg_op='INSERT' or old.status is distinct from new.status) then
    select s.display_name into squad_name from public.igpat_arena_squads s where s.id=new.squad_id;
    perform public.buklod_queue_notification_once_v1(
      new.user_id,'IGPAT Squad invitation',coalesce(squad_name,'An Arena Squad') || ' invited you to join.',
      'igpat_squad_invite',jsonb_build_object('route','/igpat/arena/squad','squad_id',new.squad_id),
      'igpat-squad-invite:'||new.squad_id::text||':'||new.user_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists buklod_igpat_squad_member_notify_v1 on public.igpat_arena_squad_members;
create trigger buklod_igpat_squad_member_notify_v1
after insert or update of status on public.igpat_arena_squad_members
for each row execute function public.buklod_igpat_notify_squad_member_v1();

create or replace function public.buklod_igpat_notify_squad_match_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare challenger_captain uuid; opponent_captain uuid; uid uuid;
begin
  select s.captain_user_id into challenger_captain from public.igpat_arena_squads s where s.id=new.challenger_squad_id;
  select s.captain_user_id into opponent_captain from public.igpat_arena_squads s where s.id=new.opponent_squad_id;
  if tg_op='INSERT' and new.status='OPEN' and opponent_captain is not null then
    perform public.buklod_queue_notification_once_v1(opponent_captain,'IGPAT Squad challenge','Your Squad received a new challenge.','igpat_squad_challenge',jsonb_build_object('route','/igpat/arena/squad','match_id',new.id),'igpat-squad-match-open:'||new.id::text||':'||opponent_captain::text);
  elsif old.status is distinct from new.status and new.status='ACCEPTED' and challenger_captain is not null then
    perform public.buklod_queue_notification_once_v1(challenger_captain,'IGPAT Squad challenge accepted','The opposing Squad accepted your challenge.','igpat_squad_accepted',jsonb_build_object('route','/igpat/arena/squad','match_id',new.id),'igpat-squad-match-accepted:'||new.id::text||':'||challenger_captain::text);
  elsif old.status is distinct from new.status and new.status='COMPLETED' then
    for uid in
      select m.user_id from public.igpat_arena_squad_members m where m.squad_id in (new.challenger_squad_id,new.opponent_squad_id) and m.status='ACTIVE'
    loop
      perform public.buklod_queue_notification_once_v1(uid,'IGPAT Squad result ready','Your Squad battle result is ready.','igpat_squad_result',jsonb_build_object('route','/igpat/arena/squad','match_id',new.id),'igpat-squad-match-complete:'||new.id::text||':'||uid::text);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists buklod_igpat_squad_match_notify_v1 on public.igpat_arena_squad_matches;
create trigger buklod_igpat_squad_match_notify_v1
after insert or update of status on public.igpat_arena_squad_matches
for each row execute function public.buklod_igpat_notify_squad_match_v1();

create or replace function public.buklod_igpat_notify_lms_participant_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and old.status is distinct from new.status then
    if new.status='ELIMINATED' then
      perform public.buklod_queue_notification_once_v1(new.user_id,'IGPAT Last Man Standing','Your run ended this round. No public shame—your completed rounds remain part of your Arena record.','igpat_lms_eliminated',jsonb_build_object('route','/igpat/arena/last-man','event_id',new.event_id,'round',new.eliminated_round),'igpat-lms-eliminated:'||new.event_id::text||':'||new.user_id::text);
    elsif new.status='CHAMPION' then
      perform public.buklod_queue_notification_once_v1(new.user_id,'IGPAT Last Man Standing Champion','You completed the deterministic elimination event as champion.','igpat_lms_champion',jsonb_build_object('route','/igpat/arena/last-man','event_id',new.event_id),'igpat-lms-champion:'||new.event_id::text||':'||new.user_id::text);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists buklod_igpat_lms_participant_notify_v1 on public.igpat_arena_lms_participants;
create trigger buklod_igpat_lms_participant_notify_v1
after update of status on public.igpat_arena_lms_participants
for each row execute function public.buklod_igpat_notify_lms_participant_v1();

create or replace function public.buklod_igpat_notify_lms_round_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if tg_op='UPDATE' and new.status='ACTIVE' and (old.status is distinct from new.status or old.current_round is distinct from new.current_round) then
    for uid in select p.user_id from public.igpat_arena_lms_participants p where p.event_id=new.id and p.status='ACTIVE'
    loop
      perform public.buklod_queue_notification_once_v1(uid,'IGPAT Last Man Standing · Round '||new.current_round::text,'Your next elimination round is ready for a real IGPAT submission.','igpat_lms_round',jsonb_build_object('route','/igpat/arena/last-man','event_id',new.id,'round',new.current_round),'igpat-lms-round:'||new.id::text||':'||new.current_round::text||':'||uid::text);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists buklod_igpat_lms_round_notify_v1 on public.igpat_arena_lms_events;
create trigger buklod_igpat_lms_round_notify_v1
after update of status,current_round on public.igpat_arena_lms_events
for each row execute function public.buklod_igpat_notify_lms_round_v1();
