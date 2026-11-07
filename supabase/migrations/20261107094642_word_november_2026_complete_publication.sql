-- BUKLOD Word November 2026 complete repair. Owner authorized 2026-11-07.
-- 30 independently written entries stored in content/word/2026-11/.
-- Do not change September/October archives or weekly assignments.
-- Idempotent seed with editor-conflict checks; publication dates future-gated by existing readers.

DO $word_seed$
DECLARE v_series uuid; v jsonb; v_total int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('buklod-word-november-2026-once'));
  SELECT id INTO v_series FROM public.devotional_series
  WHERE title='BUKLOD Daily Devotion — November 2026' ORDER BY created_at LIMIT 1;
  IF v_series IS NULL THEN
    INSERT INTO public.devotional_series(title,description,is_published)
    VALUES ('BUKLOD Daily Devotion — November 2026',
      'Thirty new Scripture-grounded November 2026 daily Word devotionals, scheduled by exact local date.',true)
    RETURNING id INTO v_series;
  ELSIF EXISTS(SELECT 1 FROM public.devotional_series WHERE id=v_series AND is_published=false) THEN
    RAISE EXCEPTION 'November series intentionally unpublished; refusing to override';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.devotionals d JOIN public.devotional_series s ON s.id=d.series_id
    WHERE d.publish_date BETWEEN date '2026-11-01' AND date '2026-11-30'
    AND s.title LIKE 'BUKLOD Daily Devotion%' AND d.series_id<>v_series
  ) THEN RAISE EXCEPTION 'November dates belong to another Daily Devotion series'; END IF;
  FOR v IN SELECT value FROM jsonb_array_elements($word_json$[{"day":1,"title":"ANG PANANAMPALATAYANG MAY MGA HAKBANG","bible_passage":"James 2:14–18","key_verse":"James 2:17","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang buhay na pananampalataya ay nakikita sa makataong pagkilos.","reflection_text":"May mga salitang madaling sabihin: “Ipagdarasal kita,” “Nandito lang ako,” “Mahal kita.” Ngunit sa Santiago 2, hinahamon ang taong nakakita ng kapatid na walang damit at pagkain ngunit walang ginawa upang tumulong. Hindi sapat na mabait ang sagot kung nakatalikod naman ang mga kamay.\n\nHindi itinuturo ni Santiago na nabibili ng mabubuting gawa ang kaligtasan. Ang tunay na pagtitiwala sa Diyos ay nagbubunga ng pag-ibig na nakikita. Maaaring pagkain, oras, pakikinig, o pagdalaw ang ibigay. Ang mahalaga ay hindi ginagamit ang pananalita tungkol sa pananampalataya upang takasan ang pananagutan sa kapwa.","think_about_it":"Ano ang isang pangakong pagtulong na maaari mo nang tuparin ngayon?","application_text":"Pumili ng isang taong may konkretong pangangailangan at gawin ang kaya mong tulong nang walang kapalit.","prayer_text":"Panginoon, ilayo Mo ako sa pananampalatayang hanggang salita lamang. Hubugin Mo ang aking mga pasiya upang maging daluyan ng Iyong pag-ibig. Amen."},{"day":2,"title":"KAPAG HINDI MALINAW ANG PASIYA","bible_passage":"Proverbs 3:5–6","key_verse":"Proverbs 3:5","scripture_text":"Buod ng talata (hindi tuwirang sipi): Magtiwala sa karunungan ng Panginoon habang responsable sa pagpapasiya.","reflection_text":"Hindi lahat ng desisyon ay may kasamang malinaw na tanda. May mga pagpiling may dalawang mabuting posibilidad, at may mga pagkakataong pareho silang may panganib. Ang Kawikaan ay nag-aanyayang huwag gawing huling hukom ang sariling limitadong pang-unawa.\n\nAng pagtitiwala sa Diyos ay hindi pagtalikod sa pag-iisip, pananaliksik, at payo. Inilalapit natin ang mga iyon sa Kanyang kalooban. Tanungin: tapat ba ito? Makatarungan ba? May pag-ibig ba? Tama ba ang motibo? Kapag hindi pa malinaw ang kinabukasan, maaaring maging malinaw pa rin ang susunod na matapat na hakbang.","think_about_it":"Aling desisyon ang kailangan mong suriin hindi lamang sa pakinabang kundi sa katapatan?","application_text":"Isulat ang tatlong biblical principles na dapat gumabay sa kasalukuyan mong pagpili.","prayer_text":"Diyos na marunong, ituwid Mo ang aking hangarin at turuan Mo akong magpasiyang may pananampalataya at pananagutan. Amen."},{"day":3,"title":"MGA HABAG NA HINDI NAUUBOS","bible_passage":"Lamentations 3:19–24","key_verse":"Lamentations 3:22–23","scripture_text":"Buod ng talata (hindi tuwirang sipi): Sa gitna ng pagdadalamhati, alalahanin ang di-nauubos na habag ng Diyos.","reflection_text":"Hindi isinulat ang Panaghoy mula sa magaan na kalagayan. Nasa likod nito ang pagkawasak at bigat ng pagkawala. Sa ganoong tagpo, ang pag-alala sa awa ng Panginoon ay hindi pagtanggi sa nangyari. Ito ang matibay na pag-asa habang totoo pa ang sakit.\n\nMay umagang wala ka pang nakikitang pagbabago. Pareho pa rin ang bayarin, problema, o pangungulila. Gayunman, hindi nasusukat ang katapatan ng Diyos sa bilis ng ginhawa. Maaari kang lumapit nang may luha at magsabi: “Panginoon, sapat ang Iyong katapatan upang harapin ko ang araw na ito.”","think_about_it":"Anong kabigatan ang kailangan mong dalhin sa Diyos nang hindi nagkukunwaring maayos ang lahat?","application_text":"Magsimula ng araw sa isang tapat na panalangin ng pag-asa, kahit maikli lamang.","prayer_text":"Panginoon, salamat na ang Iyong habag ay hindi nauubos. Turuan Mo akong umasa sa Iyo kahit mabigat pa ang aking kalagayan. Amen."},{"day":4,"title":"LAKAS PARA SA NANGHIHINA","bible_passage":"Isaiah 40:27–31","key_verse":"Isaiah 40:31","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang Diyos na hindi nanghihina ang nagbibigay ng lakas sa umaasa sa Kanya.","reflection_text":"May pagod na nalulutas ng tulog, at may pagod na bumibigat dahil sa matagal na pakikibaka. Sa Isaias 40, ang bayan ay pinaaalalahanang hindi nakaligtaan ng Maylalang ang kanilang daing. Hindi kapos sa lakas ang Diyos kahit kapos na tayo.\n\nAng pag-aantay sa Panginoon ay hindi kawalang-kilos. Ito ay patuloy na pagtitiwala habang ginagawa ang ipinagkatiwalang gawain sa tamang sukat. May mga panahong tatakbo, at may mga panahong makalalakad lamang. Hindi kabawasan sa pananampalataya ang pagkilala sa limitasyon, paghingi ng tulong, at paglalaan ng pahinga. Ang pag-asa ay nakaugat sa kung sino ang Diyos, hindi sa ating tibay.","think_about_it":"May bahagi ba ng buhay mo na pilit mong dinadala nang walang tulong?","application_text":"Humingi ng tamang tulong at ayusin ang isang tungkuling maaaring hatiin o ipagpaliban.","prayer_text":"Panginoon, kilala Mo ang aking pagod. Bigyan Mo ako ng lakas, karunungan, at pagpapakumbabang tanggapin ang tulong na kailangan ko. Amen."},{"day":5,"title":"MAGLINGKOD NANG HINDI NAWAWALA ANG PAKIKINIG","bible_passage":"Luke 10:38–42","key_verse":"Luke 10:42","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang paglilingkod ay dapat manggaling sa pakikinig kay Jesus.","reflection_text":"Mahalaga ang ginawa ni Marta: nag-aasikaso siya para sa panauhin. Ngunit nang maging puno ng pag-aalala ang paglilingkod, hindi na niya napansin ang pangangailangang makinig. Hindi kinondena ni Jesus ang pagtatrabaho; itinuwid Niya ang pusong naliligalig sa maraming bagay.\n\nMadaling mangyari ito sa tahanan, simbahan, o trabaho. Abala tayo sa paggawa ng mabuti, ngunit wala nang panahon sa Salita at sa mga taong pinaglilingkuran. Hindi karangalan ang sobrang pagkakaabala kapag nawala ang pag-ibig. Ang mabuting paglilingkod ay lumalago mula sa pakikinig, hindi mula sa takot na mapag-iwanan.","think_about_it":"May ginagawa ka bang para sa Diyos ngunit unti-unti nang nauubos ang iyong pakikinig sa Kanya?","application_text":"Maglaan ng tahimik na oras sa pagbasa ng Salita bago buuin ang mga gawain.","prayer_text":"Panginoong Jesus, ayusin Mo ang aking mga prayoridad. Gawin Mong bunga ng pakikinig at pag-ibig ang aking paglilingkod. Amen."},{"day":6,"title":"SA BANGKANG MAY TAKOT","bible_passage":"Mark 4:35–41","key_verse":"Mark 4:40","scripture_text":"Buod ng talata (hindi tuwirang sipi): May kapangyarihan si Cristo kahit may bagyong kinatatakutan ang mga alagad.","reflection_text":"Kasama ng mga alagad si Jesus sa bangka, ngunit hindi sila nakaligtas sa biglang unos. Mahalagang tandaan iyon: ang presensya ni Cristo ay hindi pangakong wala nang paghihirap. Sa gitna ng alon, inihayag Niya ang awtoridad Niya sa hangin at dagat at tinanong ang mga alagad tungkol sa kanilang takot.\n\nKapag nanginginig ang loob, huwag ipagkamaling iniwan ka ng Diyos. Maaari kang tumawag sa Kanya at kasabay nito'y gawin ang kinakailangang pag-iingat. Ang tanong ng pananampalataya ay hindi kung kaya mong itago ang takot, kundi kung kaninong kapangyarihan at kabutihan ka kakapit habang humaharap dito.","think_about_it":"Ano ang bagyong nagpaparamdam sa iyong parang wala nang kontrol?","application_text":"Ipangalan sa panalangin ang takot at gumawa ng isang maingat na hakbang na nasa iyong pananagutan.","prayer_text":"Panginoong Jesus, pakinggan Mo ang aking takot. Palalimin Mo ang tiwala ko sa Iyong presensya at awtoridad. Amen."},{"day":7,"title":"PASASALAMAT NA HINDI NAGKUKUNWARI","bible_passage":"1 Thessalonians 5:16–18","key_verse":"1 Thessalonians 5:18","scripture_text":"Buod ng talata (hindi tuwirang sipi): Magpasalamat sa lahat ng kalagayan nang hindi itinatanggi ang sakit.","reflection_text":"Inuutusan ni Pablo ang mga mananampalataya na magalak, manalangin, at magpasalamat. Hindi ibig sabihin nito na ang bawat masakit na pangyayari ay mabuti. Ang mga Kristiyano ay maaari pa ring magluksa, magprotesta laban sa kawalang-katarungan, at humingi ng paghilom.\n\nNgunit sa gitna ng anumang kalagayan, may dahilan tayong makipag-usap sa Diyos. Ang pasasalamat ay hindi tabing sa sugat. Maaari itong maging tapat na pagkilala: “Mabigat ito, Panginoon, ngunit salamat sa taong tumulong, sa lakas na ibinigay Mo, at sa pag-asang hindi Mo ako pinabayaan.” Ang pusong nagpapasalamat ay natutong makakita ng biyaya nang hindi binubura ang katotohanan.","think_about_it":"Anong mabuting kaloob ang naroon pa rin kahit may kasabay na mabigat na problema?","application_text":"Magpasalamat sa isang kongkretong biyaya at sabihin din sa Diyos ang tunay na dinaramdam.","prayer_text":"Panginoon, turuan Mo akong magpasalamat nang tapat at patuloy na manalangin sa bawat kalagayan. Amen."},{"day":8,"title":"KALAYAANG NAGSISIMULA SA KATOTOHANAN","bible_passage":"John 8:31–36","key_verse":"John 8:36","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang Anak ang nagpapalaya sa tao mula sa pagkaalipin sa kasalanan.","reflection_text":"Marami ang nagsasabing malaya sila dahil walang nag-uutos sa kanila. Ngunit sa Juan 8, binubunyag ni Jesus ang isang mas malalim na pagkaalipin: ang kasalanang namumuno sa mga pagpili at pagnanasa. Hindi sapat na tawagin itong “gusto ko lang” kung unti-unti nitong sinisira ang buhay at kapwa.\n\nAng pananatili sa salita ni Jesus ang landas ng tunay na alagad. Ang Kanyang katotohanan ay hindi palamuti sa sarili nating plano. Tinutuwid Niya tayo, inilalantad ang maling dahilan, at tinatawag sa pagsisisi. Ngunit hindi Niya tayo iniiwan sa kahihiyan; ang Anak ang nagpapalaya. Kaya may pag-asa kahit matagal nang paulit-ulit ang isang maling gawi.","think_about_it":"Anong ugali ang ipinagtatanggol mo bilang kalayaan kahit alam mong nakapipinsala?","application_text":"Kilalanin ang isang maling gawi at humingi ng pananagutan at tulong sa mapagkakatiwalaang tao.","prayer_text":"Panginoong Jesus, ilantad Mo ang anumang umaalipin sa akin at turuan Mo akong mamuhay sa Iyong katotohanan. Amen."},{"day":9,"title":"BIYAYANG HINDI NABIBILI","bible_passage":"Ephesians 2:8–10","key_verse":"Ephesians 2:8–10","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang kaligtasan ay kaloob ng Diyos; ang mabubuting gawa ay bunga nito.","reflection_text":"Kapag nasanay tayong sukatin ang sarili sa dami ng nagawa, maaari nating dalhin ang parehong sukatan sa Diyos. Para bang ang pagtanggap Niya ay gantimpala sa mahabang listahan ng kabutihan. Ngunit malinaw ang Efeso 2: hindi tayo naliligtas dahil sa sariling gawa; ito'y kaloob ng Diyos kay Cristo.\n\nHindi rin nilalayong gawing tamad ang biyaya. Ang iniligtas na tao ay nililikha para sa mabubuting gawa na inihanda ng Diyos. May malaking kaibahan ang paggawa upang bilhin ang pagmamahal at ang paggawa dahil minahal na tayo. Ang una ay nakapapagod at mapagmataas; ang ikalawa ay mapagpasalamat at mapaglingkod.","think_about_it":"Saan mo nasusukat ang halaga mo sa dami ng nagawa mo para sa Diyos?","application_text":"Gumawa ng kabutihan ngayon bilang pasasalamat, hindi bilang pagtatangkang kumita ng pagtanggap.","prayer_text":"Ama, salamat sa biyayang hindi ko kayang bilhin. Gawin Mong bunga ng pananampalataya ang aking mga gawa. Amen."},{"day":10,"title":"PAGSISISING HINDI NAGTATAGO","bible_passage":"Psalm 51:1–12","key_verse":"Psalm 51:10","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang tunay na pagsisisi ay lumalapit sa awa ng Diyos at humihiling ng malinis na puso.","reflection_text":"Ang Awit 51 ay hindi simpleng pagpapagaan ng konsensiya ni David. Isinilang ito sa pagharap sa mabigat na kasalanan. Hindi niya sinisisi ang sitwasyon o ang ibang tao; humihingi siya ng awa at malinis na puso mula sa Diyos.\n\nMinsan mas madali ang magsabi ng “sorry” kaysa tanggapin ang epekto ng nagawa. Ngunit ang pagsisisi ay higit sa lungkot dahil nahuli tayo. Kasama rito ang pag-amin, pagtalikod sa kasalanan, at matapat na pag-aayos sa abot ng makakaya. Hindi natin kayang baguhin ang sariling puso sa lakas lamang ng panata. Lumalapit tayo sa Diyos na mahabagin at humihingi ng tunay na pagbabago.","think_about_it":"May pagkakamali ka bang binibigyang-dahilan sa halip na inaamin?","application_text":"Magsabi ng tapat na paghingi ng tawad at simulan ang nararapat na pagwawasto.","prayer_text":"Maawa Ka sa akin, Panginoon. Linisin Mo ang aking puso at bigyan Mo ako ng lakas na talikuran ang mali. Amen."},{"day":11,"title":"ANG PAGPAPAKUMBABANG HUGIS NI CRISTO","bible_passage":"Philippians 2:1–11","key_verse":"Philippians 2:5","scripture_text":"Buod ng talata (hindi tuwirang sipi): Itinuro ni Cristo ang kababaang-loob sa pamamagitan ng paglilingkod.","reflection_text":"Sa Filipos 2, hindi lamang magandang asal ang panawagan ni Pablo. Itinuturo niyang tingnan ang sarili at kapwa sa liwanag ng pagpakumbaba ni Cristo. Siya na may karangalan ay naglingkod at nagpakasakit bilang pagsunod sa Ama.\n\nHindi nangangahulugan ang pagpapakumbaba na wala kang halaga o wala ka nang hangganan. Nangangahulugan itong hindi mo kailangang laging manalo sa usapan o ikaw ang palaging sentro. Maaari kang makinig, magbigay ng pagkilala, magbahagi ng oportunidad, at maglingkod kahit walang palakpakan. Ang pag-uugaling ito ay hindi kayang gawin nang matagal sa pagmamataas; kailangan ng pusong hinuhubog ng ebanghelyo.","think_about_it":"Saang relasyon mo kailangang unahin ang pakikinig kaysa pagpapatunay na tama ka?","application_text":"Magbigay ng buong pakikinig sa isang taong madalas mong nasasapawan.","prayer_text":"Panginoong Jesus, turuan Mo akong magkaroon ng Iyong pag-iisip—mapagpakumbaba, matapang, at mapagmahal. Amen."},{"day":12,"title":"KUNG SAAN NAKATAGO ANG KAYAMANAN","bible_passage":"Matthew 6:19–24","key_verse":"Matthew 6:21","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang pinakamahalaga sa puso ay nahahayag sa kung saan inilalagak ang yaman at oras.","reflection_text":"Hindi hinahatulan ni Jesus ang responsableng pag-iimpok. Itinutuwid Niya ang pusong ginagawang panginoon ang kayamanan. Ang mga bagay na maaaring masira o mawala ay hindi sapat na pundasyon ng panghabambuhay na seguridad.\n\nSuriin kung saan napupunta ang oras, lakas, at salapi. Hindi lahat ng ginagastusan ay mali, ngunit kapag ang pagkuha ng higit pa ang nagiging sukatan ng tagumpay, madaling mawala ang pagkalinga sa pamilya, integridad, at pagsamba. Ang kayamanang nakatago sa langit ay nakikita sa buhay na humahawak sa mga kaloob ng Diyos nang tapat at bukas-palad. Ang tanong ay hindi lang magkano ang mayroon tayo, kundi ano ang namumuno sa puso natin.","think_about_it":"Aling bagay ang natatakot kang mawala nang higit sa iyong katapatan sa Diyos?","application_text":"Repasuhin ang isang gastos at ilaan ang angkop na bahagi sa tunay na pangangailangan ng kapwa.","prayer_text":"Ama, ingatan Mo ang puso ko mula sa pagkaalipin sa kayamanan at turuan Mo akong maging tapat na katiwala. Amen."},{"day":13,"title":"MGA SALITANG NAGTATAYO","bible_passage":"Ephesians 4:25–32","key_verse":"Ephesians 4:29","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang pananalita ng mananampalataya ay ginagamit sa katotohanang nagpapatibay.","reflection_text":"Hindi iniutos ni Pablo na manahimik kapag may mali. Hinamon niya ang iglesya na magsabi ng totoo at umiwas sa pananalitang naninira. May mga salitang totoo ang nilalaman ngunit marahas ang paraan. Mayroon ding mabait pakinggan ngunit itinatago ang kailangang ituwid.\n\nAng mabuting pananalita ay parehong tapat at may layuning magpatibay. Bago magpadala ng mensahe, itanong: kailangan bang sabihin ito? Tama ba ang detalye? Ito ba ang tamang oras at tao? Nakakatulong ba ang tono? Kahit sa gitna ng pagtatalo, hindi kailangang isuko ang katotohanan o ang dignidad ng kausap. Ang bibig na nasa ilalim ng paghahari ni Cristo ay marunong magwasto nang may malasakit.","think_about_it":"May mensahe ka bang kailangang baguhin ang tono bago ipadala?","application_text":"Basahing muli ang isang sensitibong mensahe at alisin ang panghahamak nang hindi inaalis ang katotohanan.","prayer_text":"Panginoon, bantayan Mo ang aking mga salita. Gamitin Mo ang aking bibig sa katotohanan at pagpapatibay. Amen."},{"day":14,"title":"MAGTULUNGAN SA PAGDADALA","bible_passage":"Galatians 6:1–5","key_verse":"Galatians 6:2","scripture_text":"Buod ng talata (hindi tuwirang sipi): Tinatawag ang mga alagad na magpasan ng bigat ng kapwa nang may pananagutan.","reflection_text":"Sa Galacia 6, may dalawang mahalagang larawan: ang pagtulong sa mabigat na pasan ng kapwa at ang pagtupad sa sariling pananagutan. Hindi sila magkalaban. May mga problemang kailangang tulungan, at may mga tungkuling hindi natin maaaring ipasa sa iba.\n\nAng kapatid na nanghihina ay hindi dapat gawing halimbawa ng pagkabigo. Lapitan siya nang mahinahon at may pag-iingat sa sarili. Sa kabilang banda, ang pagtulong ay hindi laging pagsagot sa lahat ng hinihingi. Kailangan din ng wastong hangganan upang ang malasakit ay hindi maging pagpapabaya sa katotohanan. Ang tunay na komunidad ay may parehong awa at pananagutan.","think_about_it":"Kanino ka makatutulong nang hindi inaako ang desisyong siya ang dapat gumawa?","application_text":"Mag-alok ng isang malinaw at kayang panindigang tulong sa isang nangangailangan.","prayer_text":"Diyos, bigyan Mo ako ng malasakit na matalino at kababaang-loob na tumanggap din ng tulong. Amen."},{"day":15,"title":"PAG-ASANG HINDI PA NAKIKITA","bible_passage":"Romans 8:18–25","key_verse":"Romans 8:25","scripture_text":"Buod ng talata (hindi tuwirang sipi): Nananatili ang pag-asa sa pangakong pagtubos ng Diyos kahit sa pagdurusa.","reflection_text":"Hindi minamaliit ni Pablo ang kasalukuyang paghihirap. Inilalarawan niya ang nilikha at ang mga mananampalatayang dumaraing, naghihintay sa ganap na pagtubos. Ang pag-asang ito ay hindi simpleng optimismo na magiging madali ang susunod na linggo.\n\nMay mga mabubuting bagay na hindi pa natin nararanasan nang buo: katarungan, kagalingan, kapayapaan, pagpapanibago. Habang naghihintay, maaari tayong maglingkod at umiyak nang sabay. Ang pagtitiis sa Biblia ay hindi pagtanggap sa pang-aabuso o kawalang-katarungan; ito ay pananatili sa Diyos habang ginagawa ang tama. Hindi pa tapos ang kuwento sa kasalukuyang sakit.","think_about_it":"Anong inaasam mong kabutihan ang kailangan mong ipagkatiwala sa Diyos nang may pagtitiis?","application_text":"Gumawa ng isang mabuting hakbang ngayon habang ipinagdarasal ang hindi mo pa nakikita.","prayer_text":"Panginoon, panatilihin Mong buhay ang aking pag-asa sa Iyong pangakong pagpapanibago. Amen."},{"day":16,"title":"KAPAG NABAGO ANG DIREKSIYON","bible_passage":"Acts 16:6–10","key_verse":"Acts 16:9–10","scripture_text":"Buod ng talata (hindi tuwirang sipi): Sa paglalakbay ni Pablo, may mga planong nagbago habang ginagabayan ng Diyos ang misyon.","reflection_text":"May malinaw na layunin ang mga misyonero: ipahayag ang ebanghelyo. Gayunman, hindi lahat ng rutang nais nilang tahakin ay nabuksan. Sa Gawa 16, kinakailangan nilang makinig, maghintay, at tumugon sa bagong direksiyong ipinakita ng Diyos.\n\nHindi bawat saradong pagkakataon ay tiyak na mensahe mula sa langit. Minsan bunga ito ng kakulangan, maling panahon, o karaniwang hadlang. Kaya kailangan ng panalangin, payo, pagsusuri, at tiyagang magtrabaho. Ngunit maaari ring magbago ang paraan nang hindi nagbabago ang katapatan sa layunin. Ang mabuting plano ay hindi kailangang ipagtanggol hanggang masira ang lahat; maaari itong iwasto.","think_about_it":"May planong ipinipilit mo kahit may makatuwirang dahilan upang suriin itong muli?","application_text":"Suriin ang isang plano kasama ang mapagkakatiwalaang tagapayo bago magpasya.","prayer_text":"Panginoon, gawing matatag ang aking pagsunod at maluwag ang aking kamay sa sarili kong mga plano. Amen."},{"day":17,"title":"PAGPAPATAWAD NA NAKAAALALA NG AWA","bible_passage":"Matthew 18:21–35","key_verse":"Matthew 18:33","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang taong nakatanggap ng awa ay tinatawag ding magpakita ng awa.","reflection_text":"Sa talinghaga ni Jesus, napakalaki ng utang na pinatawad sa isang lingkod. Ngunit lumabas siyang malupit sa kapwa na may mas maliit na pagkakautang. Ipinakita ni Jesus ang kalupitan ng pusong humihingi ng habag ngunit ayaw magbigay nito.\n\nAng pagpapatawad ay hindi pagdedeklarang mabuti ang nangyari. Hindi rin nito inaalis ang pangangailangan sa katotohanan, pananagutan, o pagprotekta sa nasaktan. Ang ibig sabihin nito ay hindi paghahariin ang paghihiganti sa puso. Kapag mahirap magpatawad, maaaring unang hakbang ang tapat na panalangin at ligtas na paghingi ng tulong. Ang habag ng Diyos ang pundasyon ng ating pagbabago.","think_about_it":"May galit ka bang kailangang dalhin sa Diyos nang hindi isinusuko ang wastong hangganan?","application_text":"Manalangin nang tapat tungkol sa sugat at humingi ng payo kung kailangan ang ligtas na pagharap dito.","prayer_text":"Panginoon, salamat sa Iyong awa. Iligtas Mo ako mula sa paghihiganti at turuan Mo ako ng matuwid na pagpapatawad. Amen."},{"day":18,"title":"KABUTIHANG HINDI NAGPAPAPANSIN","bible_passage":"Matthew 6:1–4","key_verse":"Matthew 6:4","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang paglilingkod ay hindi dapat gawing palabas upang makuha ang papuri ng mga tao.","reflection_text":"Sa Sermon sa Bundok, tinutukoy ni Jesus ang pagbibigay na ginagamit bilang palabas. Hindi masama ang nakikitang pagtulong—may pagkakataong mahalaga ang transparent na pag-uulat. Ang panganib ay kapag nagiging mas mahalaga ang pagtingin ng mga tao kaysa sa taong tinutulungan.\n\nHindi kailangang i-post ang bawat kabutihan. Maaaring mas mahalaga ang tahimik na pag-abot ng pagkain, pagbayad sa kailangang gamot, o pagdamay nang walang camera. Ang taong nasa pangangailangan ay may dignidad; hindi siya kasangkapan sa pagpapaganda ng reputasyon natin. Ang Ama ay nakakakita kahit ang ibang tao ay hindi.","think_about_it":"May pagkakataon bang mas inuuna mo ang pagkilala kaysa tunay na pangangailangan ng kapwa?","application_text":"Gumawa ng isang tahimik na kabutihang hindi kailangang ipaalam sa iba.","prayer_text":"Ama, linisin Mo ang aking motibo. Turuan Mo akong magbigay nang may pag-ibig at paggalang. Amen."},{"day":19,"title":"BIYAYANG SAPAT SA KAHINAAN","bible_passage":"2 Corinthians 12:7–10","key_verse":"2 Corinthians 12:9","scripture_text":"Buod ng talata (hindi tuwirang sipi): Sapat ang biyaya ni Cristo sa gitna ng kahinaang hindi agad naaalis.","reflection_text":"Tatlong ulit na nanalangin si Pablo tungkol sa isang matinding paghihirap. Hindi niya natanggap ang sagot na inaasahan, ngunit narinig niya ang pangakong sapat ang biyaya ng Panginoon. Hindi nito ginawang mabuti ang pagdurusa; ipinakita nito na hindi nanghihina ang kapangyarihan ni Cristo kapag mahina ang Kanyang lingkod.\n\nHindi kailangang ipagmalaki ang sakit o tanggihan ang paggamot, pahinga, at tulong. Maaari nating gamitin ang lahat ng angkop na paraan upang gumaling at manatiling umaasa sa Diyos. Ang kahinaan ay hindi awtomatikong kakulangan ng pananampalataya. Sa pagkilalang hindi natin kaya ang lahat, natututo tayong humawak sa biyayang hindi galing sa sariling lakas.","think_about_it":"Aling kahinaan ang pilit mong ikinukubli dahil sa takot na makita ng iba?","application_text":"Kilalanin ang limitasyon at humingi ng tamang tulong habang patuloy na nananalangin.","prayer_text":"Panginoong Jesus, salamat sa biyaya Mong sapat. Turuan Mo akong umasa sa Iyo nang hindi ikinahihiya ang aking pangangailangan. Amen."},{"day":20,"title":"KATAPATAN SA MGA IPINAGKATIWALA","bible_passage":"Luke 16:10–13","key_verse":"Luke 16:10","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang katapatan sa maliliit na ipinagkatiwala ay mahalaga sa harap ng Diyos.","reflection_text":"Sa pagtuturo ni Jesus tungkol sa kayamanan, hindi maliit ang usapin ng maliliit na bagay. Ang paggamit natin ng oras, salapi, at kapangyarihan sa pang-araw-araw ay nagpapakita kung paano natin nauunawaan ang pagiging katiwala.\n\nMadalas nating gustong tumanggap ng malaking tungkulin habang pinababayaan ang kasalukuyang pangako. Ngunit ang integridad ay nahuhubog sa simpleng gawain: tamang sukli, totoo sa oras, maingat sa impormasyon, at pagtupad sa usapan. Hindi nakikita ng lahat ang mga desisyong ito, ngunit mahalaga ang mga iyon. Ang katapatan ay hindi paghabol sa katayuan; ito ay paggalang sa nagkatiwala at sa taong maaapektuhan.","think_about_it":"Anong maliit ngunit mahalagang tungkulin ang matagal mo nang ipinagpapaliban?","application_text":"Tapusin nang maayos ang isang responsibilidad bago humingi ng panibagong pagkakataon.","prayer_text":"Diyos, turuan Mo akong maging tapat sa maliliit at malalaking bagay na ipinagkatiwala Mo. Amen."},{"day":21,"title":"PAMILYA AT PUSONG MAY HABAG","bible_passage":"Colossians 3:12–15","key_verse":"Colossians 3:13","scripture_text":"Buod ng talata (hindi tuwirang sipi): Binibigyang-hugis ng habag, pagtitiis, at pag-ibig ang buhay sa tahanan.","reflection_text":"Sa tahanan, alam natin ang kahinaan ng bawat isa. Dahil dito, maaaring maging mas matalim ang salita natin sa pinakamalalapit kaysa sa mga hindi natin kakilala. Sa Colosas 3, tinatawag ang mga mananampalataya na magsuot ng habag at pagpapasensya sa araw-araw.\n\nHindi ito paanyayang itago ang pananakit o pabayaang magpatuloy ang pang-aabuso. Ang pag-ibig ay dapat ding magsabi ng katotohanan at magtakda ng ligtas na hangganan. Ngunit sa mga ordinaryong di-pagkakaunawaan, makatutulong ang mahinahong pakikinig at tapat na paghingi ng tawad. Ang kapayapaan ni Cristo ay naghahari kung handa tayong ituwid ang maling asal, hindi lamang magpanggap na walang problema.","think_about_it":"Saang usapan sa tahanan kailangan ng higit na habag at mas malinaw na katotohanan?","application_text":"Magbukas ng isang mahinahong pag-uusap na may pakikinig, hindi paninisi.","prayer_text":"Panginoon, pagharian Mo ang aming tahanan ng katotohanan, habag, at kapayapaan. Amen."},{"day":22,"title":"ANG PAHINGANG MAY PAGSAMBA","bible_passage":"Exodus 20:8–11","key_verse":"Exodus 20:8","scripture_text":"Buod ng talata (hindi tuwirang sipi): Itinuturo ng Sabbath ang pag-alaala sa Diyos at ang hangganan ng ating paggawa.","reflection_text":"Sa Sampung Utos, ang araw ng pamamahinga ay nakaugat sa pagkilos ng Diyos bilang Maylalang. Hindi tao ang panginoon ng walang katapusang paggawa. May dignidad ang pagod na manggagawa, ang kasambahay, at ang taong hindi makasabay sa bilis ng iba.\n\nMagkakaiba ang pag-unawa ng mga Kristiyano sa eksaktong pagsasabuhay ng Sabbath, ngunit malinaw ang pangangailangan sa pagsamba, pahinga, at paggalang sa kapwa. Hindi banal ang pamumuhay na inuubos ang sarili at ang iba dahil lamang ayaw tumigil. Ang tunay na pahinga ay hindi katamaran; isa itong pagpapahayag na ang Diyos ang nagtataguyod ng buhay at hindi lamang ang ating paggawa.","think_about_it":"May ginagawa ka bang palagiang sumisira sa pahinga mo o ng taong umaasa sa iyo?","application_text":"Maglaan ng makatotohanang panahon para sa pagsamba at pahinga nang hindi nagpapatong ng bigat sa iba.","prayer_text":"Panginoon, turuan Mo akong gumawa nang tapat at magpahinga nang nagtitiwala sa Iyo. Amen."},{"day":23,"title":"MAY LUGAR ANG PAGDADALAMHATI","bible_passage":"Psalm 42:1–11","key_verse":"Psalm 42:5","scripture_text":"Buod ng talata (hindi tuwirang sipi): Maaaring ihayag ang pangungulila habang tinatawag ang puso na umasa sa Diyos.","reflection_text":"Ang sumulat ng Awit 42 ay hindi nagpanggap na masaya. Inilarawan niya ang luha, pag-iisa, at pagnanais na muling lumapit sa Diyos kasama ng Kanyang bayan. Sa gitna ng pangungulila, kinausap niya ang sariling kaluluwa: bakit ka nanlulumo, at saan ka aasa?\n\nAng pananampalataya ay hindi obligasyong laging ngumiti. May lugar ang pagdadalamhati sa panalangin at pagsamba. Maaari kang magsabi ng mahihirap na tanong nang hindi nawawala ang iyong pagiging anak ng Diyos. Kung matagal at mabigat ang pagkalumbay, makatutulong ang mapagkakatiwalaang kaibigan at propesyonal na suporta. Ang pag-asa ay hindi pagtanggi sa sugat; ito ang pagharap sa sugat sa harap ng Diyos.","think_about_it":"Anong lungkot ang hindi mo pa nabibigyan ng tapat na pangalan?","application_text":"Ipanalangin nang walang pagtatago ang nararamdaman at makipag-usap sa mapagkakatiwalaang tao.","prayer_text":"Panginoon, tanggapin Mo ang aking mga luha at patatagin Mo ang pag-asa ko sa Iyo. Amen."},{"day":24,"title":"HUWAG GANTIHAN ANG KASAMAAN","bible_passage":"Romans 12:17–21","key_verse":"Romans 12:21","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang kasamaan ay hindi nagagapi sa paghihiganti kundi sa matuwid na kabutihan.","reflection_text":"Kapag nasaktan tayo, madaling isipin na gagaan ang loob kapag nakita nating nasaktan din ang nanakit. Ngunit sa Roma 12, pinipigil ni Pablo ang paghihiganti at itinuturo ang mapayapa at makatarungang pagtugon hangga't maaari.\n\nHindi ito utos na manatili sa mapanganib na lugar o isuko ang karapatang maghanap ng proteksiyon at katarungan. Ang pagtanggi sa paghihiganti ay ibang bagay kaysa pagtanggi sa pananagutan. Maaari kang magsabi ng totoo, humingi ng tulong sa tamang awtoridad, at magtakda ng hangganan nang hindi hinahayaang ang galit ang magtakda ng iyong pagkatao. Sa kabutihan, hindi hinahayaang maghari ang kasamaan.","think_about_it":"May tunggalian bang unti-unting binabago ang ugali mo tungo sa paghihiganti?","application_text":"Piliin ang isang ligtas, tapat, at makatarungang tugon sa halip na gumanti.","prayer_text":"Panginoon, ilayo Mo ako sa paghihiganti at gabayan Mo ako sa matapang ngunit mapayapang paggawa ng tama. Amen."},{"day":25,"title":"SALITANG HINDI UMUUWI NANG WALANG BUNGA","bible_passage":"Isaiah 55:6–11","key_verse":"Isaiah 55:11","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang salita ng Diyos ay tumutupad sa Kanyang layunin kahit hindi agad nakikita ang bunga.","reflection_text":"Ginagamit ng Isaias 55 ang larawan ng ulan na nagpapasibol sa lupa. Ganoon ang salita ng Diyos: hindi ito hungkag na tunog. Tinatawag nito ang tao sa pagbabalik-loob at ipinapahayag ang maaasahang layunin ng Panginoon.\n\nHindi dapat gamitin ang pangakong ito para igiit na agad magbabago ang lahat ayon sa ating timetable. May mga salitang itinanim na matagal bago naunawaan. Ang tungkulin nating makinig, sumunod, at magpahayag nang tapat; hindi natin kontrolado ang bawat tugon. Kung tila mabagal ang paglago ng isang pamilya o komunidad, huwag gawing dahilan iyon upang isuko ang katotohanan. Manatiling matiyaga at mahabagin.","think_about_it":"Anong katotohanan ng Salita ang kailangan mong patuloy na isabuhay bago mo makita ang bunga?","application_text":"Basahin ang talata at isagawa ang isang malinaw na utos nito ngayong araw.","prayer_text":"Panginoon, gawing mabungang binhi ang Iyong Salita sa aking puso, kahit hindi ko pa nakikita ang lahat ng resulta. Amen."},{"day":26,"title":"ANG NGAYON AT ANG BUKAS","bible_passage":"Matthew 6:25–34","key_verse":"Matthew 6:33–34","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang paghahanap sa kaharian ng Diyos ay naglalagay ng pangangailangan sa tamang kaayusan.","reflection_text":"Kilala ni Jesus ang tunay na pangangailangan sa pagkain at pananamit. Hindi Niya ipinagbabawal ang responsableng pagpaplano o pagsisikap. Sa halip, hinahamon Niya ang pag-aalalang umaagaw sa buong buhay na para bang wala nang Ama na nakakaalam ng ating pangangailangan.\n\nMay mga responsibilidad para bukas na kailangang paghandaan ngayon: trabaho, budget, pangangalaga at kalusugan. Ngunit hindi natin kailangang maranasan sa isip ang lahat ng posibleng problema bago pa ito dumating. Unahin ang matuwid, hanapin ang tulong na kailangan, at harapin ang ipinagkatiwala sa araw na ito. Ang bawat araw ay may sarili nang bigat; huwag nang dagdagan ng lahat ng pangambang hindi pa dumarating.","think_about_it":"Aling pangamba tungkol sa bukas ang maaari mong gawing malinaw na plano para ngayon?","application_text":"Gumawa ng isang praktikal na hakbang at ipagkatiwala sa Diyos ang hindi mo kontrolado.","prayer_text":"Ama, alam Mo ang aming pangangailangan. Turuan Mo akong unahin ang Iyong kaharian at maging tapat sa gawain ngayon. Amen."},{"day":27,"title":"ANG PAGHUBOG NA HINDI MADALI","bible_passage":"Hebrews 12:5–11","key_verse":"Hebrews 12:11","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang pagdidisiplina ng Diyos ay paghuhubog tungo sa kabanalan.","reflection_text":"Walang batang nasisiyahan sa mahirap na pagdidisiplina habang nangyayari ito. Sa Hebreo 12, ginamit ang larawan ng mapagmahal na ama upang ipakita na ang buhay ng pananampalataya ay may pagwawasto at pagsasanay.\n\nHindi natin dapat ipakahulugang ang bawat karamdaman, trahedya, o pang-aabuso ay parusang ipinadala ng Diyos. Hindi ganoon kasimple ang pagdurusa. Ngunit kapag malinaw na may maling gawi tayong kailangang itama, maaari nating tanggapin ang pagwawasto nang may pag-asa. Ang tunay na pagdidisiplina ay hindi panghahamak; may layunin itong magbunga ng kapayapaan at katuwiran. Ang hamon ay hindi lamang malampasan ang hirap, kundi hayaang baguhin ang puso.","think_about_it":"Anong makatarungang pagwawasto ang kailangan mong pakinggan sa halip na agad ipagtanggol ang sarili?","application_text":"Tumanggap ng isang tapat na puna at gumawa ng konkretong hakbang upang itama ang mali.","prayer_text":"Ama, bigyan Mo ako ng pusong natututo at karunungang tanggapin ang paghubog na ayon sa Iyong katotohanan. Amen."},{"day":28,"title":"ANG KAPWA SA GILID NG DAAN","bible_passage":"Luke 10:25–37","key_verse":"Luke 10:36–37","scripture_text":"Buod ng talata (hindi tuwirang sipi): Sa talinghaga ng mabuting Samaritano, ang pag-ibig ay lumalapit sa nangangailangan.","reflection_text":"Nais ng tagapagtanong na malaman kung sino ang kabilang sa kategoryang “kapwa.” Sa halip na paliitin ang obligasyong magmahal, ikinuwento ni Jesus ang isang sugatang tao at ang Samaritano na huminto, nag-alaga, at gumastos upang matulungan siya.\n\nHindi nangangailangan ng magkaparehong pinagmulan, paniniwala, o katayuan ang tunay na malasakit. Madaling magbigay ng opinyon sa paghihirap kapag malayo tayo rito. Mas mahirap ang huminto, makinig, at magbahagi ng oras o yaman. May mga limitasyon ang bawat tao, ngunit hindi dapat gawing dahilan ang pagkakaiba upang mawala ang awa. Ang tanong ni Jesus ay hindi lamang kung sino ang kapwa, kundi kung paano tayo magiging kapwa sa iba.","think_about_it":"Sino ang taong madalas mong hindi napapansin dahil hindi siya bahagi ng sariling grupo?","application_text":"Magpakita ng ligtas at praktikal na malasakit sa isang taong karaniwang hindi mo nalalapitan.","prayer_text":"Panginoong Jesus, buksan Mo ang aking mga mata sa kapwang nangangailangan at bigyan Mo ako ng pusong handang tumulong. Amen."},{"day":29,"title":"MANALANGIN AT MAGSALITA NANG MAY BIYAYA","bible_passage":"Colossians 4:2–6","key_verse":"Colossians 4:6","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang panalangin at maingat na pananalita ay bahagi ng tapat na pagpapatotoo.","reflection_text":"Hinihikayat ni Pablo ang iglesya na magpatuloy sa panalangin nang mapagpasalamat at mapagmatyag. Kasunod nito, itinuro niya ang matalinong pakikitungo sa mga nasa labas at ang pananalitang may biyaya.\n\nHindi kailangang maging malakas ang boses upang maging matatag sa pananampalataya. May pagkakataong higit na makahulugan ang malinaw na sagot, tapat na pag-amin na hindi mo alam ang lahat, at mahinahong pakikinig. Ang panalangin ay hindi hiwalay sa pakikipag-usap; hinuhubog nito kung paano natin tinatrato ang kausap. Ang layunin ay hindi manalo sa bawat pagtatalo, kundi maging tapat na saksi sa katotohanan at pag-ibig ni Cristo.","think_about_it":"Saang pag-uusap mo kailangang dagdagan ang pakikinig at bawasan ang pagmamadali sa pagsagot?","application_text":"Ipagdasal ang isang tao at makipag-usap sa kanya nang may paggalang at malinaw na katotohanan.","prayer_text":"Panginoon, gawin Mong masikap ang aking panalangin at mahinahon ang aking pananalita. Amen."},{"day":30,"title":"ANG PAG-ASANG HINDI MAGWAWAKAS","bible_passage":"Revelation 21:1–5","key_verse":"Revelation 21:5","scripture_text":"Buod ng talata (hindi tuwirang sipi): Ang pangwakas na pangako ng Diyos ay bagong nilikha kung saan Siya'y mananahan kasama ng Kanyang bayan.","reflection_text":"Sa Apocalipsis 21, hindi lamang pagtakas mula sa mundo ang pag-asa ng mananampalataya. Ipinapakita ang Diyos na gumagawa ng bagong langit at bagong lupa at nagpupunas ng luha. Ang huling salita ay hindi kamatayan, pagdurusa, o kawalang-katarungan kundi ang pagpapanibagong gagawin Niya.\n\nHindi ibig sabihin nito na bale-wala ang kasalukuyang buhay. Dahil may pangakong bagong nilikha, may dahilan tayong pahalagahan ang katawan, kapwa, katotohanan, at makatarungang pagkilos ngayon. Maaari tayong magluksa nang may pag-asa at maglingkod nang hindi nawawalan ng saysay. Ang hinaharap ng Diyos ay hindi dahilan para tumalikod sa kasalukuyan; ito ang nagbibigay ng tibay upang maging tapat dito.","think_about_it":"Anong takot tungkol sa hinaharap ang kailangang maliwanagan ng pangako ng Diyos?","application_text":"Magpasalamat sa pangako ng bagong nilikha at gumawa ng isang mabuting gawain sa kasalukuyan.","prayer_text":"Panginoon, palakasin Mo ang aming pag-asa sa Iyong pagpapanibago. Gawin Mo kaming tapat habang hinihintay Ka namin. Amen."}]$word_json$::jsonb) j(value) LOOP
    IF EXISTS(
      SELECT 1 FROM public.devotionals d
      WHERE d.series_id=v_series AND d.day_number=(v->>'day')::int AND
       (d.title IS DISTINCT FROM v->>'title'
        OR d.reflection_text IS DISTINCT FROM v->>'reflection_text'
        OR d.publish_date IS DISTINCT FROM make_date(2026,11,(v->>'day')::int)
        OR d.is_published IS DISTINCT FROM true)
    ) THEN RAISE EXCEPTION 'Word editorial conflict for November day %',v->>'day'; END IF;
    INSERT INTO public.devotionals(series_id,day_number,sort_order,publish_date,title,bible_passage,
      key_verse,scripture_text,reflection_text,think_about_it,live_it_today,application_text,
      prayer_text,is_published,allow_comments,bayanihan_reward)
    SELECT v_series,(v->>'day')::int,(v->>'day')::int,make_date(2026,11,(v->>'day')::int),
      v->>'title',v->>'bible_passage',v->>'key_verse',v->>'scripture_text',v->>'reflection_text',
      v->>'think_about_it',v->>'application_text',v->>'application_text',v->>'prayer_text',true,true,2
    WHERE NOT EXISTS(SELECT 1 FROM public.devotionals x WHERE x.series_id=v_series AND x.day_number=(v->>'day')::int);
  END LOOP;
  SELECT count(*) INTO v_total FROM public.devotionals d WHERE d.series_id=v_series
    AND d.is_published=true AND d.publish_date BETWEEN date '2026-11-01' AND date '2026-11-30';
  IF v_total<>30 THEN RAISE EXCEPTION 'November Word publication incomplete: % of 30',v_total; END IF;
END;
$word_seed$;

CREATE OR REPLACE FUNCTION public.get_my_daily_devotional()
RETURNS TABLE(series_id uuid, series_title text, devotional_date date, day_number integer,
  day_count integer, devotional_id uuid, title text, bible_passage text, key_verse text,
  scripture_text text, reflection_text text, illustration_text text, think_about_it text,
  live_it_today text, prayer_text text, application_text text, quotation_text text,
  quotation_author text, sort_order integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $word_daily$
DECLARE actor uuid := (SELECT auth.uid());
        v_today date := (timezone('Asia/Manila',now()))::date;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM public.buklod_require_active_cluster_membership(actor);
  RETURN QUERY
  SELECT s.id,s.title,v_today,d.day_number,
   (SELECT count(*)::integer FROM public.devotionals x WHERE x.series_id=s.id AND x.is_published=true),
   d.id,d.title,d.bible_passage,d.key_verse,d.scripture_text,d.reflection_text,d.illustration_text,
   d.think_about_it,d.live_it_today,d.prayer_text,d.application_text,d.quotation_text,d.quotation_author,
   coalesce(d.sort_order,d.day_number,1)
  FROM public.devotionals d JOIN public.devotional_series s ON s.id=d.series_id
  WHERE s.is_published=true AND s.title LIKE 'BUKLOD Daily Devotion%'
    AND d.is_published=true AND d.publish_date=v_today
    AND NOT EXISTS(
       SELECT 1 FROM public.devotionals older WHERE older.id<>d.id
         AND older.is_published=true AND older.publish_date<d.publish_date
         AND lower(btrim(older.title))=lower(btrim(d.title))
         AND btrim(older.reflection_text)=btrim(d.reflection_text))
  ORDER BY s.created_at DESC,d.created_at DESC LIMIT 1;
END;
$word_daily$;

CREATE OR REPLACE FUNCTION public.queue_formation_reminders_v1()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date := (timezone('Asia/Manila', now()))::date;
  v_devotional uuid;
  v_assignment uuid;
  v_count bigint := 0;
  v_user uuid;
  v_scope uuid;
  v_admin uuid;
  v_pending_count integer;
begin
  if auth.uid() is not null and not public.buklod_is_system_admin() then
    raise exception 'System administrator access required';
  end if;

  select d.id into v_devotional
  from public.devotionals d
  join public.devotional_series ds on ds.id=d.series_id
    and ds.is_published=true and ds.title LIKE 'BUKLOD Daily Devotion%'
  where d.is_published=true
    and d.publish_date=v_today
  order by d.publish_date desc nulls last, d.created_at desc
  limit 1;

  select a.id into v_assignment
  from public.daily_bible_assignments a
  where a.is_published = true
    and a.reading_date = v_today
  order by a.created_at desc
  limit 1;

  for v_user in
    select distinct m.user_id
    from public.buklod_scope_memberships m
    join public.buklod_scopes s on s.id = m.scope_id
    join public.profiles p on p.id = m.user_id
    where m.membership_status = 'ACTIVE'
      and s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED')
      and p.is_active = true
  loop
    if v_devotional is not null
       and not exists (
         select 1 from public.devotional_completions dc
         where dc.user_id = v_user and dc.devotional_id = v_devotional
       ) then
      if public.buklod_queue_notification_once_v1(
        v_user,
        'Today''s Daily Devotion is ready',
        'Spend time in the Word with BUKLOD today.',
        'devotional_reminder',
        jsonb_build_object('devotional_id', v_devotional, 'date', v_today),
        'formation:devotion-reminder:' || v_user::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end if;

    if v_assignment is not null
       and not exists (
         select 1 from public.daily_bible_submissions s
         where s.user_id = v_user and s.assignment_id = v_assignment
       ) then
      if public.buklod_queue_notification_once_v1(
        v_user,
        'Today''s Daily Reading is ready',
        'Open BUKLOD Daily Reading and complete today''s Scripture and reflection.',
        'formation_daily_reading_reminder',
        jsonb_build_object('assignment_id', v_assignment, 'date', v_today),
        'formation:reading-reminder:' || v_user::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end if;

    if exists (
      select 1
      from public.track_enrollments e
      join public.learning_tracks t on t.id = e.track_id
      where e.user_id = v_user
        and e.status::text = 'active'
        and t.formation_program in ('ccp','discipleship','mentoring')
        and exists (
          select 1
          from public.learning_lessons l
          where l.track_id = t.id
            and coalesce(l.content_ready, true) = true
            and not exists (
              select 1
              from public.lesson_progress lp
              where lp.user_id = v_user
                and lp.lesson_id = l.id
                and lp.completed_at is not null
            )
        )
    ) then
      if public.buklod_queue_notification_once_v1(
        v_user,
        'Continue your BUKLOD Lesson',
        'You have an active Formation lesson waiting. Continue when you are ready.',
        'formation_lesson_reminder',
        jsonb_build_object('date', v_today),
        'formation:lesson-reminder:' || v_user::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  for v_scope, v_pending_count in
    select a.scope_id, count(*)::integer
    from public.buklod_scope_formation_approvals_v2 a
    where a.status = 'PENDING'
      and a.created_at <= now() - interval '2 hours'
    group by a.scope_id
  loop
    for v_admin in
      select x.user_id
      from public.buklod_scope_formation_approver_ids_v1(v_scope) x
    loop
      if public.buklod_queue_notification_once_v1(
        v_admin,
        'Formation reviews waiting',
        format('%s submission%s waiting in your scope.', v_pending_count, case when v_pending_count = 1 then ' is' else 's are' end),
        'formation_pending_reminder',
        jsonb_build_object('scope_id', v_scope, 'pending_count', v_pending_count, 'date', v_today),
        'formation:pending-reminder:' || v_scope::text || ':' || v_admin::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_buklod_daily_devotion_schedule(p_through date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $word_monitor$
DECLARE v_today date := (timezone('Asia/Manila',now()))::date;
        v_through date := coalesce(p_through,(timezone('Asia/Manila',now()))::date+7);
        v_missing text;
BEGIN
  -- Never generate/recycle prior content. Cron fails visibly when any future date is missing.
  IF v_through<v_today OR v_through>v_today+31 THEN
    RAISE EXCEPTION 'Invalid Word monitoring horizon';
  END IF;
  SELECT string_agg(days.day::date::text,', ' ORDER BY days.day) INTO v_missing
  FROM generate_series(v_today,v_through,'1 day'::interval) AS days(day)
  WHERE NOT EXISTS(
    SELECT 1 FROM public.devotionals d JOIN public.devotional_series s ON s.id=d.series_id
    WHERE d.publish_date=days.day::date AND d.is_published=true
      AND s.is_published=true AND s.title LIKE 'BUKLOD Daily Devotion%'
  );
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'BUKLOD daily Word gap: %',v_missing; END IF;
  RETURN (v_through-v_today)+1;
END;
$word_monitor$;

-- Remap existing November in-app reminders to the actual devotional on their date.
-- Existing notifications keep the same recipient, date, dedupe_key and read state.
-- Push dispatch triggers are INSERT-only, so UPDATE does not resend any push.
UPDATE public.notifications n
SET data=jsonb_set(n.data,'{devotional_id}',to_jsonb(d.id::text),true)
FROM public.devotionals d JOIN public.devotional_series s ON s.id=d.series_id
WHERE n.kind='devotional_reminder'
  AND n.data->>'devotional_id'='efd517bd-bda4-4412-8d0b-c78e43ee1261'
  AND n.data->>'date'=d.publish_date::text
  AND n.data->>'date' BETWEEN '2026-11-01' AND '2026-11-30'
  AND s.title='BUKLOD Daily Devotion — November 2026'
  AND s.is_published=true AND d.is_published=true;

-- An anonymous caller cannot dispatch a system-wide reminder job.
REVOKE EXECUTE ON FUNCTION public.queue_formation_reminders_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_formation_reminders_v1() TO service_role;
-- The daily RPC already checks auth.uid() and current active Cluster membership.
REVOKE EXECUTE ON FUNCTION public.get_my_daily_devotional() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_daily_devotional() TO authenticated;