-- ABaKa continuing doctrinal curriculum v1 (DEV only until separately migrated).
-- Existing A-Z completions, credits and reward rules are preserved.
-- New lessons are published by a trusted content administrator through service-role migrations;
-- clients have no authoring/publishing privileges and cannot read answer keys.

create table if not exists public.buklod_abc_doctrinal_lessons (
  lesson_id text primary key check (lesson_id ~ '^doctrine-[0-9]{4,}$'),
  series_key text not null check (length(series_key) between 3 and 80),
  series_title text not null,
  position integer not null check (position > 0),
  code text not null,
  title text not null,
  difficulty text not null check (difficulty in ('foundation','intermediate','advanced','deep')),
  prerequisite_id text,
  body_blocks jsonb not null check (jsonb_typeof(body_blocks) = 'array'),
  assessment_prompt text not null,
  assessment_options text[] not null check (array_length(assessment_options,1) = 4),
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (series_key,position),
  check (prerequisite_id is null or prerequisite_id <> lesson_id)
);

alter table public.buklod_abc_doctrinal_lessons enable row level security;
revoke all on public.buklod_abc_doctrinal_lessons from public, anon, authenticated;
grant select on public.buklod_abc_doctrinal_lessons to authenticated;
drop policy if exists "Read published ABaKa doctrine" on public.buklod_abc_doctrinal_lessons;
create policy "Read published ABaKa doctrine" on public.buklod_abc_doctrinal_lessons
for select to authenticated using (published = true);

create schema if not exists private;
create table if not exists private.buklod_abc_doctrinal_answers (
  lesson_id text primary key references public.buklod_abc_doctrinal_lessons(lesson_id) on delete cascade,
  correct_option text not null check (correct_option in ('A','B','C','D'))
);
revoke all on private.buklod_abc_doctrinal_answers from public, anon, authenticated;

create table if not exists private.buklod_abc_doctrine_quiz_attempts (
 user_id uuid not null references public.profiles(id) on delete cascade,
 lesson_id text not null references public.buklod_abc_doctrinal_lessons(lesson_id) on delete cascade,
 failed_count integer not null default 0 check(failed_count between 0 and 3),
 blocked_until timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,lesson_id)
);
create table if not exists private.buklod_abc_doctrine_reflection_hashes (
 user_id uuid not null references public.profiles(id) on delete cascade,
 lesson_id text not null references public.buklod_abc_doctrinal_lessons(lesson_id) on delete cascade,
 content_hash text not null check(length(content_hash)=32),
 created_at timestamptz not null default now(),
 primary key(user_id,content_hash),
 unique(user_id,lesson_id)
);
revoke all on private.buklod_abc_doctrine_quiz_attempts from public,anon,authenticated;
revoke all on private.buklod_abc_doctrine_reflection_hashes from public,anon,authenticated;
-- No direct client permission to the private schema/table; only this trusted RPC checks answers.

alter table public.buklod_abc_growth_progress
  drop constraint if exists buklod_abc_growth_progress_lesson_check;
alter table public.buklod_abc_growth_progress
  add constraint buklod_abc_growth_progress_lesson_check check (
    lesson_id in ('prelim-01','prelim-02')
    or lesson_id ~ '^lesson-(0[1-9]|1[0-9]|2[0-6])$'
    or lesson_id ~ '^doctrine-[0-9]{4,}$'
  );

-- The initial four examples are original, Scripture-linked lessons, not copied study materials.
-- New lessons can be inserted indefinitely and published in sequence without code updates.
insert into public.buklod_abc_doctrinal_lessons
(lesson_id,series_key,series_title,position,code,title,difficulty,prerequisite_id,body_blocks,assessment_prompt,assessment_options,published,published_at)
values
('doctrine-0001','god-and-creation','Pagkilala sa Diyos',1,'S2 · 1','Ang Diyos na Manlilikha','intermediate','lesson-26',
$body$[
{"kind":"heading","text":"Ang paglikha ay nagpapatotoo tungkol sa Diyos."},
{"kind":"body","text":"Itinuturo ng Genesis 1:1 na ang Diyos ang simula ng langit at lupa. Hindi nangangahulugang tayo ang sentro ng sanlibutan; tayo ay mga katiwala ng Kanyang nilikha.","refs":[{"label":"Genesis 1:1","bookNo":1,"chapter":1,"verse":1},{"label":"Awit 24:1","bookNo":19,"chapter":24,"verse":1}]},
{"kind":"body","text":"Sa Colosas 1:16–17, ang lahat ng bagay ay nilikha sa pamamagitan at para kay Kristo. Magkaugnay ang pananampalataya sa Manlilikha at ang pananagutan sa kapwa at kalikasan.","refs":[{"label":"Colosas 1:16-17","bookNo":51,"chapter":1,"verse":16,"endVerse":17}]},
{"kind":"memory","text":"Ang lupa at lahat ng naririto ay sa Panginoon.","refs":[{"label":"Awit 24:1","bookNo":19,"chapter":24,"verse":1}]}
]$body$::jsonb,
'Ayon sa Colosas 1:16, paano nauugnay si Kristo sa paglikha?',array['Walang kinalaman si Kristo','Sa pamamagitan at para sa Kanya nilikha ang lahat','Tao lamang ang lumikha','Nagkataon lamang ang paglikha'],true,now()),
('doctrine-0002','god-and-creation','Pagkilala sa Diyos',2,'S2 · 2','Banal at Makatarungan ang Diyos','intermediate','doctrine-0001',
$body$[
{"kind":"heading","text":"Ang kabanalan at katarungan ng Diyos."},
{"kind":"body","text":"Sa Isaias 6:3, inihahayag na ang Panginoon ay banal. Hindi Niya minamaliit ang kasalanan, ngunit hindi rin Niya tinatalikuran ang habag at katotohanan.","refs":[{"label":"Isaias 6:3","bookNo":23,"chapter":6,"verse":3},{"label":"Awit 89:14","bookNo":19,"chapter":89,"verse":14}]},
{"kind":"body","text":"Ipinapakita ng Roma 3:25–26 ang katarungan at pagpapawalang-sala ng Diyos sa pamamagitan ni Hesukristo. Magkakaugnay ang kabanalan, biyaya, at ang krus.","refs":[{"label":"Roma 3:25-26","bookNo":45,"chapter":3,"verse":25,"endVerse":26}]},
{"kind":"homework","text":"Pag-isipan kung paano magiging makatarungan at mahabagin sa isang mahirap na sitwasyon sa tahanan o komunidad."}
]$body$::jsonb,
'Alin ang ipinapakita ng Roma 3:26 tungkol sa Diyos?',array['Hindi Niya pansin ang katarungan','Walang halaga ang pananampalataya','Siya ay matuwid at nagpapawalang-sala sa sumasampalataya kay Hesus','Nagliligtas ang mabuting gawa lamang'],true,now()),
('doctrine-0003','christ-and-salvation','Si Kristo at Kaligtasan',1,'S3 · 1','Biyaya, Pananampalataya at Mabuting Gawa','advanced','doctrine-0002',
$body$[
{"kind":"heading","text":"Ang mabuting gawa ay bunga, hindi kabayaran ng kaligtasan."},
{"kind":"body","text":"Sa Efeso 2:8–10, ang kaligtasan ay kaloob ng Diyos sa pamamagitan ng pananampalataya at hindi mapagmamayabang na gawa. Gayunman, nilikha tayo kay Kristo para sa mabuting gawain.","refs":[{"label":"Efeso 2:8-10","bookNo":49,"chapter":2,"verse":8,"endVerse":10}]},
{"kind":"body","text":"Binibigyang-diin ng Santiago 2:17 ang pananampalatayang buhay at may bunga. Hindi kailangang pag-awayin ang biyaya at pagsunod: ang pagliligtas ay kay Kristo, ang pagbabago ay tugon ng taong tinubos.","refs":[{"label":"Santiago 2:17","bookNo":59,"chapter":2,"verse":17},{"label":"Tito 3:5","bookNo":56,"chapter":3,"verse":5}]},
{"kind":"homework","text":"Ihambing ang dahilan ng kaligtasan at ang bunga nito; magbigay ng isang payak na halimbawa sa buhay."}
]$body$::jsonb,
'Ano ang pinakaangkop na ugnayan ng Efeso 2:8–10 at Santiago 2:17?',array['Binibili ang kaligtasan ng gawa','Hindi mahalaga ang pagsunod','Taliwas ang Biblia sa sarili nito','Biyaya ang dahilan ng kaligtasan at ang buhay na pananampalataya ay may bunga'],true,now()),
('doctrine-0004','biblical-interpretation','Pag-unawa sa Kasulatan',1,'S4 · 1','Konteksto at Pananagutan sa Pagbasa','deep','doctrine-0003',
$body$[
{"kind":"heading","text":"Basahin ang talata sa loob ng kabuuan."},
{"kind":"body","text":"Hinihikayat ng 2 Timoteo 2:15 ang wastong paghawak sa salita ng katotohanan. Alamin ang nagsasalita, unang tagapakinig, uri ng sulatin, at katabing mga talata bago ipakahulugan.","refs":[{"label":"2 Timoteo 2:15","bookNo":55,"chapter":2,"verse":15}]},
{"kind":"body","text":"Sinuri ng mga taga-Berea ang Kasulatan upang tingnan kung totoo ang narinig (Gawa 17:11). Sa Lucas 24:27, itinuro ni Hesus ang lugar ng Kanyang gawain sa malawak na salaysay ng Kasulatan.","refs":[{"label":"Gawa 17:11","bookNo":44,"chapter":17,"verse":11},{"label":"Lucas 24:27","bookNo":42,"chapter":24,"verse":27}]},
{"kind":"homework","text":"Pumili ng isang talatang madalas sipiin. Ipaliwanag kung paano nagbabago ang pag-unawa kapag isinama ang buong kabanata."}
]$body$::jsonb,
'Alin ang responsableng unang hakbang sa pagpapaliwanag ng isang mahirap na talata?',array['Suriin ang konteksto at ihambing sa Kasulatan','Pumili ng paboritong opinyon','Ihiwalay ang isang pangungusap','Huwag nang basahin ang kabuuan'],true,now())
on conflict (lesson_id) do nothing;

insert into private.buklod_abc_doctrinal_answers(lesson_id,correct_option)
values ('doctrine-0001','B'),('doctrine-0002','C'),('doctrine-0003','D'),('doctrine-0004','A')
on conflict (lesson_id) do nothing;

create or replace function public.complete_my_abc_doctrinal_lesson_v1(
  p_lesson_id text, p_answer text, p_reflection text
) returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  actor uuid := (select auth.uid());
  normalized_id text := lower(trim(coalesce(p_lesson_id,'')));
  chosen text := upper(trim(coalesce(p_answer,'')));
  reflection_text text := trim(regexp_replace(coalesce(p_reflection,''), '\s+', ' ', 'g'));
  item record;
  previous record;
  correct text;
  failures integer := 0;
  previous_block timestamptz;
  next_block timestamptz;
  attempts_updated_at timestamptz;
  reflection_hash text;
  points_for_level integer;
  today_points integer;
  award integer;
  award_ledger uuid;
  existing public.buklod_abc_growth_progress%rowtype;
  ledger_state text;
  completed_when timestamptz;
  credit_enabled boolean;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if normalized_id !~ '^doctrine-[0-9]{4,}$' then raise exception 'Unknown doctrinal lesson'; end if;

  -- Serializes all doctrine completions for one account, including daily cap checks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 4204));

  select * into item from public.buklod_abc_doctrinal_lessons
   where lesson_id=normalized_id and published=true;
  if not found then raise exception 'Lesson is not published'; end if;

  select * into existing from public.buklod_abc_growth_progress
   where user_id=actor and lesson_id=normalized_id;
  if found then
    select l.points,l.claim_state into award,ledger_state from public.buklod_points_ledger l
      where l.id=existing.point_ledger_id and l.user_id=actor;
    return jsonb_build_object('lesson_id',normalized_id,'completed',true,
      'already_completed',true,'points',coalesce(award,0),
      'claim_state',coalesce(ledger_state,'unrewarded'),'completed_at',existing.completed_at);
  end if;

  if item.prerequisite_id is not null and not exists
    (select 1 from public.buklod_abc_growth_progress
     where user_id=actor and lesson_id=item.prerequisite_id) then
    raise exception 'Complete the preceding ABaKa lesson first';
  end if;

  select correct_option into correct from private.buklod_abc_doctrinal_answers
   where lesson_id=normalized_id;
  if correct is null then raise exception 'Assessment unavailable'; end if;
  select a.failed_count,a.blocked_until,a.updated_at
    into failures,previous_block,attempts_updated_at
  from private.buklod_abc_doctrine_quiz_attempts a
  where a.user_id=actor and a.lesson_id=normalized_id for update;
  if previous_block is not null and previous_block > now() then
    return jsonb_build_object('lesson_id',normalized_id,'completed',false,
      'reason','quiz_cooldown','retry_after_seconds',
      greatest(1,ceil(extract(epoch from previous_block-now()))::integer));
  end if;
  if chosen <> correct then
    failures := case
      when previous_block is not null and previous_block <= now() then 1
      when attempts_updated_at is null or attempts_updated_at < now()-interval '1 hour' then 1
      else least(3,coalesce(failures,0)+1) end;
    next_block := case when failures >= 3 then now()+interval '10 minutes' else null end;
    insert into private.buklod_abc_doctrine_quiz_attempts
      (user_id,lesson_id,failed_count,blocked_until,updated_at)
    values(actor,normalized_id,failures,next_block,now())
    on conflict(user_id,lesson_id) do update set
      failed_count=excluded.failed_count,
      blocked_until=excluded.blocked_until,
      updated_at=now();
    return jsonb_build_object('lesson_id',normalized_id,'completed',false,
      'reason','quiz_incorrect','remaining_attempts',greatest(0,3-failures),
      'retry_after_seconds',case when next_block is not null then 600 else 0 end);
  end if;
  -- Lightweight rubric; reflection is checked transiently and is never stored in this table.
  if length(reflection_text) < 80 or length(reflection_text) > 2000 or
     (select count(distinct lower(word))
      from pg_catalog.regexp_split_to_table(reflection_text,'\s+') as word
      where length(word) >= 3) < 8 then
    raise exception 'Kailangan ng sariling reflection: 80–2000 characters at 8 magkakaibang salita.';
  end if;

  -- Compare only normalized hashes; reflection text stays private to the device.
  reflection_hash := pg_catalog.md5(lower(
    pg_catalog.regexp_replace(reflection_text,'[^[:alnum:]]+','','g')));
  insert into private.buklod_abc_doctrine_reflection_hashes
    (user_id,lesson_id,content_hash)
  values(actor,normalized_id,reflection_hash)
  on conflict(user_id,content_hash) do nothing;
  if not found then
    raise exception 'Same reflection already used. Please provide original learning and application.';
  end if;
  select r.is_active into credit_enabled from public.buklod_point_rules r
   where r.activity_type='abc_growth_lesson';
  if credit_enabled is distinct from true then raise exception 'Points rule is unavailable'; end if;

  points_for_level := case item.difficulty
    when 'foundation' then 8
    when 'intermediate' then 12
    when 'advanced' then 18
    when 'deep' then 25
    else 0 end;
  if points_for_level <= 0 then raise exception 'Invalid lesson difficulty'; end if;

  -- Only continuing doctrine credits count against this bounded daily quota.
  select coalesce(sum(l.points),0)::integer into today_points
    from public.buklod_points_ledger l
   where l.user_id=actor and l.direction='credit'
     and l.activity_type='abc_growth_lesson'
     and l.source_key like 'abc_growth:v1:doctrine-%'
     and l.created_at >= (pg_catalog.date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila');
  award := case when today_points + points_for_level <= 50 then points_for_level else 0 end;
  -- Official System Admin accounts are excluded from BP, but may still study.
  if public.buklod_is_system_admin() then award := 0; end if;
  if award > 0 then
    insert into public.buklod_points_ledger
      (user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
    values (actor,'credit',award,'abc_growth_lesson','abc_growth:v1:'||normalized_id,
      null,'ABaKa '||item.difficulty||' doctrinal lesson: '||item.title,actor)
    on conflict(user_id,source_key) do nothing returning id into award_ledger;
    if award_ledger is null then
      select id into award_ledger from public.buklod_points_ledger
      where user_id=actor and source_key='abc_growth:v1:'||normalized_id;
    end if;
    if award_ledger is null then raise exception 'Could not create doctrine credit'; end if;
  end if;

  insert into public.buklod_abc_growth_progress
    (user_id,lesson_id,completed_at,point_ledger_id,source_key)
  values (actor,normalized_id,now(),award_ledger,'abc_growth:v1:'||normalized_id)
  returning completed_at into completed_when;

  if award_ledger is not null then
    select claim_state into ledger_state from public.buklod_points_ledger
      where id=award_ledger and user_id=actor;
  end if;
  return jsonb_build_object('lesson_id',normalized_id,'completed',true,
    'already_completed',false,'points',award,'daily_cap_points',50,
    'claim_state',coalesce(ledger_state,'unrewarded'),'completed_at',completed_when);
end;
$fn$;
revoke all on function public.complete_my_abc_doctrinal_lesson_v1(text,text,text) from public,anon;
grant execute on function public.complete_my_abc_doctrinal_lesson_v1(text,text,text) to authenticated;

create or replace function public.get_my_abc_growth_progress_v1()
returns table(lesson_id text,completed_at timestamptz,points integer,
              claim_state text,point_ledger_id uuid)
language sql stable security definer set search_path=''
as $fn$
  select p.lesson_id,p.completed_at,
    coalesce(l.points,case when p.lesson_id ~ '^doctrine-[0-9]{4,}$' then 0 else 5 end)::integer,
    coalesce(l.claim_state,case when p.lesson_id ~ '^doctrine-[0-9]{4,}$' then 'unrewarded' else 'legacy' end)::text,
    p.point_ledger_id
  from public.buklod_abc_growth_progress p
  left join public.buklod_points_ledger l on l.id=p.point_ledger_id and l.user_id=p.user_id
  where p.user_id=(select auth.uid()) order by p.completed_at asc;
$fn$;
revoke all on function public.get_my_abc_growth_progress_v1() from public,anon;
grant execute on function public.get_my_abc_growth_progress_v1() to authenticated;
