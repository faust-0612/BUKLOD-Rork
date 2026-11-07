-- BUKLOD Home weekly helpful tips, real reactions, reflective Dugtong, and verified Points.
-- Source-only additive migration; do not apply to production without QA.
-- Existing community posts, reaction tables, BP ledger, and points rules are NOT replaced.
create table if not exists public.buklod_weekly_tips_v1 (
  tip_index integer primary key check (tip_index between 0 and 11),
  category text not null,
  title text not null,
  lead text not null,
  continuation text not null,
  weekly_action text not null,
  enabled boolean not null default true
);
alter table public.buklod_weekly_tips_v1 enable row level security;
revoke all on public.buklod_weekly_tips_v1 from public,anon,authenticated;
grant select on public.buklod_weekly_tips_v1 to anon,authenticated;
drop policy if exists weekly_tips_public_read_v1 on public.buklod_weekly_tips_v1;
create policy weekly_tips_public_read_v1 on public.buklod_weekly_tips_v1
  for select to anon,authenticated using (enabled);

insert into public.buklod_weekly_tips_v1(tip_index,category,title,lead,continuation,weekly_action,enabled) values
 (0,'LOVE','Pagmamahal na nararamdaman','Hindi laging malaking regalo ang kailangan. Minsan, ang sampung minutong pakikinig ay mas mahalaga sa mamahaling sorpresa.','Dugtong: Magtanong ngayon ng “Kumusta ka talaga?” at makinig nang hindi agad nagbibigay ng solusyon.','Pumili ng isang taong bibigyan mo ng buong atensyon ngayong linggo.',true),
 (1,'FAMILY','Bahay na may usapan','Kapag may hindi pagkakaunawaan sa pamilya, mas mahalaga ang pag-unawa kaysa pagpanalo sa argumento.','Dugtong: Gumamit ng “Nararamdaman ko…” sa halip na “Lagi kang…”. Maliliit na salita, malaking kaibahan.','Maglaan ng isang mahinahong family check-in.',true),
 (2,'MENTAL_HEALTH','Pahinga ay bahagi ng pag-usad','Hindi sukatan ng halaga mo ang dami ng natapos mo ngayong araw. May panahon para kumilos at may panahon para magpahinga.','Dugtong: Pumili ng isang gawain na maaari mong ipagpaliban. Ang pahinga, tulog at paghingi ng suporta ay mga makatotohanang hakbang.','Kausapin ang pinagkakatiwalaang tao kapag mabigat ang nararamdaman.',true),
 (3,'HEALTH','Isang lakad, maraming benepisyo','Hindi kailangang matindi agad ang ehersisyo. Ang ligtas at regular na paggalaw ay magandang simula para sa maraming tao.','Dugtong: Subukang magsimula sa maikling lakad o pag-unat na angkop sa iyong kalusugan at kakayahan.','Pumili ng maliliit at ligtas na galaw na maaari mong ulitin.',true),
 (4,'HEART','Makinig bago magpaliwanag','Sa relasyon, minsan ang kailangan ng kasama mo ay maramdaman na naririnig siya, hindi agad mabigyan ng sagot.','Dugtong: Ulitin ang naunawaan mo bago sumagot: “Ang ibig mong sabihin…”. Nakakatulong itong maiwasan ang maling akala.','Tanungin ang isang mahal sa buhay kung paano mo siya masusuportahan.',true),
 (5,'LIFE','Isang hakbang bawat linggo','Ang malalaking pagbabago ay mas madaling simulan kapag hinahati sa maliliit at malinaw na hakbang.','Dugtong: Pumili ng isang layuning kaya sa pitong araw. Isulat ang unang konkretong gawain at kailan mo gagawin.','Piliin ang isang makatotohanang goal para sa linggong ito.',true),
 (6,'SLEEP','Mas mahinahong gabi','Ang regular na oras ng tulog at paggising ay makatutulong sa mas maayos na pahinga para sa maraming tao.','Dugtong: Kung maaari, bawasan ang maliwanag na screen at caffeine malapit sa oras ng tulog. Iayon ang routine sa iyong sitwasyon.','Magtakda ng isang simpleng evening habit.',true),
 (7,'FRIENDSHIP','Pagkakaibigang may kamustahan','Hindi kailangang may okasyon para sabihing mahalaga sa iyo ang isang kaibigan.','Dugtong: Isang simpleng mensahe na “Naalala kita. Kumusta?” ay maaaring magbukas ng makabuluhang usapan.','Kamustahin ang isang taong matagal mo nang hindi nakakausap.',true),
 (8,'BOUNDARIES','Ang mabuting hangganan ay may respeto','Puwedeng maging mapagmalasakit at sabay na maging malinaw sa sariling oras, lakas at limitasyon.','Dugtong: Magsanay ng magalang ngunit tiyak na sagot: “Gusto kong tumulong, pero hindi ko kaya ngayong araw.”','Pumili ng isang healthy boundary na makatutulong sa iyong linggo.',true),
 (9,'COMMUNICATION','Mas malinaw kaysa mas malakas','Kapag mainit ang usapan, mas nakakatulong ang paghinto sandali at pagbabalik kapag kalmado na kaysa pasigaw na pagtatalo.','Dugtong: Itanong kung pareho kayong handang mag-usap. Pagkatapos, isa-isahin ang problema nang hindi inaatake ang pagkatao.','Subukan ang isang mahinahon at malinaw na pag-uusap.',true),
 (10,'STRESS','Hindi kailangang sarilinin','Kapag matindi ang stress, ang pakikipag-usap sa isang taong ligtas at pinagkakatiwalaan ay maaaring makatulong.','Dugtong: Huminga nang dahan-dahan kung komportable, magpahinga, at isulat kung alin ang kaya mong kontrolin. Humingi ng propesyonal na tulong kung kailangan.','Kilalanin ang isang mapagkakatiwalaang taong maaaring lapitan.',true),
 (11,'WELLNESS','Alaga sa sarili, alaga sa iba','Ang pag-inom ng tubig, balanseng pagkain, at pahinga ay mga simpleng paraan ng pag-aalaga sa katawan at isip.','Dugtong: Sa halip na biglaang mahigpit na pagbabago, pumili ng isang positibong gawi na akma sa iyong pangangailangan.','Pumili ng isang healthy habit na kaya mong panindigan.',true)
on conflict(tip_index) do nothing;

create table if not exists public.buklod_weekly_tip_interactions_v1 (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  tip_index integer not null references public.buklod_weekly_tips_v1(tip_index),
  reaction text check(reaction in ('helpful','heart','relate')),
  reacted_at timestamptz,
  dugtong text check(char_length(dugtong) between 30 and 1200),
  dugtong_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id,week_start)
);
create index if not exists buklod_weekly_tip_reactions_week_v1
  on public.buklod_weekly_tip_interactions_v1(week_start,tip_index);
alter table public.buklod_weekly_tip_interactions_v1 enable row level security;
revoke all on public.buklod_weekly_tip_interactions_v1 from public,anon,authenticated;
grant select on public.buklod_weekly_tip_interactions_v1 to authenticated;
drop policy if exists weekly_tip_own_select_v1 on public.buklod_weekly_tip_interactions_v1;
create policy weekly_tip_own_select_v1 on public.buklod_weekly_tip_interactions_v1
  for select to authenticated using (user_id=(select auth.uid()));

-- Dedicated rules: real verified credit only on the first valid action per
-- user per Monday-based Manila week, with unique source_key idempotency.
insert into public.buklod_point_rules(
  activity_type,label,base_points,max_points_per_event,daily_cap_points,
  weekly_cap_points,is_active,notes
) values
 ('weekly_tip_reaction','BUKLOD Today weekly helpful tip reaction',1,1,1,1,true,
  'First verified weekly tip reaction only; no reward for views, scroll or switching reactions'),
 ('weekly_tip_dugtong','BUKLOD Today weekly helpful tip meaningful Dugtong',2,2,2,2,true,
  'First user-written reflection at least 30 characters per week; editable, never repeatedly credited')
on conflict(activity_type) do nothing;

create or replace function public.get_buklod_weekly_tip_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $weekly$
declare
 v_user uuid := (select auth.uid());
 v_week date := date_trunc('week',now() at time zone 'Asia/Manila')::date;
 v_tip public.buklod_weekly_tips_v1%rowtype;
 v_my public.buklod_weekly_tip_interactions_v1%rowtype;
begin
 select * into v_tip from public.buklod_weekly_tips_v1
  where tip_index=mod(((v_week-date '2026-11-02')/7),12) and enabled=true;
 if not found then return null; end if;
 if v_user is not null then
  select * into v_my from public.buklod_weekly_tip_interactions_v1
   where user_id=v_user and week_start=v_week;
 end if;
 return pg_catalog.jsonb_build_object(
  'week_start',v_week,'tip_index',v_tip.tip_index,'category',v_tip.category,
  'title',v_tip.title,'lead',v_tip.lead,'continuation',v_tip.continuation,
  'weekly_action',v_tip.weekly_action,
  'my_reaction',v_my.reaction,'my_dugtong',v_my.dugtong,
  'authenticated',v_user is not null,
  'points_enabled',(select coalesce(bool_and(r.is_active),false) from public.buklod_point_rules r
    where r.activity_type in ('weekly_tip_reaction','weekly_tip_dugtong'))
 );
end;
$weekly$;
revoke all on function public.get_buklod_weekly_tip_v1() from public,anon,authenticated;
grant execute on function public.get_buklod_weekly_tip_v1() to anon,authenticated;

create or replace function public.react_to_buklod_weekly_tip_v1(
 p_reaction text default null,p_dugtong text default null)
returns jsonb language plpgsql security definer set search_path='' as $weekly$
declare
 v_user uuid := (select auth.uid());
 v_week date := date_trunc('week',now() at time zone 'Asia/Manila')::date;
 v_tip integer := mod(((v_week-date '2026-11-02')/7),12);
 v_existing public.buklod_weekly_tip_interactions_v1%rowtype;
 v_first_reaction boolean := false;
 v_first_dugtong boolean := false;
 v_awarded integer := 0;
 v_points integer;
 v_ledger_id uuid;
begin
 if v_user is null then raise exception 'Sign in to react to weekly tips' using errcode='42501';end if;
 if not exists(select 1 from public.profiles where id=v_user and is_active=true) then
   raise exception 'Active BUKLOD account required' using errcode='42501';end if;
 if not exists(select 1 from public.buklod_weekly_tips_v1 where tip_index=v_tip and enabled) then
   raise exception 'Current weekly tip unavailable';end if;
 if p_reaction is null and p_dugtong is null then
   raise exception 'Select a reaction or write a reflection';end if;
 if p_reaction is not null and p_reaction not in ('helpful','heart','relate') then
   raise exception 'Invalid reaction';end if;
 if p_dugtong is not null and char_length(pg_catalog.btrim(p_dugtong)) not between 30 and 1200 then
   raise exception 'Reflection must contain 30–1200 characters';end if;

 -- Serialize this user's own engagement and ledger award within one TX.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('buklod:weekly-tip:'||v_user::text||':'||v_week::text,0)
 );
 insert into public.buklod_weekly_tip_interactions_v1(user_id,week_start,tip_index)
  values(v_user,v_week,v_tip)
  on conflict(user_id,week_start) do nothing;
 select * into v_existing from public.buklod_weekly_tip_interactions_v1
  where user_id=v_user and week_start=v_week for update;
 v_first_reaction := p_reaction is not null and v_existing.reacted_at is null;
 v_first_dugtong := p_dugtong is not null and v_existing.dugtong_at is null;
 update public.buklod_weekly_tip_interactions_v1
   set reaction=coalesce(p_reaction,reaction),
       reacted_at=case when v_first_reaction then now() else reacted_at end,
       dugtong=coalesce(pg_catalog.nullif(pg_catalog.btrim(p_dugtong),''),dugtong),
       dugtong_at=case when v_first_dugtong then now() else dugtong_at end,
       updated_at=now()
  where user_id=v_user and week_start=v_week;

 -- Use the existing ledger and claim trigger, never mutate balances in UI.
 if v_first_reaction then
   insert into public.buklod_points_ledger(
     user_id,direction,points,activity_type,source_key,source_id,description
   )
   select v_user,'credit',r.base_points,r.activity_type,
     'weekly_tip:'||v_week::text||':reaction',null,
     'Verified weekly BUKLOD Today reaction'
   from public.buklod_point_rules r
   where r.activity_type='weekly_tip_reaction' and r.is_active
     and r.base_points between 1 and coalesce(r.max_points_per_event,r.base_points)
     and r.base_points<=coalesce(r.weekly_cap_points,r.base_points)
   on conflict(user_id,source_key) do nothing returning id,points into v_ledger_id,v_points;
   if v_ledger_id is not null then v_awarded:=v_awarded+v_points;end if;
 end if;
 if v_first_dugtong then
   v_ledger_id:=null; v_points:=null;
   insert into public.buklod_points_ledger(
     user_id,direction,points,activity_type,source_key,source_id,description
   )
   select v_user,'credit',r.base_points,r.activity_type,
     'weekly_tip:'||v_week::text||':dugtong',null,
     'Verified weekly BUKLOD Today reflection'
   from public.buklod_point_rules r
   where r.activity_type='weekly_tip_dugtong' and r.is_active
     and r.base_points between 1 and coalesce(r.max_points_per_event,r.base_points)
     and r.base_points<=coalesce(r.weekly_cap_points,r.base_points)
   on conflict(user_id,source_key) do nothing returning id,points into v_ledger_id,v_points;
   if v_ledger_id is not null then v_awarded:=v_awarded+v_points;end if;
 end if;

 return pg_catalog.jsonb_build_object(
   'ok',true,'week_start',v_week,'reaction',coalesce(p_reaction,v_existing.reaction),
   'dugtong_saved',p_dugtong is not null,
   'awarded_points',v_awarded,'points_pending_claim',v_awarded>0,
   'first_reaction',v_first_reaction,'first_dugtong',v_first_dugtong);
end;
$weekly$;
revoke all on function public.react_to_buklod_weekly_tip_v1(text,text) from public,anon,authenticated;
grant execute on function public.react_to_buklod_weekly_tip_v1(text,text) to authenticated;
