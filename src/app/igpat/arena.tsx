import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { createIgpatArenaChallenge, type IgpatArenaMode } from '@/lib/igpat/igpatRuntime';

type Mode = {
  id: IgpatArenaMode;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: [string, string];
  metric: string;
  objective: string;
  winRule: string;
  missions: string[];
  tools: string[];
};

type QaState = 'idle' | 'playing' | 'paused' | 'finished';
type ToolState = 'ready' | 'active' | 'complete';

const MODES: Mode[] = [
  { id:'duel', title:'Duel', subtitle:'One creator versus one opponent.', icon:'sword-cross', accent:['#3158FF','#17214B'], metric:'1 VS 1', objective:'Complete the same challenge and beat the opponent by verified score.', winRule:'Highest valid score wins; ties go to rematch.', missions:['60-second useful skill','One verse, one application','Before-and-after service'], tools:['Opponent card','Timer','Score board','Rematch','Respect'] },
  { id:'prove_it', title:'Prove It', subtitle:'Show the skill or result.', icon:'shield-star-outline', accent:['#8C43FF','#301A52'], metric:'SKILL', objective:'Complete a clear skill or proof mission.', winRule:'Evidence must satisfy the stated challenge.', missions:['Teach one technique','Show a completed service task','Demonstrate a learned skill'], tools:['Evidence checklist','Completion badge','Skill category','Review state','Share result'] },
  { id:'squad_battle', title:'Squad vs Squad', subtitle:'Team effort and verified completion.', icon:'account-group-outline', accent:['#00A66B','#123D2E'], metric:'TEAM', objective:'Two squads complete the same mission together.', winRule:'Team quality and valid member contribution decide the result.', missions:['Community clean-up relay','Team learning challenge','Group service mission'], tools:['Squad roster','Contribution tracker','Team progress','Battle result','Respect vote'] },
  { id:'king_of_the_hill', title:'King of the Hill', subtitle:'Take and defend the crown.', icon:'crown-outline', accent:['#C98B00','#4A3410'], metric:'CROWN', objective:'Win the hill then defend it from challengers.', winRule:'Holder remains champion while completing valid defenses.', missions:['7-day consistency hill','Skill mastery hill','Service streak hill'], tools:['Current holder','Defense count','Queue','Crown history','Respect'] },
  { id:'hard_mode', title:'Hard Mode', subtitle:'Stricter creative mission.', icon:'fire', accent:['#D14A28','#4B1C16'], metric:'HARD', objective:'Complete a normal Arena mission under harder rules.', winRule:'All hard conditions must be met.', missions:['No-cut 60-second explanation','Three-step service challenge','Timed skill demo'], tools:['Hard conditions','Retry','Mastery badge','Attempt record','Completion proof'] },
  { id:'iron_streak', title:'Iron Streak', subtitle:'Consistency and mastery streak.', icon:'link-variant', accent:['#66717D','#252B31'], metric:'STREAK', objective:'Keep completing the required action across rounds.', winRule:'The streak survives only when each round is completed on time.', missions:['7-day learning streak','Daily encouragement streak','Service consistency streak'], tools:['Streak counter','Current day','Best streak','Recovery rules','Iron badge'] },
  { id:'ranked_season', title:'Ranked Season', subtitle:'Seasonal skill competition.', icon:'podium-gold', accent:['#2B7FD5','#17304A'], metric:'RANKED', objective:'Build season standing through valid Arena results.', winRule:'Standing uses wins and completion records, not purchased points.', missions:['Weekly Duel set','Season service circuit','Multi-skill ladder'], tools:['Season tier','Placements','Win/loss','History','Champion badge'] },
  { id:'boss_challenge', title:'Boss Challenge', subtitle:'Shared high-difficulty target.', icon:'shield-crown-outline', accent:['#B52C5C','#4C1730'], metric:'BOSS', objective:'Break one hard mission into objectives and clear them all.', winRule:'Beat every required objective before close.', missions:['Community impact boss','Learning mastery boss','Team outreach boss'], tools:['Boss health','Objectives','Contributors','Milestones','Final clear'] },
  { id:'last_man_standing', title:'Last Man Standing', subtitle:'Advance round by round.', icon:'account-hard-hat-outline', accent:['#7B5CFF','#2D254D'], metric:'LMS', objective:'Survive each challenge by completing it correctly.', winRule:'Missed challenge eliminates a player; final valid player wins.', missions:['Knowledge elimination','Skill ladder','Service rounds'], tools:['Round board','Active players','Elimination state','Final round','Champion result'] },
  { id:'bounty_challenge', title:'Bounty Challenge', subtitle:'Complete a defined mission.', icon:'target', accent:['#E06B00','#4D2A12'], metric:'MISSION', objective:'Accept and complete a clearly defined mission.', winRule:'Valid completion earns recognition according to mission rules.', missions:['Help-one-person mission','Creative teaching bounty','Community improvement bounty'], tools:['Mission brief','Accept state','Proof upload','Review','Recognition'] },
];

const FEATURED = [
  { title:'60-Second Skill Duel', mode:'duel' as IgpatArenaMode, icon:'sword-cross' as const, tag:'QUICK MATCH', copy:'Prove one useful skill in under a minute.' },
  { title:'Community Impact', mode:'prove_it' as IgpatArenaMode, icon:'hand-heart-outline' as const, tag:'IMPACT', copy:'Show a real action that helped a person or place.' },
  { title:'Squad Mission', mode:'squad_battle' as IgpatArenaMode, icon:'account-group-outline' as const, tag:'TEAM PLAY', copy:'Every member contributes one verified action.' },
];

function normalizeChallengeId(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const row = Array.isArray(value) ? value[0] : value;
    const id = (row as any)?.id ?? (row as any)?.challenge_id;
    if (id) return String(id);
  }
  return null;
}

export default function IgpatArenaScreen() {
  const insets = useSafeAreaInsets();
  const { hasRole } = useAuth();
  const isSystemAdmin = hasRole('system_admin');
  const [selected, setSelected] = useState<IgpatArenaMode>('duel');
  const [openModeId, setOpenModeId] = useState<IgpatArenaMode | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [qaState, setQaState] = useState<QaState>('idle');
  const [timeLeft, setTimeLeft] = useState(20);
  const [myScore, setMyScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [qaRound, setQaRound] = useState(1);
  const [qaHistory, setQaHistory] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolState, setToolState] = useState<ToolState>('ready');
  const [toolValue, setToolValue] = useState(0);
  const [toolNote, setToolNote] = useState('');

  const selectedMode = useMemo(() => MODES.find(x => x.id === selected) ?? MODES[0], [selected]);
  const openMode = useMemo(() => MODES.find(x => x.id === openModeId) ?? null, [openModeId]);

  useEffect(() => {
    if (!qaOpen || qaState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft(value => {
        if (value <= 1) {
          setQaState('finished');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    const bot = setInterval(() => setBotScore(value => value + 1), 2200);
    return () => { clearInterval(timer); clearInterval(bot); };
  }, [qaOpen, qaState]);

  const inspectMode = (mode: IgpatArenaMode, suggestedTitle?: string) => {
    setSelected(mode);
    if (suggestedTitle) setTitle(suggestedTitle);
    setActiveTool(null);
    setOpenModeId(mode);
  };

  const startQa = (mode = selected) => {
    if (!isSystemAdmin) return;
    setSelected(mode);
    setQaOpen(true);
    setQaState('playing');
    setTimeLeft(20);
    setMyScore(0);
    setBotScore(0);
    setQaRound(1);
  };

  const restartQa = () => {
    setQaState('playing');
    setTimeLeft(20);
    setMyScore(0);
    setBotScore(0);
    setQaRound(value => value + 1);
  };

  const finishQa = () => {
    setQaState('finished');
    setTimeLeft(0);
    const result = myScore === botScore ? 'DRAW' : myScore > botScore ? 'WIN' : 'LOSS';
    setQaHistory(current => [`${selectedMode.title} · Round ${qaRound} · ${result} ${myScore}-${botScore}`, ...current].slice(0, 8));
  };

  const openTool = (tool: string) => {
    setActiveTool(tool);
    setToolState('ready');
    setToolValue(0);
    setToolNote('');
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const challengeTitle = title.trim() || selectedMode.title;
    try {
      const result = await createIgpatArenaChallenge({ mode: selected, title: challengeTitle });
      const id = normalizeChallengeId(result);
      setQaHistory(current => [`Challenge created · ${selectedMode.title}${id ? ` · ${id}` : ''}`, ...current].slice(0, 8));
      setTitle('');
      if (isSystemAdmin) {
        startQa(selected);
      } else {
        Alert.alert('Arena challenge created', `${selectedMode.title} is ready.`);
      }
    } catch (error) {
      if (isSystemAdmin) {
        setQaHistory(current => [`QA fallback · ${selectedMode.title} · backend unavailable`, ...current].slice(0, 8));
        setTitle('');
        startQa(selected);
      } else {
        Alert.alert('BUKLOD IGPAT Arena', String((error as any)?.message ?? error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#06080C','#101722','#050706']} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}><MaterialCommunityIcons name="arrow-left" size={23} color="#fff" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>BUKLOD IGPAT</Text><Text style={styles.title}>ARENA</Text><Text style={styles.tagline}>Mastery · Challenge · Respect</Text></View>
        <Pressable onPress={() => router.replace('/igpat' as any)} style={styles.iconButton}><MaterialCommunityIcons name="play-circle-outline" size={23} color="#fff" /></Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 44 }]} showsVerticalScrollIndicator={false}>
        {isSystemAdmin ? (
          <LinearGradient colors={['#174A38','#0C251B']} style={styles.adminBanner}>
            <MaterialCommunityIcons name="shield-key-outline" size={28} color="#C8F9D8" />
            <View style={{flex:1}}><Text style={styles.adminTitle}>SYSTEM ADMIN · FULL QA ACCESS</Text><Text style={styles.adminCopy}>All Arena modes, inner tools and solo simulation are open for end-to-end checking without another account.</Text></View>
            <Pressable onPress={() => startQa(selected)} style={styles.qaQuick}><Text style={styles.qaQuickText}>PLAY QA</Text></Pressable>
          </LinearGradient>
        ) : null}

        <LinearGradient colors={['#173B6E','#141C30']} style={styles.hero}>
          <View style={styles.heroOrb}><MaterialCommunityIcons name="shield-crown" size={46} color="#FFD76B" /></View>
          <View style={{flex:1}}><Text style={styles.heroKicker}>ARENA SEASON</Text><Text style={styles.heroTitle}>Compete with skill, not fake popularity.</Text><Text style={styles.heroCopy}>Every mode has a real objective, interactive tools, challenge flow and result state.</Text>
            <View style={styles.row}><Pressable onPress={() => inspectMode('ranked_season','Ranked Season Challenge')} style={styles.goldButton}><Text style={styles.goldText}>ENTER SEASON</Text></Pressable><Pressable onPress={() => setRulesOpen(v=>!v)} style={styles.darkButton}><Text style={styles.darkText}>{rulesOpen?'HIDE RULES':'HOW IT WORKS'}</Text></Pressable></View>
          </View>
        </LinearGradient>

        {rulesOpen ? <View style={styles.ruleCard}><MaterialCommunityIcons name="shield-check-outline" size={24} color="#9FE7BB"/><Text style={styles.ruleText}>Arena stays separate from Pure Watch. Results are based on challenge completion. No fake viewers, gambling mechanics or pay-to-win score.</Text></View> : null}

        <SectionTitle title="FEATURED CHALLENGES" subtitle="Open and play a prepared challenge." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {FEATURED.map(item => <LinearGradient key={item.title} colors={['#192638','#0D131D']} style={styles.featuredCard}><View style={styles.featuredTop}><View style={styles.featuredIcon}><MaterialCommunityIcons name={item.icon} size={27} color="#fff"/></View><Text style={styles.featuredTag}>{item.tag}</Text></View><Text style={styles.featuredTitle}>{item.title}</Text><Text style={styles.featuredCopy}>{item.copy}</Text><Pressable onPress={() => inspectMode(item.mode,item.title)} style={styles.featuredButton}><Text style={styles.featuredButtonText}>OPEN CHALLENGE</Text><MaterialCommunityIcons name="arrow-right" size={17} color="#07140D"/></Pressable></LinearGradient>)}
        </ScrollView>

        <SectionTitle title="CHOOSE MODE" subtitle="Tap any card to open its complete mode workspace." right={`${MODES.length} MODES`} />
        <View style={styles.grid}>{MODES.map(mode => {
          const active = mode.id === selected;
          return <Pressable key={mode.id} onPress={() => inspectMode(mode.id)} style={[styles.modeCard, active && styles.modeCardOn]}><LinearGradient colors={active?mode.accent:['#14191D','#0D1012']} style={styles.modeGradient}><View style={styles.modeTop}><MaterialCommunityIcons name={mode.icon} size={29} color="#fff"/><Text style={styles.metric}>{mode.metric}</Text></View><Text style={styles.modeTitle}>{mode.title}</Text><Text style={styles.modeSubtitle}>{mode.subtitle}</Text><View style={styles.modeBottom}><Text style={styles.openText}>OPEN</Text><MaterialCommunityIcons name="chevron-right" size={17} color="#DDE5DF"/></View></LinearGradient></Pressable>;
        })}</View>

        <View style={styles.createCard}><View style={styles.createHead}><View style={[styles.selectedIcon,{backgroundColor:selectedMode.accent[0]}]}><MaterialCommunityIcons name={selectedMode.icon} size={25} color="#fff"/></View><View style={{flex:1}}><Text style={styles.createEyebrow}>CREATE / TEST</Text><Text style={styles.createTitle}>{selectedMode.title}</Text></View></View><TextInput value={title} onChangeText={setTitle} placeholder="Challenge title or goal" placeholderTextColor="#737D76" style={styles.input}/><Pressable disabled={busy} onPress={() => void create()} style={[styles.createButton,busy&&{opacity:.55}]}>{busy?<ActivityIndicator color="#07140D"/>:<MaterialCommunityIcons name={isSystemAdmin?'gamepad-variant-outline':'flag-checkered'} size={21} color="#07140D"/>}<Text style={styles.createText}>{isSystemAdmin?'CREATE + PLAY QA':'CREATE CHALLENGE'}</Text></Pressable></View>

        {isSystemAdmin && qaHistory.length ? <View style={styles.historyCard}><Text style={styles.sectionLabel}>QA HISTORY</Text>{qaHistory.map((row,index)=><Text key={`${row}-${index}`} style={styles.historyText}>• {row}</Text>)}</View> : null}
      </ScrollView>

      <Modal visible={Boolean(openMode)} transparent animationType="slide" onRequestClose={()=>setOpenModeId(null)}>
        <Pressable style={styles.backdrop} onPress={()=>setOpenModeId(null)}><Pressable style={styles.sheet} onPress={e=>e.stopPropagation()}>{openMode ? <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHead}><View style={[styles.sheetIcon,{backgroundColor:openMode.accent[0]}]}><MaterialCommunityIcons name={openMode.icon} size={31} color="#fff"/></View><View style={{flex:1}}><Text style={styles.sheetEyebrow}>{openMode.metric}</Text><Text style={styles.sheetTitle}>{openMode.title}</Text><Text style={styles.sheetSubtitle}>{openMode.subtitle}</Text></View><Pressable onPress={()=>setOpenModeId(null)}><MaterialCommunityIcons name="close" size={24} color="#fff"/></Pressable></View>
          <InfoBlock label="OBJECTIVE" text={openMode.objective}/><InfoBlock label="WIN / COMPLETION RULE" text={openMode.winRule}/>
          <Text style={styles.sectionLabel}>STARTER MISSIONS</Text>
          {openMode.missions.map((x,i)=><Pressable key={x} onPress={()=>{setTitle(x);setSelected(openMode.id);}} style={styles.actionRow}><View style={styles.number}><Text style={styles.numberText}>{i+1}</Text></View><Text style={styles.actionText}>{x}</Text><MaterialCommunityIcons name="plus-circle-outline" size={19} color="#9FE7BB"/></Pressable>)}
          <Text style={[styles.sectionLabel,{marginTop:14}]}>MODE TOOLS</Text>
          <View style={styles.toolGrid}>{openMode.tools.map(tool=><Pressable key={tool} onPress={()=>openTool(tool)} style={[styles.toolChip,activeTool===tool&&styles.toolChipOn]}><MaterialCommunityIcons name={activeTool===tool?'cog-play-outline':'cog-outline'} size={17} color="#9FE7BB"/><Text style={styles.toolText}>{tool}</Text></Pressable>)}</View>
          {activeTool ? <View style={styles.toolWorkspace}>
            <View style={styles.toolWorkspaceHead}><View><Text style={styles.sheetEyebrow}>INTERACTIVE TOOL</Text><Text style={styles.toolWorkspaceTitle}>{activeTool}</Text></View><Text style={[styles.toolState,toolState==='complete'&&styles.toolStateDone]}>{toolState.toUpperCase()}</Text></View>
            <View style={styles.toolCounter}><Pressable onPress={()=>setToolValue(v=>Math.max(0,v-1))} style={styles.counterButton}><MaterialCommunityIcons name="minus" size={20} color="#fff"/></Pressable><Text style={styles.counterValue}>{toolValue}</Text><Pressable onPress={()=>setToolValue(v=>v+1)} style={styles.counterButton}><MaterialCommunityIcons name="plus" size={20} color="#fff"/></Pressable></View>
            <TextInput value={toolNote} onChangeText={setToolNote} placeholder="QA note / test data" placeholderTextColor="#737D76" style={styles.toolInput}/>
            <View style={styles.toolActions}><Pressable onPress={()=>setToolState('active')} style={styles.darkButton}><Text style={styles.darkText}>START</Text></Pressable><Pressable onPress={()=>setToolState('complete')} style={styles.goldButton}><Text style={styles.goldText}>MARK COMPLETE</Text></Pressable><Pressable onPress={()=>{setToolState('ready');setToolValue(0);setToolNote('');}} style={styles.darkButton}><Text style={styles.darkText}>RESET</Text></Pressable></View>
          </View> : null}
          <View style={styles.sheetActions}>{isSystemAdmin?<Pressable onPress={()=>{setOpenModeId(null);startQa(openMode.id);}} style={styles.goldButton}><Text style={styles.goldText}>PLAY SOLO QA</Text></Pressable>:null}<Pressable onPress={()=>{setSelected(openMode.id);setOpenModeId(null);}} style={styles.darkButton}><Text style={styles.darkText}>USE THIS MODE</Text></Pressable></View>
        </ScrollView>:null}</Pressable></Pressable>
      </Modal>

      <Modal visible={qaOpen} transparent animationType="fade" onRequestClose={()=>setQaOpen(false)}>
        <View style={styles.qaBackdrop}><LinearGradient colors={selectedMode.accent} style={styles.qaPanel}><View style={styles.qaHeader}><View><Text style={styles.qaEyebrow}>SYSTEM ADMIN · QA SIMULATION</Text><Text style={styles.qaTitle}>{selectedMode.title}</Text></View><Pressable onPress={()=>setQaOpen(false)}><MaterialCommunityIcons name="close" size={25} color="#fff"/></Pressable></View><View style={styles.scoreBoard}><Score label="YOU" value={myScore}/><View style={styles.timerOrb}><Text style={styles.timer}>{timeLeft}</Text><Text style={styles.timerLabel}>SEC</Text></View><Score label="QA BOT" value={botScore}/></View><Text style={styles.roundLabel}>ROUND {qaRound} · {qaState.toUpperCase()}</Text><View style={styles.playField}><MaterialCommunityIcons name={selectedMode.icon} size={62} color="#fff"/><Text style={styles.playTitle}>{selectedMode.objective}</Text><Text style={styles.playHint}>Tap the target while the timer runs. System Admin can verify the full gameplay loop without another account.</Text>{qaState==='playing'?<Pressable onPress={()=>setMyScore(v=>v+1)} style={styles.targetButton}><MaterialCommunityIcons name="target" size={38} color="#07140D"/><Text style={styles.targetText}>HIT TARGET</Text></Pressable>:null}{qaState==='finished'?<View style={styles.resultBox}><Text style={styles.resultTitle}>{myScore===botScore?'DRAW':myScore>botScore?'YOU WIN':'QA BOT WINS'}</Text><Text style={styles.resultScore}>{myScore} — {botScore}</Text></View>:null}</View><View style={styles.qaActions}>{qaState==='playing'?<><Pressable onPress={()=>setQaState('paused')} style={styles.darkButton}><Text style={styles.darkText}>PAUSE</Text></Pressable><Pressable onPress={finishQa} style={styles.darkButton}><Text style={styles.darkText}>FINISH NOW</Text></Pressable></>:qaState==='paused'?<Pressable onPress={()=>setQaState('playing')} style={styles.goldButton}><Text style={styles.goldText}>RESUME</Text></Pressable>:null}<Pressable onPress={restartQa} style={styles.goldButton}><Text style={styles.goldText}>{qaState==='finished'?'REMATCH':'RESTART'}</Text></Pressable></View></LinearGradient></View>
      </Modal>
    </View>
  );
}

function SectionTitle({title,subtitle,right}:{title:string;subtitle:string;right?:string}) { return <View style={styles.sectionHead}><View><Text style={styles.sectionLabel}>{title}</Text><Text style={styles.sectionSub}>{subtitle}</Text></View>{right?<Text style={styles.count}>{right}</Text>:null}</View>; }
function InfoBlock({label,text}:{label:string;text:string}) { return <View style={styles.infoBlock}><Text style={styles.sectionLabel}>{label}</Text><Text style={styles.infoText}>{text}</Text></View>; }
function Score({label,value}:{label:string;value:number}) { return <View style={styles.score}><Text style={styles.scoreLabel}>{label}</Text><Text style={styles.scoreValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#060807'}, header:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#27302B'}, iconButton:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#151A18',borderWidth:1,borderColor:'#2C3430'}, headerCopy:{flex:1,alignItems:'center'}, eyebrow:{color:'#9FE7BB',fontSize:9,fontWeight:'900',letterSpacing:1.5}, title:{color:'#fff',fontSize:25,fontWeight:'900',letterSpacing:1.1}, tagline:{color:'#9DA69F',fontSize:10,fontWeight:'700'}, content:{padding:14,gap:14},
  adminBanner:{borderRadius:20,padding:14,flexDirection:'row',alignItems:'center',gap:11,borderWidth:1,borderColor:'#2B7A58'}, adminTitle:{color:'#C8F9D8',fontSize:10,fontWeight:'900',letterSpacing:.8}, adminCopy:{marginTop:3,color:'#A7D8B7',fontSize:10,lineHeight:14}, qaQuick:{paddingHorizontal:12,minHeight:38,borderRadius:12,backgroundColor:'#C8F9D8',alignItems:'center',justifyContent:'center'}, qaQuickText:{fontSize:9,fontWeight:'900',color:'#092117'},
  hero:{minHeight:220,borderRadius:25,padding:18,flexDirection:'row',gap:14,borderWidth:1,borderColor:'#315A8A'}, heroOrb:{width:68,height:68,borderRadius:23,backgroundColor:'rgba(0,0,0,.23)',alignItems:'center',justifyContent:'center'}, heroKicker:{color:'#FFD76B',fontSize:9,fontWeight:'900',letterSpacing:1.4}, heroTitle:{marginTop:5,color:'#fff',fontSize:23,lineHeight:27,fontWeight:'900'}, heroCopy:{marginTop:7,color:'#CBD6E4',fontSize:11,lineHeight:16}, row:{marginTop:14,flexDirection:'row',gap:8,flexWrap:'wrap'}, goldButton:{minHeight:40,paddingHorizontal:14,borderRadius:12,backgroundColor:'#FFD76B',alignItems:'center',justifyContent:'center'}, goldText:{color:'#17130A',fontSize:9,fontWeight:'900'}, darkButton:{minHeight:40,paddingHorizontal:14,borderRadius:12,borderWidth:1,borderColor:'#60718A',backgroundColor:'rgba(0,0,0,.2)',alignItems:'center',justifyContent:'center'}, darkText:{color:'#fff',fontSize:9,fontWeight:'900'},
  ruleCard:{flexDirection:'row',gap:10,padding:13,borderRadius:16,backgroundColor:'#111713',borderWidth:1,borderColor:'#26362C'}, ruleText:{flex:1,color:'#B9C1BB',fontSize:11,lineHeight:16}, sectionHead:{marginTop:3,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12}, sectionLabel:{color:'#9FE7BB',fontSize:10,fontWeight:'900',letterSpacing:1.05}, sectionSub:{marginTop:3,color:'#818B85',fontSize:10}, count:{color:'#737E77',fontSize:9,fontWeight:'900'},
  featuredRow:{gap:10,paddingRight:8}, featuredCard:{width:260,minHeight:205,borderRadius:20,padding:15,borderWidth:1,borderColor:'#2A3C51'}, featuredTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, featuredIcon:{width:48,height:48,borderRadius:15,backgroundColor:'#243A58',alignItems:'center',justifyContent:'center'}, featuredTag:{color:'#FFD76B',fontSize:8,fontWeight:'900'}, featuredTitle:{marginTop:14,color:'#fff',fontSize:17,fontWeight:'900'}, featuredCopy:{marginTop:5,color:'#AEBBC8',fontSize:10,lineHeight:15}, featuredButton:{marginTop:'auto',minHeight:39,borderRadius:11,backgroundColor:'#DDF5E5',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, featuredButtonText:{color:'#07140D',fontSize:9,fontWeight:'900'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:9}, modeCard:{width:'48.5%',minHeight:164,borderRadius:19,overflow:'hidden',borderWidth:1,borderColor:'#29302B'}, modeCardOn:{borderColor:'#8FBBA0'}, modeGradient:{flex:1,padding:13}, modeTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, metric:{color:'#D8E0DB',fontSize:8,fontWeight:'900',letterSpacing:.8}, modeTitle:{marginTop:11,color:'#fff',fontSize:14,fontWeight:'900'}, modeSubtitle:{marginTop:4,color:'#A2AAA5',fontSize:10,lineHeight:14}, modeBottom:{marginTop:'auto',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, openText:{color:'#D9E0DC',fontSize:8,fontWeight:'900'},
  createCard:{padding:15,borderRadius:21,backgroundColor:'#0F1311',borderWidth:1,borderColor:'#2B3430'}, createHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}, selectedIcon:{width:49,height:49,borderRadius:15,alignItems:'center',justifyContent:'center'}, createEyebrow:{color:'#9FE7BB',fontSize:8,fontWeight:'900',letterSpacing:1}, createTitle:{marginTop:2,color:'#fff',fontSize:18,fontWeight:'900'}, input:{minHeight:50,borderRadius:13,borderWidth:1,borderColor:'#333B35',paddingHorizontal:12,color:'#fff',backgroundColor:'#090C0A'}, createButton:{marginTop:10,minHeight:50,borderRadius:13,backgroundColor:'#DDF5E5',flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'}, createText:{color:'#07140D',fontSize:10,fontWeight:'900'}, historyCard:{padding:14,borderRadius:18,backgroundColor:'#0C100E',borderWidth:1,borderColor:'#27302B'}, historyText:{marginTop:7,color:'#C3CBC5',fontSize:10,lineHeight:15},
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.62)'}, sheet:{maxHeight:'90%',padding:18,paddingBottom:30,borderTopLeftRadius:25,borderTopRightRadius:25,backgroundColor:'#101512'}, sheetHead:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:16}, sheetIcon:{width:56,height:56,borderRadius:18,alignItems:'center',justifyContent:'center'}, sheetEyebrow:{color:'#9FE7BB',fontSize:9,fontWeight:'900',letterSpacing:1}, sheetTitle:{color:'#fff',fontSize:23,fontWeight:'900'}, sheetSubtitle:{marginTop:2,color:'#9FA8A2',fontSize:10}, infoBlock:{padding:13,borderRadius:15,backgroundColor:'#171D19',borderWidth:1,borderColor:'#2A332D',marginBottom:9}, infoText:{marginTop:5,color:'#C8D0CB',fontSize:11,lineHeight:16}, actionRow:{minHeight:48,marginTop:7,paddingHorizontal:10,borderRadius:12,backgroundColor:'#161B18',flexDirection:'row',alignItems:'center',gap:9}, number:{width:27,height:27,borderRadius:9,backgroundColor:'#26362C',alignItems:'center',justifyContent:'center'}, numberText:{color:'#9FE7BB',fontSize:10,fontWeight:'900'}, actionText:{flex:1,color:'#fff',fontSize:11,fontWeight:'800'}, toolGrid:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:8}, toolChip:{minWidth:'47%',flexGrow:1,padding:10,borderRadius:11,backgroundColor:'#161B18',flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:'transparent'}, toolChipOn:{borderColor:'#8FC6A3',backgroundColor:'#1A2A20'}, toolText:{color:'#C8D0CB',fontSize:9,fontWeight:'800'}, sheetActions:{marginTop:17,flexDirection:'row',gap:8,flexWrap:'wrap'},
  toolWorkspace:{marginTop:12,padding:14,borderRadius:16,backgroundColor:'#0C110E',borderWidth:1,borderColor:'#2D3D33'}, toolWorkspaceHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}, toolWorkspaceTitle:{marginTop:2,color:'#fff',fontSize:17,fontWeight:'900'}, toolState:{paddingHorizontal:9,paddingVertical:5,borderRadius:999,backgroundColor:'#26302B',color:'#C8D0CB',fontSize:8,fontWeight:'900'}, toolStateDone:{backgroundColor:'#1E5D3E',color:'#D6FFE5'}, toolCounter:{marginTop:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:20}, counterButton:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#1D2521',borderWidth:1,borderColor:'#34423A'}, counterValue:{minWidth:54,textAlign:'center',color:'#fff',fontSize:30,fontWeight:'900'}, toolInput:{marginTop:13,minHeight:48,borderRadius:12,borderWidth:1,borderColor:'#303A34',paddingHorizontal:12,color:'#fff',backgroundColor:'#080B09'}, toolActions:{marginTop:12,flexDirection:'row',gap:7,flexWrap:'wrap'},
  qaBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.78)',alignItems:'center',justifyContent:'center',padding:16}, qaPanel:{width:'100%',maxWidth:560,borderRadius:28,padding:18,borderWidth:1,borderColor:'rgba(255,255,255,.25)'}, qaHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, qaEyebrow:{color:'#EAF3FF',fontSize:8,fontWeight:'900',letterSpacing:1.1}, qaTitle:{marginTop:2,color:'#fff',fontSize:24,fontWeight:'900'}, scoreBoard:{marginTop:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, score:{minWidth:100,alignItems:'center'}, scoreLabel:{color:'#DCE5E0',fontSize:9,fontWeight:'900'}, scoreValue:{marginTop:2,color:'#fff',fontSize:35,fontWeight:'900'}, timerOrb:{width:78,height:78,borderRadius:39,backgroundColor:'rgba(0,0,0,.3)',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'rgba(255,255,255,.5)'}, timer:{color:'#fff',fontSize:28,fontWeight:'900'}, timerLabel:{color:'#DCE5E0',fontSize:7,fontWeight:'900'}, roundLabel:{marginTop:8,color:'#E9F0EC',textAlign:'center',fontSize:9,fontWeight:'900',letterSpacing:1}, playField:{marginTop:14,minHeight:250,borderRadius:22,backgroundColor:'rgba(0,0,0,.28)',padding:18,alignItems:'center',justifyContent:'center'}, playTitle:{marginTop:10,color:'#fff',fontSize:16,lineHeight:21,fontWeight:'900',textAlign:'center'}, playHint:{marginTop:7,color:'#D5DDD8',fontSize:10,lineHeight:15,textAlign:'center'}, targetButton:{marginTop:20,width:150,height:150,borderRadius:75,backgroundColor:'#E9F8EE',alignItems:'center',justifyContent:'center',borderWidth:6,borderColor:'rgba(255,255,255,.45)'}, targetText:{marginTop:4,color:'#07140D',fontSize:10,fontWeight:'900'}, resultBox:{marginTop:20,padding:18,borderRadius:18,backgroundColor:'rgba(0,0,0,.35)',alignItems:'center',minWidth:220}, resultTitle:{color:'#FFD76B',fontSize:18,fontWeight:'900'}, resultScore:{marginTop:5,color:'#fff',fontSize:30,fontWeight:'900'}, qaActions:{marginTop:15,flexDirection:'row',justifyContent:'center',gap:8,flexWrap:'wrap'},
});