-- Verified adult-account story assessment metadata only. No child identity,
-- answers, names, reflections, or photos are retained in completion records.
create schema if not exists private;
create table if not exists private.buklod_children_story_answer_keys (
 story_id text not null, version integer not null check (version>0),
 answers smallint[] not null check (cardinality(answers) between 1 and 20),
 primary key(story_id,version)
);
create table if not exists private.buklod_children_story_completions (
 user_id uuid not null references auth.users(id) on delete cascade,
 story_id text not null check (story_id ~ '^[a-z0-9-]{3,70}$'),
 version integer not null check (version>0),
 source text not null check(source in ('bundled','published')),
 completed_at timestamptz not null default now(),
 primary key(user_id,story_id)
);
alter table private.buklod_children_story_answer_keys enable row level security;
alter table private.buklod_children_story_completions enable row level security;
revoke all on private.buklod_children_story_answer_keys,private.buklod_children_story_completions from public,anon,authenticated;
create index if not exists buklod_story_completion_period_idx on private.buklod_children_story_completions(completed_at,user_id);
-- Generated from the 12 authored and 132 expanded bundled stories, using the
-- same story-question + Sunday School question order as the reader.
insert into private.buklod_children_story_answer_keys(story_id,version,answers) values
 ('maliit-na-ilaw',1,array[0,0,1,2]::smallint[]),
 ('david-at-ang-tapang',1,array[1,0,1,2]::smallint[]),
 ('bangka-ng-pag-asa',1,array[2,0,1,2]::smallint[]),
 ('si-pagong-at-ang-buto',1,array[0,0,1,2]::smallint[]),
 ('bituin-ni-bitu',1,array[1,0,1,2]::smallint[]),
 ('ang-mabuting-kapitbahay',1,array[2,0,1,2]::smallint[]),
 ('lola-sa-hardin',1,array[0,0,1,2]::smallint[]),
 ('alon-at-ang-kabibe',1,array[1,0,1,2]::smallint[]),
 ('si-jonas-at-ang-dagat',1,array[2,0,1,2]::smallint[]),
 ('tatlong-salitang-mahalaga',1,array[0,0,1,2]::smallint[]),
 ('puno-ng-pangarap',1,array[1,0,1,2]::smallint[]),
 ('gabi-ng-payapang-ulan',1,array[2,0,1,2]::smallint[]),
 ('paglikha',1,array[0,2,0,1]::smallint[]),
 ('eden',1,array[2,1,2,0]::smallint[]),
 ('cain-abel',1,array[1,0,1,2]::smallint[]),
 ('babel',1,array[0,2,0,1]::smallint[]),
 ('abraham-tawag',1,array[2,1,2,0]::smallint[]),
 ('abraham-bituin',1,array[0,2,0,1]::smallint[]),
 ('isaac-rebekah',1,array[2,1,2,0]::smallint[]),
 ('esau-jacob',1,array[2,1,2,0]::smallint[]),
 ('hagdan-jacob',1,array[1,0,1,2]::smallint[]),
 ('joseph-panaginip',1,array[2,1,2,0]::smallint[]),
 ('joseph-egipto',1,array[2,1,2,0]::smallint[]),
 ('joseph-patawad',1,array[0,2,0,1]::smallint[]),
 ('baby-moses',1,array[2,1,2,0]::smallint[]),
 ('naglalagablab-puno',1,array[1,0,1,2]::smallint[]),
 ('sampung-salot',1,array[2,1,2,0]::smallint[]),
 ('paskuwa',1,array[2,1,2,0]::smallint[]),
 ('dagat-pula',1,array[2,1,2,0]::smallint[]),
 ('manna',1,array[0,2,0,1]::smallint[]),
 ('sampung-utos',1,array[1,0,1,2]::smallint[]),
 ('guya-ginto',1,array[2,1,2,0]::smallint[]),
 ('tolda-pagsamba',1,array[0,2,0,1]::smallint[]),
 ('labindalawang-espiya',1,array[0,2,0,1]::smallint[]),
 ('balaam-asno',1,array[0,2,0,1]::smallint[]),
 ('jordan',1,array[1,0,1,2]::smallint[]),
 ('jerico',1,array[1,0,1,2]::smallint[]),
 ('rahab',1,array[0,2,0,1]::smallint[]),
 ('deborah',1,array[2,1,2,0]::smallint[]),
 ('gideon',1,array[1,0,1,2]::smallint[]),
 ('samson',1,array[1,0,1,2]::smallint[]),
 ('ruth-naomi',1,array[2,1,2,0]::smallint[]),
 ('samuel-tinawag',1,array[0,2,0,1]::smallint[]),
 ('saul-hari',1,array[1,0,1,2]::smallint[]),
 ('david-pinili',1,array[1,0,1,2]::smallint[]),
 ('david-jonathan',1,array[0,2,0,1]::smallint[]),
 ('david-saul-awa',1,array[0,2,0,1]::smallint[]),
 ('solomon-hatol',1,array[2,1,2,0]::smallint[]),
 ('solomon-templo',1,array[0,2,0,1]::smallint[]),
 ('elijah-ibon',1,array[0,2,0,1]::smallint[]),
 ('elijah-balo',1,array[0,2,0,1]::smallint[]),
 ('elijah-carmel',1,array[2,1,2,0]::smallint[]),
 ('elijah-mahinang-tinig',1,array[1,0,1,2]::smallint[]),
 ('naaman',1,array[1,0,1,2]::smallint[]),
 ('langis-balo',1,array[0,2,0,1]::smallint[]),
 ('josiah-aklat',1,array[1,0,1,2]::smallint[]),
 ('esther',1,array[1,0,1,2]::smallint[]),
 ('ezra',1,array[2,1,2,0]::smallint[]),
 ('nehemiah',1,array[0,2,0,1]::smallint[]),
 ('job',1,array[1,0,1,2]::smallint[]),
 ('isaiah-tawag',1,array[1,0,1,2]::smallint[]),
 ('jeremiah-bata',1,array[2,1,2,0]::smallint[]),
 ('daniel-pagkain',1,array[0,2,0,1]::smallint[]),
 ('apoy-tatlong-kaibigan',1,array[1,0,1,2]::smallint[]),
 ('daniel-leon',1,array[0,2,0,1]::smallint[]),
 ('ezekiel-buto',1,array[1,0,1,2]::smallint[]),
 ('hosea-habag',1,array[0,2,0,1]::smallint[]),
 ('micah-katarungan',1,array[2,1,2,0]::smallint[]),
 ('habakkuk-tiwala',1,array[1,0,1,2]::smallint[]),
 ('zacharias-elisabet',1,array[1,0,1,2]::smallint[]),
 ('maria-anghel',1,array[1,0,1,2]::smallint[]),
 ('joseph-panaginip-bethlehem',1,array[0,2,0,1]::smallint[]),
 ('kapanganakan-hesus',1,array[1,0,1,2]::smallint[]),
 ('mga-pastol',1,array[2,1,2,0]::smallint[]),
 ('mga-pantas',1,array[2,1,2,0]::smallint[]),
 ('paglikas-egipto',1,array[1,0,1,2]::smallint[]),
 ('jesus-templo-bata',1,array[0,2,0,1]::smallint[]),
 ('juan-binyag',1,array[0,2,0,1]::smallint[]),
 ('tukso-ilang',1,array[0,2,0,1]::smallint[]),
 ('unang-alagad',1,array[1,0,1,2]::smallint[]),
 ('kasal-cana',1,array[2,1,2,0]::smallint[]),
 ('nicodemus',1,array[1,0,1,2]::smallint[]),
 ('samaritana-balon',1,array[2,1,2,0]::smallint[]),
 ('anak-opisyal',1,array[1,0,1,2]::smallint[]),
 ('bubong-may-sakit',1,array[2,1,2,0]::smallint[]),
 ('leprosy-healed',1,array[0,2,0,1]::smallint[]),
 ('sentrion',1,array[0,2,0,1]::smallint[]),
 ('pagpapala-bundok',1,array[2,1,2,0]::smallint[]),
 ('panalangin-ama',1,array[0,2,0,1]::smallint[]),
 ('matalino-bahay',1,array[0,2,0,1]::smallint[]),
 ('manghahasik',1,array[0,2,0,1]::smallint[]),
 ('nawawalang-tupa',1,array[1,0,1,2]::smallint[]),
 ('nawawalang-barya',1,array[2,1,2,0]::smallint[]),
 ('alibughang-anak',1,array[1,0,1,2]::smallint[]),
 ('di-nagpatawad-lingkod',1,array[1,0,1,2]::smallint[]),
 ('mayamang-hangal',1,array[1,0,1,2]::smallint[]),
 ('buto-mustasa',1,array[1,0,1,2]::smallint[]),
 ('nakatagong-yaman',1,array[2,1,2,0]::smallint[]),
 ('sampung-dalaga',1,array[0,2,0,1]::smallint[]),
 ('talento',1,array[2,1,2,0]::smallint[]),
 ('mga-bata-jesus',1,array[0,2,0,1]::smallint[]),
 ('tinapay-isda',1,array[1,0,1,2]::smallint[]),
 ('bagyo-tumahimik',1,array[1,0,1,2]::smallint[]),
 ('lumakad-tubig',1,array[2,1,2,0]::smallint[]),
 ('jairus-anak',1,array[0,2,0,1]::smallint[]),
 ('babae-gumaling',1,array[0,2,0,1]::smallint[]),
 ('bulag-bartimeo',1,array[0,2,0,1]::smallint[]),
 ('mabuting-pastol',1,array[1,0,1,2]::smallint[]),
 ('pagbabagong-anyo',1,array[2,1,2,0]::smallint[]),
 ('marta-maria',1,array[0,2,0,1]::smallint[]),
 ('zacchaeus',1,array[1,0,1,2]::smallint[]),
 ('mayamang-binata',1,array[1,0,1,2]::smallint[]),
 ('sampung-ketongin',1,array[2,1,2,0]::smallint[]),
 ('lazarus',1,array[2,1,2,0]::smallint[]),
 ('paghuhugas-paa',1,array[0,2,0,1]::smallint[]),
 ('huling-hapunan',1,array[0,2,0,1]::smallint[]),
 ('getsemani',1,array[1,0,1,2]::smallint[]),
 ('pagdakip-jesus',1,array[0,2,0,1]::smallint[]),
 ('peter-pagtanggi',1,array[1,0,1,2]::smallint[]),
 ('krus',1,array[2,1,2,0]::smallint[]),
 ('libing-jesus',1,array[1,0,1,2]::smallint[]),
 ('walang-lamang-libingan',1,array[2,1,2,0]::smallint[]),
 ('emmaus',1,array[1,0,1,2]::smallint[]),
 ('tomas',1,array[0,2,0,1]::smallint[]),
 ('almusal-dagat',1,array[2,1,2,0]::smallint[]),
 ('dakilang-utos',1,array[2,1,2,0]::smallint[]),
 ('pag-akyat',1,array[1,0,1,2]::smallint[]),
 ('pentecostes',1,array[0,2,0,1]::smallint[]),
 ('unang-iglesya',1,array[2,1,2,0]::smallint[]),
 ('magandang-pinto',1,array[1,0,1,2]::smallint[]),
 ('stephen',1,array[2,1,2,0]::smallint[]),
 ('felipe-etiopia',1,array[0,2,0,1]::smallint[]),
 ('saul-damasco',1,array[1,0,1,2]::smallint[]),
 ('cornelius-pedro',1,array[1,0,1,2]::smallint[]),
 ('pedro-bilangguan',1,array[2,1,2,0]::smallint[]),
 ('barnabas-paulo',1,array[0,2,0,1]::smallint[]),
 ('lydia',1,array[0,2,0,1]::smallint[]),
 ('bantay-piitan',1,array[2,1,2,0]::smallint[]),
 ('paulo-athens',1,array[1,0,1,2]::smallint[]),
 ('paulo-bagyo',1,array[0,2,0,1]::smallint[]),
 ('timoteo-kabataan',1,array[2,1,2,0]::smallint[]),
 ('bunga-espiritu',1,array[0,2,0,1]::smallint[]),
 ('baluti-diyos',1,array[1,0,1,2]::smallint[]),
 ('bagong-langit-lupa',1,array[1,0,1,2]::smallint[])
on conflict(story_id,version) do nothing;
create or replace function public.complete_my_children_story_v1(
 p_expected_user uuid,p_story_id text,p_version integer,p_source text,p_answers smallint[]
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 actor uuid:=auth.uid();
 expected smallint[];
 published jsonb;
 recorded timestamptz;
begin
 if actor is null or actor is distinct from p_expected_user then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 if p_story_id is null or p_story_id !~ '^[a-z0-9-]{3,70}$'
  or p_version is null or p_version<1 or p_source is null or p_source not in ('bundled','published')
  or p_answers is null or cardinality(p_answers) not between 1 and 20 then
  raise exception 'Invalid story assessment' using errcode='22023';
 end if;
 -- Idempotent replay after an interrupted response, including a subsequently
 -- replaced editorial edition. No new record is created for repeat readings.
 select c.completed_at into recorded from private.buklod_children_story_completions c
 where c.user_id=actor and c.story_id=p_story_id;
 if found then return jsonb_build_object('recorded',true,'completed_at',recorded,'already_completed',true); end if;
 if p_source='bundled' then
  select k.answers into expected from private.buklod_children_story_answer_keys k
  where k.story_id=p_story_id and k.version=p_version;
 else
  select s.payload into published from public.buklod_children_stories s
  where s.id=p_story_id and s.is_published and (s.publish_at is null or s.publish_at<=now())
  and s.payload->>'version'=p_version::text;
  if published is not null and published->>'answer' in ('0','1','2') then
   expected:=array[(published->>'answer')::smallint];
  end if;
 end if;
 if expected is null or p_answers is distinct from expected then
  raise exception 'Story assessment not verified; reopen the current story' using errcode='22023';
 end if;
 insert into private.buklod_children_story_completions(user_id,story_id,version,source)
 values(actor,p_story_id,p_version,p_source) on conflict(user_id,story_id) do nothing;
 select c.completed_at into recorded from private.buklod_children_story_completions c
 where c.user_id=actor and c.story_id=p_story_id;
 return jsonb_build_object('recorded',true,'completed_at',recorded);
end;
$fn$;
revoke all on function public.complete_my_children_story_v1(uuid,text,integer,text,smallint[]) from public,anon;
grant execute on function public.complete_my_children_story_v1(uuid,text,integer,text,smallint[]) to authenticated;
notify pgrst,'reload schema';
