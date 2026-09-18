import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextProps } from 'react-native';

export type BuklodGameLanguage = 'en' | 'tl';

type Guide = {
  titleEn: string;
  titleTl: string;
  objectiveEn: string;
  objectiveTl: string;
  controlsEn: string;
  controlsTl: string;
};

type ContextValue = {
  language: BuklodGameLanguage;
  setLanguage: (language: BuklodGameLanguage) => void;
  t: (english: string, tagalog: string) => string;
  gameId?: string;
};

const STORAGE_KEY = 'buklod.game.language.v1';
const GameLanguageContext = createContext<ContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  t: (english) => english,
});

const GUIDES: Record<string, Guide> = {
  'jawo-forest-trail': {
    titleEn: 'Forest Trail', titleTl: 'Landas sa Kagubatan',
    objectiveEn: 'Move across three trails, avoid obstacles, collect Trail Lights, and keep your combo as the forest gets faster.',
    objectiveTl: 'Lumipat sa tatlong landas, umiwas sa mga harang, kolektahin ang Trail Lights, at panatilihin ang combo habang bumibilis ang kagubatan.',
    controlsEn: 'Swipe left or right, or tap the left/right sides of the play area.',
    controlsTl: 'Mag-swipe pakaliwa o pakanan, o i-tap ang kaliwa/kanang bahagi ng play area.',
  },
  'trudice-playground-memory': {
    titleEn: 'Wonder Path', titleTl: 'Landas ng Alaala',
    objectiveEn: 'Watch the glowing playground route, remember the order, then repeat the same sequence.',
    objectiveTl: 'Panoorin ang kumikislap na ruta sa playground, tandaan ang pagkakasunod-sunod, saka ulitin ang parehong sequence.',
    controlsEn: 'Tap the playground stations in the exact order shown.',
    controlsTl: 'I-tap ang mga playground station ayon sa eksaktong pagkakasunod na ipinakita.',
  },
  'ace-rescue-grid': {
    titleEn: 'Rescue Grid', titleTl: 'Rescue Grid',
    objectiveEn: 'Secure all three rescue beacons and reach extraction before your energy runs out.',
    objectiveTl: 'Kunin ang tatlong rescue beacon at makarating sa extraction bago maubos ang energy.',
    controlsEn: 'Tap only adjacent open tiles. Avoid blocked corridors and conserve moves.',
    controlsTl: 'I-tap lamang ang katabing bukas na tile. Iwasan ang blocked corridor at tipirin ang galaw.',
  },
  'mitch-restore-mural': {
    titleEn: 'Restore the Mural', titleTl: 'Ibalik ang Mural',
    objectiveEn: 'Place all mural fragments into their correct positions with the best possible precision.',
    objectiveTl: 'Ilagay ang lahat ng piraso ng mural sa tamang puwesto nang may pinakamataas na precision.',
    controlsEn: 'Drag a fragment and release it over the matching target.',
    controlsTl: 'I-drag ang piraso at bitawan ito sa katugmang target.',
  },
  'niel-mission-trail': {
    titleEn: 'Mission Trail', titleTl: 'Landas ng Misyon',
    objectiveEn: 'Reach the remote village while balancing water, food, energy, and morale through five decisions.',
    objectiveTl: 'Marating ang malayong pamayanan habang binabalanse ang tubig, pagkain, energy, at morale sa limang desisyon.',
    controlsEn: 'Read each situation and choose the route action that best protects the team reserve.',
    controlsTl: 'Basahin ang bawat sitwasyon at piliin ang aksiyong pinakamainam para mapangalagaan ang reserba ng team.',
  },
  'angel-kingdom-treasury': {
    titleEn: 'Kingdom Treasury', titleTl: 'Ingat-Yaman ng Kaharian',
    objectiveEn: 'Build a balanced budget, keep an emergency reserve, and survive an unexpected crisis.',
    objectiveTl: 'Bumuo ng balanseng budget, magtira ng emergency reserve, at harapin ang biglaang krisis.',
    controlsEn: 'Adjust allocations, confirm the budget, then choose how the reserve will respond to the crisis.',
    controlsTl: 'Ayusin ang allocations, kumpirmahin ang budget, saka piliin kung paano gagamitin ang reserve sa krisis.',
  },
  'vhen-farm-to-market': {
    titleEn: 'Farm to Market', titleTl: 'Mula Bukid Hanggang Pamilihan',
    objectiveEn: 'Plan crops, respond to weather, harvest at the right time, and deliver with minimal spoilage.',
    objectiveTl: 'Planuhin ang pananim, tumugon sa panahon, umani sa tamang oras, at maghatid na kaunti ang nasisira.',
    controlsEn: 'Allocate fields, choose harvest timing, then select the best market route.',
    controlsTl: 'Hatiin ang taniman, piliin ang oras ng ani, saka piliin ang pinakamainam na market route.',
  },
  'elesur-village-builder': {
    titleEn: 'Village Builder', titleTl: 'Tagapagtayo ng Pamayanan',
    objectiveEn: 'Use limited workers and materials to solve the most urgent community needs.',
    objectiveTl: 'Gamitin nang maayos ang limitadong workers at materials para tugunan ang pinakaapurahang pangangailangan ng komunidad.',
    controlsEn: 'Choose projects carefully; every build consumes workers and materials.',
    controlsTl: 'Piliin nang maingat ang proyekto; bawat build ay gumagamit ng workers at materials.',
  },
  'phan-enterprise-builder': {
    titleEn: 'Enterprise Builder', titleTl: 'Tagapagtayo ng Negosyo',
    objectiveEn: 'Grow an enterprise across six cycles without destroying cash flow or reputation.',
    objectiveTl: 'Palaguin ang negosyo sa anim na cycle nang hindi nasisira ang cash flow o reputation.',
    controlsEn: 'Choose when to produce, process, sell, or expand based on inventory and market conditions.',
    controlsTl: 'Piliin kung kailan mag-produce, mag-process, magbenta, o mag-expand batay sa inventory at market condition.',
  },
  'van-living-city-dispatch': {
    titleEn: 'City Dispatch', titleTl: 'City Dispatch',
    objectiveEn: 'Send the right service team to urgent city requests while preserving capacity and public trust.',
    objectiveTl: 'Ipadala ang tamang service team sa mahahalagang request ng lungsod habang pinapanatili ang capacity at public trust.',
    controlsEn: 'Review urgency, distance, and specialization before dispatching a team.',
    controlsTl: 'Tingnan ang urgency, distance, at specialization bago magpadala ng team.',
  },
  'christian-civic-leadership': {
    titleEn: 'Leadership Council', titleTl: 'Konseho ng Pamumuno',
    objectiveEn: 'Handle five leadership cases while protecting trust, unity, budget, and time.',
    objectiveTl: 'Harapin ang limang leadership case habang pinangangalagaan ang trust, unity, budget, at oras.',
    controlsEn: 'Read each case and choose the response with the best long-term balance.',
    controlsTl: 'Basahin ang bawat case at piliin ang tugon na may pinakamagandang pangmatagalang balanse.',
  },
  'lhen-rhythm-journey': {
    titleEn: 'Rhythm Journey', titleTl: 'Paglalakbay sa Ritmo',
    objectiveEn: 'Hit the timing grid accurately, build combo, and finish the performance with strong accuracy.',
    objectiveTl: 'Tamaan nang tama ang timing grid, bumuo ng combo, at tapusin ang performance na mataas ang accuracy.',
    controlsEn: 'Tap on the beat. Perfect timing scores more than Good; late or early taps can miss.',
    controlsTl: 'I-tap sa beat. Mas mataas ang Perfect kaysa Good; sobrang aga o huli ay maaaring Miss.',
  },
  'quin-discovery-expedition': {
    titleEn: 'Discovery Expedition', titleTl: 'Ekspedisyon ng Pagtuklas',
    objectiveEn: 'Explore the fog-of-war, gather clues, avoid hazards, and secure the hidden relic.',
    objectiveTl: 'Galugarin ang fog-of-war, mangalap ng clues, umiwas sa hazards, at makuha ang nakatagong relic.',
    controlsEn: 'Move only to adjacent tiles and use the clues to locate the relic before energy runs out.',
    controlsTl: 'Lumipat lamang sa katabing tile at gamitin ang clues para mahanap ang relic bago maubos ang energy.',
  },
};


const TL_TEXT: Record<string, string> = {
  // Shared game UI
  'SCORE': 'ISKOR',
  'ENERGY': 'ENERHIYA',
  'ROUND': 'YUGTO',
  'WATCH': 'PANOORIN',
  'REPEAT': 'ULITIN',
  'GROW': 'UMUNLAD',
  'SAVE': 'MAGTIPID',
  'ROUTE': 'RUTA',
  'LIGHT': 'ILAW',
  'READ': 'BASAHIN',
  'FLOW': 'DALOY',
  'COMBO': 'COMBO',
  'PLAY AGAIN': 'MAGLARO MULI',
  'REPLAY MISSION': 'ULITIN ANG MISYON',
  'START MISSION': 'SIMULAN ANG MISYON',
  'START JOURNEY': 'SIMULAN ANG PAGLALAKBAY',
  'NEW EXPEDITION': 'BAGONG EKSPEDISYON',
  'NEW CITY SHIFT': 'BAGONG CITY SHIFT',
  'NEW TERM': 'BAGONG TERMINO',
  'NEXT SEASON': 'SUSUNOD NA SEASON',
  'REBUILD PLAN': 'BUUIN MULI ANG PLANO',
  'START NEW ENTERPRISE': 'MAGSIMULA NG BAGONG NEGOSYO',
  'FINAL SCORE': 'HULING ISKOR',
  'FIELD UNITS': 'YUNIT NG TANIMAN',
  'WORKERS / MATERIALS': 'MGA MANGGAGAWA / MATERYALES',
  'MOST URGENT': 'PINAKA-APURAHAN',
  'BUILT': 'NAITAYO',
  'LOW': 'MABABA',
  'MEDIUM': 'KATAMTAMAN',
  'HIGH': 'MATAAS',
  'WATER': 'TUBIG',
  'FOOD': 'PAGKAIN',
  'MORALE': 'MORALE',
  'CASH': 'PERA',
  'RAW': 'HILAW NA STOCK',
  'GOODS': 'PRODUKTO',
  'CAPACITY': 'KAPASIDAD',
  'REPUTATION': 'REPUTASYON',
  'CITY TRUST': 'TIWALA NG LUNGSOD',
  'ENTERPRISE VALUE': 'HALAGA NG NEGOSYO',
  'RHYTHM SCORE': 'ISKOR SA RITMO',
  'RESTORE SCORE': 'ISKOR SA PAGPAPANUMBALIK',
  'MISSION SCORE': 'ISKOR SA MISYON',
  'STEWARDSHIP SCORE': 'ISKOR SA PAMAMAHALA',
  'KINGDOM LEVEL': 'KINGDOM LEVEL',
  'WORLD TIER': 'WORLD TIER',
  'CLEARED': 'NALAMPASAN',
  'PENDING SYNC': 'NAKAPILA SA SYNC',
  'REGION LOCKED': 'NAKA-LOCK ANG REHIYON',

  // Game titles / headings
  'Forest Trail': 'Landas sa Kagubatan',
  'FOREST TRAIL': 'LANDAS SA KAGUBATAN',
  'Wonder Path': 'Landas ng Alaala',
  'WONDER PATH': 'LANDAS NG ALAALA',
  'Rescue Grid': 'Rescue Grid',
  'RESCUE GRID': 'RESCUE GRID',
  'Restore the Mural': 'Ibalik ang Mural',
  'Mission Trail': 'Landas ng Misyon',
  'Kingdom Treasury': 'Ingat-Yaman ng Kaharian',
  'Stewardship Council': 'Konseho ng Pamamahala',
  'Farm to Market': 'Mula Bukid Hanggang Pamilihan',
  'Village Builder': 'Tagapagtayo ng Pamayanan',
  'Enterprise Builder': 'Tagapagtayo ng Negosyo',
  'City Dispatch': 'City Dispatch',
  'Leadership Council': 'Konseho ng Pamumuno',
  'Rhythm Journey': 'Paglalakbay sa Ritmo',
  'Discovery Expedition': 'Ekspedisyon ng Pagtuklas',

  // Jawo
  'Move across three forest trails. Avoid fallen rock, collect Trail Lights, and build a clean-run combo as the forest speeds up.':
    'Lumipat sa tatlong landas sa kagubatan. Iwasan ang bumabagsak na bato, kolektahin ang Trail Lights, at panatilihin ang combo habang bumibilis ang laro.',
  'SWIPE': 'MAG-SWIPE',
  'left / right': 'pakaliwa / pakanan',
  'rock + light': 'bato + ilaw',
  'keep combo': 'panatilihin ang combo',
  'ENTER THE FOREST': 'PUMASOK SA KAGUBATAN',
  'TRAIL OPENS IN': 'MAGBUBUKAS ANG LANDAS SA',
  'Run the trail. Read the forest, not the buttons.': 'Tahakin ang landas. Basahin ang kagubatan, hindi lang ang mga button.',
  'Swipe or tap to change trail. Stay alert.': 'Mag-swipe o mag-tap para lumipat ng landas. Manatiling alerto.',
  'Listen. Watch the path. Move only when needed.': 'Makinig. Bantayan ang landas. Gumalaw lamang kapag kailangan.',

  // Trudice
  'The playground lights a route across four stations. Watch the full sequence, then repeat it. Every round adds another step.':
    'Iilaw ang ruta sa apat na station. Panoorin ang buong sequence, saka ulitin. Bawat round ay may dagdag na hakbang.',
  'follow the glow': 'sundan ang liwanag',
  'tap in order': 'i-tap ayon sa tamang pagkakasunod',
  '5 rounds': '5 round',
  'OPEN THE PLAYGROUND': 'BUKSAN ANG PLAYGROUND',
  'PATH REMEMBERED': 'NATANDAAN ANG LANDAS',
  'Children’s Haven lights up. The path is remembered.': 'Umiilaw ang Children’s Haven. Natandaan ang landas.',
  'The path faded. Replay it slowly and rebuild the pattern.': 'Nawala ang landas. Ulitin nang dahan-dahan at buuin muli ang pattern.',
  'Your turn. Repeat the glowing path.': 'Ikaw naman. Ulitin ang kumikislap na landas.',
  'The playground is adding one more step. Watch carefully.': 'May idinadagdag na isang hakbang ang playground. Panooring mabuti.',
  'Not that station. Watch the same round once more.': 'Hindi iyon ang station. Panoorin muli ang parehong round.',
  'Round 1: watch the path.': 'Round 1: panoorin ang landas.',
  'Watch the playground come alive, then repeat the path.': 'Panoorin ang playground na mabuhay, saka ulitin ang landas.',

  // Ace
  'EXIT': 'LABASAN',
  'START': 'SIMULA',
  'RESCUE': 'PAGLILIGTAS',
  'Navigate a tactical city grid with limited energy. Secure all three rescue beacons, avoid blocked corridors, then reach extraction.':
    'Tahakin ang tactical city grid gamit ang limitadong enerhiya. Kunin ang tatlong rescue beacon, iwasan ang mga saradong corridor, at makarating sa extraction.',
  'adjacent tiles': 'magkatabing tile',
  '3 beacons': '3 beacon',
  'energy': 'enerhiya',
  'All rescue beacons secured. Extraction corridor is open.': 'Nakuha na ang lahat ng rescue beacon. Bukas na ang extraction corridor.',
  'Energy depleted before extraction. Re-route and use fewer moves.': 'Naubos ang enerhiya bago makarating sa extraction. Magpalit ng ruta at bawasan ang galaw.',
  'Extraction locked: rescue every beacon first.': 'Naka-lock ang extraction: kunin muna ang lahat ng beacon.',
  'Mission live. Secure all rescue beacons, then reach extraction.': 'Aktibo na ang misyon. Kunin ang lahat ng rescue beacon, saka makarating sa extraction.',
  'Plan a route through the district. Reach all three rescue beacons before extraction.':
    'Planuhin ang ruta sa distrito. Marating ang tatlong rescue beacon bago ang extraction.',

  // Mitch
  'FRAGMENT TABLE • DRAG TO RESTORE': 'MGA PIRA-PIRASO • I-DRAG PARA MAIBALIK',
  'ART VILLAGE RESTORATION': 'PAGPAPANUMBALIK NG ART VILLAGE',
  'MURAL AWAKENED': 'MULING NABUHAY ANG MURAL',
  "Every restored fragment can later become a permanent visual upgrade inside Mitch's map region.":
    'Bawat naibalik na piraso ay maaaring maging permanenteng visual upgrade sa rehiyon ni Mitch.',
  'RESTORE AGAIN': 'IBALIK MULI',
  'Drag fragments directly. Near-center drops earn higher precision and stronger combo bonuses.':
    'I-drag nang direkta ang mga piraso. Mas malapit sa gitna ang drop, mas mataas ang precision at combo bonus.',
  'That fragment does not belong there. Read the shape and color flow, then try again.':
    'Hindi diyan nababagay ang pirasong iyon. Basahin ang hugis at daloy ng kulay, saka subukan muli.',
  'Drag each fragment into the faded mural. Precision builds your restoration score.':
    'I-drag ang bawat piraso sa kupas na mural. Ang precision ang nagpapataas ng restoration score.',

  // Niel
  'TAKE THIS ROUTE →': 'TAHAKIN ANG RUTANG ITO →',
  'PLAN ANOTHER EXPEDITION': 'MAGPLANO NG PANIBAGONG EKSPEDISYON',
  'Plan the expedition. Every decision changes the team reserve and the road ahead.':
    'Planuhin ang ekspedisyon. Bawat desisyon ay nakaaapekto sa reserba ng team at sa susunod na ruta.',
  'Remote village reached. Mission route complete.': 'Narating ang malayong pamayanan. Kumpleto ang ruta ng misyon.',
  'The expedition reserve collapsed before the village. Replan the route and protect every critical resource.':
    'Naubos ang mahalagang reserba bago marating ang pamayanan. Planuhin muli ang ruta at ingatan ang bawat kritikal na resource.',
  'ARRIVED': 'NAKARATING',
  'EXPEDITION INTERRUPTED': 'NAANTALA ANG EKSPEDISYON',
  'REPLAN THE TRAIL': 'PLANUHIN MULI ANG LANDAS',
  'VILLAGE REACHED': 'NARATING ANG PAMAYANAN',
  'A critical reserve reached zero. Route choice matters more than raw speed.':
    'May kritikal na reserbang naubos. Mas mahalaga ang tamang ruta kaysa bilis lamang.',
  'The route is complete. Later, this result can permanently open Niel’s next frontier station and change the Mission map.':
    'Kumpleto ang ruta. Ang resulta ay maaaring magbukas ng susunod na frontier station ni Niel at baguhin ang Mission map.',

  // Angel
  'QUARTER TREASURY': 'PONDO NG QUARTER',
  'PHASE 1': 'YUGTO 1',
  'Build the Budget': 'Bumuo ng Budget',
  'APPROVE QUARTER BUDGET': 'APRUBAHAN ANG BUDGET',
  'PHASE 2 • UNEXPECTED EVENT': 'YUGTO 2 • BIGLAANG PANGYAYARI',
  'The quarter does not go as planned.': 'Hindi nasunod ang inaasahang takbo ng quarter.',
  'Your original allocation created strengths and weaknesses. The reserve now becomes meaningful.':
    'Ang unang allocation ay lumikha ng lakas at kahinaan. Ngayon mahalaga ang reserve.',
  'REVEAL EMERGENCY': 'IPAKITA ANG EMERGENCY',
  'PHASE 3 • RESPONSE': 'YUGTO 3 • PAGTUGON',
  'RELEASE FROM RESERVE': 'MAGLABAS MULA SA RESERVE',
  'PRIMARY FUND': 'PANGUNAHING PONDO',
  'SECONDARY FUND': 'PANGALAWANG PONDO',
  'COMMIT EMERGENCY RESPONSE': 'KUMPIRMAHIN ANG EMERGENCY RESPONSE',
  'QUARTER RESULT': 'RESULTA NG QUARTER',
  'Reserve left:': 'Natitirang reserve:',
  'Emergency release:': 'Inilabas sa emergency:',
  'NEW QUARTER': 'BAGONG QUARTER',
  'BALANCED STEWARDSHIP': 'BALANSENG PAMAMAHALA',
  'STEWARDSHIP BREAKDOWN': 'BUMAGSAK ANG PAMAMAHALA',
  'KINGDOM THRIVES': 'UMUUNLAD ANG KAHARIAN',
  'KINGDOM UNDER STRAIN': 'NASA PANGANIB ANG KAHARIAN',
  'CRISIS SURVIVED • RESERVE EXHAUSTED': 'NALAMPASAN ANG KRISIS • NAUBOS ANG RESERVE',
  'Build a balanced first budget. A kingdom with no reserve is fragile; a kingdom with no investment stops growing.':
    'Bumuo ng balanseng unang budget. Mahina ang kahariang walang reserve; humihinto naman ang paglago kapag walang investment.',
  'Budget approved. The kingdom enters the quarter... then an emergency interrupts the plan.':
    'Aprubado ang budget. Nagsisimula ang quarter... ngunit may biglaang emergency na sumira sa plano.',
  'Displaced families arrive with immediate needs while local service teams are already stretched.':
    'Dumating ang mga pamilyang nangangailangan agad habang sagad na rin ang local service teams.',

  // Vhen
  'Planting Plan': 'Plano sa Pagtatanim',
  'PLANT THE SEASON': 'ITANIM ANG SEASON',
  'SEASON EVENT': 'PANGYAYARI SA SEASON',
  'Weather is changing.': 'Nagbabago ang panahon.',
  'Your field mix is locked. Harvest timing now determines how much of the season you save.':
    'Naka-lock na ang kombinasyon ng tanim. Ang oras ng pag-ani ang magpapasya kung gaano karami ang maililigtas.',
  'REVEAL WEATHER': 'IPAKITA ANG PANAHON',
  'Choose Harvest Timing': 'Piliin ang Oras ng Pag-ani',
  'LOAD FOR MARKET': 'IKARGA PARA SA PAMILIHAN',
  'Choose Delivery Route': 'Piliin ang Ruta ng Paghahatid',
  'Town Market': 'Pamilihang Bayan',
  'Lower price • only 4% spoilage risk': 'Mas mababang presyo • 4% lang ang panganib na masira',
  'Trading Hub': 'Trading Hub',
  'Higher price • 13% spoilage risk': 'Mas mataas na presyo • 13% panganib na masira',
  'SEND THE HARVEST': 'IPADALA ANG ANI',
  'SEASON COMPLETE': 'TAPOS ANG SEASON',
  'Allocate eight field units. Diversification protects the farm, but over-spreading can reduce output efficiency.':
    'Hatiin ang walong yunit ng taniman. Nakababawas ng panganib ang iba-ibang pananim, pero puwedeng bumaba ang efficiency kapag sobra ang paghahati.',
  'Fields planted. The season develops and weather starts shaping the harvest window.':
    'Naitanim na ang bukid. Umiikot ang season at nagsisimulang magtakda ang panahon ng tamang oras ng ani.',
  'Ideal season. Peak harvest gives the strongest quality and yield.':
    'Magandang season. Pinakamataas ang kalidad at ani kapag peak harvest.',
  'Dry spell. Waiting too long increases crop loss; early harvest becomes safer.':
    'Tagtuyot. Mas maraming mawawala kapag naghintay nang matagal; mas ligtas ang maagang pag-ani.',
  'Heavy rain. Peak harvest is still possible, but late harvest risks spoilage.':
    'Malakas ang ulan. Posible pa rin ang peak harvest, pero mas mataas ang panganib na masira kapag huli ang ani.',
  'The farm reached market, but losses were too high to sustain the next cycle.':
    'Nakarating ang ani sa pamilihan, pero masyadong malaki ang nalugi para masuportahan ang susunod na cycle.',
  'Harvest is loaded. Choose the market route: shorter town delivery or farther trading hub with better prices but more spoilage risk.':
    'Nakarga na ang ani. Piliin ang ruta: mas maikling biyahe sa bayan o mas malayong trading hub na mas mataas ang presyo pero mas mataas ang panganib na masira.',

  // ELESUR
  'HIGHLAND VILLAGE': 'HIGHLAND VILLAGE',
  'You can finish only a few projects this cycle. Highest need is not always the only factor—watch community health and remaining resources.':
    'Ilang proyekto lamang ang matatapos sa cycle na ito. Hindi laging pinakamataas na need ang tanging batayan—bantayan ang kalagayan ng komunidad at natitirang resources.',
  'COMMUNITY CYCLE COMPLETE': 'KUMPLETO ANG COMMUNITY CYCLE',
  'The highland village has more needs than resources. Build in the right order before the community enters crisis.':
    'Mas marami ang pangangailangan kaysa resources sa highland village. Magtayo sa tamang pagkakasunod bago magkaroon ng krisis.',
  'Not enough workers or materials for that project. Prioritize what the village can finish.':
    'Kulang ang workers o materials para sa proyektong iyon. Unahin ang kayang tapusin ng pamayanan.',
  'The village improved, but too many urgent needs were left unresolved. Rebuild the intervention order.':
    'Umunlad ang pamayanan, pero marami pang agarang pangangailangan ang hindi nalutas. Ayusin muli ang pagkakasunod ng intervention.',

  // Phan
  'BUSINESS CYCLE': 'BUSINESS CYCLE',
  'Finished-goods price this cycle:': 'Presyo ng finished goods sa cycle na ito:',
  'PRODUCE': 'MAG-PRODUCE',
  'Spend cash → increase raw stock': 'Gumastos ng pera → dagdagan ang raw stock',
  'PROCESS': 'MAG-PROCESS',
  'Convert raw stock → finished goods': 'Gawing finished goods ang raw stock',
  'SELL': 'MAGBENTA',
  'Convert goods → cash + reputation': 'Gawing pera + reputasyon ang produkto',
  'EXPAND': 'MAG-EXPAND',
  'Invest cash → larger future capacity': 'Mag-invest ng pera → mas malaking kapasidad sa hinaharap',
  'High demand is wasted if you have no finished goods. Too much inventory without cash can also trap the enterprise.':
    'Sayang ang mataas na demand kung walang finished goods. Maaari ring maipit ang negosyo kapag sobrang dami ng inventory pero kulang sa cash.',
  'SIX CYCLES COMPLETE': 'KUMPLETO ANG ANIM NA CYCLE',
  'Grow a small farmstead into a stable enterprise. Cash, production capacity, inventory and reputation must all survive six business cycles.':
    'Palaguin ang maliit na farmstead tungo sa matatag na negosyo. Kailangang mapanatili ang cash, production capacity, inventory at reputasyon sa anim na business cycle.',
  'Not enough cash to fund another production cycle.': 'Kulang ang cash para pondohan ang panibagong production cycle.',
  'Processing needs raw stock and working cash.': 'Kailangan ng raw stock at working cash para makapag-process.',
  'No finished goods are ready for market. Production alone does not create revenue.':
    'Walang finished goods na handang ibenta. Hindi sapat ang production lamang para kumita.',
  'Workshop expanded by 2 capacity. Short-term cash fell, but future production ceiling increased.':
    'Nadagdagan ng 2 ang kapasidad ng workshop. Bumaba ang cash ngayon, pero tumaas ang future production ceiling.',
  'The enterprise expanded too fast or lost market trust. Rebuild with stronger cash flow and reputation.':
    'Masyadong mabilis ang expansion o nawala ang tiwala ng market. Buuin muli gamit ang mas matatag na cash flow at reputasyon.',

  // Van
  'Care Team': 'Care Team',
  'Mobility Team': 'Mobility Team',
  'Community Team': 'Community Team',
  'URGENCY': 'URGENCY',
  'Deploy': 'Ipadala',
  'CITY SHIFT COMPLETE': 'KUMPLETO ANG CITY SHIFT',
  'City requests arrive with different urgency, distance and service needs. Dispatch the right team before capacity collapses.':
    'Dumarating ang city requests na may iba-ibang urgency, layo at service need. Ipadala ang tamang team bago maubos ang kapasidad.',
  'Elder needs urgent assistance': 'May nakatatandang nangangailangan ng agarang tulong',
  'Supply delivery is blocked': 'Naantala ang paghahatid ng supply',
  'Family support visit requested': 'Humiling ng family support visit',
  'Students stranded after road closure': 'Na-stranded ang mga estudyante dahil sarado ang kalsada',
  'Medication follow-up visit': 'Follow-up visit para sa gamot',
  'Crowd conflict needs mediation': 'Kailangang mamagitan sa alitan ng mga tao',
  'Riverside': 'Tabing-Ilog',
  'Market Row': 'Hanay ng Pamilihan',
  'North Homes': 'Hilagang Kabahayan',
  'School Quarter': 'Distrito ng Paaralan',
  'West Block': 'Kanlurang Bloke',
  'Central Plaza': 'Gitnang Plaza',

  // Christian
  'TERM COMPLETE': 'KUMPLETO ANG TERMINO',
  'Leadership is measured by consequences, not just fast answers. Keep trust, resources, time and community unity alive through five civic decisions.':
    'Nasusukat ang pamumuno sa bunga ng desisyon, hindi lamang sa bilis ng sagot. Panatilihin ang tiwala, resources, oras at pagkakaisa sa limang civic decision.',
  'Two Groups, One Hall': 'Dalawang Grupo, Isang Bulwagan',
  'Two community groups request the same hall schedule and neither wants to move.':
    'Parehong oras sa bulwagan ang hinihingi ng dalawang grupo at walang gustong umatras.',
  'Facilitate a joint schedule': 'Ayusin ang pinagsamang iskedyul',
  'Meet both groups and split time transparently.': 'Harapin ang dalawang grupo at hatiin nang malinaw ang oras.',
  'Choose the larger group': 'Piliin ang mas malaking grupo',
  'Fast decision, but one side feels ignored.': 'Mabilis na desisyon, pero may panig na mararamdamang hindi pinakinggan.',
  'Delay the issue': 'Ipagpaliban ang usapin',
  'Avoid conflict today, lose credibility tomorrow.': 'Iwas-gulo ngayon, bawas kredibilidad bukas.',
  'Flooded Street': 'Binahang Kalsada',
  'A damaged drainage line needs urgent repair while the youth learning program also lacks materials.':
    'Kailangang ayusin agad ang sirang drainage habang kulang din sa materials ang youth learning program.',
  'Emergency repair first': 'Unahin ang emergency repair',
  'Protect access now, then preserve a smaller learning allocation.': 'Ayusin muna ang access at magtira ng mas maliit na learning allocation.',
  'Split funds evenly': 'Hatiin nang pantay ang pondo',
  'Both programs move, neither is fully solved.': 'Parehong uusad ang programa pero walang lubos na malulutas.',
  'Ignore infrastructure': 'Ipagpaliban ang infrastructure',
  'Protect the learning budget but risk public frustration.': 'Mapoprotektahan ang learning budget pero maaaring mabawasan ang tiwala ng publiko.',
  'Rumor in the Plaza': 'Usap-usapan sa Plaza',
  'A false rumor spreads about the civic team. People demand an immediate answer.':
    'Kumakalat ang maling balita tungkol sa civic team. Humihingi agad ng sagot ang mga tao.',
  'Publish verified facts': 'Ilabas ang beripikadong impormasyon',
  'Respond with evidence and invite questions.': 'Tumugon gamit ang ebidensiya at buksan ang pagkakataon para sa tanong.',
  'Attack the critics': 'Patulan ang mga kritiko',
  'Fast and emotional; division grows.': 'Mabilis at emosyonal; lalo lamang lalaki ang pagkakahati.',
  'Say nothing': 'Huwag munang magsalita',
  'Avoid escalation, but uncertainty remains.': 'Maiiwasan ang paglala pero mananatili ang pagdududa.',
  'Volunteer Burnout': 'Pagkapagod ng Volunteers',
  'The same volunteers have carried too many projects and are close to quitting.':
    'Iisang volunteers ang sumalo ng napakaraming proyekto at malapit nang sumuko.',
  'Reduce load and rotate teams': 'Bawasan ang load at mag-rotate ng team',
  'Slower delivery, stronger long-term capacity.': 'Mas mabagal ngayon, pero mas matatag ang long-term capacity.',
  'Push through one more month': 'Ituloy pa ng isang buwan',
  'Output stays high today, burnout worsens.': 'Mataas ang output ngayon pero lalala ang burnout.',
  'Replace them immediately': 'Palitan sila agad',
  'Faster than mentoring, damaging to trust.': 'Mas mabilis kaysa mentoring pero nakasisira ng tiwala.',
  'Final Community Forum': 'Huling Community Forum',
  'Residents disagree on what the next major project should be.':
    'Hindi magkasundo ang residents kung ano ang susunod na malaking proyekto.',
  'Use needs data + open forum': 'Gamitin ang needs data + open forum',
  'Combine evidence with public participation.': 'Pagsamahin ang ebidensiya at pakikilahok ng publiko.',
  'Leader decides alone': 'Leader lang ang magdesisyon',
  'Fast, but low participation.': 'Mabilis, pero mababa ang participation.',
  'Promise every proposal': 'Ipangako ang lahat ng proposal',
  'Popular now, impossible to fund.': 'Popular ngayon pero imposibleng pondohan.',

  // Lhen
  'TIMING ENGINE': 'TIMING ENGINE',
  'Follow the center pulse.': 'Sundan ang pulse sa gitna.',
  'This V1 uses the real timing windows and combo logic. Final music stems and Lhen animation can synchronize to the same beat map later.':
    'Gumagamit ito ng tunay na timing windows at combo logic. Ang final music stems at animation ni Lhen ay puwedeng sumabay sa parehong beat map.',
  'TAP THE PULSE': 'I-TAP ANG PULSE',
  'PERFORMANCE COMPLETE': 'KUMPLETO ANG PERFORMANCE',
  'Missed pulse. Reset your timing and re-enter the rhythm.': 'Hindi natamaan ang pulse. Ayusin muli ang timing at bumalik sa ritmo.',
  'Listen with your eyes for now—audio stems plug into this same timing grid later.':
    'Sundan muna sa mata—ang audio stems ay ikakabit sa parehong timing grid.',
  'Too early. Wait for the pulse to collapse into the center.': 'Masyadong maaga. Hintaying pumasok ang pulse sa gitna.',
  'Tap when the pulse reaches the center. Perfect timing builds combo; missed beats break the flow.':
    'I-tap kapag nasa gitna ang pulse. Perfect timing ang nagpapataas ng combo; ang miss ay pumuputol sa flow.',

  // Quin
  'FIELD NOTES': 'FIELD NOTES',
  'CLUES': 'CLUES',
  'YOU': 'IKAW',
  'CLUE': 'PALATANDAAN',
  'CACHE': 'SUPPLY',
  'RISK': 'PANGANIB',
  'RELIC': 'RELIKO',
  'Only adjacent tiles can be entered. Revealed hazards are avoidable; clues improve the final discovery rating.':
    'Katabing tile lamang ang maaaring puntahan. Maiiwasan ang nakitang hazard; pinapataas ng clues ang final discovery rating.',
  'Explore the hidden grid, collect enough clues, protect expedition energy, and locate the relic before the map goes dark.':
    'Galugarin ang nakatagong grid, mangalap ng sapat na clues, ingatan ang enerhiya ng ekspedisyon, at hanapin ang reliko bago magdilim ang mapa.',
  'No directional evidence yet.': 'Wala pang direksiyonal na ebidensiya.',
  'New ground mapped.': 'Bagong lugar ang na-map.',
  'Discovery clue recovered. The relic location is becoming clearer.': 'Nakuha ang discovery clue. Mas luminaw ang lokasyon ng reliko.',
  'Supply cache found: +3 expedition energy.': 'Nakahanap ng supply cache: +3 expedition energy.',
  'Hazard zone: the expedition loses extra energy.': 'Hazard zone: dagdag na enerhiya ang nawala sa ekspedisyon.',
  'Expedition energy is exhausted before the relic is secured.': 'Naubos ang expedition energy bago makuha ang reliko.',
  'The relic was found, but the expedition lacked enough evidence or reserve energy to secure the discovery.':
    'Nahanap ang reliko, pero kulang ang ebidensiya o reserve energy para maging matagumpay ang discovery.',
  // Live Kingdom progression / result copy
  'STATION CLEARED': 'NALAMPASAN ANG STATION',
  'TRAIL INTERRUPTED': 'NAANTALA ANG LANDAS',
  'HIDDEN GROVE FOUND': 'NATAGPUAN ANG HIDDEN GROVE',
  'RETURN TO THE TRAIL': 'BUMALIK SA LANDAS',
  'RUN AGAIN': 'TAKBUHIN MULI',
  'TRY AGAIN': 'SUBUKAN MULI',
  'MISSION CLEARED': 'NALAMPASAN ANG MISYON',
  'MISSION INCOMPLETE': 'HINDI KUMPLETO ANG MISYON',
  'EXTRACTION SUCCESS': 'MATAGUMPAY ANG EXTRACTION',
  'REPLAN THE GRID': 'PLANUHIN MULI ANG GRID',
  'PATH LOST': 'NAWALA ANG LANDAS',
  'CHILDREN’S HAVEN GLOWS': 'UMIILAW ANG CHILDREN’S HAVEN',
  'TRY THE PATH AGAIN': 'SUBUKAN MULI ANG LANDAS',
  'Clear recorded. Your next Kingdom Level is now available and this region grows on the map.':
    'Naitala ang clear. Available na ang susunod mong Kingdom Level at lumalago ang rehiyong ito sa mapa.',
  'Replay this level to improve your best score and stars without farming first-clear XP.':
    'Ulitin ang level para mapataas ang best score at stars; hindi mauulit ang first-clear XP.',
  'Clear recorded. Trudice’s Journey advances and Children’s Haven grows on the Kingdom Map.':
    'Naitala ang clear. Umuusad ang Journey ni Trudice at lumalago ang Children’s Haven sa Kingdom Map.',
  'Replay this level freely. Progress advances only when the level is cleared.':
    'Malaya mong ulitin ang level. Uusad lamang ang progression kapag na-clear ang level.',
  'Clear recorded. Ace’s next Kingdom Level opens and the Strategy District world tier can grow.':
    'Naitala ang clear. Bumukas ang susunod na Kingdom Level ni Ace at puwedeng umangat ang world tier ng Strategy District.',
  'Replay this level and find a shorter, cleaner route. A loss never advances the level.':
    'Ulitin ang level at humanap ng mas maikli at malinis na ruta. Hindi nagpapataas ng level ang pagkatalo.',
  'This clear advances Mitch’s Journey and contributes to permanent Art Village world growth.':
    'Ang clear na ito ay nagpapasulong sa Journey ni Mitch at sa permanenteng paglago ng Art Village.',
  'Clear recorded. Niel’s next Kingdom Level is available and Mission Frontier growth is saved to your account.':
    'Naitala ang clear. Available na ang susunod na Kingdom Level ni Niel at naka-save sa account mo ang paglago ng Mission Frontier.',
  'Follow the visual pulse and local feedback. Timing windows become tighter as your Kingdom Level rises.':
    'Sundan ang visual pulse at local feedback. Mas humihigpit ang timing windows habang tumataas ang Kingdom Level.',
  'This timing engine uses real Perfect, Good, and Miss windows. Higher Kingdom Levels tighten the timing challenge.':
    'Gumagamit ang timing engine ng tunay na Perfect, Good, at Miss windows. Mas mahigpit ang timing sa mas mataas na Kingdom Level.',

  // Kingdom map
  'SWIPE TO EXPLORE': 'MAG-SWIPE PARA MAG-EXPLORE',
  'EXPLORE THE KINGDOM': 'GALUGARIN ANG KAHARIAN',
  'A SMALL BEGINNING': 'MUNTING SIMULA',
  'A greater tomorrow starts here': 'Dito nagsisimula ang mas magandang bukas',
  'STRONGER TOGETHER': 'MAS MATATAG NANG MAGKASAMA',
  'The kingdom begins to awaken': 'Nagsisimulang mabuhay ang kaharian',
  'A GROWING KINGDOM': 'LUMALAGONG KAHARIAN',
  'More paths, people and purpose': 'Mas maraming landas, tao at layunin',
  'A BRIGHTER TOMORROW': 'MAS MALIWANAG NA BUKAS',
  'A united people, a living world': 'Nagkakaisang bayan, buhay na mundo',
  'KINGDOM UNITED': 'NAGKAISANG KAHARIAN',
  'Every region is alive; mastery now shapes the world': 'Buhay ang bawat rehiyon; mastery na ang humuhubog sa mundo',
  'THE CITADEL': 'ANG CITADEL',
  'Unity • Purpose • Eternal Home': 'Pagkakaisa • Layunin • Walang-hanggang Tahanan',
  'A JOURNEY OF FAITH': 'PAGLALAKBAY NG PANANAMPALATAYA',
  'EXPLORE • GROW • BELONG': 'GALUGARIN • LUMAGO • MAPABILANG',
  'PEOPLE': 'MGA TAO',
  'FAITH': 'PANANAMPALATAYA',
  'GROWTH': 'PAGLAGO',
  'BUKLOD HARBOR': 'BUKLOD HARBOR',
  'SCRIPTURE GARDEN': 'HARDIN NG KASULATAN',
  'BUKLOD CITADEL': 'BUKLOD CITADEL',
  'HIGH CITADEL': 'HIGH CITADEL',
  'A brighter world together': 'Mas maliwanag na mundong magkakasama',
  'Awakens in a later stage': 'Magbubukas sa susunod na stage',
  '13 regions alive • mastery continues': 'Buhay ang 13 rehiyon • nagpapatuloy ang mastery',
  'TRAINING GROUNDS': 'TRAINING GROUNDS',
  'IGPAT ARENA': 'IGPAT ARENA',
  'MENTOR TOWER': 'MENTOR TOWER',
  'LOCKED LAND': 'NAKA-LOCK NA LUPAIN',
  'COMING SOON': 'PAPARATING',
  'BUILD • BELONG • SERVE': 'BUMUO • MAPABILANG • MAGLINGKOD',
  'TOGETHER FOR A BRIGHTER WORLD': 'MAGKASAMA PARA SA MAS MALIWANAG NA MUNDO',
  'MASTERED': 'MASTERED',
  'LOCKED': 'NAKA-LOCK',
};

function translateDynamicTagalog(input: string) {
  let value = input;

  const rules: Array<[RegExp, (...args: any[]) => string]> = [
    [/^Impact at (.+)\. Recover and change trail\.$/, (_m, zone) => \`Tumama sa \${zone}. Bumawi at lumipat ng landas.\`],
    [/^Round (\\d+): watch the path\. Do not tap yet\.$/, (_m, n) => \`Round \${n}: panoorin ang landas. Huwag munang mag-tap.\`],
    [/^Round (\\d+) complete\. The playground grows brighter\.$/, (_m, n) => \`Kumpleto ang Round \${n}. Mas lumiwanag ang playground.\`],
    [/^(\\d+)\\/(\\d+) correct\\. Keep the path in mind\\.$/, (_m, a, b) => \`\${a}/\${b} tama. Tandaan ang landas.\`],
    [/^Rescue beacon (\\d+)\\/3 secured\\. Continue to extraction\\.$/, (_m, n) => \`Nakuha ang rescue beacon \${n}/3. Magpatuloy sa extraction.\`],
    [/^Mural restored • (\\d+)% average precision$/, (_m, n) => \`Naibalik ang mural • \${n}% average precision\`],
    [/^Assign the remaining (\\d+) treasury tokens before approving the budget\\.$/, (_m, n) => \`Ilaan muna ang natitirang \${n} treasury token bago aprubahan ang budget.\`],
    [/^Emergency covered\\. (\\d+) reserve remains for the next unknown challenge\\.$/, (_m, n) => \`Natugunan ang emergency. May \${n} reserve pa para sa susunod na hamon.\`],
    [/^The emergency response fell short by (\\d+) coverage points\\. The kingdom absorbed the consequences\\.$/, (_m, n) => \`Kulang ng \${n} coverage points ang emergency response. Sinalo ng kaharian ang epekto.\`],
    [/^Use all (\\d+) field units before planting\\. (\\d+) remain\\.$/, (_m, a, b) => \`Gamitin ang lahat ng \${a} field units bago magtanim. \${b} pa ang natitira.\`],
    [/^Market run complete\\. (\\d+) crates arrived with (\\d+) trade value\\.$/, (_m, a, b) => \`Kumpleto ang market run. \${a} crates ang dumating na may \${b} trade value.\`],
    [/^(.+) completed\\. The village changed, but unresolved needs keep increasing pressure\\.$/, (_m, p) => \`Natapos ang \${p}. Nagbago ang pamayanan, pero tumitindi pa rin ang pressure mula sa hindi nalutas na pangangailangan.\`],
    [/^Village cycle stabilized\\. (\\d+) priority projects now anchor the highland community\\.$/, (_m, n) => \`Naging matatag ang village cycle. \${n} priority projects na ang pundasyon ng highland community.\`],
    [/^Need (\\d+)$/, (_m, n) => \`Pangangailangan \${n}\`],
    [/^Enterprise stabilized at (\\d+) value with (\\d+) reputation\\.$/, (_m, a, b) => \`Naging matatag ang negosyo sa halagang \${a} at reputasyong \${b}.\`],
    [/^Harvest cycle completed: \\+(\\d+) raw units\\. Cash fell by (\\d+), but the supply base grew\\.$/, (_m, a, b) => \`Kumpleto ang harvest cycle: +\${a} raw units. Bumaba ng \${b} ang cash pero lumaki ang supply base.\`],
    [/^Processed (\\d+) raw units into higher-value goods\\.$/, (_m, n) => \`Na-process ang \${n} raw units bilang mas mataas ang halagang produkto.\`],
    [/^Sold (\\d+) goods into (.+) for (\\d+)\\. Market trust increased\\.$/, (_m, a, market, b) => \`Nabenta ang \${a} goods sa \${market} sa halagang \${b}. Tumaas ang tiwala ng market.\`],
    [/^Expansion costs (\\d+)\\. Growth without enough cash can break the enterprise\\.$/, (_m, n) => \`Nagkakahalaga ng \${n} ang expansion. Maaaring bumagsak ang negosyo kung kulang ang cash.\`],
    [/^(.+) needs (\\d+) capacity for this distance but has only (\\d+)\\.$/, (_m, team, need, have) => \`Kailangan ng \${need} capacity ng \${team} para sa layong ito pero \${have} lamang ang available.\`],
    [/^(.+) resolved (.+)\\. Trust improved\\.$/, (_m, team, place) => \`Nalutas ng \${team} ang request sa \${place}. Tumaas ang tiwala.\`],
    [/^Wrong specialization\\. The request was handled poorly and city trust dropped\\.$/, () => 'Maling specialization. Hindi maayos ang paghawak sa request at bumaba ang tiwala ng lungsod.'],
    [/^City shift stabilized with (\\d+) trust and (\\d+) reserve team capacity\\.$/, (_m, a, b) => \`Naging matatag ang city shift na may \${a} trust at \${b} reserve team capacity.\`],
    [/^Dispatch capacity or public trust collapsed before the city stabilized\\.$/, () => 'Bumagsak ang dispatch capacity o public trust bago naging matatag ang lungsod.'],
    [/^Civic term completed with (\\d+) trust, (\\d+) unity and (\\d+) budget reserve\\.$/, (_m, a, b, c) => \`Kumpleto ang civic term na may \${a} trust, \${b} unity at \${c} budget reserve.\`],
    [/^Leadership mandate weakened: trust, unity, or resources fell below a sustainable level\\.$/, () => 'Humina ang mandato ng pamumuno: bumaba sa hindi sustainable na antas ang trust, unity o resources.'],
    [/^First clue: the relic lies mostly (north|south) of your position\\.$/, (_m, d) => \`Unang clue: ang reliko ay nasa bandang \${d === 'north' ? 'hilaga' : 'timog'} ng posisyon mo.\`],
    [/^Second clue: move (east|west) while preserving energy\\.$/, (_m, d) => \`Ikalawang clue: gumalaw pa-\${d === 'east' ? 'silangan' : 'kanluran'} habang nagtitipid ng enerhiya.\`],
    [/^Relic signature is close: (\\d+) grid steps away\\.$/, (_m, n) => \`Malapit na ang relic signature: \${n} grid steps na lang.\`],
    [/^Relic secured with (\\d+) clues and (\\d+) energy remaining\\.$/, (_m, a, b) => \`Nakuha ang reliko gamit ang \${a} clues at may \${b} energy pang natitira.\`],
  ];

  for (const [pattern, replace] of rules) {
    if (pattern.test(value)) return value.replace(pattern, replace as any);
  }

  return value;
}

export function translateBuklodGameText(text: string, _gameId?: string) {
  if (!text) return text;
  const leading = text.match(/^\\s*/)?.[0] ?? '';
  const trailing = text.match(/\\s*$/)?.[0] ?? '';
  const core = text.trim();
  if (!core) return text;
  const direct = TL_TEXT[core];
  if (direct) return \`\${leading}\${direct}\${trailing}\`;
  const dynamic = translateDynamicTagalog(core);
  return \`\${leading}\${dynamic}\${trailing}\`;
}

function translateNode(node: React.ReactNode, gameId?: string): React.ReactNode {
  if (typeof node === 'string') return translateBuklodGameText(node, gameId);
  if (Array.isArray(node)) return node.map((child) => translateNode(child, gameId));
  return node;
}

export function BuklodGameText({ children, ...props }: TextProps) {
  const { language, gameId } = useBuklodGameLanguage();
  return (
    <Text {...props}>
      {language === 'tl' ? translateNode(children, gameId) : children}
    </Text>
  );
}


export function BuklodGameLanguageProvider({ gameId, children }: { gameId?: string; children: React.ReactNode }) {
  const [language, setLanguageState] = useState<BuklodGameLanguage>('en');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (mounted && (value === 'en' || value === 'tl')) setLanguageState(value);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const setLanguage = (next: BuklodGameLanguage) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };

  const value = useMemo<ContextValue>(() => ({
    language,
    setLanguage,
    gameId,
    t: (english, tagalog) => language === 'tl' ? tagalog : english,
  }), [gameId, language]);

  return <GameLanguageContext.Provider value={value}>{children}</GameLanguageContext.Provider>;
}

export function useBuklodGameLanguage() {
  return useContext(GameLanguageContext);
}

export function BuklodGameLanguageControl() {
  const { language, setLanguage, gameId } = useBuklodGameLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const guide = gameId ? GUIDES[gameId] : undefined;

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <View style={styles.row}>
        <Pressable
          onPress={() => setGuideOpen((value) => !value)}
          style={({ pressed }) => [styles.guideButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={language === 'tl' ? 'Buksan ang gabay' : 'Open game guide'}
        >
          <Text style={styles.guideButtonText}>{language === 'tl' ? 'GABAY' : 'GUIDE'}</Text>
        </Pressable>
        <View style={styles.languagePill}>
          <Pressable onPress={() => setLanguage('en')} style={[styles.langButton, language === 'en' && styles.langActive]}>
            <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
          </Pressable>
          <Pressable onPress={() => setLanguage('tl')} style={[styles.langButton, language === 'tl' && styles.langActive]}>
            <Text style={[styles.langText, language === 'tl' && styles.langTextActive]}>TL</Text>
          </Pressable>
        </View>
      </View>

      {guideOpen && guide ? (
        <View style={styles.guideCard}>
          <Text style={styles.guideEyebrow}>{language === 'tl' ? 'TAGALOG GAME GUIDE' : 'GAME GUIDE'}</Text>
          <Text style={styles.guideTitle}>{language === 'tl' ? guide.titleTl : guide.titleEn}</Text>
          <Text style={styles.guideCopy}>{language === 'tl' ? guide.objectiveTl : guide.objectiveEn}</Text>
          <Text style={styles.controlsLabel}>{language === 'tl' ? 'PAANO LARUIN' : 'HOW TO PLAY'}</Text>
          <Text style={styles.guideCopy}>{language === 'tl' ? guide.controlsTl : guide.controlsEn}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', top: 10, right: 10, zIndex: 100, alignItems: 'flex-end', maxWidth: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  languagePill: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: 'rgba(5,10,18,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  langButton: { minWidth: 34, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  langActive: { backgroundColor: 'rgba(255,255,255,0.92)' },
  langText: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  langTextActive: { color: '#13202a' },
  guideButton: { height: 34, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,10,18,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  guideButtonText: { color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  guideCard: { marginTop: 8, width: 300, maxWidth: '92%', padding: 13, borderRadius: 16, backgroundColor: 'rgba(5,10,18,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  guideEyebrow: { color: '#a9e4c0', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  guideTitle: { marginTop: 4, color: '#ffffff', fontSize: 17, fontWeight: '900' },
  guideCopy: { marginTop: 6, color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  controlsLabel: { marginTop: 10, color: '#f3d27d', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.72 },
});
