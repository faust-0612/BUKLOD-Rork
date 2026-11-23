-- BUKLOD Children Stories server-scored reading+quiz V4.
-- Only an ADULT account ID is stored. Never collect child names or public
-- child evidence. Replays, edits, retries, duplicate requests: zero new BP.
-- Quiz answers generated deterministically from the exact bundled source at
-- faust-0612/BUKLOD-Rork; 144 distinct stories. Published edited stories are
-- NOT rewardable until their authoritative answer keys are approved.
-- No QMP, ad view, cash, or historical ledger mutation.
create table if not exists private.buklod_children_story_quiz_keys_v4 (
 story_id text primary key,
 story_version integer not null check(story_version>0),
 answers integer[] not null,
 min_read_seconds integer not null check(min_read_seconds between 30 and 600)
);
revoke all on table private.buklod_children_story_quiz_keys_v4
 from public,anon,authenticated;
insert into private.buklod_children_story_quiz_keys_v4
(story_id,story_version,answers,min_read_seconds) values
('maliit-na-ilaw',1,array[0,0,1,2]::integer[],60),
('david-at-ang-tapang',1,array[1,0,1,2]::integer[],60),
('bangka-ng-pag-asa',1,array[2,0,1,2]::integer[],60),
('si-pagong-at-ang-buto',1,array[0,0,1,2]::integer[],60),
('bituin-ni-bitu',1,array[1,0,1,2]::integer[],60),
('ang-mabuting-kapitbahay',1,array[2,0,1,2]::integer[],60),
('lola-sa-hardin',1,array[0,0,1,2]::integer[],60),
('alon-at-ang-kabibe',1,array[1,0,1,2]::integer[],60),
('si-jonas-at-ang-dagat',1,array[2,0,1,2]::integer[],60),
('tatlong-salitang-mahalaga',1,array[0,0,1,2]::integer[],60),
('puno-ng-pangarap',1,array[1,0,1,2]::integer[],60),
('gabi-ng-payapang-ulan',1,array[2,0,1,2]::integer[],60),
('paglikha',1,array[0,2,0,1]::integer[],90),
('eden',1,array[2,1,2,0]::integer[],90),
('cain-abel',1,array[1,0,1,2]::integer[],90),
('babel',1,array[0,2,0,1]::integer[],90),
('abraham-tawag',1,array[2,1,2,0]::integer[],90),
('abraham-bituin',1,array[0,2,0,1]::integer[],90),
('isaac-rebekah',1,array[2,1,2,0]::integer[],90),
('esau-jacob',1,array[2,1,2,0]::integer[],90),
('hagdan-jacob',1,array[1,0,1,2]::integer[],90),
('joseph-panaginip',1,array[2,1,2,0]::integer[],90),
('joseph-egipto',1,array[2,1,2,0]::integer[],90),
('joseph-patawad',1,array[0,2,0,1]::integer[],90),
('baby-moses',1,array[2,1,2,0]::integer[],90),
('naglalagablab-puno',1,array[1,0,1,2]::integer[],90),
('sampung-salot',1,array[2,1,2,0]::integer[],90),
('paskuwa',1,array[2,1,2,0]::integer[],90),
('dagat-pula',1,array[2,1,2,0]::integer[],90),
('manna',1,array[0,2,0,1]::integer[],90),
('sampung-utos',1,array[1,0,1,2]::integer[],90),
('guya-ginto',1,array[2,1,2,0]::integer[],90),
('tolda-pagsamba',1,array[0,2,0,1]::integer[],90),
('labindalawang-espiya',1,array[0,2,0,1]::integer[],90),
('balaam-asno',1,array[0,2,0,1]::integer[],90),
('jordan',1,array[1,0,1,2]::integer[],90),
('jerico',1,array[1,0,1,2]::integer[],90),
('rahab',1,array[0,2,0,1]::integer[],90),
('deborah',1,array[2,1,2,0]::integer[],90),
('gideon',1,array[1,0,1,2]::integer[],90),
('samson',1,array[1,0,1,2]::integer[],90),
('ruth-naomi',1,array[2,1,2,0]::integer[],90),
('samuel-tinawag',1,array[0,2,0,1]::integer[],90),
('saul-hari',1,array[1,0,1,2]::integer[],90),
('david-pinili',1,array[1,0,1,2]::integer[],90),
('david-jonathan',1,array[0,2,0,1]::integer[],90),
('david-saul-awa',1,array[0,2,0,1]::integer[],90),
('solomon-hatol',1,array[2,1,2,0]::integer[],90),
('solomon-templo',1,array[0,2,0,1]::integer[],90),
('elijah-ibon',1,array[0,2,0,1]::integer[],90),
('elijah-balo',1,array[0,2,0,1]::integer[],90),
('elijah-carmel',1,array[2,1,2,0]::integer[],90),
('elijah-mahinang-tinig',1,array[1,0,1,2]::integer[],90),
('naaman',1,array[1,0,1,2]::integer[],90),
('langis-balo',1,array[0,2,0,1]::integer[],90),
('josiah-aklat',1,array[1,0,1,2]::integer[],90),
('esther',1,array[1,0,1,2]::integer[],90),
('ezra',1,array[2,1,2,0]::integer[],90),
('nehemiah',1,array[0,2,0,1]::integer[],90),
('job',1,array[1,0,1,2]::integer[],90),
('isaiah-tawag',1,array[1,0,1,2]::integer[],90),
('jeremiah-bata',1,array[2,1,2,0]::integer[],90),
('daniel-pagkain',1,array[0,2,0,1]::integer[],90),
('apoy-tatlong-kaibigan',1,array[1,0,1,2]::integer[],90),
('daniel-leon',1,array[0,2,0,1]::integer[],90),
('ezekiel-buto',1,array[1,0,1,2]::integer[],90),
('hosea-habag',1,array[0,2,0,1]::integer[],90),
('micah-katarungan',1,array[2,1,2,0]::integer[],90),
('habakkuk-tiwala',1,array[1,0,1,2]::integer[],90),
('zacharias-elisabet',1,array[1,0,1,2]::integer[],90),
('maria-anghel',1,array[1,0,1,2]::integer[],90),
('joseph-panaginip-bethlehem',1,array[0,2,0,1]::integer[],90),
('kapanganakan-hesus',1,array[1,0,1,2]::integer[],90),
('mga-pastol',1,array[2,1,2,0]::integer[],90),
('mga-pantas',1,array[2,1,2,0]::integer[],90),
('paglikas-egipto',1,array[1,0,1,2]::integer[],90),
('jesus-templo-bata',1,array[0,2,0,1]::integer[],90),
('juan-binyag',1,array[0,2,0,1]::integer[],90),
('tukso-ilang',1,array[0,2,0,1]::integer[],90),
('unang-alagad',1,array[1,0,1,2]::integer[],90),
('kasal-cana',1,array[2,1,2,0]::integer[],90),
('nicodemus',1,array[1,0,1,2]::integer[],90),
('samaritana-balon',1,array[2,1,2,0]::integer[],90),
('anak-opisyal',1,array[1,0,1,2]::integer[],90),
('bubong-may-sakit',1,array[2,1,2,0]::integer[],90),
('leprosy-healed',1,array[0,2,0,1]::integer[],90),
('sentrion',1,array[0,2,0,1]::integer[],90),
('pagpapala-bundok',1,array[2,1,2,0]::integer[],90),
('panalangin-ama',1,array[0,2,0,1]::integer[],90),
('matalino-bahay',1,array[0,2,0,1]::integer[],90),
('manghahasik',1,array[0,2,0,1]::integer[],90),
('nawawalang-tupa',1,array[1,0,1,2]::integer[],90),
('nawawalang-barya',1,array[2,1,2,0]::integer[],90),
('alibughang-anak',1,array[1,0,1,2]::integer[],90),
('di-nagpatawad-lingkod',1,array[1,0,1,2]::integer[],90),
('mayamang-hangal',1,array[1,0,1,2]::integer[],90),
('buto-mustasa',1,array[1,0,1,2]::integer[],90),
('nakatagong-yaman',1,array[2,1,2,0]::integer[],90),
('sampung-dalaga',1,array[0,2,0,1]::integer[],90),
('talento',1,array[2,1,2,0]::integer[],90),
('mga-bata-jesus',1,array[0,2,0,1]::integer[],90),
('tinapay-isda',1,array[1,0,1,2]::integer[],90),
('bagyo-tumahimik',1,array[1,0,1,2]::integer[],90),
('lumakad-tubig',1,array[2,1,2,0]::integer[],90),
('jairus-anak',1,array[0,2,0,1]::integer[],90),
('babae-gumaling',1,array[0,2,0,1]::integer[],90),
('bulag-bartimeo',1,array[0,2,0,1]::integer[],90),
('mabuting-pastol',1,array[1,0,1,2]::integer[],90),
('pagbabagong-anyo',1,array[2,1,2,0]::integer[],90),
('marta-maria',1,array[0,2,0,1]::integer[],90),
('zacchaeus',1,array[1,0,1,2]::integer[],90),
('mayamang-binata',1,array[1,0,1,2]::integer[],90),
('sampung-ketongin',1,array[2,1,2,0]::integer[],90),
('lazarus',1,array[2,1,2,0]::integer[],90),
('paghuhugas-paa',1,array[0,2,0,1]::integer[],90),
('huling-hapunan',1,array[0,2,0,1]::integer[],90),
('getsemani',1,array[1,0,1,2]::integer[],90),
('pagdakip-jesus',1,array[0,2,0,1]::integer[],90),
('peter-pagtanggi',1,array[1,0,1,2]::integer[],90),
('krus',1,array[2,1,2,0]::integer[],90),
('libing-jesus',1,array[1,0,1,2]::integer[],90),
('walang-lamang-libingan',1,array[2,1,2,0]::integer[],90),
('emmaus',1,array[1,0,1,2]::integer[],90),
('tomas',1,array[0,2,0,1]::integer[],90),
('almusal-dagat',1,array[2,1,2,0]::integer[],90),
('dakilang-utos',1,array[2,1,2,0]::integer[],90),
('pag-akyat',1,array[1,0,1,2]::integer[],90),
('pentecostes',1,array[0,2,0,1]::integer[],90),
('unang-iglesya',1,array[2,1,2,0]::integer[],90),
('magandang-pinto',1,array[1,0,1,2]::integer[],90),
('stephen',1,array[2,1,2,0]::integer[],90),
('felipe-etiopia',1,array[0,2,0,1]::integer[],90),
('saul-damasco',1,array[1,0,1,2]::integer[],90),
('cornelius-pedro',1,array[1,0,1,2]::integer[],90),
('pedro-bilangguan',1,array[2,1,2,0]::integer[],90),
('barnabas-paulo',1,array[0,2,0,1]::integer[],90),
('lydia',1,array[0,2,0,1]::integer[],90),
('bantay-piitan',1,array[2,1,2,0]::integer[],90),
('paulo-athens',1,array[1,0,1,2]::integer[],90),
('paulo-bagyo',1,array[0,2,0,1]::integer[],90),
('timoteo-kabataan',1,array[2,1,2,0]::integer[],90),
('bunga-espiritu',1,array[0,2,0,1]::integer[],90),
('baluti-diyos',1,array[1,0,1,2]::integer[],90),
('bagong-langit-lupa',1,array[1,0,1,2]::integer[],90)
on conflict(story_id) do update set story_version=excluded.story_version,
 answers=excluded.answers,min_read_seconds=excluded.min_read_seconds;

create table if not exists public.buklod_children_story_reader_sessions_v4 (
 user_id uuid not null references auth.users(id) on delete cascade,
 story_id text not null,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 primary key(user_id,story_id)
);
alter table public.buklod_children_story_reader_sessions_v4 enable row level security;
revoke all on public.buklod_children_story_reader_sessions_v4 from public,anon,authenticated;
grant select on public.buklod_children_story_reader_sessions_v4 to authenticated;
create policy "adult own children reading v4" on public.buklod_children_story_reader_sessions_v4
 for select to authenticated using ((select auth.uid())=user_id);

create or replace function public.begin_my_children_story_v4(p_story_id text)
returns jsonb language plpgsql security definer set search_path=''
as $child_begin$
declare
 v_user uuid := (select auth.uid());
 v_version integer;
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.is_active=true)
   or private.buklod_is_platform_official_v1(v_user) then
   raise exception 'Active adult BUKLOD member required' using errcode='42501';
 end if;
 select story_version into v_version from private.buklod_children_story_quiz_keys_v4
 where story_id=p_story_id;
 if v_version is null then
   return jsonb_build_object('status','not_in_verified_catalog','awardable',false);
 end if;
 insert into public.buklod_children_story_reader_sessions_v4(user_id,story_id)
 values(v_user,p_story_id) on conflict(user_id,story_id) do nothing;
 return jsonb_build_object('status','reading','awardable',true,'story_id',p_story_id);
end;
$child_begin$;

create or replace function public.complete_my_children_story_v4(
 p_story_id text,p_answers integer[])
returns jsonb language plpgsql security definer set search_path=''
as $child_complete$
declare
 v_user uuid := (select auth.uid());
 v_key private.buklod_children_story_quiz_keys_v4%rowtype;
 v_start timestamptz;
 v_points integer;
 v_led uuid;
 v_source text;
 v_today date := (now() at time zone 'Asia/Manila')::date;
 v_count integer;
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.is_active=true)
   or private.buklod_is_platform_official_v1(v_user) then
   raise exception 'Active adult BUKLOD member required' using errcode='42501';
 end if;
 select * into v_key from private.buklod_children_story_quiz_keys_v4
 where story_id=p_story_id;
 if v_key.story_id is null then
   return jsonb_build_object('status','not_in_verified_catalog','awarded_points',0);
 end if;
 if p_answers is distinct from v_key.answers then
   return jsonb_build_object('status','quiz_not_verified','awarded_points',0);
 end if;
 v_source:='children_story:v4:'||v_key.story_id;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod-child-story-v4'),
   pg_catalog.hashtext(v_user::text));
 -- Existing reward wins, even if the user reopens a story or loses network.
 if exists(select 1 from public.buklod_points_ledger l
           where l.user_id=v_user and l.source_key=v_source) then
   return jsonb_build_object('status','already_credited','awarded_points',0);
 end if;
 select s.started_at into v_start
 from public.buklod_children_story_reader_sessions_v4 s
 where s.user_id=v_user and s.story_id=p_story_id for update;
 if v_start is null then
   return jsonb_build_object('status','reading_not_started','awarded_points',0);
 end if;
 if now()-v_start<make_interval(secs=>v_key.min_read_seconds) then
   return jsonb_build_object('status','more_reading_needed','awarded_points',0,
     'minimum_read_seconds',v_key.min_read_seconds);
 end if;
 select count(*)::integer into v_count from public.buklod_points_ledger l
 where l.user_id=v_user and l.activity_type='child_story_complete'
   and l.direction='credit'
   and (l.created_at at time zone 'Asia/Manila')::date=v_today;
 if v_count>=4 then
   return jsonb_build_object('status','daily_reward_limit','awarded_points',0);
 end if;
 select least(r.base_points,coalesce(r.max_points_per_event,r.base_points),5)
 into v_points from public.buklod_point_rules r
 where r.activity_type='child_story_complete' and r.is_active=true;
 if coalesce(v_points,0)<>5 then
   return jsonb_build_object('status','reward_rule_unavailable','awarded_points',0);
 end if;
 insert into public.buklod_points_ledger(
  user_id,direction,points,activity_type,source_key,source_id,description
 ) values(v_user,'credit',v_points,'child_story_complete',v_source,null::uuid,
          'Verified story + complete story questions')
 on conflict(user_id,source_key) do nothing returning id into v_led;
 if v_led is null then
   return jsonb_build_object('status','already_credited','awarded_points',0);
 end if;
 update public.buklod_children_story_reader_sessions_v4
 set completed_at=coalesce(completed_at,now())
 where user_id=v_user and story_id=p_story_id;
 return jsonb_build_object('status','credited','awarded_points',v_points,
                           'claim_state','pending','story_id',p_story_id);
end;
$child_complete$;
revoke all on function public.begin_my_children_story_v4(text)
 from public,anon,authenticated;
revoke all on function public.complete_my_children_story_v4(text,integer[])
 from public,anon,authenticated;
grant execute on function public.begin_my_children_story_v4(text)
 to authenticated;
grant execute on function public.complete_my_children_story_v4(text,integer[])
 to authenticated;
update public.buklod_point_rules
set is_active=true,base_points=5,max_points_per_event=5,daily_cap_points=20,
    weekly_cap_points=140,updated_at=now(),
    notes='V4 server-verifies 4 bundled quiz answers, reading time and once/story key; no cash or QMP'
where activity_type='child_story_complete';
comment on table public.buklod_children_story_reader_sessions_v4 is
 'Adult-account-only private reading sessions; no child identity or photo.';
