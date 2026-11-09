-- Bible Quiz V4 audited educational feedback for all 45 imported R3 MCQs.
-- Keep the R3 bank untouched for old clients; patch private V4 question metadata only.
update private.buklod_bible_v4_questions q set
  scripture_reference=v.reference,
  rationale=v.explanation,
  prompt=coalesce(v.improved_prompt,q.prompt)
from (values
  ('ark','Genesis 6:13–22','Tinagubilinan ng Diyos si Noe na gumawa ng arka bilang paghahanda sa baha.',null),
  ('bethlehem','Lucas 2:4–7','Nasa Bethlehem sina Jose at Maria nang ipanganak si Jesus.',null),
  ('first','Genesis 1:1','Genesis ang unang aklat ng karaniwang pagkakasunod-sunod ng Biblia.',null),
  ('goliath','1 Samuel 17:40–50','Si David, na may tirador at bato, ang humarap at tumalo kay Goliat.',null),
  ('moses','Exodo 3:10; 12:31–42','Si Moises ang inatasang pangunahan ang pag-alis ng Israel sa Ehipto.',null),
  ('r3_e1','Lucas 1:26–31','Si Maria ang napiling maging ina ni Jesus.',null),
  ('r3_e10','Genesis 17:4–5','Ang pangalan ni Abram ay ginawang Abraham, ama ng maraming bansa.',null),
  ('r3_e2','Genesis 2:7','Nilalang ng Diyos si Adan mula sa alabok ng lupa.',null),
  ('r3_e3','Exodo 4:14–16','Si Aaron ang kapatid ni Moises na tumulong sa kaniyang pagsasalita.',null),
  ('r3_e4','Genesis 1:1–31; 2:1–3','Inilarawan ang anim na araw ng paglalang at ang ikapitong araw ng pamamahinga.',null),
  ('r3_e5','Pahayag 22:18–21','Pahayag ang huling aklat sa karaniwang pagkakasunod ng Bagong Tipan.',null),
  ('r3_e6','Genesis 17:15–16','Si Sara ang asawa ni Abraham; binanggit ang pangakong magkakaanak sila.',null),
  ('r3_e7','Mateo 26:14–16, 47–50','Si Judas Iscariote ang nagbigay-daan sa pagdakip kay Jesus.',null),
  ('r3_e8','Lucas 2:7','Inihiga ni Maria ang sanggol na si Jesus sa isang sabsaban.',null),
  ('r3_e9','Exodo 20:3','Ang panimulang pagbabawal sa sampung utos ay ang pagkakaroon ng ibang diyos.',null),
  ('denial','Lucas 22:54–62','Tatlong ulit na itinanggi ni Pedro ang pagkakakilala kay Jesus.',null),
  ('disciples','Lucas 6:12–16','Pumili si Jesus ng labindalawang alagad na tinawag niyang mga apostol.',null),
  ('esther','Esther 4:13–16; 7:3–6','Namamagitan si Reyna Esther upang maligtas ang kaniyang bayan.',null),
  ('jonah','Jonas 1:17; 2:1','Isang malaking isda ang lumunok kay Jonas matapos siyang itapon sa dagat.',null),
  ('jordan','Marcos 1:9–11','Si Jesus ay binautismuhan ni Juan sa Ilog Jordan.',null),
  ('paul','Mga Gawa 13:9','Tinukoy si Pablo bilang ''Saulo, na kilala ring Pablo''; hindi sinabing pinalitan ang pangalan sa kaniyang pagbabalik-loob.','Ano ang pangalang ginamit para kay Pablo sa naunang bahagi ng Mga Gawa bago ang Mga Gawa 13:9?'),
  ('psalms','Mga Awit 1; 23; 51','Ang aklat ng Mga Awit ay koleksiyon ng mga awit, papuri at panalangin.',null),
  ('r3_h1','Mga Gawa 1:23–26','Napili si Matias sa halip ni Judas bilang kasama ng labing-isang apostol.',null),
  ('r3_h10','Mga Gawa 8:27–35','Ipinaliwanag ni Felipe ang binabasang Isaias sa opisyal na Etiope.',null),
  ('r3_h2','1 Corinto 13:1–13','Sa 1 Corinto 13 tinalakay nang malawakan ang pag-ibig.',null),
  ('r3_h3','Genesis 14:18–20','Si Melquisedec, hari ng Salem at saserdote, ang binigyan ni Abram ng ikapu.',null),
  ('r3_h4','Filemon 1:10–17','Hiniling ni Pablo kay Filemon na tanggapin muli si Onesimo bilang minamahal na kapatid.','Sino ang taong hiniling ni Pablo kay Filemon na tanggapin muli ayon sa kaniyang liham?'),
  ('r3_h5','Mga Gawa 11:25–26','Sa Antioquia unang tinawag na mga Kristiyano ang mga alagad.',null),
  ('r3_h6','2 Hari 22:1–11','Sa panahon ni Haring Josias natagpuan ang Aklat ng Kautusan sa templo.',null),
  ('r3_h7','2 Timoteo 1:5; Mga Gawa 16:1','Si Eunice ang ina ni Timoteo at si Loida naman ang kaniyang lola.',null),
  ('r3_h8','Ezekiel 37:1–14','Ipinakita kay Ezekiel ang pangitain ng libis na puno ng mga tuyong buto.',null),
  ('r3_h9','Genesis 11:28, 31','Mula sa Ur ng mga Caldeo umalis ang pamilya ni Terah at Abram patungong Canaan.','Saang lugar umalis ang pamilya ni Terah at Abram patungong Canaan ayon sa Genesis 11:31?'),
  ('r3_m1','Josue 1:1–2','Si Josue ang inatasang manguna sa Israel pagkamatay ni Moises.',null),
  ('r3_m10','Galacia 5:22–23','Siyam na katangian ang nakalista sa teksto bilang bunga ng Espiritu.',null),
  ('r3_m2','Bilang 14:33–34; Deuteronomio 8:2','Ang apatnapung taong paglalakbay sa ilang ay binanggit sa salaysay ng Israel.',null),
  ('r3_m3','1 Samuel 1:19–20','Si Ana ang nanalangin at naging ina ni Samuel.',null),
  ('r3_m4','Roma 1:1; 1 Corinto 1:1; Galacia 1:1','Maraming liham sa Bagong Tipan ang hayagang ipinakikilalang galing kay Pablo.',null),
  ('r3_m5','Exodo 19:20; 20:1–17','Sa Bundok Sinai ibinigay ang mga tagubilin ng Kautusan kay Moises.',null),
  ('r3_m6','1 Hari 18:20–40','Si Elias ang humarap sa mga propeta ni Baal sa Bundok Carmelo.',null),
  ('r3_m7','Ruth 1:1–22','Isinasalaysay ng aklat ni Ruth ang ugnayan niya sa biyenang si Naomi.',null),
  ('r3_m8','Lucas 1:5–13, 57–63','Si Zacarias ang ama ni Juan Bautista at si Elisabet ang kaniyang ina.',null),
  ('r3_m9','Lucas 1:1–4; Mga Gawa 1:1','Ayon sa tradisyong Kristiyano, si Lucas ang kinikilalang may-akda ng ikatlong Ebanghelyo; hindi ito direktang pinangalanan sa mismong teksto.',null),
  ('resurrection','1 Corinto 15:3–4; Lucas 24:1–7','Ayon sa Kasulatan, muling nabuhay si Jesus sa ikatlong araw.',null),
  ('walls','Josue 6:12–20','Gumuho ang pader ng Jerico matapos ang pag-ikot at pagsigaw ng Israel.',null),
  ('wisdom','1 Hari 3:9–12','Humiling si Solomon ng karunungan upang pamahalaan ang bayan.',null)
) as v(id,reference,explanation,improved_prompt)
where q.id=v.id and q.reviewed and q.active
  and q.scripture_reference='';
do $qa$
begin
 if exists (
  select 1 from private.buklod_bible_v4_questions q
  where q.id in (select id from private.buklod_r2_bible_quiz_questions)
    and (trim(q.scripture_reference)='' or
      q.rationale='Basahin ang kaugnay na talata at ang buong konteksto.')
 ) then raise exception 'Legacy V4 feedback annotation incomplete'; end if;
end $qa$;
