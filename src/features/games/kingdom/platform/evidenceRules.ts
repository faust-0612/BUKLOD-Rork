/** Evidence puzzle engine used ONLY for Quin Guessing Quest and Van Mind Challenge. */
export type EvidenceGameId = 'quin-guessing-quest' | 'van-mind-challenge';
export type Bilingual = { en: string; tl: string };
export type EvidenceQuestion = {
  id: string; tier: 0 | 1 | 2; prompt: Bilingual;
  choices: { en: [string, string, string, string]; tl: [string, string, string, string] };
  correct: 0 | 1 | 2 | 3; hint: Bilingual; explanation: Bilingual;
};
const question = (id: string, tier: 0 | 1 | 2, en: string, tl: string,
  enChoices: [string,string,string,string], tlChoices: [string,string,string,string],
  correct: 0|1|2|3, hintEn: string, hintTl: string, explanationEn: string, explanationTl: string): EvidenceQuestion =>
  ({id,tier,prompt:{en,tl},choices:{en:enChoices,tl:tlChoices},correct,hint:{en:hintEn,tl:hintTl},explanation:{en:explanationEn,tl:explanationTl}});
export const EVIDENCE_QUESTIONS: Record<EvidenceGameId, readonly EvidenceQuestion[]> = {
 'quin-guessing-quest': [
  question('q1',0,'I appear after rain when sunlight passes through water droplets. What am I?','Lumalabas ako pagkatapos ng ulan kapag sinisinagan ng araw ang maliliit na patak ng tubig. Ano ako?',
    ['Rainbow','Moon','Shadow','Thunder'],['Bahaghari','Buwan','Anino','Kulog'],0,
    'My colors form an arc.','Bahagyang bilog ang makukulay kong guhit.','Refraction and reflection in droplets form a rainbow.','Ang repraksiyon at repleksiyon sa patak ng tubig ang bumubuo ng bahaghari.'),
  question('q2',0,'What tool shows north, south, east and west by using a magnetized needle?','Anong gamit ang nagtuturo ng hilaga, timog, silangan at kanluran gamit ang magnetikong karayom?',
    ['Thermometer','Compass','Ruler','Sundial'],['Termometro','Kompas','Ruler','Orasang-araw'],1,
    'Explorers use me for direction.','Ginagamit ako ng mga explorer upang malaman ang direksiyon.','A compass needle aligns with the local magnetic field.','Ang karayom ng kompas ay umaayon sa magnetic field.'),
  question('q3',0,'Which object lets you see tiny living cells that are too small for the naked eye?','Anong gamit ang nagpapakita ng napakaliit na mga selulang hindi makita ng mata?',
    ['Telescope','Periscope','Microscope','Binoculars'],['Teleskopyo','Periskopyo','Mikroskopyo','Binoculars'],2,
    'It magnifies samples on slides.','Pinapalaki nito ang nasa slide.','A microscope magnifies extremely small specimens.','Pinapalaki ng mikroskopyo ang napakaliit na specimen.'),
  question('q4',1,'Which natural process turns liquid water into water vapor when heated?','Anong proseso ang nagbabago ng likidong tubig tungo sa singaw kapag uminit?',
    ['Condensation','Freezing','Melting','Evaporation'],['Kondensasyon','Pagyeyelo','Pagkatunaw','Pagsingaw'],3,
    'Puddles shrink even without boiling.','Unti-unting nawawala ang tubig sa lubak kahit hindi kumukulo.','Evaporation moves water molecules into gas form.','Sa pagsingaw ay lumilipat ang mga molekula ng tubig sa anyong gas.'),
  question('q5',1,'A tree has rings inside its trunk. What can counting complete yearly rings roughly estimate?','May mga singsing sa loob ng katawan ng puno. Ano ang tinatayang malalaman sa pagbibilang ng taunang singsing?',
    ['Tree age','Soil pH','Height of nearby trees','Wind speed'],['Edad ng puno','Asim ng lupa','Taas ng katabing puno','Bilis ng hangin'],0,
    'Many trees grow roughly one set each year.','Maraming puno ang gumagawa ng isang bagong singsing bawat taon.','Annual growth rings provide an approximate tree age.','Ang taunang growth rings ay gabay sa tinatayang edad ng puno.'),
  question('q6',1,'Which planet is known for its prominent rings of ice and rock?','Aling planeta ang kilala sa malalaking singsing ng yelo at bato?',
    ['Mars','Saturn','Venus','Mercury'],['Mars','Saturn','Venus','Mercury'],1,
    'It is a gas giant beyond Jupiter.','Isa itong gas giant sa labas ng orbit ng Jupiter.','Saturn has the most conspicuous ring system in the Solar System.','Ang Saturn ang may pinakakilalang ring system sa ating Solar System.'),
  question('q7',2,'A fossil shell is found high in mountain rock. Which is the strongest evidence-based explanation?','May natagpuang fossil ng kabibe sa mataas na bundok. Ano ang pinakamainam na paliwanag batay sa ebidensya?',
    ['It grew in snow','A bird always carried it','The rock formed in a marine environment before uplift','The shell was created by lightning'],
    ['Tumubo ito sa niyebe','Laging ibon ang nagdala nito','Nabuo ang bato sa dagat bago ito umangat','Nilikha ito ng kidlat'],2,
    'Consider tectonic uplift across geologic time.','Isipin ang pag-angat ng lupa sa mahabang panahon.','Marine sedimentary rock can be raised into mountains by tectonic processes.','Maaaring umangat ang dating batong-dagat dahil sa paggalaw ng tectonic plates.'),
  question('q8',2,'A sealed jar contains plants and water. Droplets form on its inside wall each morning. Which process makes the droplets?','May halaman at tubig sa saradong garapon. May mga patak sa loob tuwing umaga. Aling proseso ang bumubuo ng mga patak?',
    ['Sublimation','Freezing','Erosion','Condensation'],['Sublimasyon','Pagyeyelo','Pagguho','Kondensasyon'],3,
    'Water vapor meets the cooler glass.','Sumasalubong ang singaw sa mas malamig na salamin.','Condensation turns vapor into liquid droplets on cooler surfaces.','Sa kondensasyon ay nagiging patak ng likido ang singaw sa malamig na ibabaw.'),
  question('q9',2,'Two independent maps label the same hill differently. What should a careful explorer do first?','Magkaiba ang pangalan ng iisang burol sa dalawang mapa. Ano muna ang dapat gawin ng maingat na explorer?',
    ['Cross-check locations and reliable evidence','Guess which sounds better','Discard both maps','Change the names without asking'],
    ['Ihambing ang lokasyon at mapagkakatiwalaang ebidensya','Manghula kung alin ang maganda pakinggan','Itapon ang mga mapa','Palitan agad ang mga pangalan'],0,
    'Good conclusions come from verification.','Ang matibay na konklusyon ay nagmumula sa pagberipika.','Cross-referencing coordinates and source reliability resolves conflicting labels.','Ang paghahambing ng coordinates at pinagmulan ng datos ang makatutulong.'),
 ],
 'van-mind-challenge': [
  question('m1',0,'Finish the pattern: 2, 4, 8, 16, ?','Ituloy ang pattern: 2, 4, 8, 16, ?',
   ['24','32','30','18'],['24','32','30','18'],1,'Each number doubles.','Dinodoble ang bawat numero.','16 × 2 = 32.','16 × 2 = 32.'),
  question('m2',0,'A compass arrow ↑ rotates 90° clockwise. Which way does it point?','Umikot nang 90° clockwise ang palasong ↑. Saan na ito tuturo?',
   ['←','↓','→','↑'],['←','↓','→','↑'],2,'Clockwise moves from north toward east.','Mula hilaga, clockwise ay papuntang silangan.','North rotated 90° clockwise becomes east (→).','Ang hilaga na inikot nang 90° clockwise ay silangan (→).'),
  question('m3',0,'Which number breaks the doubling pattern: 3, 6, 12, 25, 48?','Aling numero ang sumisira sa pagdodoble: 3, 6, 12, 25, 48?',
   ['3','6','12','25'],['3','6','12','25'],3,'After 12, doubling should give 24.','Pagkatapos ng 12, dapat ay 24.','The correct sequence is 3, 6, 12, 24, 48.','Ang tamang sequence ay 3, 6, 12, 24, 48.'),
  question('m4',1,'Finish the sequence of square numbers: 1, 4, 9, 16, ?','Ituloy ang square numbers: 1, 4, 9, 16, ?',
   ['25','24','20','36'],['25','24','20','36'],0,'Think of 5 × 5.','Isipin ang 5 × 5.','5² = 25.','5² = 25.'),
  question('m5',1,'If every A is B, and every B is C, what must be true?','Kung lahat ng A ay B, at lahat ng B ay C, ano ang tiyak na totoo?',
   ['All C are A','All A are C','No A is C','No B is C'],['Lahat ng C ay A','Lahat ng A ay C','Walang A na C','Walang B na C'],1,'Follow the containment chain.','Sundan ang pagkakasakop ng mga pangkat.','A is contained in B, which is contained in C.','Sakop ang A ng B, na sakop naman ng C.'),
  question('m6',1,'A regular hexagon has how many sides?','Ilang gilid mayroon ang regular na hexagon?',
   ['4','5','6','8'],['4','5','6','8'],2,'Hexa means six.','Ang hexa ay nangangahulugang anim.','A hexagon has exactly six sides.','Ang hexagon ay may anim na gilid.'),
  question('m7',2,'Continue: 1, 1, 2, 3, 5, 8, ?','Ituloy: 1, 1, 2, 3, 5, 8, ?',
   ['11','12','14','13'],['11','12','14','13'],3,'Add the previous two numbers.','Idagdag ang naunang dalawang numero.','5 + 8 = 13 in the Fibonacci sequence.','Ang 5 + 8 = 13 sa Fibonacci sequence.'),
  question('m8',2,'A square is rotated 45° about its center. Does its area change?','Inikot ang parisukat nang 45° sa gitna. Nagbabago ba ang lawak nito?',
   ['No, rotation preserves area','Yes, it doubles','Yes, it halves','It becomes zero'],['Hindi, hindi nagbabago ang lawak sa pag-ikot','Oo, nagdodoble','Oo, nangangalahati','Nagiging sero'],0,'Rotation changes orientation, not size.','Binabago ng pag-ikot ang direksiyon, hindi ang laki.','A rigid rotation preserves lengths and area.','Hindi nagbabago ang haba at lawak sa rigid rotation.'),
  question('m9',2,'Three gears touch in a line. Gear 1 rotates clockwise. How does gear 3 rotate?','Magkakadikit sa isang linya ang tatlong gear. Clockwise ang gear 1. Saan umiikot ang gear 3?',
   ['Counterclockwise','Clockwise','Does not rotate','Only up and down'],['Counterclockwise','Clockwise','Hindi umiikot','Pataas-pababa lang'],1,'Every touching pair reverses direction.','Bawat magkadikit na gear ay nagpapabaligtad ng ikot.','Gear 2 reverses, then gear 3 reverses again: clockwise.','Baligtad sa gear 2, saka bumabaligtad muli sa gear 3: clockwise.'),
 ],
};
export type EvidenceRound = { gameId: EvidenceGameId; index: number; wrong: number; hints: string[]; score: number;
  correct: number; locked: boolean; status: 'playing' | 'won' | 'lost'; selected: number | null };
export const EVIDENCE_LENGTH = 9;
export function createEvidenceRound(gameId: EvidenceGameId): EvidenceRound {
 if(!EVIDENCE_QUESTIONS[gameId]) throw new Error('Unknown evidence game');
 return {gameId,index:0,wrong:0,hints:[],score:0,correct:0,locked:false,status:'playing',selected:null};
}
export function evidenceHint(state: EvidenceRound): EvidenceRound {
 if(state.status!=='playing'||state.locked||state.hints.includes(EVIDENCE_QUESTIONS[state.gameId][state.index].id)) return state;
 return {...state,hints:[...state.hints,EVIDENCE_QUESTIONS[state.gameId][state.index].id]};
}
export function answerEvidence(state: EvidenceRound, choice: number): EvidenceRound {
 if(state.status!=='playing'||state.locked) return state;
 if(!Number.isInteger(choice)||choice<0||choice>3) throw new Error('Choice out of range');
 const q=EVIDENCE_QUESTIONS[state.gameId][state.index];
 if(choice===q.correct) {
  const earned=Math.max(50,300+q.tier*150-state.wrong*90-(state.hints.includes(q.id)?95:0));
  return {...state,selected:choice,score:state.score+earned,correct:state.correct+1,locked:true};
 }
 return {...state,selected:choice,wrong:state.wrong+1,locked:state.wrong>=1};
}
export function advanceEvidence(state:EvidenceRound):EvidenceRound {
 if(state.status!=='playing'||!state.locked) throw new Error('Answer is not yet settled');
 if(state.index===EVIDENCE_LENGTH-1)
  return {...state,status:state.correct>=6?'won':'lost'};
 return {...state,index:state.index+1,wrong:0,locked:false,selected:null};
}
