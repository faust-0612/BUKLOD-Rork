-- Kabihasnang Ligaw R5 canonical Panimula and Kabanata 1.
-- Additive. Do not apply to production from this change.
-- Episodes stay draft. Art and audio stay unapproved. No OTA.
--
-- Rollback, only on a database where this migration was applied and nothing
-- has been member-released:
--   update public.kl_episodes
--     set content = '[]'::jsonb, manuscript_status = 'content_blocked',
--         prose_complete = false, prose_sha256 = null
--     where episode_number in (0, 1)
--       and id in (
--         '11111111-1111-4111-8111-000000000000',
--         '11111111-1111-4111-8111-000000000001'
--       );
--   update public.kl_storyboard
--     set paragraph_start = null, paragraph_end = null,
--         status = 'CONTENT BLOCKED / MANUSCRIPT NOT IN REPOSITORY / NO ARTWORK'
--     where scene_id like 's1-e01-shot-%' or scene_id = 's1-panimula-unbound';
--   update public.kl_living_layers
--     set activation = 'BLOCKED_UNTIL_WORD_FOR_WORD_MANUSCRIPT',
--         paragraph_start = null, paragraph_end = null, active = false, approved = false
--     where episode_id = '11111111-1111-4111-8111-000000000001';
-- Re-apply the previous function bodies from
-- 20261021153000_kabihasnang_ligaw_r5_reader_admin.sql if the locks below must be removed.

alter table public.kl_episodes add column if not exists prose_sha256 text;

update public.kl_episodes
set content = $klcanon0$[{"id":"kl-e00-p001","index":1,"kind":"heading","text":"### KABIHASNANG LIGAW"},{"id":"kl-e00-p002","index":2,"kind":"body","text":"Isang orihinal na serye ng hiwaga, pakikipagsapalaran, at mga lihim ng isang daigdig."},{"id":"kl-e00-p003","index":3,"kind":"body","text":"Likha ni Faustino Jr. M. Gabut"},{"id":"kl-e00-p004","index":4,"kind":"heading","text":"### PANIMULA"},{"id":"kl-e00-p005","index":5,"kind":"heading","text":"### Ang Daigdig na May Sariling Alaala"},{"id":"kl-e00-p006","index":6,"kind":"body","text":"May mga lugar sa daigdig na hindi makikita sa anumang mapa. Hindi dahil nakatago ang mga ito sa likod ng malalayong kabundukan o napapalibutan ng dagat, kundi dahil may mga lugar na nagbabago ng kinalalagyan. May mga daang lumilitaw lamang kapag umuulan, mga kagubatang hindi pareho ang anyo sa umaga at gabi, at mga pamayanang isang araw ay naroon, ngunit kinabukasan ay wala nang nakaaalala kung saan matatagpuan."},{"id":"kl-e00-p007","index":7,"kind":"body","text":"Sa daigdig na ito, hindi lahat ng kakaiba ay kinatatakutan. May mga magsasakang marunong makinig sa lupa bago magtanim, mga manlalakbay na sumusunod sa mga bituing hindi nakikita ng iba, at mga tagapagtayo ng lungsod na naniniwalang may sariling ugali ang bawat tahanan. May mga bagay ding hindi maipaliwanag, ngunit natutuhan nang tanggapin ng mga tao bilang bahagi ng kanilang pang-araw-araw na buhay."},{"id":"kl-e00-p008","index":8,"kind":"body","text":"Gayunman, may hangganan ang mga bagay na kayang unawain ng tao."},{"id":"kl-e00-p009","index":9,"kind":"body","text":"May mga binhing tumutubo kahit walang tubig. May mga ilog na nagdadala ng mga bagay mula sa mga lugar na hindi pa nararating. May mga awiting naaalala ng isang tao kahit hindi pa niya naririnig. At kung minsan, may mga tinig na bumabalik mula sa mga taong matagal nang namatay."},{"id":"kl-e00-p010","index":10,"kind":"body","text":"Sa loob ng maraming salinlahi, magkakahiwalay na namuhay ang mga pamayanan. Bawat isa ay may sariling kuwento tungkol sa mga kababalaghang nakapaligid sa kanila. Walang nakaaalam kung iisa ang pinagmulan ng mga ito, o kung nagkataon lamang na ang daigdig ay puno ng mga bagay na hindi maipaliwanag."},{"id":"kl-e00-p011","index":11,"kind":"body","text":"Hanggang sa nagsimulang magbago ang mga bagay na matagal nang hindi gumagalaw."},{"id":"kl-e00-p012","index":12,"kind":"body","text":"Sa isang maliit na pamayanang tinatawag na Lunawen, isang magsasaka ang unang makakasaksi sa pagbabagong iyon."},{"id":"kl-e00-p013","index":13,"kind":"body","text":"Ang pangalan niya ay Phan."},{"id":"kl-e00-p014","index":14,"kind":"body","text":"At sa gabing nagsimulang umangat ang lupa, may isang tinig na matagal na niyang hinintay na marinig."}]$klcanon0$::jsonb,
    manuscript_status = 'approved_complete',
    prose_complete = true,
    prose_sha256 = '78195ad435ba17ae033ec6d5649813edd85411b70189a437bf502db96cce77c2'
where id = '11111111-1111-4111-8111-000000000000'
  and episode_number = 0;

update public.kl_episodes
set content = $klcanon1$[{"id":"kl-e01-p001","index":1,"kind":"heading","text":"### UNANG SERYE"},{"id":"kl-e01-p002","index":2,"kind":"heading","text":"### Ang Lupang Hindi Namamatay"},{"id":"kl-e01-p003","index":3,"kind":"heading","text":"### KABANATA 1 — ANG GABI NG PAG-AHON"},{"id":"kl-e01-p004","index":4,"kind":"body","text":"Unang naramdaman ni Phan ang paggalaw sa ilalim ng kanyang mga paa habang tinatali niya ang huling bungkos ng mga tangkay sa kanilang imbakan."},{"id":"kl-e01-p005","index":5,"kind":"body","text":"Mahina lamang iyon, halos katulad ng pagdaan ng mabigat na kariton sa malayong daan. Huminto siya at pinakinggan ang paligid. Wala namang kariton. Tahimik na ang mga bahay sa Lunawen, at ang tanging maririnig ay ang pagaspas ng mga dahon sa gilid ng kanilang bakuran."},{"id":"kl-e01-p006","index":6,"kind":"body","text":"Muli niyang hinigpitan ang tali."},{"id":"kl-e01-p007","index":7,"kind":"body","text":"Pagkatapos ay gumalaw na naman ang lupa."},{"id":"kl-e01-p008","index":8,"kind":"body","text":"Sa pagkakataong ito, may narinig siyang mahabang paglangitngit mula sa ilalim ng imbakan. Unti-unting gumulong ang isang sisidlang puno ng tuyong butil hanggang sa tumama sa kanyang paa."},{"id":"kl-e01-p009","index":9,"kind":"body","text":"Napatingin siya sa sahig."},{"id":"kl-e01-p010","index":10,"kind":"body","text":"Isang manipis na guhit ang lumitaw sa pagitan ng mga batong nakabaon sa lupa. Habang pinagmamasdan niya iyon, dahan-dahang humaba ang guhit, na para bang may humihila sa magkabilang dulo ng sahig."},{"id":"kl-e01-p011","index":11,"kind":"body","text":"“Phan!”"},{"id":"kl-e01-p012","index":12,"kind":"body","text":"Tinig iyon ng kanyang ina mula sa bahay."},{"id":"kl-e01-p013","index":13,"kind":"body","text":"Iniwan niya ang mga tangkay at nagmamadaling lumabas. Sa kabilang bakuran, may ilang taong nakatayo sa harap ng kanilang mga tahanan. May isang matandang nakayuko at nakadikit ang palad sa lupa. Ang mga alagang hayop sa tabi ng daan ay nagkakagulo, pilit na kumakawala sa kanilang mga tali."},{"id":"kl-e01-p014","index":14,"kind":"body","text":"Paglingon ni Phan sa kanilang bahay, nakita niyang nakabukas ang pinto."},{"id":"kl-e01-p015","index":15,"kind":"body","text":"Nakatayo sa bungad ang kanyang ina, hawak sa balikat ang nakababatang kapatid niyang si Tali."},{"id":"kl-e01-p016","index":16,"kind":"body","text":"“Bakit gumagalaw ang lupa?” tanong ng bata."},{"id":"kl-e01-p017","index":17,"kind":"body","text":"Hindi agad sumagot si Phan."},{"id":"kl-e01-p018","index":18,"kind":"body","text":"Sa likod ng kanilang bahay, ang maliit na punong itinanim ng kanyang ama maraming taon na ang nakalilipas ay nakatagilid na. Hindi ito tinatangay ng hangin. Gumagalaw ang mismong lupang kinakapitan ng mga ugat nito."},{"id":"kl-e01-p019","index":19,"kind":"body","text":"“Lumabas kayo sa daan,” sabi niya. “Doon sa maluwang.”"},{"id":"kl-e01-p020","index":20,"kind":"body","text":"“Ano'ng nangyayari?” tanong ng kanyang ina."},{"id":"kl-e01-p021","index":21,"kind":"body","text":"“Hindi ko alam. Basta lumayo muna kayo sa bahay.”"},{"id":"kl-e01-p022","index":22,"kind":"body","text":"Hinawakan niya ang kamay ni Tali at inakay silang dalawa palabas ng bakuran. Hindi pa sila nakalalayo nang marinig nila ang isang malakas na pagputok."},{"id":"kl-e01-p023","index":23,"kind":"body","text":"Napalingon si Phan."},{"id":"kl-e01-p024","index":24,"kind":"body","text":"Nahati ang lupang nasa ilalim ng imbakan. Bumagsak ang isang haligi, sumunod ang bubong, at sa gitna ng alikabok ay may umangat na makapal na bagay na tila isang napakalaking ugat."},{"id":"kl-e01-p025","index":25,"kind":"body","text":"Hindi iyon katulad ng karaniwang ugat ng puno."},{"id":"kl-e01-p026","index":26,"kind":"body","text":"Makinis ang ibabaw nito, kulay abo na may mahahabang guhit na maputlang luntian. Gumagalaw ito sa ilalim ng lupa na para bang may sariling lakas. Sa bawat pag-angat nito, natutulak paitaas ang mga bato at nahihila pababa ang ibang bahagi ng bakuran."},{"id":"kl-e01-p027","index":27,"kind":"body","text":"May sumigaw sa kabilang bahay."},{"id":"kl-e01-p028","index":28,"kind":"body","text":"“Lumubog ang sahig!”"},{"id":"kl-e01-p029","index":29,"kind":"body","text":"Nagsimulang magtakbuhan ang mga tao. May mga magulang na buhat ang kanilang mga anak, may mga matandang inaalalayan palabas, at may ilang nagsisikap pang iligtas ang kanilang mga kagamitan."},{"id":"kl-e01-p030","index":30,"kind":"body","text":"Sa gitna ng kaguluhan, napansin ni Phan ang isang bagay na lalong nagpalamig sa kanyang katawan."},{"id":"kl-e01-p031","index":31,"kind":"body","text":"Hindi lamang ang kanilang bakuran ang gumagalaw."},{"id":"kl-e01-p032","index":32,"kind":"body","text":"Sa buong Lunawen, may mga bahaging unti-unting lumulubog habang may ibang bahagi namang umaangat. Ang daang dati ay patag ay nagkaroon ng mahahabang umbok. Ang mga bakod ay tumagilid. Ang mga punong nakatanim sa magkabilang panig ng daan ay tila hinihila sa magkasalungat na direksyon."},{"id":"kl-e01-p033","index":33,"kind":"body","text":"At mula sa ilalim ng lupa, may lumilitaw na maputlang liwanag."},{"id":"kl-e01-p034","index":34,"kind":"body","text":"“Phan, halika na!” sigaw ng kanyang ina."},{"id":"kl-e01-p035","index":35,"kind":"body","text":"“Mauna na kayo sa liwasan!”"},{"id":"kl-e01-p036","index":36,"kind":"body","text":"“Hindi kita iiwan!”"},{"id":"kl-e01-p037","index":37,"kind":"body","text":"“Susunod ako!”"},{"id":"kl-e01-p038","index":38,"kind":"body","text":"Hindi niya alam kung bakit niya iyon sinabi. Wala naman siyang balak bumalik sa bahay. Ngunit may narinig siyang panibagong sigaw mula sa kabilang bakuran."},{"id":"kl-e01-p039","index":39,"kind":"body","text":"Isang bata."},{"id":"kl-e01-p040","index":40,"kind":"body","text":"Humihingi ng tulong."},{"id":"kl-e01-p041","index":41,"kind":"body","text":"Tumingin siya sa pinanggalingan ng tinig."},{"id":"kl-e01-p042","index":42,"kind":"body","text":"Sa pagitan ng dalawang gumuhong bakod, may nabuksang makitid na siwang. Isang maliit na kamay ang nakakapit sa gilid nito. Sa ilalim ng kamay, bahagya niyang nakita ang mukha ng isang batang lalaki."},{"id":"kl-e01-p043","index":43,"kind":"body","text":"“Tulungan ninyo ako!”"},{"id":"kl-e01-p044","index":44,"kind":"body","text":"Humakbang si Phan papalapit."},{"id":"kl-e01-p045","index":45,"kind":"body","text":"“Phan!” sigaw ng kanyang ina."},{"id":"kl-e01-p046","index":46,"kind":"body","text":"Hindi siya lumingon."},{"id":"kl-e01-p047","index":47,"kind":"body","text":"“Pumunta kayo sa liwasan! Ngayon na!”"},{"id":"kl-e01-p048","index":48,"kind":"body","text":"Tumakbo siya patungo sa siwang. Sa bawat hakbang, nararamdaman niyang hindi matatag ang lupa. May mga batong lumulubog sa bigat ng kanyang paa, at ang ilang bahagi ng daan ay tila lumalambot."},{"id":"kl-e01-p049","index":49,"kind":"body","text":"Nang makarating siya sa gilid, lumuhod siya at iniabot ang kamay."},{"id":"kl-e01-p050","index":50,"kind":"body","text":"“Abutin mo ako!”"},{"id":"kl-e01-p051","index":51,"kind":"body","text":"Sinubukan ng bata, ngunit masyadong malayo."},{"id":"kl-e01-p052","index":52,"kind":"body","text":"“Hindi ko kaya!”"},{"id":"kl-e01-p053","index":53,"kind":"body","text":"“Tumayo ka sa bato sa likod mo!”"},{"id":"kl-e01-p054","index":54,"kind":"body","text":"“Wala pong bato!”"},{"id":"kl-e01-p055","index":55,"kind":"body","text":"Napatingin si Phan sa loob ng siwang."},{"id":"kl-e01-p056","index":56,"kind":"body","text":"Hindi niya makita ang ilalim."},{"id":"kl-e01-p057","index":57,"kind":"body","text":"Sa halip na karaniwang lupa at bato, may mga makakapal na ugat na nakapulupot sa magkabilang dingding. Sa pagitan ng mga ito ay may liwanag na tila nagmumula sa ilalim ng isang malalim na balon."},{"id":"kl-e01-p058","index":58,"kind":"body","text":"“Makinig ka,” sabi ni Phan. “Huwag mong bibitawan ang gilid. Kukuha ako ng lubid.”"},{"id":"kl-e01-p059","index":59,"kind":"body","text":"Tumango ang bata."},{"id":"kl-e01-p060","index":60,"kind":"body","text":"Tumayo si Phan at lumingon sa kanilang bakuran. May lubid sa tabi ng imbakan, ngunit halos natabunan na iyon ng gumuhong bubong."},{"id":"kl-e01-p061","index":61,"kind":"body","text":"Nagmadali siyang bumalik."},{"id":"kl-e01-p062","index":62,"kind":"body","text":"Habang hinihila niya ang lubid mula sa ilalim ng mga kahoy, may narinig siyang malakas na paglangitngit mula sa kanilang bahay."},{"id":"kl-e01-p063","index":63,"kind":"body","text":"Ang isa sa mga haligi nito ay lumubog."},{"id":"kl-e01-p064","index":64,"kind":"body","text":"Sumunod ang buong gilid ng dingding."},{"id":"kl-e01-p065","index":65,"kind":"body","text":"Napahinto siya."},{"id":"kl-e01-p066","index":66,"kind":"body","text":"Sa bukas na pinto, nakita niya ang loob ng tahanang kinalakhan niya. Naroon pa ang mahabang hapag na ginawa ng kanyang ama, ang mga sisidlang ginagamit ng kanyang ina sa pagluluto, at ang maliit na bangkong madalas upuan ni Tali habang hinihintay siyang umuwi mula sa bukid."},{"id":"kl-e01-p067","index":67,"kind":"body","text":"Lahat ng iyon ay unti-unting tumatagilid."},{"id":"kl-e01-p068","index":68,"kind":"body","text":"May bahagi sa kanya na gustong tumakbo papasok upang iligtas ang kahit ano."},{"id":"kl-e01-p069","index":69,"kind":"body","text":"Ang mga kagamitan. Ang mga binhi. Ang lumang kahong pinaglalagyan ng mga gamit ng kanyang ama."},{"id":"kl-e01-p070","index":70,"kind":"body","text":"Ngunit mula sa kabilang bakuran ay muling sumigaw ang bata."},{"id":"kl-e01-p071","index":71,"kind":"body","text":"“Kuya!”"},{"id":"kl-e01-p072","index":72,"kind":"body","text":"Hinila ni Phan ang lubid."},{"id":"kl-e01-p073","index":73,"kind":"body","text":"Nakuha niya ang isang dulo, ngunit naipit ang natitirang bahagi sa ilalim ng malaking kahoy. Yumuko siya, itinukod ang balikat, at buong lakas na itinulak ang nakaharang."},{"id":"kl-e01-p074","index":74,"kind":"body","text":"Hindi gumalaw."},{"id":"kl-e01-p075","index":75,"kind":"body","text":"Muli niyang itinulak."},{"id":"kl-e01-p076","index":76,"kind":"body","text":"Sa pagkakataong ito, bahagyang umangat ang kahoy. Nahila niya ang lubid, ngunit kasabay nito ay may bumagsak na bahagi ng bubong sa kanyang likuran."},{"id":"kl-e01-p077","index":77,"kind":"body","text":"Napayuko siya upang makaiwas."},{"id":"kl-e01-p078","index":78,"kind":"body","text":"Nang tumingala siya, nakita niyang halos kalahati na ng kanilang bahay ang lumubog."},{"id":"kl-e01-p079","index":79,"kind":"body","text":"Hindi niya namalayang mahigpit na pala niyang hawak ang lubid."},{"id":"kl-e01-p080","index":80,"kind":"body","text":"Isang iglap siyang nanatiling nakatayo, nakatitig sa bahay na hindi na niya maililigtas."},{"id":"kl-e01-p081","index":81,"kind":"body","text":"Pagkatapos ay tumalikod siya at tumakbo pabalik sa bata."},{"id":"kl-e01-p082","index":82,"kind":"body","text":"Mas lumawak na ang siwang."},{"id":"kl-e01-p083","index":83,"kind":"body","text":"“Abutin mo ito!” sigaw niya habang inihahagis ang lubid."},{"id":"kl-e01-p084","index":84,"kind":"body","text":"Hindi agad sumagot ang bata."},{"id":"kl-e01-p085","index":85,"kind":"body","text":"Nakasandal na lamang ito sa isang makapal na ugat. Ang mga daliri nitong kanina ay nakakapit sa gilid ay nanginginig na."},{"id":"kl-e01-p086","index":86,"kind":"body","text":"“Kuya, may gumagalaw po rito.”"},{"id":"kl-e01-p087","index":87,"kind":"body","text":"“Nakikita ko. Hawakan mo ang lubid!”"},{"id":"kl-e01-p088","index":88,"kind":"body","text":"“May humihila po sa paa ko.”"},{"id":"kl-e01-p089","index":89,"kind":"body","text":"Napatingin si Phan sa ibabang bahagi ng katawan ng bata."},{"id":"kl-e01-p090","index":90,"kind":"body","text":"May isang manipis na ugat na nakapulupot sa bukung-bukong nito."},{"id":"kl-e01-p091","index":91,"kind":"body","text":"Hindi iyon mahigpit. Ngunit habang pinagmamasdan niya, dahan-dahang gumapang ang ugat paitaas."},{"id":"kl-e01-p092","index":92,"kind":"body","text":"Naramdaman ni Phan ang mabilis na pagtibok ng kanyang puso."},{"id":"kl-e01-p093","index":93,"kind":"body","text":"Hinila niya pabalik ang lubid, gumawa ng malaking buhol sa dulo, at muling ibinaba iyon."},{"id":"kl-e01-p094","index":94,"kind":"body","text":"“Ipasok mo ang braso mo rito!”"},{"id":"kl-e01-p095","index":95,"kind":"body","text":"Sinunod siya ng bata."},{"id":"kl-e01-p096","index":96,"kind":"body","text":"“Mahigpit ang kapit mo?”"},{"id":"kl-e01-p097","index":97,"kind":"body","text":"“Opo!”"},{"id":"kl-e01-p098","index":98,"kind":"body","text":"“Kapag sinabi kong hila, itulak mo ang sarili mo pataas.”"},{"id":"kl-e01-p099","index":99,"kind":"body","text":"Tumango ang bata."},{"id":"kl-e01-p100","index":100,"kind":"body","text":"Itinukod ni Phan ang kanyang mga paa sa matigas na bahagi ng lupa at nagsimulang humila."},{"id":"kl-e01-p101","index":101,"kind":"body","text":"Mabigat."},{"id":"kl-e01-p102","index":102,"kind":"body","text":"Mas mabigat kaysa sa inaasahan niya."},{"id":"kl-e01-p103","index":103,"kind":"body","text":"Naramdaman niyang humihigpit ang lubid sa kanyang mga palad. Unti-unting umangat ang bata, ngunit kasabay nito ay gumalaw ang ugat na nakapulupot sa paa nito."},{"id":"kl-e01-p104","index":104,"kind":"body","text":"“Masakit po!”"},{"id":"kl-e01-p105","index":105,"kind":"body","text":"“Kaunti na lang!”"},{"id":"kl-e01-p106","index":106,"kind":"body","text":"Muling humila si Phan."},{"id":"kl-e01-p107","index":107,"kind":"body","text":"Sa ilalim ng siwang, may mahinang tunog na tila paghinga."},{"id":"kl-e01-p108","index":108,"kind":"body","text":"Huminto siya."},{"id":"kl-e01-p109","index":109,"kind":"body","text":"Hindi niya alam kung saan iyon nanggaling."},{"id":"kl-e01-p110","index":110,"kind":"body","text":"Pagkatapos ay may narinig siyang tinig."},{"id":"kl-e01-p111","index":111,"kind":"body","text":"“Phan.”"},{"id":"kl-e01-p112","index":112,"kind":"body","text":"Napalingon siya."},{"id":"kl-e01-p113","index":113,"kind":"body","text":"Walang tao sa kanyang likuran."},{"id":"kl-e01-p114","index":114,"kind":"body","text":"Mula sa liwasan ay naririnig pa rin ang mga sigaw ng mga taga-Lunawen. Sa paligid niya ay patuloy ang pagguho ng lupa."},{"id":"kl-e01-p115","index":115,"kind":"body","text":"Ngunit ang tinig na narinig niya ay malinaw."},{"id":"kl-e01-p116","index":116,"kind":"body","text":"Pamilyar."},{"id":"kl-e01-p117","index":117,"kind":"body","text":"At matagal na niyang hindi naririnig."},{"id":"kl-e01-p118","index":118,"kind":"body","text":"“Phan,” muling tawag nito."},{"id":"kl-e01-p119","index":119,"kind":"body","text":"Nanigas ang kanyang mga daliri sa lubid."},{"id":"kl-e01-p120","index":120,"kind":"body","text":"Hindi maaaring totoo."},{"id":"kl-e01-p121","index":121,"kind":"body","text":"Alam niya ang tinig na iyon. Kilala niya ang mababang tono nito, ang bahagyang paos na pagbigkas sa kanyang pangalan, at ang paraan ng pagsasalita na para bang kahit gaano kabigat ang problema ay may panahon pa rin upang pag-isipan ang susunod na gagawin."},{"id":"kl-e01-p122","index":122,"kind":"body","text":"Tinig iyon ng kanyang ama."},{"id":"kl-e01-p123","index":123,"kind":"body","text":"Ang amang tatlong taon nang nakalibing sa gilid ng kanilang bukirin."},{"id":"kl-e01-p124","index":124,"kind":"body","text":"“Anak.”"},{"id":"kl-e01-p125","index":125,"kind":"body","text":"Dahan-dahang tumingin si Phan sa siwang."},{"id":"kl-e01-p126","index":126,"kind":"body","text":"Mula sa pagitan ng mga ugat, may maputlang liwanag na unti-unting lumalakas."},{"id":"kl-e01-p127","index":127,"kind":"body","text":"“Pakawalan mo ang lubid.”"},{"id":"kl-e01-p128","index":128,"kind":"body","text":"Hindi siya gumalaw."},{"id":"kl-e01-p129","index":129,"kind":"body","text":"“Anak, makinig ka sa akin.”"},{"id":"kl-e01-p130","index":130,"kind":"body","text":"Napalunok si Phan."},{"id":"kl-e01-p131","index":131,"kind":"body","text":"“...Ama?”"},{"id":"kl-e01-p132","index":132,"kind":"body","text":"May sumagot mula sa ilalim ng lupa."},{"id":"kl-e01-p133","index":133,"kind":"body","text":"“Huwag mong iahon ang batang iyan.”"},{"id":"kl-e01-p134","index":134,"kind":"body","text":"Naramdaman niyang nanlamig ang kanyang mga kamay."},{"id":"kl-e01-p135","index":135,"kind":"body","text":"Sa ibaba, nakatingala sa kanya ang bata."},{"id":"kl-e01-p136","index":136,"kind":"body","text":"“Kuya?”"},{"id":"kl-e01-p137","index":137,"kind":"body","text":"Hindi niya alam kung alin ang dapat niyang paniwalaan."},{"id":"kl-e01-p138","index":138,"kind":"body","text":"Ang batang nakikita niya, nanginginig at humihingi ng tulong?"},{"id":"kl-e01-p139","index":139,"kind":"body","text":"O ang tinig ng kanyang ama na nanggagaling sa isang lugar na hindi niya maipaliwanag?"},{"id":"kl-e01-p140","index":140,"kind":"body","text":"“Kuya, huwag ninyo akong bitawan.”"},{"id":"kl-e01-p141","index":141,"kind":"body","text":"Humigpit ang kapit ni Phan sa lubid."},{"id":"kl-e01-p142","index":142,"kind":"body","text":"Muling nagsalita ang tinig."},{"id":"kl-e01-p143","index":143,"kind":"body","text":"“Hindi mo alam kung ano ang kasama niyang aahon.”"},{"id":"kl-e01-p144","index":144,"kind":"body","text":"Sa pagkakataong iyon, biglang tumigil ang paggalaw ng lupa."},{"id":"kl-e01-p145","index":145,"kind":"body","text":"Nawala ang paglangitngit ng mga bahay. Tumahimik ang mga ugat. Kahit ang malayong sigawan mula sa liwasan ay tila humina."},{"id":"kl-e01-p146","index":146,"kind":"body","text":"Sa loob ng ilang saglit, ang tanging naririnig ni Phan ay ang sariling paghinga."},{"id":"kl-e01-p147","index":147,"kind":"body","text":"At ang mahinang pag-iyak ng bata."},{"id":"kl-e01-p148","index":148,"kind":"body","text":"Tumingin siya sa mukha nito."},{"id":"kl-e01-p149","index":149,"kind":"body","text":"May luha sa pisngi. May putik sa noo. Hindi ito naiiba sa ibang batang nakita niyang nasugatan at natakot."},{"id":"kl-e01-p150","index":150,"kind":"body","text":"Ngunit sa likod nito, sa pagitan ng mga nagliliwanag na ugat, may isang aninong dahan-dahang gumalaw."},{"id":"kl-e01-p151","index":151,"kind":"body","text":"Hindi niya matukoy ang hugis."},{"id":"kl-e01-p152","index":152,"kind":"body","text":"Masyado itong malalim."},{"id":"kl-e01-p153","index":153,"kind":"body","text":"“Phan,” sabi ng tinig ng kanyang ama. “Huling pagkakataon mo na ito.”"},{"id":"kl-e01-p154","index":154,"kind":"body","text":"Pumikit siya sandali."},{"id":"kl-e01-p155","index":155,"kind":"body","text":"Naalala niya ang mga kamay ng kanyang ama, magaspang sa pagtatanim. Ang pagtawa nito kapag may pumapalpak siyang gawain. Ang huling gabing nakita niya itong buhay, nakaupo sa tabi ng hapag habang sinusubukang itago ang matinding pagod."},{"id":"kl-e01-p156","index":156,"kind":"body","text":"Gusto niyang maniwala."},{"id":"kl-e01-p157","index":157,"kind":"body","text":"Higit sa lahat, gusto niyang marinig muli ang tinig na iyon."},{"id":"kl-e01-p158","index":158,"kind":"body","text":"Ngunit nang dumilat siya, nakita niyang unti-unti nang dumudulas ang lubid sa mga kamay ng bata."},{"id":"kl-e01-p159","index":159,"kind":"body","text":"“Kuya!”"},{"id":"kl-e01-p160","index":160,"kind":"body","text":"Huminga nang malalim si Phan."},{"id":"kl-e01-p161","index":161,"kind":"body","text":"At humila."},{"id":"kl-e01-p162","index":162,"kind":"body","text":"Buong lakas."},{"id":"kl-e01-p163","index":163,"kind":"body","text":"Napahiyaw ang bata habang umaangat ang katawan nito. Kumalas ang ugat sa bukung-bukong nito, at sa isang huling paghila ay bumagsak silang dalawa sa lupa."},{"id":"kl-e01-p164","index":164,"kind":"body","text":"Niyakap ng bata ang sariling mga tuhod at humagulgol."},{"id":"kl-e01-p165","index":165,"kind":"body","text":"Hindi agad nakatayo si Phan."},{"id":"kl-e01-p166","index":166,"kind":"body","text":"Nakahiga siya sa tabi ng siwang, hinihingal, habang pinagmamasdan ang mga ugat na dahan-dahang bumababa sa ilalim."},{"id":"kl-e01-p167","index":167,"kind":"body","text":"Nawala ang liwanag."},{"id":"kl-e01-p168","index":168,"kind":"body","text":"Nawala rin ang tinig ng kanyang ama."},{"id":"kl-e01-p169","index":169,"kind":"body","text":"Maya-maya, bumalik ang karaniwang ingay ng gabi. May mga taong tumatawag sa kanilang mga kamag-anak. May umiiyak. May mga paa na nagmamadaling tumatakbo sa daan."},{"id":"kl-e01-p170","index":170,"kind":"body","text":"Umupo si Phan at tumingin sa batang kanyang nailigtas."},{"id":"kl-e01-p171","index":171,"kind":"body","text":"“Ano'ng pangalan mo?”"},{"id":"kl-e01-p172","index":172,"kind":"body","text":"Pinunasan ng bata ang mukha nito."},{"id":"kl-e01-p173","index":173,"kind":"body","text":"Hindi sumagot."},{"id":"kl-e01-p174","index":174,"kind":"body","text":"“Saan ang bahay ninyo?”"},{"id":"kl-e01-p175","index":175,"kind":"body","text":"Dahan-dahang umiling ang bata."},{"id":"kl-e01-p176","index":176,"kind":"body","text":"“May kasama ka bang magulang?”"},{"id":"kl-e01-p177","index":177,"kind":"body","text":"Muli itong umiling."},{"id":"kl-e01-p178","index":178,"kind":"body","text":"Napabuntong-hininga si Phan. Hinubad niya ang kanyang panlabas na kasuotan at ibinalot iyon sa nanginginig na balikat ng bata."},{"id":"kl-e01-p179","index":179,"kind":"body","text":"“Halika. Hahanapin natin sila.”"},{"id":"kl-e01-p180","index":180,"kind":"body","text":"Tumayo siya at inalalayan ito."},{"id":"kl-e01-p181","index":181,"kind":"body","text":"Sa pagharap nila sa liwasan, nakita niyang nakatayo sa malayo ang kanyang ina at si Tali. Kumakaway ang kanyang kapatid, at sa unang pagkakataon mula nang magsimula ang pagguho ay nakaramdam siya ng kaunting ginhawa."},{"id":"kl-e01-p182","index":182,"kind":"body","text":"Buhay sila."},{"id":"kl-e01-p183","index":183,"kind":"body","text":"Nasa ligtas na lugar."},{"id":"kl-e01-p184","index":184,"kind":"body","text":"May oras pa upang alamin kung ano ang nangyari sa kanilang tahanan."},{"id":"kl-e01-p185","index":185,"kind":"body","text":"Hinawakan niya ang kamay ng bata at nagsimulang maglakad."},{"id":"kl-e01-p186","index":186,"kind":"body","text":"Ngunit pagdaan nila sa tabi ng isang nakatumbang sisidlang puno ng tubig, may napansin si Phan."},{"id":"kl-e01-p187","index":187,"kind":"body","text":"Naaninag sa tubig ang maputlang buwan, ang kanyang mukha, at ang mahabang anino ng kanyang katawan."},{"id":"kl-e01-p188","index":188,"kind":"body","text":"Sa tabi niya, nakatayo ang bata."},{"id":"kl-e01-p189","index":189,"kind":"body","text":"Nakita niya ang repleksiyon nito sa tubig."},{"id":"kl-e01-p190","index":190,"kind":"body","text":"Ngunit sa lupa, sa ilalim ng liwanag ng buwan, walang aninong sumusunod sa mga paa nito."},{"id":"kl-e01-p191","index":191,"kind":"body","text":"Huminto si Phan."},{"id":"kl-e01-p192","index":192,"kind":"body","text":"Napatingin sa kanya ang bata."},{"id":"kl-e01-p193","index":193,"kind":"body","text":"“Kuya?”"},{"id":"kl-e01-p194","index":194,"kind":"body","text":"Hindi siya nakasagot."},{"id":"kl-e01-p195","index":195,"kind":"body","text":"Sa likuran nila, mula sa ilalim ng gumuhong bahay, may isang mahinang tinig na muling nagsalita."},{"id":"kl-e01-p196","index":196,"kind":"body","text":"Hindi na iyon tinig ng kanyang ama."},{"id":"kl-e01-p197","index":197,"kind":"body","text":"Tinig iyon ng isang batang lalaki."},{"id":"kl-e01-p198","index":198,"kind":"body","text":"At eksaktong kapareho ng batang hawak niya sa kamay."},{"id":"kl-e01-p199","index":199,"kind":"body","text":"“Kuya Phan,” tawag nito mula sa dilim."},{"id":"kl-e01-p200","index":200,"kind":"body","text":"“Bakit mo ako iniwan?”"},{"id":"kl-e01-p201","index":201,"kind":"body","text":"WAKAS NG KABANATA 1"}]$klcanon1$::jsonb,
    manuscript_status = 'approved_complete',
    prose_complete = true,
    prose_sha256 = 'fef559f06b20884bb57fd36898c44a1174293a2324823f02af17b48eff463173'
where id = '11111111-1111-4111-8111-000000000001'
  and episode_number = 1;

update public.kl_storyboard
set paragraph_start = null,
    paragraph_end = null,
    editorial_intent = null,
    status = 'CANONICAL TEXT IMPORTED / NO SCENE ANCHORS / NO ARTWORK',
    artwork_status = 'NO_ARTWORK',
    approval_status = 'pending',
    approved = false
where scene_id = 's1-panimula-unbound';

update public.kl_storyboard
set paragraph_start = 4,
    paragraph_end = 10,
    editorial_intent = $$Lunawen storehouse, tied stalks, grain jar rolling, hairline floor crack. No giant root or child. No rainfall.$$,
    status = 'BOUND / ART PENDING OWNER APPROVAL / NO ARTWORK',
    artwork_status = 'NO_ARTWORK',
    approval_status = 'pending',
    approved = false
where scene_id = 's1-e01-shot-01';

update public.kl_storyboard
set paragraph_start = 15,
    paragraph_end = 33,
    editorial_intent = $$Mother, Tali, Phan, tilting homestead and grey massive root with pale green veins. No visible father. No rainfall.$$,
    status = 'BOUND / ART PENDING OWNER APPROVAL / NO ARTWORK',
    artwork_status = 'NO_ARTWORK',
    approval_status = 'pending',
    approved = false
where scene_id = 's1-e01-shot-02';

update public.kl_storyboard
set paragraph_start = 42,
    paragraph_end = 57,
    editorial_intent = $$Child gripping fissure edge, Phan reaching, tangled underground roots and light. Child looks ordinary. Do not hint at a missing shadow.$$,
    status = 'BOUND / ART PENDING OWNER APPROVAL / NO ARTWORK',
    artwork_status = 'NO_ARTWORK',
    approval_status = 'pending',
    approved = false
where scene_id = 's1-e01-shot-03';

update public.kl_storyboard
set paragraph_start = 72,
    paragraph_end = 168,
    editorial_intent = $$Phan securing rope, child rising, root at ankle, collapsing home. Father is a voice only, never a visible ghost. Do not expose a hidden creature form.$$,
    status = 'BOUND / ART PENDING OWNER APPROVAL / NO ARTWORK',
    artwork_status = 'NO_ARTWORK',
    approval_status = 'pending',
    approved = false
where scene_id = 's1-e01-shot-04';

update public.kl_storyboard
set paragraph_start = 186,
    paragraph_end = 201,
    editorial_intent = $$Moonlight, water reflection of the child, no child shadow on the ground, ruined house beyond. Closing reveal only.$$,
    status = 'BOUND / ART PENDING OWNER APPROVAL / NO ARTWORK',
    artwork_status = 'NO_ARTWORK',
    approval_status = 'pending',
    approved = false
where scene_id = 's1-e01-shot-05';

insert into public.kl_living_layers (
  episode_id, layer, activation, paragraph_start, paragraph_end, approved, active
) values (
  '11111111-1111-4111-8111-000000000001',
  'rain',
  'FORBIDDEN_NOT_IN_CHAPTER_TEXT',
  null,
  null,
  false,
  false
)
on conflict (episode_id, layer) do update
set activation = excluded.activation,
    paragraph_start = excluded.paragraph_start,
    paragraph_end = excluded.paragraph_end,
    approved = false,
    active = false;

insert into public.kl_living_layers (
  episode_id, layer, activation, paragraph_start, paragraph_end, approved, active
) values (
  '11111111-1111-4111-8111-000000000001',
  'wind_foliage',
  'BOUND_PENDING_OWNER',
  5,
  5,
  false,
  false
)
on conflict (episode_id, layer) do update
set activation = excluded.activation,
    paragraph_start = excluded.paragraph_start,
    paragraph_end = excluded.paragraph_end,
    approved = false,
    active = false;

insert into public.kl_living_layers (
  episode_id, layer, activation, paragraph_start, paragraph_end, approved, active
) values (
  '11111111-1111-4111-8111-000000000001',
  'dust',
  'BOUND_PENDING_OWNER',
  24,
  24,
  false,
  false
)
on conflict (episode_id, layer) do update
set activation = excluded.activation,
    paragraph_start = excluded.paragraph_start,
    paragraph_end = excluded.paragraph_end,
    approved = false,
    active = false;

insert into public.kl_living_layers (
  episode_id, layer, activation, paragraph_start, paragraph_end, approved, active
) values (
  '11111111-1111-4111-8111-000000000001',
  'magical_glow',
  'BOUND_PENDING_OWNER',
  33,
  167,
  false,
  false
)
on conflict (episode_id, layer) do update
set activation = excluded.activation,
    paragraph_start = excluded.paragraph_start,
    paragraph_end = excluded.paragraph_end,
    approved = false,
    active = false;

insert into public.kl_living_layers (
  episode_id, layer, activation, paragraph_start, paragraph_end, approved, active
) values (
  '11111111-1111-4111-8111-000000000001',
  'water_ripples',
  'CLOSING_REVEAL_ONLY',
  186,
  201,
  false,
  false
)
on conflict (episode_id, layer) do update
set activation = excluded.activation,
    paragraph_start = excluded.paragraph_start,
    paragraph_end = excluded.paragraph_end,
    approved = false,
    active = false;

update public.kl_assets
set required = true,
    reason = 'No rights-cleared file. The owner has not waived the media gate.'
where kind in ('music', 'ambient')
  and approved = false
  and classification = 'MISSING';

do $$
begin
  if to_regclass('public.buklod_points_ledger') is not null
     and not exists (
       select 1 from pg_indexes
       where schemaname = 'public'
         and indexname = 'buklod_points_ledger_user_source_key_uidx'
     ) then
    execute 'create unique index buklod_points_ledger_user_source_key_uidx on public.buklod_points_ledger (user_id, source_key)';
  end if;
end $$;

create or replace function public.kl_post_points_v1(
  p_user uuid,
  p_activity text,
  p_source_key text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_points integer;
  rule_max integer;
  award integer;
  ledger_id uuid;
  has_claim boolean;
begin
  if p_user is null or p_source_key is null or length(trim(p_source_key)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'reward_rule_missing');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_source_key, 0));

  if exists (
    select 1 from public.buklod_points_ledger l
    where l.user_id = p_user and l.source_key = p_source_key
  ) then
    select l.id into ledger_id
    from public.buklod_points_ledger l
    where l.user_id = p_user and l.source_key = p_source_key
    limit 1;
    return jsonb_build_object('ok', true, 'already', true, 'points', 0, 'ledger_id', ledger_id);
  end if;

  select r.base_points, r.max_points_per_event
    into rule_points, rule_max
  from public.buklod_point_rules r
  where r.activity_type = p_activity
    and coalesce(r.is_active, false) = true
  limit 1;

  if rule_points is null or rule_max is null then
    return jsonb_build_object('ok', false, 'error', 'reward_rule_missing');
  end if;

  award := least(rule_points, rule_max);
  if award < 1 then
    return jsonb_build_object('ok', false, 'error', 'reward_rule_missing');
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'buklod_points_ledger'
      and column_name = 'claim_state'
  ) into has_claim;

  if has_claim then
    insert into public.buklod_points_ledger (
      user_id, direction, points, activity_type, source_key, source_id, description, awarded_by, claim_state
    ) values (
      p_user, 'credit', award, p_activity, p_source_key, null, p_description, p_user, 'pending'
    )
    on conflict (user_id, source_key) do nothing
    returning id into ledger_id;
  else
    insert into public.buklod_points_ledger (
      user_id, direction, points, activity_type, source_key, source_id, description, awarded_by
    ) values (
      p_user, 'credit', award, p_activity, p_source_key, null, p_description, p_user
    )
    on conflict (user_id, source_key) do nothing
    returning id into ledger_id;
  end if;

  if ledger_id is null then
    return jsonb_build_object('ok', true, 'already', true, 'points', 0);
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'points', award,
    'ledger_id', ledger_id,
    'claim_state', case when has_claim then 'pending' else null end
  );
end;
$$;

create or replace function public.kl_complete_episode_v1(p_episode_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ep public.kl_episodes%rowtype;
  source_key text;
  posted jsonb;
  season_posted jsonb;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kl-episode:' || actor::text || ':' || p_episode_id::text, 0));

  if not public.kl_episode_member_visible(p_episode_id) then
    return jsonb_build_object('ok', false, 'error', 'not_readable');
  end if;

  select * into ep from public.kl_episodes where id = p_episode_id;
  source_key := 'kl:episode:v1:' || ep.id::text;

  if exists (
    select 1 from public.kl_story_progress p
    where p.user_id = actor and p.episode_id = ep.id
  ) then
    season_posted := public.kl_try_season_points_v1(actor, ep.season_id);
    return jsonb_build_object('ok', true, 'already_completed', true, 'points', 0, 'season', season_posted);
  end if;

  posted := public.kl_post_points_v1(
    actor,
    'kl_episode_completion',
    source_key,
    'Kabihasnang Ligaw episode completed'
  );

  if coalesce((posted->>'ok')::boolean, false) is distinct from true then
    insert into public.kl_reward_outbox (user_id, source_type, source_id, points, status, last_error)
    values (actor, 'episode', ep.id, 0, 'failed', coalesce(posted->>'error', 'reward_failed'))
    on conflict (user_id, source_type, source_id) do update
      set status = 'failed', last_error = excluded.last_error;
    return jsonb_build_object('ok', false, 'error', 'reward_failed', 'detail', posted);
  end if;

  if coalesce((posted->>'already')::boolean, false) then
    insert into public.kl_story_progress (user_id, episode_id, point_ledger_id, source_key)
    values (actor, ep.id, nullif(posted->>'ledger_id', '')::uuid, source_key)
    on conflict (user_id, episode_id) do nothing;
    return jsonb_build_object('ok', true, 'already_completed', true, 'points', 0);
  end if;

  insert into public.kl_story_progress (user_id, episode_id, point_ledger_id, source_key)
  values (actor, ep.id, nullif(posted->>'ledger_id', '')::uuid, source_key)
  on conflict (user_id, episode_id) do nothing;

  insert into public.kl_reward_outbox (user_id, source_type, source_id, points, status, ledger_id)
  values (
    actor, 'episode', ep.id,
    coalesce((posted->>'points')::integer, 0),
    'posted',
    nullif(posted->>'ledger_id', '')::uuid
  )
  on conflict (user_id, source_type, source_id) do update
    set status = 'posted', ledger_id = excluded.ledger_id, points = excluded.points, last_error = null;

  season_posted := public.kl_try_season_points_v1(actor, ep.season_id);
  return jsonb_build_object(
    'ok', true,
    'already_completed', false,
    'points', coalesce((posted->>'points')::integer, 0),
    'claim_state', 'pending',
    'season', season_posted
  );
end;
$$;

create or replace function public.kl_admin_action_v1(
  p_action text,
  p_episode_id uuid,
  p_notes text,
  p_manila_date date,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ep public.kl_episodes%rowtype;
  v_release_at timestamptz;
  blocked text;
begin
  if actor is null or coalesce(public.buklod_is_system_admin(), false) is distinct from true then
    raise exception 'Not allowed';
  end if;

  if p_action = 'emergency_stop' then
    update public.kl_publication_control
      set emergency_stop = true, updated_at = now(), updated_by = actor
      where id = true;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, p_episode_id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'emergency_clear' then
    update public.kl_publication_control
      set emergency_stop = false, updated_at = now(), updated_by = actor
      where id = true;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, p_episode_id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  select * into ep from public.kl_episodes where id = p_episode_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'missing');
  end if;

  if p_expected_updated_at is not null and ep.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  if p_action = 'pause_season' then
    update public.kl_seasons set status = 'paused', emergency_stop = false, updated_at = now()
    where id = ep.season_id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'resume_season' then
    update public.kl_seasons set status = 'approved', updated_at = now()
    where id = ep.season_id and status = 'paused';
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'pause' then
    update public.kl_episodes set status = 'paused', updated_at = now() where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'revise' then
    update public.kl_episodes
      set status = 'needs_revision',
          approved_at = null,
          approved_by = null,
          revision_notes = left(coalesce(p_notes, ''), 2000),
          updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  blocked := null;
  if ep.manuscript_status is distinct from 'approved_complete' or ep.prose_complete is distinct from true then
    blocked := 'manuscript_incomplete';
  elsif not exists (
    select 1 from jsonb_array_elements(ep.content) elem
    where length(trim(coalesce(elem->>'text', ''))) > 0
  ) then
    blocked := 'manuscript_incomplete';
  elsif not exists (
    select 1 from public.kl_storyboard b
    where b.episode_id = ep.id and b.required
  ) or exists (
    select 1 from public.kl_storyboard b
    where b.episode_id = ep.id and b.required
      and (b.paragraph_start is null or b.paragraph_end is null or b.approved is distinct from true or b.artwork_status is distinct from 'APPROVED')
  ) then
    blocked := 'media_blocked';
  elsif not exists (
    select 1 from public.kl_assets a
    where a.episode_id = ep.id and a.required and a.approved and a.classification = 'APPROVED'
  ) or exists (
    select 1 from public.kl_assets a
    where a.required
      and (a.episode_id = ep.id or a.episode_id is null)
      and (a.approved is distinct from true or a.classification is distinct from 'APPROVED')
  ) then
    blocked := 'media_blocked';
  end if;

  if p_action = 'approve' then
    if blocked is not null then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'approve_refused', ep.id, blocked);
      return jsonb_build_object('ok', false, 'error', blocked, 'published', false);
    end if;
    update public.kl_episodes
      set status = 'approved',
          approved_at = now(),
          approved_by = actor,
          media_gate = 'clear',
          revision_notes = left(coalesce(p_notes, ''), 2000),
          updated_at = now()
      where id = ep.id;
    update public.kl_seasons
      set status = 'approved', updated_at = now()
      where id = ep.season_id and status = 'draft';
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, 'approve', ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'schedule' then
    if ep.approved_at is null or ep.status not in ('approved', 'scheduled', 'live') or blocked is not null then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'schedule_refused', ep.id, coalesce(blocked, 'not_approved'));
      return jsonb_build_object('ok', false, 'error', coalesce(blocked, 'not_approved'), 'published', false);
    end if;
    v_release_at := public.kl_release_from_manila_date(p_manila_date);
    if v_release_at is null or public.kl_is_manila_six(v_release_at) is distinct from true then
      return jsonb_build_object('ok', false, 'error', 'release_must_be_0600_asia_manila');
    end if;
    perform pg_advisory_xact_lock(hashtextextended('kl-schedule:' || ep.season_id::text, 0));
    if exists (
      select 1
      from public.kl_episodes other
      where other.season_id = ep.season_id
        and other.id <> ep.id
        and other.status in ('scheduled', 'live')
        and timezone('Asia/Manila', other.release_at)::date
            = timezone('Asia/Manila', public.kl_release_from_manila_date(p_manila_date))::date
    ) then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'schedule_refused', ep.id, 'one_episode_per_manila_day');
      return jsonb_build_object('ok', false, 'error', 'one_episode_per_manila_day', 'published', false);
    end if;
    update public.kl_episodes
      set status = 'scheduled', release_at = v_release_at, updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, 'schedule', ep.id, v_release_at::text);
    return jsonb_build_object('ok', true, 'published', false, 'release_at', v_release_at);
  end if;

  if p_action = 'resume' then
    if ep.approved_at is null or blocked is not null then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'resume_refused', ep.id, coalesce(blocked, 'not_approved'));
      return jsonb_build_object('ok', false, 'error', coalesce(blocked, 'not_approved'));
    end if;
    update public.kl_episodes
      set status = case when release_at <= now() then 'live' else 'scheduled' end,
          updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, 'resume', ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unknown_action');
end;
$$;

revoke all on function public.kl_post_points_v1(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.kl_complete_episode_v1(uuid) from public, anon;
grant execute on function public.kl_complete_episode_v1(uuid) to authenticated;
grant execute on function public.kl_admin_action_v1(text, uuid, text, date, timestamptz) to authenticated;

drop policy if exists kl_read_released_episodes on public.kl_episodes;
create policy kl_read_released_episodes on public.kl_episodes
for select to authenticated
using (
  status in ('approved', 'scheduled', 'live')
  and approved_at is not null
  and release_at <= now()
  and prose_complete
  and manuscript_status = 'approved_complete'
  and media_gate = 'clear'
  and exists (
    select 1 from public.kl_seasons s
    where s.id = season_id and s.status in ('approved', 'live') and s.emergency_stop = false
  )
  and not exists (select 1 from public.kl_publication_control c where c.emergency_stop)
  and exists (
    select 1 from public.kl_assets a
    where a.episode_id = kl_episodes.id and a.required and a.approved and a.classification = 'APPROVED'
  )
  and not exists (
    select 1 from public.kl_assets a
    where a.episode_id = kl_episodes.id and a.required
      and (a.approved is distinct from true or a.classification is distinct from 'APPROVED')
  )
  and exists (
    select 1 from public.kl_storyboard b
    where b.episode_id = kl_episodes.id and b.required
  )
  and not exists (
    select 1 from public.kl_storyboard b
    where b.episode_id = kl_episodes.id and b.required
      and (b.paragraph_start is null or b.paragraph_end is null or b.approved is distinct from true)
  )
  and not exists (
    select 1 from public.kl_assets a
    where a.required
      and a.episode_id is null
      and (a.approved is distinct from true or a.classification is distinct from 'APPROVED')
  )
);

create or replace function public.kl_episode_member_visible(p_episode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kl_episodes e
    join public.kl_seasons s on s.id = e.season_id
    where e.id = p_episode_id
      and coalesce(s.emergency_stop, false) = false
      and s.status in ('approved', 'live')
      and e.status in ('approved', 'scheduled', 'live')
      and e.approved_at is not null
      and e.release_at <= now()
      and e.prose_complete
      and e.manuscript_status = 'approved_complete'
      and e.media_gate = 'clear'
      and exists (
        select 1
        from jsonb_array_elements(e.content) elem
        where length(trim(coalesce(elem->>'text', ''))) > 0
      )
      and exists (
        select 1 from public.kl_assets a
        where a.episode_id = e.id
          and a.required
          and a.approved
          and a.classification = 'APPROVED'
      )
      and not exists (
        select 1 from public.kl_assets a
        where a.required
          and (a.episode_id = e.id or a.episode_id is null)
          and (a.approved is distinct from true or a.classification is distinct from 'APPROVED')
      )
      and not exists (
        select 1 from public.kl_storyboard b
        where b.episode_id = e.id
          and b.required
          and (b.paragraph_start is null or b.paragraph_end is null or b.approved is distinct from true)
      )
      and not exists (
        select 1 from public.kl_publication_control c
        where c.emergency_stop
      )
  );
$$;

revoke all on function public.kl_episode_member_visible(uuid) from public, anon;
grant execute on function public.kl_episode_member_visible(uuid) to authenticated;

create or replace function public.kl_publication_stopped()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.emergency_stop from public.kl_publication_control c where c.id), false);
$$;

revoke all on function public.kl_publication_stopped() from public, anon;
grant execute on function public.kl_publication_stopped() to authenticated;

drop policy if exists kl_read_released_episodes on public.kl_episodes;
create policy kl_read_released_episodes on public.kl_episodes
for select to authenticated
using (public.kl_episode_member_visible(id));

drop policy if exists kl_read_approved_seasons on public.kl_seasons;
create policy kl_read_approved_seasons on public.kl_seasons
for select to authenticated
using (
  status in ('approved', 'live')
  and emergency_stop = false
  and not public.kl_publication_stopped()
);
