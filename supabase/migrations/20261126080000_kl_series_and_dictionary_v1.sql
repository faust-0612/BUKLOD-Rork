-- Additive KL bookshelf and chapter-scoped glossary. Stage first.
-- Existing manuscript, approval, quiz, progress, media and rewards are untouched.
begin;
create table public.kl_series_v1 (
 season_number integer primary key check(season_number between 1 and 12),
 title text not null check(length(btrim(title)) between 3 and 250),
 cover_path text, published boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.kl_series_v1 enable row level security;
revoke all on public.kl_series_v1 from public,anon,authenticated;
insert into public.kl_series_v1(season_number,title,published) values(1,'Ang Lupang Hindi Namamatay',true);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kl-series-covers','kl-series-covers',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create function private.kl_is_active_admin_v1() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role::text='system_admin' and is_active=true)
$$;
revoke all on function private.kl_is_active_admin_v1() from public,anon,authenticated;
-- Only narrowly scoped RPCs expose series records. Draft covers remain private.
create function public.kl_series_list_v1(p_admin boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_admin and not private.kl_is_active_admin_v1() then raise exception 'Admin only'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(s) order by season_number),'[]'::jsonb)
 from public.kl_series_v1 s where published or p_admin);
end $$;
revoke all on function public.kl_series_list_v1(boolean) from public;
grant execute on function public.kl_series_list_v1(boolean) to authenticated,anon;
create function public.kl_series_cover_readable_v1(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.kl_is_active_admin_v1() or exists(select 1 from public.kl_series_v1 where published and cover_path=p_path)
$$;
revoke all on function public.kl_series_cover_readable_v1(text) from public;
grant execute on function public.kl_series_cover_readable_v1(text) to authenticated,anon;
create policy kl_series_cover_read_v1 on storage.objects for select to authenticated,anon
using(bucket_id='kl-series-covers' and public.kl_series_cover_readable_v1(name));
create policy kl_series_cover_upload_v1 on storage.objects for insert to authenticated
with check(bucket_id='kl-series-covers' and public.kl_series_cover_readable_v1('') and name ~ '^[0-9]{1,2}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$');
-- Admin cannot publish a newly created series without an uploaded cover.
create function public.kl_series_save_v1(p_season integer,p_title text,p_cover_path text default null,p_publish boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.kl_series_v1%rowtype; v_cover text;
begin
 if not private.kl_is_active_admin_v1() then raise exception 'Admin only'; end if;
 if p_season is null or p_season not between 1 and 12 or length(btrim(coalesce(p_title,''))) not between 3 and 250 then raise exception 'Invalid series'; end if;
 select * into v from public.kl_series_v1 where season_number=p_season for update;
 v_cover:=coalesce(nullif(p_cover_path,''),v.cover_path);
 if v_cover is not null and (split_part(v_cover,'/',1)<>p_season::text or not exists(select 1 from storage.objects where bucket_id='kl-series-covers' and name=v_cover)) then raise exception 'Cover not uploaded'; end if;
 if coalesce(p_publish,false) and v_cover is null and p_season<>1 then raise exception 'Upload a cover first'; end if;
 insert into public.kl_series_v1(season_number,title,cover_path,published)
 values(p_season,btrim(p_title),v_cover,coalesce(p_publish,false) or coalesce(v.published,false))
 on conflict(season_number) do update set title=excluded.title,cover_path=coalesce(excluded.cover_path,kl_series_v1.cover_path),published=kl_series_v1.published or excluded.published,updated_at=now()
 returning * into v;
 return to_jsonb(v);
end $$;
revoke all on function public.kl_series_save_v1(integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.kl_series_save_v1(integer,text,text,boolean) to authenticated;
-- Protect future series even when an older admin client calls chapter creation/release.
create function private.kl_require_series_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare v_published boolean;
begin
 select published into v_published from public.kl_series_v1 where season_number=new.season_number;
 if not found then raise exception 'Create the series in KL Studio first'; end if;
 if new.status='approved' and new.approved_at is not null and new.release_at is not null and not v_published then raise exception 'Publish the series cover first'; end if;
 return new;
end $$;
revoke all on function private.kl_require_series_v1() from public,anon,authenticated;
create trigger kl_require_series_v1 before insert or update of season_number,status,approved_at,release_at on public.kl_episodes for each row execute function private.kl_require_series_v1();

create table private.kl_dictionary_curated_v1(
 name text primary key,kind text not null,meaning text not null
);
alter table private.kl_dictionary_curated_v1 enable row level security;
revoke all on private.kl_dictionary_curated_v1 from public,anon,authenticated;
insert into private.kl_dictionary_curated_v1(name,kind,meaning) values
('Lunawen','Lugar','Pamayanang nasa gilid ng malawak na lambak. Ang mga tahanan nito ay hinuhubog mula sa isang batong tumitigas kapag nasisikatan ng liwanag.'),
('Dumalir','Lugar','Lupang sinasabing may kakayahang mag-ingat ng bakas ng mga lumipas.'),
('Sanghira','Nilalang / Puno','Isang sinaunang punong may mga ugat na nagtataglay ng gumagalaw na liwanag.'),
('Marukha','Nilalang','Isang nilalang sa mga salaysay na sinasabing nanghihiram ng pamilyar na mukha.'),
('Nalimor','Pangyayari','Pangalan sa kakaibang pagkawala ng mga alaala at mga bagay.'),
('Phan','Tauhan','Batang magsasaka mula sa Lunawen at nakatatandang kapatid ni Tali.'),
('Tali','Tauhan','Nakababatang kapatid ni Phan, praktikal at mapagmalasakit sa mga kasama.'),
('Mang Doro','Tauhan','Matandang tagapag-alaga ng mga balon ng Lunawen.'),
('Elyam','Tauhan','Pangalang ibinigay ni Tali sa batang walang anino, mula sa El na naaalala nito at Yam na ipinaliwanag ni Asun.'),
('Lalaking Nasa Pagitan','Tauhan','Mahiwagang taong nakabalabal.'),
('Salvo','Tauhan','Tauhang naninirahan sa Lunawen at gumagawa ng palayok.'),
('Dino','Tauhan','Batang tauhang katuwang ni Salvo.'),
('Aling Besa','Tauhan','Isa sa mga taong naninirahan sa Lunawen.'),
('Tonyo','Tauhan','Pangalan ng isang mag-anak na binabanggit sa Lunawen.'),
('Orbal','Tauhan','Matandang tagapag-alaga ng mga balon bago si Mang Doro.'),
('Ketra','Tauhan','Babaeng nakilala ng mga manlalakbay sa Salindaw at nagbigay ng parol.'),
('Nirel','Tauhan','Matandang tauhang kilala sa paghahabi.'),
('Asun','Tauhan','Tagapag-ingat ng mga tala sa Salindaw.'),
('Prima','Tauhan','Pangalang kaugnay ng mga pamilya sa Salindaw.'),
('Hesed','Tauhan','Pangalang kaugnay ng mga pamilya sa Salindaw.'),
('Orvan','Tauhan','Pangalang kaugnay ng mga pamilya sa Salindaw.'),
('Lumis','Tauhan','Pangalang kaugnay ng mga pamilya sa Salindaw.'),
('Valen','Tauhan','Tagapagbantay ng Pinto ng Dumalir.'),
('Sael','Tauhan','Binatilyong naglilingkod sa mga Tagapag-ingat at gumagabay sa mga bagong dating sa Dumalir.'),
('Maestro Calen','Tauhan','Isa sa tatlong namumuno sa Katipunan ng mga Tagapag-ingat ng Dumalir.'),
('Sirel','Tauhan','Tagapag-ingat ng Dumalir na mas bukas sa pagbabahagi ng mga tala.'),
('Odrin','Tauhan','Matandang Tagapag-ingat ng Dumalir na maingat sa pagbubunyag ng mga tala.'),
('Tiber','Tauhan','Tauhang nagtatanong tungkol sa isang silid.'),
('Maren','Tauhan','Tauhang kabilang sa nakaraan ng Dumalir.'),
('Hanira','Tauhan','Isa sa mga tinatawag na Hindi Nakalimot.'),
('Bastel','Tauhan','Isa sa mga tinatawag na Hindi Nakalimot.'),
('Orun','Tauhan','Isa sa mga tinatawag na Hindi Nakalimot.'),
('Sefa','Tauhan','Isa sa mga tinatawag na Hindi Nakalimot.'),
('Dulim','Tauhan','Isa sa mga tinatawag na Hindi Nakalimot.'),
('Kirab','Tauhan','Isa sa mga tinatawag na Hindi Nakalimot.'),
('Nena','Tauhan','Isa sa mga tinatawag na Hindi Nakalimot.'),
('Quin','Tauhan','Manlalakbay na may sariling mapa at nagtatala ng mga landas.'),
('Van','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Christian','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Lhen','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Ace','Tauhan','Manlalakbay na tumutulong sa pag-aayos at pamamahagi ng mga kagamitan.'),
('ELESUR','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Jawo','Tauhan','Manlalakbay na may dalang plawtang kahoy.'),
('Mitch','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Niel','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Angel','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Vhen','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Trudice','Tauhan','Isa sa mahahalagang tauhan sa mas malawak na serye.'),
('Ulnarik','Lugar','Daigdig na inuugnay sa gunita at pagkalito sa nakaraan.'),
('Tigmalar','Lugar','Daigdig na inuugnay sa sukat at mahigpit na kaayusan.'),
('Hatiran','Lugar','Daigdig na inuugnay sa mga pagpili at mga bunga nito.'),
('Marukhan','Lugar','Daigdig na inuugnay sa pagkakakilanlan at panggagaya.'),
('Lampira','Lugar','Daigdig na inuugnay sa mga parol at pagkilala sa katotohanan.'),
('Kulimbay','Lugar','Daigdig na inuugnay sa takot.'),
('Hulmalen','Lugar','Daigdig na inuugnay sa tukso at labis na aliw.'),
('Dalamhira','Lugar','Daigdig na inuugnay sa pagdurusa at pag-asa.'),
('Tahimir','Lugar','Daigdig na inuugnay sa katahimikan at mga lihim.'),
('Ilawin','Lugar','Daigdig na inuugnay sa liwanag at pag-asa.'),
('Pader ng Pagbabalik','Lugar','Isang hangganang binabanggit sa paglalakbay.'),
('Kagubatang May Mga Bakas','Lugar','Gubat na may mga bakas na bahagi ng hiwaga ng lugar.'),
('Mga ilog na umaakyat','Lugar','Mga ilog na dumadaloy nang salungat sa karaniwan.'),
('Salindaw','Lugar','Pamayanang may habihan at Bahay ng mga Tala.'),
('Silid ng Pahinga','Lugar','Isa sa mga silid sa Salindaw.'),
('Habihan','Lugar','Lugar na pinaghahabihan o pinaggagawaan ng tela.'),
('Bahay ng mga Tala','Lugar','Lugar na pinag-iingatan ng mga tala sa Salindaw.'),
('Bulwagan ng mga Tagapag-ingat','Lugar','Lugar ng pagtitipon ng mga tagapag-ingat.'),
('Silid ng mga Marka','Lugar','Silid na may mga iniingatang marka at tala.'),
('Ikapitong Silid','Lugar','Silid na may natatanging papel sa mga tala ng Dumalir.'),
('Hardin ng Dapit','Lugar','Isang hardin na binabanggit sa Dumalir.'),
('Lumang Daluyan','Lugar','Matandang lagusang kaugnay ng mga daluyan ng tubig.'),
('Ilalim na Bayan','Lugar','Pamayanang nasa ilalim ng lupa.'),
('Silid ng mga Hindi Tinanong','Lugar','Bulwagang binabanggit sa kasaysayan ng mga nanirahan sa unang Lunawen.'),
('Puso ng Ugat','Lugar','Lugar na kaugnay ng mga daluyan ng tubig sa ilalim ng lupa.'),
('Kahoy na may apat na guhit','Bagay / Simbolo','Piraso ng kahoy na may apat na natatanging marka.'),
('Tatlong batong palatandaan','Bagay / Simbolo','Mga batong ginagamit bilang tanda sa daan.'),
('Batong may puwang','Bagay / Simbolo','Bato na may uka o puwang na nagsisilbing tanda.'),
('Roll ng tatlong pahina','Bagay / Simbolo','Nakabalumbong tala na binubuo ng tatlong pahina.'),
('Mga binhi','Bagay / Simbolo','Mga butong maaaring itanim upang tumubo.'),
('Kumot ng ama','Bagay / Simbolo','Kumot na inuugnay sa ama ni Phan.'),
('Parol','Bagay / Simbolo','Ilawang may takip o sisidlang pumoprotekta sa apoy.'),
('Awit ng Kulang','Bagay / Simbolo','Matandang himig na binabanggit ng mga Hindi Nakalimot.'),
('Habing Dumaan','Bagay / Simbolo','Telang hinabi sa Salindaw na may natatanging disenyo.'),
('Tanda ng Pahintulot','Bagay / Simbolo','Tabletang may mga marka na nagpapakita ng pahintulot sa pagpasok at pagbabasa ng mga tala sa Dumalir.'),
('Mapa ng mga daluyan','Bagay / Simbolo','Mapa na nagpapakita ng mga dinaraanan o agos.'),
('ikaapat na guhit','Bagay / Simbolo','Ikaapat na marka sa isang hanay ng mga guhit.'),
('Katipunan ng mga Tagapag-ingat','Pangkat / Konsepto','Pangkat ng mga tagapag-ingat ng tala at kaalaman.'),
('Mga Nag-iingat','Pangkat / Konsepto','Pangkat na kumakatawan sa maingat na paghawak ng kaalaman.'),
('Mga Bukas','Pangkat / Konsepto','Pangkat na inuugnay sa pagbubukas ng kaalaman.'),
('Mga Hindi Nakalimot','Pangkat / Konsepto','Tawag sa pangkat na nag-iingat ng mga alaala.'),
('Pasan ang tanong','Pangkat / Konsepto','Paraan ng pagdadala at pagninilay sa isang tanong.'),
('Pitong gabi ng apoy','Pangkat / Konsepto','Tawag sa isang pangyayaring naganap sa Dumalir.'),
('Ang apat na daluyan','Pangkat / Konsepto','Apat na daanan o agos na magkakaugnay.'),
('Ang Susi','Pangkat / Konsepto','Mahiwagang katawagang hindi pa lubos na naipaliliwanag.'),
('Mga tinig mula sa ilalim','Pangkat / Konsepto','Tawag sa mga tinig na inuugnay sa mga alaala sa ilalim.'),
('Batang walang anino','Pangkat / Konsepto','Paglalarawan sa batang hindi nakikitaan ng anino.'),
('liwasan','Salita','Maluwang na pampublikong lugar o plasa.'),
('imbakan','Salita','Lugar o sisidlan kung saan inilalagay ang mga bagay para itago.'),
('siwang','Salita','Makitid na bukas o pagitan ng dalawang bagay.'),
('balabal','Salita','Telang nakapatong sa balikat at katawan bilang pantakip.'),
('talukbong','Salita','Telang pantakip sa ulo o mukha.'),
('bingaw','Salita','Maliit na uka o puwang sa gilid ng isang bagay.'),
('pisi','Salita','Manipis na lubid na panali.'),
('pagkit','Salita','Materyal na tulad ng waks na maaaring pansara o pangtatak.'),
('hibla','Salita','Manipis na sinulid o bahagi ng tela at halaman.'),
('daluyan','Salita','Daanan ng tubig, hangin, o ibang dumadaloy.'),
('salinlahi','Salita','Magkakasunod na henerasyon ng isang pamilya o pangkat.'),
('dapithapon','Salita','Oras bago tuluyang lumubog ang araw.'),
('tarangkahan','Salita','Malaking pintuang panlabas ng isang lugar.'),
('tipan','Salita','Kasunduan o pangakong pinagtibay ng mga panig.'),
('tagapag-alaga','Salita','Taong may tungkuling mag-aruga at mag-ingat.'),
('tagapag-ingat','Salita','Taong may tungkuling magbantay at magpanatili.'),
('tagapagbantay','Salita','Taong nagmamasid at nangangalaga laban sa panganib.'),
('tagapagtala','Salita','Taong sumusulat o nagtatala ng impormasyon.'),
('palatandaan','Salita','Marka o senyas na nagbibigay ng pahiwatig.'),
('dipa','Salita','Sukat mula sa dulo ng isang nakabukang braso hanggang sa kabila.'),
('pitsel','Salita','Sisidlang may hawakan na karaniwang lalagyan ng tubig.'),
('sisidlan','Salita','Bagay na ginagamit bilang lalagyan.'),
('sapin','Salita','Bagay o telang inilalagay bilang takip o patong.'),
('tableta','Salita','Maliit na patag na bagay na maaaring may nakaukit na tanda.'),
('tabletang','Salita','Anyo ng salitang tableta kapag may kasunod na paglalarawan.'),
('pilak','Salita','Metal na maputi at makintab.'),
('abuhin','Salita','Kulay na kahawig ng abo.'),
('kulay-kalawang','Salita','Mapulang kayumanggi na kahawig ng kalawang.'),
('kulay-gatas','Salita','Maputing kahawig ng gatas.'),
('Bogo','Tauhan','Batang kasama ni Asun sa Bahay ng mga Tala sa Salindaw.'),
('Narek','Tauhan','Mamamayan ng Dumalir na nagnanais mabasa ang mga tala ng kaniyang ama.'),
('Dalungaw','Nilalang','Mga nilalang na nakatira sa tubig, may mga lamad sa leeg, at nagpapasa ng mga salaysay sa pamamagitan ng himig at panginginig ng tubig.'),
('Balat-bato','Nilalang','Mga nilalang na may matitigas na umbok sa katawan at nakararamdam ng maliliit na pagyanig sa bato at lupa.'),
('Matandang Tagaakyat','Nilalang','Napakalaking nilalang na kahawig ng pagong na naglalakbay sa mga ilog na umaakyat.'),
('Gagamba ng Pisi','Nilalang','Mga gagambang humahabi ng mga hiblang ginagamit sa pag-iingat at pag-uugnay ng mga tala.'),
('El','Wika ng daigdig','Bahagi ng pangalan na naaalala ng batang tinawag na Elyam.'),
('Yam','Wika ng daigdig','Sa paliwanag ni Asun, ang hawak na hindi bumibitaw.'),
('Pinto ng Dumalir','Lugar / Simbolo','Mahiwagang pasukan sa lungsod ng Dumalir na may nakaukit na mga guhit.'),
('Bahay ng Pahinga','Lugar','Pasilidad sa Dumalir kung saan dinadala ang ilang mamamayan upang magpahinga at mapangalagaan.'),
('Paalala ng Pagbasa','Kaugalian','Tunog na hudyat sa Dumalir mula sa mga pilak na hibla sa pagitan ng mga gusali.'),
('Mapulang latak','Bagay / Pangyayari','Maliliit na butil na kulay-pula na napapansin sa ilang daluyan ng tubig.'),
('Pilak na hibla','Bagay','Mga hiblang may natatanging gamit sa pagbibigay ng liwanag, tunog o pag-iingat ng mga tala.'),
('Pitong buhol','Bagay / Simbolo','Pitong markang nakabuhol sa isa sa matatandang tala ng Salindaw.'),
('Tagapag-alaga ng mga balon','Tungkulin','Taong pinagkatiwalaang pangalagaan ang mga balon at ang mga aral na kaugnay ng mga ito.'),
('Unang Tagapag-alaga','Tauhan / Tungkulin','Sinaunang tagapag-alaga na binabanggit sa mga tala tungkol sa mga balon.'),
('Unang Lunawen','Lugar / Kasaysayan','Naunang pamayanan na binabanggit sa matatandang salaysay tungkol sa Lunawen.'),
('Lumalang','Konsepto','Tawag sa lumikha ng daigdig at sa pinagmumulan ng buhay at mga kaloob.'),
('Tore ng Dumalir','Lugar','Matangkad na tore sa gitna ng lawa ng Dumalir na may maputlang liwanag sa tuktok.'),
('Plaza ng Pagbasa','Lugar','Pampublikong lugar sa Dumalir kung saan binabasa ang mga tala.'),
('Himig ni Orbal','Bagay / Simbolo','Himig na naaalala ni Mang Doro mula sa matandang tagapag-alaga.'),
('Mga taga-Lunawen','Pangkat','Mga naninirahan sa pamayanang Lunawen.');
create table private.kl_dictionary_jobs_v1(
 episode_id uuid not null references public.kl_episodes(id) on delete cascade,
 source_hash text not null check(source_hash ~ '^[0-9a-f]{32}$'),
 state text not null default 'pending' check(state in ('pending','running','ready','failed')),
 attempts integer not null default 0, lease_until timestamptz, next_attempt timestamptz not null default now(),
 lease_token uuid, entries jsonb not null default '[]', last_error text,
 updated_at timestamptz not null default now(), primary key(episode_id,source_hash)
);
alter table private.kl_dictionary_jobs_v1 enable row level security;
revoke all on private.kl_dictionary_jobs_v1 from public,anon,authenticated;
-- The displayed revision, not the historical quiz manuscript, defines the glossary.
create function private.kl_dictionary_source_v1(p_episode uuid)
returns text language plpgsql stable security definer set search_path='' as $
declare v_base text; v_revision text;
begin
 select e.manuscript into v_base
 from public.kl_episodes e join public.kl_series_v1 s using(season_number)
 where e.id=p_episode and s.published and e.status='approved' and e.approved_at is not null and e.release_at<=now();
 if not found then return null; end if;
 -- Editorial revisions are already available in the shared production schema;
 -- fresh staging installs may not yet have that independent migration.
 if to_regprocedure('private.kl_editorial_current_v1(uuid,boolean)') is not null then
  execute 'select (private.kl_editorial_current_v1($1,false)).manuscript' into v_revision using p_episode;
 end if;
 return coalesce(v_revision,v_base);
end $;
revoke all on function private.kl_dictionary_source_v1(uuid) from public,anon,authenticated;
create function public.kl_dictionary_read_v1(p_episode_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_source text; v_generated jsonb; v_curated jsonb; v_season integer; v_episode integer;
begin
 v_source:=private.kl_dictionary_source_v1(p_episode_id);
 if v_source is null then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'kind',kind,'meaning',meaning) order by name),'[]') into v_curated
 from private.kl_dictionary_curated_v1 where strpos(lower(v_source),lower(name))>0;
 -- A prior chapter's validated terms can recur without another definition.
 -- Never expose a future chapter or stale revision; current chapter text
 -- must contain the term before its definition is returned.
 select season_number,episode_number into v_season,v_episode from public.kl_episodes where id=p_episode_id;
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'kind',kind,'meaning',meaning) order by name),'[]') into v_generated
 from (
  select distinct on(lower(x->>'name')) x->>'name' name,x->>'kind' kind,x->>'meaning' meaning
  from private.kl_dictionary_jobs_v1 j join public.kl_episodes e on e.id=j.episode_id
  cross join lateral jsonb_array_elements(j.entries) x
  where j.state='ready' and (e.season_number,e.episode_number)<=(v_season,v_episode)
  and j.source_hash=md5(private.kl_dictionary_source_v1(j.episode_id))
  and strpos(lower(v_source),lower(x->>'name'))>0
  order by lower(x->>'name'),e.season_number,e.episode_number
 ) prior_terms;
 return v_curated||coalesce(v_generated,'[]'::jsonb);
end $$;
revoke all on function public.kl_dictionary_read_v1(uuid) from public;
grant execute on function public.kl_dictionary_read_v1(uuid) to authenticated,anon;
-- Worker-only RPC claims at most one source version per invocation. Stale leases recover.
create function public.kl_dictionary_claim_v1() returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.kl_dictionary_jobs_v1%rowtype; v_source text;
begin
 insert into private.kl_dictionary_jobs_v1(episode_id,source_hash)
 select e.id,md5(src.manuscript) from public.kl_episodes e
 cross join lateral (select private.kl_dictionary_source_v1(e.id) as manuscript) src
 where e.status='approved' and e.release_at<=now() and src.manuscript is not null and length(src.manuscript) between 100 and 200000
 on conflict do nothing;
 select j.* into v from private.kl_dictionary_jobs_v1 j
 where j.attempts<5 and j.next_attempt<=now() and (j.state in ('pending','failed') or (j.state='running' and j.lease_until<now()))
 and j.source_hash=md5(private.kl_dictionary_source_v1(j.episode_id))
 order by j.next_attempt,(select season_number from public.kl_episodes e where e.id=j.episode_id),(select episode_number from public.kl_episodes e where e.id=j.episode_id) limit 1 for update skip locked;
 if not found then return null; end if;
 v_source:=private.kl_dictionary_source_v1(v.episode_id);
 update private.kl_dictionary_jobs_v1 set state='running',attempts=attempts+1,lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid(),updated_at=now() where episode_id=v.episode_id and source_hash=v.source_hash returning * into v;
 return jsonb_build_object('episode_id',v.episode_id,'source_hash',v.source_hash,'lease_token',v.lease_token,'manuscript',v_source,'known_names',(select coalesce(jsonb_agg(name order by name),'[]') from (
 select name from private.kl_dictionary_curated_v1
 union select unnest(array['Calen','Balat-batong','Gagambang Pisi','Hindi Nakalimot','ilog na umaakyat','ilog na dumadaloy paakyat','mga ilog na dumadaloy paakyat','mga ilog na hindi dumadaloy pababa','ilog na hindi dumadaloy pababa','pulang latak','Katipunan','pilak na hiblang','tagapag-alaga ng balon'])
 union select x->>'name' from private.kl_dictionary_jobs_v1 j join public.kl_episodes e on e.id=j.episode_id
 cross join lateral jsonb_array_elements(j.entries) x
 where j.state='ready' and j.source_hash=md5(private.kl_dictionary_source_v1(j.episode_id))
 and (e.season_number,e.episode_number)<(select season_number,episode_number from public.kl_episodes where id=v.episode_id)
 ) known));
end $$;
revoke all on function public.kl_dictionary_claim_v1() from public,anon,authenticated;
grant execute on function public.kl_dictionary_claim_v1() to service_role;
create function public.kl_dictionary_finish_v1(p_episode uuid,p_hash text,p_lease uuid,p_items jsonb,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_source text; v_entries jsonb; v_count integer;
begin
 v_source:=private.kl_dictionary_source_v1(p_episode);
 if v_source is null or md5(v_source) is distinct from p_hash then return false; end if;
 if p_error is null then
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid glossary'; end if;
  if jsonb_array_length(p_items)>24 then raise exception 'Invalid glossary'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'kind',kind,'meaning',meaning,'evidence',evidence) order by name),'[]') into v_entries
  from (select distinct on(lower(btrim(x->>'name'))) btrim(x->>'name') name,btrim(x->>'kind') kind,btrim(x->>'meaning') meaning,btrim(x->>'evidence') evidence
   from jsonb_array_elements(p_items) x
   where length(btrim(x->>'name')) between 2 and 100 and length(btrim(x->>'kind')) between 2 and 50
   and btrim(x->>'name') !~ '[[:cntrl:]]' and length(btrim(x->>'meaning')) between 8 and 500 and length(btrim(x->>'evidence')) between 12 and 800
   and strpos(v_source,btrim(x->>'evidence'))>0 and strpos(lower(x->>'evidence'),lower(btrim(x->>'name')))>0
   and not exists(select 1 from private.kl_dictionary_curated_v1 c where lower(c.name)=lower(btrim(x->>'name')))
   order by lower(btrim(x->>'name'))) accepted;
  if jsonb_array_length(p_items)>0 and jsonb_array_length(v_entries)=0 then raise exception 'No source-grounded glossary entries'; end if;
 end if;
 update private.kl_dictionary_jobs_v1 set state=case when p_error is null then 'ready' else 'failed' end,
 entries=coalesce(v_entries,'[]'),last_error=left(p_error,160),lease_until=null,lease_token=null,
 next_attempt=now()+interval '30 minutes'*greatest(attempts,1),updated_at=now()
 where episode_id=p_episode and source_hash=p_hash and lease_token=p_lease and state='running' and lease_until>=now();
 get diagnostics v_count=row_count; return v_count=1;
end $$;
revoke all on function public.kl_dictionary_finish_v1(uuid,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.kl_dictionary_finish_v1(uuid,text,uuid,jsonb,text) to service_role;
-- Deploy worker first, configure dedicated secret in Edge + Vault, then enable cron.
-- No existing scheduler credential is reused.
commit;
