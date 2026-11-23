-- BUKLOD Points V4 (approved 2026-11-24), additive and forward-only.
-- Runtime/financial gate: apply to verified STAGING first. This is NOT a
-- community QMP, revenue, settlement, cash, or historical-points migration.
-- New Connect BP never depends on ad impressions, clicks, or rewarded ads.
-- DO NOT re-credit old messages or edit finalized month records.

update public.buklod_point_rules
set base_points=3, max_points_per_event=3, daily_cap_points=9,
    weekly_cap_points=42, updated_at=now(),
    notes='Approved +3 meaningful Community Dugtong; anti-duplicate and caps enforced by source workflow'
where activity_type='community_dugtong';

update public.buklod_point_rules
set base_points=3, max_points_per_event=3, daily_cap_points=3,
    weekly_cap_points=3, updated_at=now(),
    notes='Approved +3 first BUKLOD Today Dugtong per cycle/week; no credit on edit'
where activity_type='weekly_tip_dugtong';

insert into public.buklod_point_rules (
 activity_type,label,base_points,max_points_per_event,daily_cap_points,
 weekly_cap_points,is_active,notes
) values
 ('connect_message','Verified Connect Message',1,1,20,140,true,
  'Server-side message proof, 20 per Asia/Manila day, 45 second spacing, 7-day exact duplicate exclusion; never QMP or ad-view based'),
 ('todays_best_story','Today''s Best Story',2,2,6,42,false,'Await canonical verified story-specific integration before activation'),
 ('todays_best_comment','Today''s Best Comment',2,2,10,70,false,'Await Wall/R37 shared anti-farming and source detection'),
 ('todays_best_reaction','Today''s Best Reaction',1,1,5,35,false,'Await Wall/R37 qualified reaction routing'),
 ('todays_best_streak','Today''s Best 7-day Streak',10,10,10,10,false,'Await seven distinct server-verifiable daily completions'),
 ('child_story_complete','Children Story and Questions',5,5,20,140,false,'Await secure server-authoritative story quiz answers'),
 ('child_teaching_session','Children Story Teaching',10,10,20,70,false,'Await private photo evidence and duplicate-safe completion validator'),
 ('personal_bible_reflection','Personal Bible Reading and Reflection',10,10,30,210,false,'Separate from Daily Reading; await canonical chapter and rubric validation'),
 ('bayanihan_verified_action','Verified Bayanihan Action',50,50,100,200,false,'AI evidence check plus distinct authorized Cluster Admin approval required')
on conflict(activity_type) do nothing;

-- A validated event is recognized only after the message exists in one of the
-- canonical Connect tables. There is NO public API to mint arbitrary points.
create or replace function private.buklod_points_connect_message_v4()
returns trigger language plpgsql security definer set search_path = ''
as $connect$
declare
 v_actor uuid := (select auth.uid());
 v_text text;
 v_words integer;
 v_daily integer;
 v_pts integer;
 v_source text;
 v_today date := (now() at time zone 'Asia/Manila')::date;
begin
 if new.sender_id is null or new.deleted_at is not null or
    v_actor is null or v_actor <> new.sender_id or
    nullif(pg_catalog.btrim(coalesce(new.body,'')),'') is null then
   return new;
 end if;
 if not exists(
   select 1 from public.profiles p where p.id=new.sender_id and p.is_active=true
 ) or private.buklod_is_platform_official_v1(new.sender_id) then
   return new;
 end if;
 v_text:=lower(pg_catalog.regexp_replace(
   pg_catalog.btrim(coalesce(new.body,'')), '[^[:alnum:][:space:]]', '', 'g'));
 v_text:=pg_catalog.regexp_replace(v_text, '[[:space:]]+', ' ', 'g');
 v_words:=coalesce(pg_catalog.array_length(pg_catalog.regexp_split_to_array(v_text,' '),1),0);
 if pg_catalog.char_length(v_text)<15 or v_words<3 or
    v_text in ('good morning everyone','good evening everyone',
               'thank you everyone','amen amen amen') then
   return new;
 end if;

 -- The advisory lock serializes daily cap and velocity for a single member.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod-connect-v4'),
   pg_catalog.hashtext(new.sender_id::text));

 -- 45-second gap between rewardable messages across rooms; sending remains
 -- unrestricted. Source keys survive deletion, retries, client restarts and claims.
 if exists (
   select 1 from public.buklod_points_ledger l
   where l.user_id=new.sender_id and l.activity_type='connect_message'
     and l.direction='credit' and l.created_at>now()-interval '45 seconds'
 ) then return new; end if;

 -- Identical messages in any chat in the last seven days are not rewardable.
 -- Nothing about private message text is sent to AI or written to new metadata.
 if exists (
   select 1 from public.buklod_connect_scope_messages m
   where m.sender_id=new.sender_id and m.id<>new.id
     and m.created_at>now()-interval '7 days'
     and lower(pg_catalog.regexp_replace(
       pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(m.body,'')),
       '[^[:alnum:][:space:]]','','g'),'[[:space:]]+',' ','g'))=v_text
 ) or exists (
   select 1 from public.buklod_connect_direct_messages m
   where m.sender_id=new.sender_id and m.id<>new.id
     and m.created_at>now()-interval '7 days'
     and lower(pg_catalog.regexp_replace(
       pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(m.body,'')),
       '[^[:alnum:][:space:]]','','g'),'[[:space:]]+',' ','g'))=v_text
 ) then return new; end if;

 select count(*)::integer into v_daily
 from public.buklod_points_ledger l
 where l.user_id=new.sender_id and l.activity_type='connect_message'
   and l.direction='credit'
   and (l.created_at at time zone 'Asia/Manila')::date=v_today;
 if v_daily>=20 then return new; end if;
 select least(r.base_points,r.max_points_per_event,1) into v_pts
 from public.buklod_point_rules r
 where r.activity_type='connect_message' and r.is_active=true;
 if coalesce(v_pts,0)<>1 then return new; end if;

 v_source:='connect:'||
   case when tg_table_name='buklod_connect_scope_messages' then 'scope:' else 'direct:' end
   ||new.id::text;
 insert into public.buklod_points_ledger(
   user_id,direction,points,activity_type,source_key,source_id,description,awarded_by
 ) values(new.sender_id,'credit',v_pts,'connect_message',v_source,new.id,
          'Verified Connect participation',null::uuid)
 on conflict(user_id,source_key) do nothing;
 return new;
end;
$connect$;
revoke all on function private.buklod_points_connect_message_v4()
 from public,anon,authenticated;
drop trigger if exists buklod_connect_scope_points_v4 on public.buklod_connect_scope_messages;
create trigger buklod_connect_scope_points_v4
 after insert on public.buklod_connect_scope_messages for each row
 execute function private.buklod_points_connect_message_v4();
drop trigger if exists buklod_connect_direct_points_v4 on public.buklod_connect_direct_messages;
create trigger buklod_connect_direct_points_v4
 after insert on public.buklod_connect_direct_messages for each row
 execute function private.buklod_points_connect_message_v4();

comment on function private.buklod_points_connect_message_v4() is
 'BUKLOD Connect Points V4: authenticated actor, 3 words/15 chars, duplicate exclusion, 45 sec velocity and 20/day cap. No ad or QMP linkage.';
