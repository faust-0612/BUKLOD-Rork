/** BUKLOD character adventure: account-bound NON-CREDIT story experience.
 * Entirely separate from authoritative Character V2 XP/level, Circle Rank,
 * BUKLOD Points, Shards, AdMob/QMP, and finance. No real-money entitlements.
 * All actions are deterministic and replay-safe; the offline profile is not
 * a server achievement and cannot be traded, credited, or withdrawn.
 */
export const ADVENTURE_VERSION = 1;
export const ADVENTURE_MAX_LEVEL = 20;
export const ADVENTURE_GATE_LEVELS = [4, 8, 12, 16] as const;
export const ADVENTURE_RELICS = ['origin', 'wisdom', 'service', 'courage', 'legacy'] as const;
export type AdventureRelic = typeof ADVENTURE_RELICS[number];
export type AdventureCharacter = 'phan'|'quin'|'van'|'christian'|'lhen'|'ace'|'ellusur'|'jawo'|'mitch'|'niel'|'angel'|'vhen'|'trudice';
export type AdventureBranch = 'heart'|'courage';
export type AdventureAction =
  | { type:'chapter'; chapter:0|1|2; choice:AdventureBranch }
  | { type:'practice'; challenge:'wisdom'|'service'|'courage'; answer:0|1|2; day:string }
  | { type:'craft'; relic:AdventureRelic }
  | { type:'refine'; relic:AdventureRelic }
  | { type:'exchange'; relic:AdventureRelic }
  | { type:'gate'; gate:4|8|12|16 }
  | { type:'ascend' }
  | { type:'gift'; day:string };
export type AdventureBadgeId = 'story'|'wise'|'steadfast'|'collector'|'secret';
export type AdventureBadgeTier = 'none'|'bronze'|'silver'|'gold'|'legendary';
export type AdventureStory = Readonly<{
  name:string; title:string; theme:string; chapters: readonly [string,string,string];
  dilemmas:readonly [string,string,string];
  choices:readonly [readonly [string,string],readonly [string,string],readonly [string,string]];
}>;
export const ADVENTURE_STORIES:Readonly<Record<AdventureCharacter,AdventureStory>> = {
  phan:{name:'Phan',title:'Seeds of Tomorrow',theme:'Responsible enterprise',chapters:['The Seed','The Market','The Harvest'],dilemmas:['A neighbor has less seed than you.','The marketplace has a shortage.','Your harvest succeeds while another farm struggles.'],choices:[['Share some seeds','Save seeds for the next planting'],['Keep prices fair','Organize a shared supply plan'],['Help rebuild the neighbor’s farm','Create a sustainable seed reserve']]},
  quin:{name:'Quin',title:'The Lost Trail',theme:'Curiosity and exploration',chapters:['The Map','The Crossing','The Discovery'],dilemmas:['An old map offers two trails.','Someone is separated from your group.','You discover an unfamiliar place.'],choices:[['Ask elders for clues','Scout the marked trail'],['Stay and call for help','Organize a safe search'],['Document what you find','Protect the place before sharing it']]},
  van:{name:'Van',title:'City of Choices',theme:'Service and clear thinking',chapters:['The Call','The Junction','The Promise'],dilemmas:['Two neighbors need help at once.','An emergency team has limited supplies.','The neighborhood asks you to lead.'],choices:[['Ask which need is most urgent','Gather volunteers'],['Protect the most vulnerable','Build a fair allocation plan'],['Listen to residents first','Design a shared readiness plan']]},
  christian:{name:'Christian',title:'The Council Path',theme:'Wise leadership',chapters:['The Invitation','The Vote','The Promise'],dilemmas:['Neighbors disagree over a decision.','Two proposals have equal support.','You receive credit for the team’s work.'],choices:[['Listen without judging','Ask for transparent evidence'],['Build a compromise','Consult the affected families'],['Share the recognition','Make responsibilities public']]},
  lhen:{name:'Lhen',title:'A Song for Everyone',theme:'Music and encouragement',chapters:['The First Note','The Ensemble','The Festival'],dilemmas:['A new musician is nervous.','Your group cannot agree on a melody.','One member misses the final rehearsal.'],choices:[['Offer a simple first part','Encourage a supportive duet'],['Listen to every suggestion','Test two original melodies'],['Make the arrangement accessible','Adapt the performance as a team']]},
  ace:{name:'Ace',title:'The Rescue Strategy',theme:'Care and strategy',chapters:['The Signal','The Crossing','The Safe Return'],dilemmas:['You find an injured traveler.','The shortest route is blocked.','Your team is exhausted.'],choices:[['Assess safety and seek help','Coordinate a calm response'],['Find a safe alternate route','Conserve supplies for the team'],['Rest and reassess','Let everyone share the effort']]},
  ellusur:{name:'ELESUR',title:'The Village Lantern',theme:'Teaching and compassion',chapters:['The Lesson','The Gathering','The Light'],dilemmas:['A learner struggles to follow.','The village needs a meeting space.','A young student asks for guidance.'],choices:[['Explain in simpler words','Listen to what is confusing'],['Invite families to plan together','Offer a shared space'],['Help them make a plan','Encourage careful questions']]},
  jawo:{name:'Jawo',title:'Forest of Echoes',theme:'Nature and creativity',chapters:['The Forest Song','The River','The Clearing'],dilemmas:['You hear an unfamiliar sound in the forest.','A route could disturb wildlife.','The team wants to celebrate.'],choices:[['Listen and identify it','Follow the safe trail'],['Choose a protected detour','Ask for local guidance'],['Compose an original nature song','Invite everyone into the celebration']]},
  mitch:{name:'Mitch',title:'Colors of Home',theme:'Art and community',chapters:['The Wall','The Pattern','The Gallery'],dilemmas:['A wall needs restoration.','Two groups propose different colors.','Your art gains attention.'],choices:[['Ask residents what matters','Protect the original artwork'],['Create a design everyone can join','Honor both histories'],['Credit all contributors','Teach the next generation']]},
  niel:{name:'Niel',title:'The Listening Path',theme:'Mentoring and faith',chapters:['The Question','The Journey','The Community'],dilemmas:['Someone asks a difficult question.','Your companion loses confidence.','A group requests a mentor.'],choices:[['Listen and seek understanding','Study together respectfully'],['Offer encouragement','Help them choose the next step'],['Invite shared leadership','Support new mentors']]},
  angel:{name:'Angel',title:'The Steward’s Ledger',theme:'Financial responsibility',chapters:['The Record','The Need','The Trust'],dilemmas:['A shared expense is undocumented.','Two community needs compete for support.','Someone asks to see the accounts.'],choices:[['Verify the receipt','Ask for a clear explanation'],['Assess urgency openly','Invite transparent prioritization'],['Share an appropriate summary','Protect private details while reporting']]},
  vhen:{name:'Vhen',title:'The Living Field',theme:'Agriculture and care',chapters:['The Soil','The Weather','The Community'],dilemmas:['The soil begins to weaken.','Heavy rain threatens a crop.','A neighbor lacks tools.'],choices:[['Learn sustainable techniques','Ask experienced growers'],['Protect the people first','Prepare a safer field plan'],['Share available tools','Organize a responsible tool library']]},
  trudice:{name:'Trudice',title:'The Wonder Classroom',theme:'Learning and kindness',chapters:['The First Question','The Puzzle','The Celebration'],dilemmas:['A child is afraid to ask.','The class cannot solve a puzzle.','A quiet learner makes progress.'],choices:[['Make asking questions safe','Offer a patient explanation'],['Break the problem into steps','Try a different learning style'],['Celebrate their effort','Give everyone a chance to shine']]},
};
const BADGE_TARGETS: Readonly<Record<AdventureBadgeId,readonly [number,number,number,number]>> = {
  story:[1,2,3,6], wise:[1,3,7,14], steadfast:[2,4,8,16], collector:[1,2,4,5], secret:[1,2,3,4],
};
const BADGE_TIERS:readonly AdventureBadgeTier[]=['bronze','silver','gold','legendary'];
export const ADVENTURE_BADGE_INFO:Readonly<Record<AdventureBadgeId,{name:string; purpose:string; reward:string}>> = {
  story:{name:'Storykeeper',purpose:'Make meaningful story choices',reward:'Storykeeper title and journal cover'},
  wise:{name:'Wisdom Seeker',purpose:'Complete distinct wisdom practices',reward:'Knowledge aura and journal stamp'},
  steadfast:{name:'Faithful Steps',purpose:'Return for meaningful practice on different days',reward:'Animated trail decoration'},
  collector:{name:'Relic Keeper',purpose:'Craft unique personal story relics',reward:'Collection gallery frame'},
  secret:{name:'Hidden Paths',purpose:'Discover different story choices across ascensions',reward:'Secret narrative illustration'},
};
export type AdventureState = {
  version:1; character:AdventureCharacter; xp:number; level:number; ascensions:number;
  bond:number; hibla:number; dust:number; fragments:Record<AdventureRelic,number>;
  relics:Record<AdventureRelic,number>; gates:number[]; completed:string[];
  chapters:Record<string,AdventureBranch>; practiceDays:string[]; giftDays:string[];
  lastActiveDay:string|null; streak:number; graceAvailable:boolean; hiddenPaths:number;
};
export type AdventureOutcome = { state:AdventureState; changed:boolean; message:string;
  earned:{xp:number;hibla:number;bond:number;fragment:AdventureRelic|null}; };
const NO_REWARD = {xp:0,hibla:0,bond:0,fragment:null};
const zeroRelics=():Record<AdventureRelic,number>=>({origin:0,wisdom:0,service:0,courage:0,legacy:0});
export function initialAdventure(character:AdventureCharacter):AdventureState {
  if (!Object.hasOwn(ADVENTURE_STORIES,character)) throw new Error('Unknown Character');
  return {version:1,character,xp:0,level:1,ascensions:0,bond:0,hibla:0,dust:0,
    fragments:zeroRelics(),relics:zeroRelics(),gates:[],completed:[],chapters:{},practiceDays:[],giftDays:[],
    lastActiveDay:null,streak:0,graceAvailable:true,hiddenPaths:0};
}
export function adventureXpForLevel(level:number):number {
  if (!Number.isInteger(level)||level<1||level>ADVENTURE_MAX_LEVEL) throw new Error('Invalid adventure level');
  const steps=level-1;return steps*steps*12+steps*28;
}
export function bondTier(bond:number):number {return Math.max(1,Math.min(5,Math.floor(Math.max(0,bond)/30)+1));}
export function strength(state:AdventureState):number {return state.level + state.ascensions*2;}
/** Cosmetic-only visual set completion; no official game scores or BP effects. */
export function relicSetProgress(state:AdventureState) {
  const count=ADVENTURE_RELICS.filter(key=>state.relics[key]>0).length;
  return { count,total:ADVENTURE_RELICS.length,
    scene:count>=5?'Legacy Gallery':count>=4?'Illuminated Hall':count>=2?'Living Room':'Starting Corner',
    finished:count===ADVENTURE_RELICS.length };
}
export function adventureEnding(s:AdventureState):'Heart of the Kingdom'|'Courage of the Kingdom'|'Balanced Legacy'|'Unfinished' {
  if(Object.keys(s.chapters).length<3)return 'Unfinished';
  const values=Object.values(s.chapters);
  const hearts=values.filter(v=>v==='heart').length;
  return hearts>=3?'Heart of the Kingdom':hearts===0?'Courage of the Kingdom':'Balanced Legacy';
}
export function isDuoUnlocked(hero:AdventureState,companion:AdventureState):boolean {
  return hero.character!==companion.character && bondTier(hero.bond)>=3 && bondTier(companion.bond)>=3;
}
export const ADVENTURE_PRACTICE:Readonly<Record<'wisdom'|'service'|'courage',{
  title:string;question:string;answers:readonly [string,string,string];explanation:string;
}>>={
  wisdom:{title:'Wisdom Puzzle',question:'A surprising claim spreads quickly. What helps the community?',answers:['Share it without checking','Compare sources before sharing','Remove the source'],explanation:'Verified evidence protects others from misinformation.'},
  service:{title:'Care Challenge',question:'Two volunteers are overwhelmed. What is a responsible response?',answers:['Ignore both people','Listen and distribute work fairly','Assign blame immediately'],explanation:'Listening and fair coordination support the whole team.'},
  courage:{title:'Guardian Challenge',question:'A trail looks unsafe after a storm. What is the best next step?',answers:['Rush forward','Choose a verified safer route','Hide warning signs'],explanation:'Protecting people comes before finishing quickly.'},
};
function safeDay(day:string):boolean {return /^20\d\d-\d\d-\d\d$/.test(day) && !Number.isNaN(new Date(day+'T00:00:00Z').getTime()) && new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
function dayGap(from:string,to:string):number {return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86_400_000);}
function recordDay(state:AdventureState,day:string) {
  if(!safeDay(day))throw new Error('Invalid local day');
  if(state.lastActiveDay===day)return;
  if(!state.lastActiveDay){state.streak=1;}
  else { const gap=dayGap(state.lastActiveDay,day);
    if(gap<0)throw new Error('Out-of-order day');
    if(gap===1)state.streak+=1;
    else if(gap===2 && state.graceAvailable){state.streak+=1;state.graceAvailable=false;}
    else{state.streak=1;state.graceAvailable=true;}
  }
  state.lastActiveDay=day;
}
function requiredGateForLevel(level:number):number|null {
  return (ADVENTURE_GATE_LEVELS as readonly number[]).find(g=>level===g)??null;
}
function recomputeLevel(s:AdventureState) {
  // XP accumulates while a gate is locked; unlocking a gate safely catches up.
  while(s.level<ADVENTURE_MAX_LEVEL) {
    const gate=requiredGateForLevel(s.level);
    if(gate&&!s.gates.includes(gate))break;
    if(s.xp<adventureXpForLevel(s.level+1))break;
    s.level++;
  }
}
function outcome(old:AdventureState,s:AdventureState,message:string,earned=NO_REWARD):AdventureOutcome {
  return {state:s,changed:s!==old,message,earned};
}
function awarded(s:AdventureState, type:'story'|'practice'|'gift', fragment:AdventureRelic) {
  const xp=type==='story'?65:type==='practice'?34:15;
  const hibla=type==='story'?3:type==='practice'?2:1;
  const bond=type==='story'?14:type==='practice'?7:8;
  s.xp+=xp;s.hibla+=hibla;s.bond+=bond;s.fragments[fragment]+=1;
  recomputeLevel(s);
  return {xp,hibla,bond,fragment};
}
function copy(s:AdventureState):AdventureState {return {...s,fragments:{...s.fragments},relics:{...s.relics},gates:[...s.gates],completed:[...s.completed],chapters:{...s.chapters},practiceDays:[...s.practiceDays],giftDays:[...s.giftDays]};}
function hasDone(s:AdventureState,id:string) {return s.completed.includes(id);}
function markDone(s:AdventureState,id:string) {s.completed.push(id);}
function gatePrerequisites(s:AdventureState,gate:number):boolean {
  const chapterCount=Object.keys(s.chapters).length;
  const distinctDays=new Set(s.practiceDays.map(x=>x.slice(0,10))).size;
  const stage=(ADVENTURE_GATE_LEVELS as readonly number[]).indexOf(gate)+1;
  return chapterCount>=Math.min(3,stage) && distinctDays>=stage && s.bond>=stage*15;
}
export function badgeTier(s:AdventureState,id:AdventureBadgeId):AdventureBadgeTier {
  const value=id==='story'?Object.keys(s.chapters).length+s.ascensions*3:
    id==='wise'?s.practiceDays.filter(x=>x.includes(':wisdom')).length:
    id==='steadfast'?new Set(s.practiceDays.map(x=>x.slice(0,10))).size:
    id==='collector'?ADVENTURE_RELICS.filter(r=>s.relics[r]>0).length:s.hiddenPaths;
  let tier:AdventureBadgeTier='none';
  BADGE_TARGETS[id].forEach((target,i)=>{if(value>=target)tier=BADGE_TIERS[i]});return tier;
}
export function badgeNextGoal(s:AdventureState,id:AdventureBadgeId):number|null {
  const metric=id==='story'?Object.keys(s.chapters).length+s.ascensions*3:
    id==='wise'?s.practiceDays.filter(x=>x.includes(':wisdom')).length:
    id==='steadfast'?new Set(s.practiceDays.map(x=>x.slice(0,10))).size:
    id==='collector'?ADVENTURE_RELICS.filter(r=>s.relics[r]>0).length:s.hiddenPaths;
  return BADGE_TARGETS[id].find(x=>x>metric)??null;
}
export function journeyNextGoal(s:AdventureState):string {
  const nextChapter=([0,1,2] as const).find(i=>s.chapters[i]===undefined);
  if(nextChapter!==undefined)return 'Continue '+ADVENTURE_STORIES[s.character].chapters[nextChapter];
  const gate=requiredGateForLevel(s.level);
  if(gate&&!s.gates.includes(gate))return gatePrerequisites(s,gate)?'Complete your story gate':'Grow Bond and practice on different days to open the gate';
  if(s.level===20)return 'Complete your Ascension ceremony';
  const incomplete=ADVENTURE_RELICS.find(r=>s.relics[r]===0&&s.fragments[r]>=3);
  if(incomplete)return 'Craft your '+incomplete+' relic';
  return 'Earn the next Adventure XP milestone through new daily practices';
}
export function performAdventure(s:AdventureState,a:AdventureAction):AdventureOutcome {
  if(s.version!==1||!Object.hasOwn(ADVENTURE_STORIES,s.character))throw new Error('Invalid adventure state');
  const n=copy(s);
  if(a.type==='chapter') {
    if (![0,1,2].includes(a.chapter)||!['heart','courage'].includes(a.choice))throw new Error('Invalid story choice');
    const key=String(a.chapter);
    if(n.chapters[key])return outcome(s,s,'Story already completed; your original choice remains.');
    if(a.chapter>0&&!n.chapters[String(a.chapter-1)])return outcome(s,s,'Finish the preceding story chapter first.');
    if(a.chapter===2&&n.bond<30)return outcome(s,s,'Strengthen this character bond before the final chapter.');
    n.chapters[key]=a.choice;markDone(n,'chapter:'+key);
    if(a.chapter===2&&n.chapters['0']!==n.chapters['2'])n.hiddenPaths++;
    const fragment=ADVENTURE_RELICS[a.chapter===0?0:a.chapter===1?2:4];
    return outcome(s,n,'Story choice saved. Your path changes future dialogue.',awarded(n,'story',fragment));
  }
  if(a.type==='practice') {
    if(!['wisdom','service','courage'].includes(a.challenge)||![0,1,2].includes(a.answer)||!safeDay(a.day))throw new Error('Invalid practice');
    const id=a.day+':'+a.challenge;
    if(n.practiceDays.includes(id))return outcome(s,s,'This practice is already completed today. Explore a different challenge.');
    if(a.answer!==1)return outcome(s,s,'Review the clue and try again. There is no penalty.');
    if(n.lastActiveDay&&dayGap(n.lastActiveDay,a.day)<0)return outcome(s,s,'This day cannot precede saved progress.');
    recordDay(n,a.day);n.practiceDays.push(id);markDone(n,'practice:'+id);
    const fragment=a.challenge==='wisdom'?'wisdom':a.challenge==='service'?'service':'courage';
    return outcome(s,n,'Practice complete. Unique daily contribution saved.',awarded(n,'practice',fragment));
  }
  if(a.type==='gift') {
    if(!safeDay(a.day))throw new Error('Invalid day');
    if(n.giftDays.includes(a.day))return outcome(s,s,'You already shared a story gift today.');
    if(n.hibla<2)return outcome(s,s,'Collect more Adventure Hibla to offer a story gift.');
    if(n.lastActiveDay&&dayGap(n.lastActiveDay,a.day)<0)return outcome(s,s,'This day cannot precede saved progress.');
    recordDay(n,a.day);n.hibla-=2;n.giftDays.push(a.day);
    n.bond+=10;n.fragments.wisdom++;
    return outcome(s,n,'Thoughtful gift shared with your character.',{xp:0,hibla:-2,bond:10,fragment:'wisdom'});
  }
  if(a.type==='craft'||a.type==='refine') {
    if(!ADVENTURE_RELICS.includes(a.relic))throw new Error('Unknown fragment');
    if(n.fragments[a.relic]<3)return outcome(s,s,'Gather three matching fragments before crafting.');
    n.fragments[a.relic]-=3;
    if(a.type==='refine') {
      if(n.relics[a.relic]===0)return outcome(s,s,'First craft the original relic.');
      n.dust+=2;return outcome(s,n,'Duplicate fragments refined into noncash Memory Dust.');
    }
    if(n.relics[a.relic]>0)return outcome(s,s,'Relic already owned. Refine duplicate fragments instead.');
    n.relics[a.relic]=1;
    n.bond+=5;
    return outcome(s,n,'Relic crafted! An album piece and its story are now yours.',{xp:0,hibla:0,bond:5,fragment:null});
  }
  if(a.type==='exchange') {
    if(!ADVENTURE_RELICS.includes(a.relic))throw new Error('Unknown relic');
    if(n.relics[a.relic]>0)return outcome(s,s,'Already collected; save your Memory Dust.');
    if(n.dust<8)return outcome(s,s,'Gather more duplicate Memory Dust to select a missing relic.');
    n.dust-=8;n.relics[a.relic]=1;
    return outcome(s,n,'Missing story relic selected with noncash Memory Dust.');
  }
  if(a.type==='gate') {
    if(!ADVENTURE_GATE_LEVELS.includes(a.gate))throw new Error('Unknown gate');
    if(n.level!==a.gate||n.gates.includes(a.gate)||!gatePrerequisites(n,a.gate))
      return outcome(s,s,'Complete the chapter, Bond, and distinct-day practice requirements first.');
    n.gates.push(a.gate);recomputeLevel(n);
    return outcome(s,n,'Story gate opened. Your earned Adventure XP is preserved.');
  }
  if(a.type==='ascend') {
    if(n.level!==20||n.xp<adventureXpForLevel(20)||n.gates.length!==4)
      return outcome(s,s,'Reach max Adventure Level and complete every story gate first.');
    n.ascensions++;n.level=1;n.xp=0;n.gates=[];n.chapters={};
    // Previous bond, crafted relics and badge evidence stay. A new story cycle begins.
    n.hiddenPaths++;
    return outcome(s,n,'Ascension complete! Your hero gained a permanent adventure crest.');
  }
  return outcome(s,s,'No matching adventure action.');
}
