-- BUKLOD University first-stage academic engine. DEV/STAGING ONLY.
-- Default OFF; no existing BP, claim, ads, rank, or payout objects changed.
create table if not exists public.buklod_university_config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 catalog_version text not null default 'BU-ACADEMIC-4',
 updated_at timestamptz not null default now()
);
insert into public.buklod_university_config(singleton,enabled) values(true,false) on conflict(singleton) do nothing;

create table if not exists public.buklod_university_credentials (
 code text primary key,
 title text not null,
 tier text not null check(tier in ('certificate','diploma','bachelors','masters')),
 min_uc integer not null check(min_uc>0),
 prerequisites text[] not null default '{}',
 evidence_requirement text not null,
 policy_version text not null default 'BU-ACADEMIC-4',
 active boolean not null default true
);
insert into public.buklod_university_credentials
 (code,title,tier,min_uc,prerequisites,evidence_requirement) values
  ('C-D01','Christian Foundations - ABaKa','certificate',150,ARRAY[]::text[],'Published ABaKa A-Z plus designated preliminaries if required by canonical curriculum'),
  ('C-D02','Christian Doctrine I','certificate',250,ARRAY['C-D01']::text[],'ABaKa foundation + verified intermediate coverage of Scripture, God, humanity, sin, Christ, salvation'),
  ('C-D03','Christian Doctrine II','certificate',420,ARRAY['C-D02']::text[],'Doctrine I + verified advanced topics including Spirit, church, ethics, discipleship, mission, hope'),
  ('C-D04','Systematic Theology Foundations','certificate',550,ARRAY['C-D03']::text[],'all core doctrinal categories mapped to versioned ABaKa evidence and Scripture'),
  ('C-D05','Christology and Salvation','certificate',500,ARRAY['C-D02']::text[],'Christology, atonement, grace, faith, discipleship evidence in ABaKa and BUKLOD 101-104'),
  ('C-D06','Ecclesiology and Church Covenants','certificate',550,ARRAY['C-D02','C-F02']::text[],'doctrinal church/ordinance/covenant evidence + official 101-104 milestones'),
  ('C-D07','Christian Ethics and Spiritual Formation','certificate',600,ARRAY['C-D03','C-S02']::text[],'ABaKa ethical reasoning + verified Word/Reading/KL application evidence'),
  ('C-D08','Advanced Doctrinal Reasoning','certificate',800,ARRAY['C-D04']::text[],'advanced/deep ABaKa outcomes; at least two SALIKSIK doctrinal comparisons'),
  ('C-F01','BUKLOD Foundations (101-103)','certificate',250,ARRAY[]::text[],'101-103 all completed; official covenants/validation and documents as applicable'),
  ('C-F02','Discipleship Formation (104)','certificate',450,ARRAY['C-F01']::text[],'101-104 all completed, including ordered BUKLOD Training and Care Covenant'),
  ('C-F03','Biblical Teaching & Children''s Ministry','certificate',550,ARRAY['C-S07']::text[],'Children''s Story mastery + existing verified teaching-session evidence (consent-protected)'),
  ('C-F04','Leadership Formation (105)','certificate',850,ARRAY['C-F02']::text[],'official three-part 105 leadership curriculum fully verified; unresolved 30th-source gap blocks'),
  ('C-F05','Christian Workers'' Formation (106)','certificate',1050,ARRAY['C-F04']::text[],'105 complete + member''s **assigned** published 106 role-track requirements + validations'),
  ('C-F06','Pastoral Ministry Formation (106)','certificate',1050,ARRAY['C-F04']::text[],'actual 106 Pastor track; *not* ordination or clerical license'),
  ('C-F07','Diaconal Service Formation (106)','certificate',1050,ARRAY['C-F04']::text[],'actual 106 Deacon track'),
  ('C-F08','Children''s Teacher Formation (106)','certificate',1050,ARRAY['C-F04','C-F03']::text[],'actual 106 Children Teacher track'),
  ('C-F09','Missionary Formation (106)','certificate',1050,ARRAY['C-F04']::text[],'actual 106 Woman Missionary / mission role pathway when appropriately assigned'),
  ('C-F10','Ministry Head Formation (106)','certificate',1050,ARRAY['C-F04']::text[],'actual 106 Ministry Head track'),
  ('C-F11','Mission Leadership Formation (107)','certificate',1300,ARRAY['C-F05']::text[],'full 107 lessons, mission-readiness and applicable official verifications'),
  ('C-R01','SALIKSIK Research Literacy','certificate',650,ARRAY[]::text[],'two distinct verifiable Bible-grounded designs or investigations'),
  ('C-R02','Biblical Exegetical Research','certificate',1000,ARRAY['C-R01']::text[],'source-verified exegesis paper and context/evidence/rationale mastery'),
  ('C-R03','Comparative Theological Research','certificate',1200,ARRAY['C-R01']::text[],'evidence-based two-view comparison with fair counterargument and citations'),
  ('C-R04','Applied Ministry Research','certificate',1300,ARRAY['C-R01','C-F02']::text[],'existing ministry evidence + approved SALIKSIK practical-research paper'),
  ('C-S01','Scripture Devotion','certificate',30,ARRAY[]::text[],'20 unique verified Daily Reading assignments'),
  ('C-S02','Word and Spiritual Reflection','certificate',50,ARRAY['C-S01']::text[],'12 verified Word reflections and 12 Daily Reading records'),
  ('C-S03','Bible Reading Foundations','certificate',100,ARRAY[]::text[],'30 verified distinct chapters; OT and NT coverage'),
  ('C-S04','Gospel and Life of Christ','certificate',180,ARRAY['C-S03']::text[],'Gospel-book chapter coverage plus verified KL/ABaKa Christology evidence'),
  ('C-S05','Old Testament Foundations','certificate',200,ARRAY['C-S03']::text[],'Verified chapters across Torah, history, poetry and prophets'),
  ('C-S06','New Testament Foundations','certificate',200,ARRAY['C-S03']::text[],'Verified chapters across Gospel, Acts, epistles and apocalyptic literature'),
  ('C-S07','Biblical Storytelling and Narratives','certificate',90,ARRAY[]::text[],'10 verified Children''s Stories + 8 KL chapters; never claim teaching qualification from reading alone'),
  ('C-S08','KL Interpretation and Moral Reasoning','certificate',80,ARRAY[]::text[],'Complete one currently published KL series with its quiz/comment gates'),
  ('C-S09','Bible Interpretation and Context','certificate',350,ARRAY['C-S05','C-S06']::text[],'cross-genre chapter evidence + verified SALIKSIK contextual exegesis'),
  ('D01','Diploma in Biblical Foundations','diploma',400,ARRAY['C-F01','C-D01','C-S03']::text[],'101-103, ABaKa foundation, Bible OT/NT evidence'),
  ('D02','Diploma in Christian Discipleship','diploma',650,ARRAY['D01','C-F02','C-S02']::text[],'101-104 complete, verified reflections, Word + Daily Reading'),
  ('D03','Diploma in Biblical Narrative and Interpretation','diploma',700,ARRAY['C-S07','C-S08','C-S09','C-R01']::text[],'KL completed series, Bible chapter coverage, Children''s Story competence, SALIKSIK context analysis'),
  ('D04','Diploma in Christian Doctrine','diploma',800,ARRAY['C-D04']::text[],'ABaKa foundation/intermediate and full foundational doctrinal coverage'),
  ('D05','Diploma in Christian Education','diploma',900,ARRAY['C-F03','C-S08']::text[],'Children/KL evidence + teaching evidence from current features'),
  ('D06','Advanced Diploma in Christian Leadership','diploma',1150,ARRAY['C-F04','C-D07','D02']::text[],'105 completely verified + leadership doctrine and reflection'),
  ('D07','Advanced Diploma in Biblical Theology','diploma',1250,ARRAY['D04','C-S09','C-R02']::text[],'ABaKa advanced + multi-genre Bible reading and exegetical SALIKSIK portfolio'),
  ('D08','Diploma in Christian Ministry','diploma',1500,ARRAY['C-F05','D06']::text[],'assigned authorized 106 track + ministry/leadership evidence'),
  ('D09','Diploma in Mission and Research Leadership','diploma',1800,ARRAY['D08','C-F11','C-R03']::text[],'107 fully verified + research paper and mission-readiness evidence'),
  ('B01','Bachelor of Biblical Studies','bachelors',1500,ARRAY['D02','C-F04','D03','C-R02']::text[],'multi-genre Scripture comprehension + one independently reviewed exegetical paper'),
  ('B02','Bachelor of Christian Education','bachelors',1600,ARRAY['D02','D05','C-F04','C-R01']::text[],'verified Children''s Story teaching and Biblical teaching-design portfolio'),
  ('B03','Bachelor of Theology','bachelors',1750,ARRAY['D02','D04','D07','C-F04','C-R03']::text[],'full doctrinal matrix + comparative theological paper'),
  ('B04','Bachelor of Discipleship and Christian Formation','bachelors',1650,ARRAY['D02','D06','C-F04']::text[],'formation 101-105 + practical application evidence'),
  ('B05','Bachelor of Christian Leadership','bachelors',1850,ARRAY['D06','C-F04']::text[],'complete 105 + leadership application and documented ministry involvement; verified 106 track where required by specialization'),
  ('B06','Bachelor of Biblical Research','bachelors',1850,ARRAY['D02','D07','C-F04','C-R03']::text[],'two different SALIKSIK research designs + exegetical and comparative papers'),
  ('B07','Bachelor of Ministry and Mission Studies','bachelors',1900,ARRAY['D02','D08','C-F05']::text[],'leadership and mission studies coverage with actual documented practice; 106 track must be verified'),
  ('M01','Master of Biblical Theology','masters',2400,ARRAY['B01','D09','C-D08']::text[],'biblical-theology synthesis, OT/NT evidence, substantial SALIKSIK exegetical capstone'),
  ('M02','Master of Christian Education','masters',2500,ARRAY['B02','D09','C-D08']::text[],'Children''s Story/teaching record + educational-theology research and evidenced application'),
  ('M03','Master of Theology and Ministry','masters',2700,ARRAY['B03','D09','C-D08']::text[],'105-107, 106 role practice + documented systematic/doctrinal and applied-theology paper'),
  ('M04','Master of Missiology and Christian Leadership','masters',2700,ARRAY['B05','D09','C-D08']::text[],'107 mission readiness + SALIKSIK mission-practice research and leadership case portfolio'),
  ('M05','Master of Theological Research','masters',2900,ARRAY['B06','D09','C-D08','C-R03']::text[],'comparative/methodological portfolio + complete source-verified thesis-style research and defense')
on conflict(code) do update set
 title=excluded.title, tier=excluded.tier,min_uc=excluded.min_uc,
 prerequisites=excluded.prerequisites,evidence_requirement=excluded.evidence_requirement;

create table if not exists public.buklod_university_uc_ledger (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_module text not null,
 source_key text not null,
 source_ledger_id uuid references public.buklod_points_ledger(id),
 uc integer not null check(uc>0 and uc<=200),
 verified_at timestamptz not null,
 policy_version text not null default 'BU-ACADEMIC-4',
 created_at timestamptz not null default now(),
 unique(user_id,source_module,source_key)
);
create index if not exists buklod_university_uc_user_idx on public.buklod_university_uc_ledger(user_id,created_at desc);

create table if not exists public.buklod_university_credential_evidence (
 user_id uuid not null references auth.users(id) on delete cascade,
 credential_code text not null references public.buklod_university_credentials(code),
 status text not null default 'PENDING' check(status in ('PENDING','VERIFIED','ON_HOLD')),
 evidence_summary jsonb not null default '{}'::jsonb,
 verified_by_source text,
 verified_at timestamptz,
 primary key (user_id,credential_code),
 constraint buklod_university_verified_gate check(status<>'VERIFIED' or (verified_by_source is not null and verified_at is not null))
);

create table if not exists public.buklod_university_awards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 credential_code text not null references public.buklod_university_credentials(code),
 status text not null default 'ISSUED' check(status in ('ISSUED','ON_HOLD','REVOKED')),
 qualifying_uc integer not null check(qualifying_uc>=0),
 policy_version text not null default 'BU-ACADEMIC-4',
 paper_status text not null default 'PENDING' check(paper_status in ('PENDING','READY','FAILED')),
 paper_path text,
 paper_sha256 text,
 issued_at timestamptz not null default now(),
 unique(user_id,credential_code),
 constraint buklod_university_paper_verification check(paper_status <> 'READY' or (paper_path is not null and paper_sha256 is not null))
);
create index if not exists buklod_university_awards_user_idx on public.buklod_university_awards(user_id,issued_at desc);
create index if not exists buklod_university_awards_admin_idx on public.buklod_university_awards(status,issued_at desc);

create table if not exists public.buklod_university_notification_ack (
 user_id uuid not null references auth.users(id) on delete cascade,
 award_id uuid not null references public.buklod_university_awards(id) on delete cascade,
 acknowledged_at timestamptz not null default now(),
 primary key(user_id,award_id)
);
-- Private issuer assets and owner PDF artifacts; no public storage.object policies.
insert into storage.buckets(id,name,public)
values('buklod-university-issuer','buklod-university-issuer',false),
      ('buklod-university-papers','buklod-university-papers',false)
on conflict(id) do nothing;

alter table public.buklod_university_config enable row level security;
alter table public.buklod_university_credentials enable row level security;
alter table public.buklod_university_uc_ledger enable row level security;
alter table public.buklod_university_credential_evidence enable row level security;
alter table public.buklod_university_awards enable row level security;
alter table public.buklod_university_notification_ack enable row level security;

revoke all on public.buklod_university_config, public.buklod_university_credentials,
 public.buklod_university_uc_ledger, public.buklod_university_credential_evidence,
 public.buklod_university_awards, public.buklod_university_notification_ack from anon,authenticated;
grant select on public.buklod_university_config, public.buklod_university_credentials,
 public.buklod_university_uc_ledger, public.buklod_university_credential_evidence,
 public.buklod_university_awards, public.buklod_university_notification_ack to authenticated;
grant insert on public.buklod_university_notification_ack to authenticated;
create policy buklod_university_config_read on public.buklod_university_config for select to authenticated using(true);
create policy buklod_university_catalog_read on public.buklod_university_credentials for select to authenticated using(true);
create policy buklod_university_uc_read on public.buklod_university_uc_ledger for select to authenticated using(user_id=(select auth.uid()));
create policy buklod_university_evidence_read on public.buklod_university_credential_evidence for select to authenticated using(user_id=(select auth.uid()));
create policy buklod_university_awards_read on public.buklod_university_awards for select to authenticated using(user_id=(select auth.uid()));
create policy buklod_university_ack_read on public.buklod_university_notification_ack for select to authenticated using(user_id=(select auth.uid()));
create policy buklod_university_ack_insert on public.buklod_university_notification_ack for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(
 select 1 from public.buklod_university_awards a where a.id=award_id and a.user_id=(select auth.uid()) and a.status='ISSUED'));

-- First three adapters use verified and approved source rows + linked point ledger receipts.
-- The other modules remain fail-closed until their independent completion adapters are tested.
create or replace function public.buklod_university_sync_my_uc_v1(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid());
  n_daily integer := 0; n_word integer := 0; n_abaka integer := 0;
  limit_rows integer := least(100,greatest(1,coalesce(p_limit,100)));
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not exists(select 1 from public.buklod_university_config where singleton and enabled) then
   return jsonb_build_object('enabled',false,'new_uc',0,'new_events',0);
 end if;
 with verified as (
   select s.id,s.user_id,s.reviewed_at,l.id as point_id from public.daily_bible_submissions s
   join public.buklod_points_ledger l on l.user_id=s.user_id and l.source_id=s.id
    and l.activity_type='daily_bible' and l.direction='credit'
   where s.user_id=actor and s.status='approved' and s.reviewed_at is not null
     and not exists(select 1 from public.buklod_university_uc_ledger u
       where u.user_id=actor and u.source_module='daily_reading' and u.source_key=s.id::text)
   order by s.reviewed_at limit limit_rows
 ), inserted as (
 insert into public.buklod_university_uc_ledger(user_id,source_module,source_key,source_ledger_id,uc,verified_at)
 select user_id,'daily_reading',id::text,point_id,1,reviewed_at from verified
 on conflict(user_id,source_module,source_key) do nothing returning 1
 ) select count(*) into n_daily from inserted;

 with verified as (
   select s.id,s.user_id,s.reviewed_at,l.id as point_id from public.devotional_reward_submissions s
   join public.buklod_points_ledger l on l.user_id=s.user_id and l.source_id=s.id
    and l.activity_type='devotional' and l.direction='credit'
   where s.user_id=actor and s.status='approved' and s.reviewed_at is not null
     and not exists(select 1 from public.buklod_university_uc_ledger u
      where u.user_id=actor and u.source_module='word' and u.source_key=s.id::text)
   order by s.reviewed_at limit limit_rows
 ), inserted as (
 insert into public.buklod_university_uc_ledger(user_id,source_module,source_key,source_ledger_id,uc,verified_at)
 select user_id,'word',id::text,point_id,2,reviewed_at from verified
 on conflict(user_id,source_module,source_key) do nothing returning 1
 ) select count(*) into n_word from inserted;

 with verified as (
 select p.user_id,p.lesson_id,p.completed_at,p.point_ledger_id
 from public.buklod_abc_growth_progress p join public.buklod_points_ledger l
  on l.id=p.point_ledger_id and l.user_id=p.user_id
  and l.activity_type='abc_growth_lesson' and l.direction='credit'
 where p.user_id=actor and p.completed_at is not null
  and not exists(select 1 from public.buklod_university_uc_ledger u
   where u.user_id=actor and u.source_module='abaka' and u.source_key=p.lesson_id)
 order by p.completed_at limit limit_rows
 ), inserted as (
 insert into public.buklod_university_uc_ledger(user_id,source_module,source_key,source_ledger_id,uc,verified_at)
 select user_id,'abaka',lesson_id,point_ledger_id,5,completed_at from verified
 on conflict(user_id,source_module,source_key) do nothing returning 1
 ) select count(*) into n_abaka from inserted;

 -- Only simple unambiguous prerequisites are auto-evidenced for this first safe rollout.
 insert into public.buklod_university_credential_evidence
 (user_id,credential_code,status,evidence_summary,verified_by_source,verified_at)
 select actor,'C-S01','VERIFIED',jsonb_build_object('daily_verified',count(*)),
 'buklod_university_uc_ledger:daily_reading',now()
 from public.buklod_university_uc_ledger where user_id=actor and source_module='daily_reading'
 having count(*)>=20
 on conflict(user_id,credential_code) do nothing;

 insert into public.buklod_university_credential_evidence
 (user_id,credential_code,status,evidence_summary,verified_by_source,verified_at)
 select actor,'C-S02','VERIFIED',jsonb_build_object(
 'daily_verified',count(*) filter(where source_module='daily_reading'),
 'word_verified',count(*) filter(where source_module='word')),
 'buklod_university_uc_ledger:daily_word',now()
 from public.buklod_university_uc_ledger where user_id=actor
 having count(*) filter(where source_module='daily_reading')>=12 and count(*) filter(where source_module='word')>=12
 on conflict(user_id,credential_code) do nothing;

 insert into public.buklod_university_credential_evidence
 (user_id,credential_code,status,evidence_summary,verified_by_source,verified_at)
 select actor,'C-D01','VERIFIED',jsonb_build_object('abaka_verified',count(*)),
 'buklod_abc_growth_progress:28_verified_lessons',now()
 from public.buklod_university_uc_ledger where user_id=actor and source_module='abaka'
  and (source_key in ('prelim-01','prelim-02') or source_key ~ '^lesson-(0[1-9]|1[0-9]|2[0-6])$')
 having count(distinct source_key)=28
 on conflict(user_id,credential_code) do nothing;

 return jsonb_build_object('enabled',true,'new_uc',n_daily+2*n_word+5*n_abaka,
 'new_events',n_daily+n_word+n_abaka,
 'source_counts',jsonb_build_object('daily_reading',n_daily,'word',n_word,'abaka',n_abaka));
end;
$$;

-- Hard gates: no award solely from sufficient UC; independently verified competency evidence is mandatory.
create or replace function public.buklod_university_evaluate_my_awards_v1()
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); c record; total_uc integer; issued integer:=0; inserted uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not exists(select 1 from public.buklod_university_config where singleton and enabled) then return 0;end if;
 select coalesce(sum(uc),0)::integer into total_uc from public.buklod_university_uc_ledger where user_id=actor;
 for c in select * from public.buklod_university_credentials where active order by min_uc,code loop
  if total_uc < c.min_uc then continue; end if;
  if not exists(select 1 from public.buklod_university_credential_evidence e
    where e.user_id=actor and e.credential_code=c.code and e.status='VERIFIED') then continue;end if;
  if exists(select 1 from unnest(c.prerequisites) required
    where not exists(select 1 from public.buklod_university_awards a
      where a.user_id=actor and a.credential_code=required and a.status='ISSUED')) then continue;end if;
  inserted:=null;
  insert into public.buklod_university_awards (user_id,credential_code,qualifying_uc)
   values(actor,c.code,total_uc) on conflict(user_id,credential_code) do nothing returning id into inserted;
  if inserted is not null then issued:=issued+1;end if;
 end loop;
 return issued;
end;
$$;

create or replace function public.buklod_university_my_summary_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); total_uc integer;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select coalesce(sum(uc),0)::integer into total_uc from public.buklod_university_uc_ledger where user_id=actor;
 return jsonb_build_object('total_uc',total_uc,
  'enabled',(select enabled from public.buklod_university_config where singleton),
  'awards',(select count(*) from public.buklod_university_awards a where a.user_id=actor and a.status='ISSUED'));
end;
$$;

create or replace function public.buklod_university_admin_recipients_v1(
 p_query text default '',p_tier text default null,p_limit integer default 30,p_offset integer default 0)
returns table(award_id uuid,user_id uuid,member_name text,credential_code text,
 credential_title text,credential_tier text,qualifying_uc integer,issued_at timestamptz,paper_status text)
language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
  raise exception 'System Admin required' using errcode='42501';
 end if;
 return query select a.id,a.user_id,
  coalesce(nullif(trim(p.full_name),''),'Member')::text,c.code,c.title,c.tier,
  a.qualifying_uc,a.issued_at,a.paper_status
 from public.buklod_university_awards a
 join public.buklod_university_credentials c on c.code=a.credential_code
 left join public.profiles p on p.id=a.user_id
 where a.status='ISSUED'
 and (p_tier is null or p_tier='' or c.tier=p_tier)
 and (coalesce(trim(p_query),'')='' or coalesce(p.full_name,'') ilike '%'||trim(p_query)||'%'
   or c.title ilike '%'||trim(p_query)||'%' or c.code ilike '%'||trim(p_query)||'%')
 order by a.issued_at desc,a.id
 limit least(100,greatest(1,coalesce(p_limit,30))) offset greatest(0,coalesce(p_offset,0));
end;
$$;

revoke all on function public.buklod_university_sync_my_uc_v1(integer),
 public.buklod_university_evaluate_my_awards_v1(),
 public.buklod_university_my_summary_v1(),
 public.buklod_university_admin_recipients_v1(text,text,integer,integer) from public,anon;
grant execute on function public.buklod_university_sync_my_uc_v1(integer),
 public.buklod_university_evaluate_my_awards_v1(),
 public.buklod_university_my_summary_v1(),
 public.buklod_university_admin_recipients_v1(text,text,integer,integer) to authenticated;
comment on table public.buklod_university_awards is
 'Independent internal MZB Ministry Inc. completion records; do not imply CHED equivalence or ordination. Enabled OFF until isolated staging QA.';
