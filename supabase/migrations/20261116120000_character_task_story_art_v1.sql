-- DEV ONLY. Additive BUKLOD Character task/story-object foundation.
-- Must pass SQL sandbox security/unit tests before migration promotion.
-- Existing Character V3 level authority, original core item RPC, Special badges,
-- Circle Rank, AdMob/QMP, finance and Kingdom Shards are not modified.

-- Public ART only. No anon/authenticated write policy; staff upload uses
-- server-side service-role credentials, never exposed by the client.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buklod-character-art-v1','buklod-character-art-v1',true,1048576,
  array['image/webp','application/json']::text[])
-- Never expose any pre-existing private bucket due to a name collision.
on conflict(id) do nothing;

-- This event ledger captures the active Character at *server receipt time*,
-- never from untrusted user input or later display-selection state.
create table if not exists private.buklod_character_task_events_v1(
 user_id uuid not null references auth.users(id) on delete cascade,
 character_id text not null check(character_id in
 ('phan','quin','van','christian','lhen','ace','ellusur','jawo',
  'mitch','niel','angel','vhen','trudice')),
 metric_key text not null check(metric_key in
 ('character_public_post','character_public_comment','character_public_reaction',
  'character_public_share','character_public_active_week','character_bible_reading',
  'character_devotional','character_formation','character_quiz',
  'character_attendance','character_prayer')),
 source_table text not null,
 source_id text not null,
 occurred_at timestamptz not null,
 verified boolean not null default true,
 captured_at timestamptz not null default now(),
 primary key(user_id,metric_key,source_table,source_id)
);
create index if not exists buklod_character_task_events_user_char_metric_idx
on private.buklod_character_task_events_v1(user_id,character_id,metric_key);
alter table private.buklod_character_task_events_v1 enable row level security;
revoke all on private.buklod_character_task_events_v1 from public,anon,authenticated;

create table if not exists private.buklod_character_story_awards_v1(
 user_id uuid not null references auth.users(id) on delete cascade,
 character_id text not null check(character_id in
 ('phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')),
 level_no integer not null check(level_no between 1 and 20),
 item_index integer not null check(item_index between 1 and 5),
 source_key text not null default 'verified_character_task_v1',
 task_snapshot jsonb not null default '{}'::jsonb,
 earned_at timestamptz not null default now(),
 primary key(user_id,character_id,level_no,item_index)
);
alter table private.buklod_character_story_awards_v1 enable row level security;
revoke all on private.buklod_character_story_awards_v1 from public,anon,authenticated;

create or replace function private.buklod_capture_character_task_event_v1()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare v_character text;
begin
 if new.user_id is null or new.metric_key not in
 ('character_public_post','character_public_comment','character_public_reaction',
  'character_public_share','character_public_active_week')
 then return new; end if;

 select s.character_id into v_character
 from private.buklod_character_selection_v2 s
 where s.user_id=new.user_id;
 v_character:=coalesce(v_character,'phan');

 insert into private.buklod_character_task_events_v1
 (user_id,character_id,metric_key,source_table,source_id,occurred_at)
 values(new.user_id,v_character,new.metric_key,new.source_table,new.source_id,new.occurred_at)
 on conflict do nothing;
 return new;
end;
$fn$;
drop trigger if exists trg_buklod_capture_character_task_event_v1
on private.buklod_character_public_events_v3;
create trigger trg_buklod_capture_character_task_event_v1
after insert on private.buklod_character_public_events_v3
for each row execute function private.buklod_capture_character_task_event_v1();

-- A second independent evidence adapter uses the EXISTING BUKLOD Points ledger.
-- Only server-created/claimed credit records count. The only live ledger RLS
-- policy grants member SELECT, not INSERT or UPDATE; clients cannot forge it.
-- IMPORTANT: capture the Character when a credit record FIRST arrives. If
-- claiming is delayed, its original Character attribution survives a switch.
-- New event accrual begins only after this migration; historical credits are
-- intentionally NOT backfilled to an arbitrary currently-active Character.
create or replace function private.buklod_capture_verified_ledger_task_v1()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare
 v_character text;
 v_metric text;
 v_verified boolean;
begin
 if new.user_id is null or lower(coalesce(new.direction,'')) <> 'credit'
   or coalesce(new.points,0)<=0 then return new; end if;
 v_metric:=case lower(coalesce(new.activity_type,''))
  when 'daily_bible' then 'character_bible_reading'
  when 'devotional' then 'character_devotional'
  when 'abc_growth_lesson' then 'character_formation'
  when 'learning_progress_verification' then 'character_formation'
  when 'bible_quiz_easy' then 'character_quiz'
  when 'bible_quiz_medium' then 'character_quiz'
  when 'bible_quiz_hard' then 'character_quiz'
  when 'scope_attendance' then 'character_attendance'
  when 'prayer_response' then 'character_prayer'
  else null
 end;
 if v_metric is null then return new; end if;

 v_verified:=lower(coalesce(new.claim_state,''))='claimed';
 -- Only pending or claimed events are eligible for an immutable attribution.
 if not v_verified and lower(coalesce(new.claim_state,''))<>'pending' then
  -- A rejected/reversed claim cannot qualify as future task evidence.
  -- Already-issued cosmetic items require separate audited dispute handling.
  update private.buklod_character_task_events_v1 set verified=false
  where user_id=new.user_id and source_table='buklod_points_ledger'
    and source_id=new.id::text;
  return new;
 end if;

 -- In normal use this row was created on INSERT, before a delayed claim.
 -- On UPDATE we never replace its original Character or activity timestamp.
 select s.character_id into v_character
 from private.buklod_character_selection_v2 s where s.user_id=new.user_id;
 v_character:=coalesce(v_character,'phan');

 insert into private.buklod_character_task_events_v1(
  user_id,character_id,metric_key,source_table,source_id,occurred_at,verified)
 values(new.user_id,v_character,v_metric,'buklod_points_ledger',
   new.id::text,coalesce(new.created_at,now()),v_verified)
 on conflict(user_id,metric_key,source_table,source_id) do update
  set verified=excluded.verified;
 return new;
end;
$fn$;
drop trigger if exists trg_buklod_capture_verified_ledger_task_v1
on public.buklod_points_ledger;
create trigger trg_buklod_capture_verified_ledger_task_v1
after insert or update of claim_state on public.buklod_points_ledger
for each row execute function private.buklod_capture_verified_ledger_task_v1();

-- Five independent task slots, each with two genuine ways to progress:
-- (1) meaningful Wall posts OR claimed Bible reading;
-- (2) meaningful Wall comments OR claimed devotional/Formation learning;
-- (3) eligible reactions OR claimed Bible quiz;
-- (4) eligible shares OR claimed scope attendance/prayer response;
-- (5) distinct verified active weeks AND slots 1-4.
-- A claimed credit is a verification signal; NO additional BP/AdMob/QMP/Shard
-- reward is minted here. All task sources are tagged to a server-saved Character.
-- Player can advance without being forced to spam the public Wall.
create or replace function private.buklod_evaluate_character_story_tasks_v1(
 p_uid uuid,p_character text,p_level integer
)returns integer
language plpgsql security definer set search_path=''
as $fn$
declare
 v_posts integer:=0;v_comments integer:=0;v_reactions integer:=0;
 v_shares integer:=0;v_weeks integer:=0;
 v_bible integer:=0;v_devotional integer:=0;v_formation integer:=0;
 v_quiz integer:=0;v_attendance integer:=0;v_prayer integer:=0;
 v_awarded integer:=0;
begin
 if p_uid is null or p_character not in
 ('phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
 or p_level<1 or p_level>20 then return 0; end if;

 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod_story_award_v1'),
   pg_catalog.hashtext(p_uid::text||':'||p_character));

 select count(*) filter(where metric_key='character_public_post'),
  count(*) filter(where metric_key='character_public_comment'),
  count(*) filter(where metric_key='character_public_reaction'),
  count(*) filter(where metric_key='character_public_share'),
  count(distinct date_trunc('week',occurred_at at time zone 'Asia/Manila')),
  count(*) filter(where metric_key='character_bible_reading'),
  count(*) filter(where metric_key='character_devotional'),
  count(*) filter(where metric_key='character_formation'),
  count(*) filter(where metric_key='character_quiz'),
  count(*) filter(where metric_key='character_attendance'),
  count(*) filter(where metric_key='character_prayer')
 into v_posts,v_comments,v_reactions,v_shares,v_weeks,
  v_bible,v_devotional,v_formation,v_quiz,v_attendance,v_prayer
 from private.buklod_character_task_events_v1
 where user_id=p_uid and character_id=p_character and verified=true;

 -- Set based: source activities never duplicate across reward reads/retries.
 with candidates as (
  select stage.level_no,slot.item_index,
   case slot.item_index
    when 1 then 'character_public_post'
    when 2 then 'character_public_comment'
    when 3 then 'character_public_reaction'
    when 4 then 'character_public_share'
   end as metric,
   case slot.item_index
    when 1 then greatest(1,(stage.level_no+1)/2)
    when 2 then greatest(1,stage.level_no)
    when 3 then greatest(2,stage.level_no*2)
    when 4 then greatest(1,(stage.level_no+1)/2)
   end as target
  from generate_series(1,p_level) as stage(level_no)
   cross join generate_series(1,4) as slot(item_index)
 ), earned as (
  select c.* from candidates c
  where case c.item_index
   when 1 then v_posts>=c.target or v_bible>=c.target
   when 2 then v_comments>=c.target or (v_formation+v_devotional)>=c.target
   when 3 then v_reactions>=c.target or v_quiz>=c.target
   when 4 then v_shares>=c.target or (v_attendance+v_prayer)>=c.target
   else false end
 )
 insert into private.buklod_character_story_awards_v1
 (user_id,character_id,level_no,item_index,task_snapshot)
 select p_uid,p_character,e.level_no,e.item_index,
  jsonb_build_object('metric',e.metric,'target',e.target,'authority','server_verified_character_tasks_v1',
   'alternative',case e.item_index
    when 1 then 'character_bible_reading'
    when 2 then 'character_formation_or_devotional'
    when 3 then 'character_quiz'
    when 4 then 'character_attendance_or_prayer' end)
 from earned e on conflict do nothing;

 -- All four other items AND distinct verified active weeks are mandatory.
 insert into private.buklod_character_story_awards_v1
 (user_id,character_id,level_no,item_index,task_snapshot)
 select p_uid,p_character,s.level_no,5,
  jsonb_build_object('metric','character_public_active_week',
  'target',greatest(1,(s.level_no+3)/4),'requires_items',jsonb_build_array(1,2,3,4),
  'authority','server_verified_character_tasks_v1')
 from generate_series(1,p_level) as s(level_no)
 where v_weeks>=greatest(1,(s.level_no+3)/4)
   and (select count(*) from private.buklod_character_story_awards_v1 a
    where a.user_id=p_uid and a.character_id=p_character
      and a.level_no=s.level_no and a.item_index between 1 and 4)=4
 on conflict do nothing;

 select count(*) into v_awarded from private.buklod_character_story_awards_v1 a
 where a.user_id=p_uid and a.character_id=p_character;
 return v_awarded;
end;
$fn$;

-- Task evidence now covers all 1,300 objects. Core legacy claims stay intact.
-- Verified task awards merge by canonical slot; existing BP and Shards unchanged.
create or replace function public.get_my_buklod_character_story_tasks_v1(
 p_character_id text
)returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
 v_uid uuid:=(select auth.uid());
 v_character text:=lower(btrim(coalesce(p_character_id,'')));
 v_state jsonb;
 v_level integer:=1;
 v_items jsonb:='[]'::jsonb;
 v_metrics jsonb:='{}'::jsonb;
 v_total integer:=0;
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 if v_character not in
 ('phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
 then raise exception 'Unsupported Character';end if;

 v_state:=public.get_my_buklod_character_selection_v2();
 if v_character in ('ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
 and not (coalesce(v_state->'visible_special_character_ids','[]'::jsonb) ? v_character)
 then raise exception 'Special Character is not unlocked'; end if;

 v_level:=greatest(1,least(20,
   coalesce((v_state->'character_levels'->>v_character)::integer,1)));

 perform private.buklod_evaluate_character_story_tasks_v1(v_uid,v_character,v_level);

 select jsonb_build_object(
  'character_public_post',count(*) filter(where metric_key='character_public_post'),
  'character_public_comment',count(*) filter(where metric_key='character_public_comment'),
  'character_public_reaction',count(*) filter(where metric_key='character_public_reaction'),
  'character_public_share',count(*) filter(where metric_key='character_public_share'),
  'character_public_active_week',count(distinct date_trunc('week',occurred_at at time zone 'Asia/Manila')),
  'character_bible_reading',count(*) filter(where metric_key='character_bible_reading'),
  'character_devotional',count(*) filter(where metric_key='character_devotional'),
  'character_formation',count(*) filter(where metric_key='character_formation'),
  'character_quiz',count(*) filter(where metric_key='character_quiz'),
  'character_attendance',count(*) filter(where metric_key='character_attendance'),
  'character_prayer',count(*) filter(where metric_key='character_prayer')
 ) into v_metrics
 from private.buklod_character_task_events_v1
 where user_id=v_uid and character_id=v_character and verified=true;

 select coalesce(jsonb_agg(jsonb_build_object(
   'level',stage.level_no,'item_index',slot.item_index,
   'key',v_character||':L'||lpad(stage.level_no::text,2,'0')
         ||':I'||lpad(slot.item_index::text,2,'0'),
   'owned',award.earned_at is not null,
   'earned_at',award.earned_at,
   'task_snapshot',case when award.earned_at is not null
     then award.task_snapshot else '{}'::jsonb end
 ) order by stage.level_no,slot.item_index),'[]'::jsonb)
 into v_items
 from generate_series(1,20) as stage(level_no)
 cross join generate_series(1,5) as slot(item_index)
 left join private.buklod_character_story_awards_v1 award
  on award.user_id=v_uid and award.character_id=v_character
  and award.level_no=stage.level_no and award.item_index=slot.item_index;

 select count(*) into v_total from private.buklod_character_story_awards_v1 a
 where a.user_id=v_uid and a.character_id=v_character;
 return jsonb_build_object('character_id',v_character,
  'current_level',v_level,'task_scope','PER_CHARACTER_SERVER_VERIFIED_BUKLOD_TASKS',
  'items',v_items,'metrics',v_metrics,'owned_total',v_total);
end;
$fn$;
revoke all on function private.buklod_capture_character_task_event_v1() from public,anon,authenticated;
revoke all on function private.buklod_capture_verified_ledger_task_v1() from public,anon,authenticated;
revoke all on function private.buklod_evaluate_character_story_tasks_v1(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.get_my_buklod_character_story_tasks_v1(text) from public,anon;
grant execute on function public.get_my_buklod_character_story_tasks_v1(text) to authenticated;
