/** BUKLOD Living Character Experience (non-credit, offline adventure).
 * Does not change official Character V2, Circle Rank, Shards, BP or finances.
 */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/providers/AuthProvider';
import {getCachedBuklodCharacterSelectionV2,getMyBuklodCharacterSelectionV2} from '@/lib/buklodCharacterSelectionV2';
import {
  ADVENTURE_STORIES, ADVENTURE_RELICS, ADVENTURE_BADGE_INFO, ADVENTURE_PRACTICE,
  adventureEnding, adventureXpForLevel, badgeNextGoal, badgeTier,bondTier,
  initialAdventure,isDuoUnlocked,journeyNextGoal,relicSetProgress,strength,
  type AdventureAction,type AdventureCharacter,type AdventureBadgeId,type AdventureRelic,type AdventureState,
} from '@/lib/buklodCharacterAdventure';
import {actOnCharacterAdventure,adventureManilaDay,loadCharacterAdventure} from '@/lib/buklodCharacterAdventureStore';
import BuklodKingdomCoreAtlas from '@/components/kingdom/BuklodKingdomCoreAtlas';
import {KingdomAdventureHeroScene,type AdventureMoment} from '@/features/games/kingdom/KingdomAdventureMotion';
import {useKingdomAdventureAudio} from '@/features/games/kingdom/useKingdomAdventureAudio';
import {cueForAdventureAction} from '@/lib/kingdomAdventurePresentation';

const C={sky:'#071e27',forest:'#0d362f',deep:'#113b37',emerald:'#a9ed8a',pale:'#e8fbe8',muted:'#c0ded0',gold:'#f1d392',border:'#56796b'};
const PRACTICE_TYPES=['wisdom','service','courage'] as const;
const BADGE_IDS=['story','wise','steadfast','collector','secret'] as const;
type Page='story'|'relics'|'badges'|'atlas';
function Card({children}: {children:React.ReactNode}) {return <View style={s.card}>{children}</View>}
function Caption({children}: {children:React.ReactNode}) {return <Text style={s.caption}>{children}</Text>}
function getActiveCharacter(value:unknown):AdventureCharacter|null {
  if(typeof value==='string'&&Object.hasOwn(ADVENTURE_STORIES,value))return value as AdventureCharacter;
  return null;
}
export default function CharacterExperienceScreen(){
  const {user}=useAuth();const uid=user?.id??null;
  const insets=useSafeAreaInsets();
  const [hero,setHero]=useState<AdventureCharacter|null>(()=>getActiveCharacter(getCachedBuklodCharacterSelectionV2(uid)?.active_character_id));
  const [profile,setProfile]=useState<AdventureState|null>(null);
  const [page,setPage]=useState<Page>('story');
  // Art uses OFFICIAL saved character level, not local preview Adventure Level.
  const [officialLevel,setOfficialLevel]=useState(1);
  const [moment,setMoment]=useState<AdventureMoment|null>(null);
  const momentSerial=useRef(0);
  const playCue=useKingdomAdventureAudio();
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [synergy,setSynergy]=useState<string|null>(null);
  const currentRef=useRef({uid,hero});currentRef.current={uid,hero};
  const savingRef=useRef(false);
  useEffect(()=>{
    let mounted=true;
    setLoading(true);setNotice('');setProfile(null);setSynergy(null);setHero(null);setMoment(null);setOfficialLevel(1);
    if(!uid){setLoading(false);return;}
    const cached=getActiveCharacter(getCachedBuklodCharacterSelectionV2(uid)?.active_character_id);
    if(cached){setHero(cached);setOfficialLevel(getCachedBuklodCharacterSelectionV2(uid)?.character_level ?? 1);}
    void getMyBuklodCharacterSelectionV2(uid,true)
      .then(selection=>{if(mounted&&currentRef.current.uid===uid){setHero(getActiveCharacter(selection.active_character_id));setOfficialLevel(selection.character_level??1);}})
      .catch(()=>{if(mounted)setNotice('Could not verify your active character. Open Character Studio and retry.');})
      .finally(()=>{if(mounted&&!cached)setLoading(false)});
    return()=>{mounted=false};
  },[uid]);
  useEffect(()=>{
    let mounted=true;setProfile(null);setSynergy(null);setMoment(null);
    if(!uid||!hero)return;
    setLoading(true);
    void loadCharacterAdventure(uid,hero).then(p=>{
      if(mounted&&currentRef.current.uid===uid&&currentRef.current.hero===hero)setProfile(p);
    }).catch(()=>{if(mounted)setNotice('Local Adventure Journal unavailable. Retry when storage is accessible.');})
      .finally(()=>{if(mounted)setLoading(false)});
    return()=>{mounted=false};
  },[uid,hero]);
  const run=useCallback(async(action:AdventureAction)=>{
    if(!uid||!hero||!profile||savingRef.current)return;
    savingRef.current=true;setBusy(true);setNotice('');
    try{
      const result=await actOnCharacterAdventure(uid,hero,action);
      if(currentRef.current.uid!==uid||currentRef.current.hero!==hero)return;
      setProfile(result.state);
      // Only successful *persisted* local actions emit a celebration.
      if (result.changed) {
        const promoted=BADGE_IDS.some(id=>badgeTier(profile,id)!==badgeTier(result.state,id));
        const cue=promoted?'badge':cueForAdventureAction(action.type);
        if(cue!=='invalid'){
          setMoment({id:++momentSerial.current,cue});
          playCue(cue);
        }
      } else if(result.message.startsWith('Review the clue')) {
        playCue('invalid');
      }
      const reward=result.changed && (result.earned.xp||result.earned.bond||result.earned.fragment)
        ? ` • +${result.earned.xp} Adventure XP · +${result.earned.bond} Bond${result.earned.fragment?' · +1 '+result.earned.fragment+' fragment':''}`:'';
      setNotice(result.message+reward);
    }catch(e){if(currentRef.current.uid===uid)setNotice(e instanceof Error?e.message:'Could not save. No reward was applied.');}
    finally{savingRef.current=false;if(currentRef.current.uid===uid)setBusy(false)}
  },[uid,hero,profile,playCue]);
  const checkDuo=useCallback(async()=>{
    if(!uid||!hero||!profile||savingRef.current)return;
    setBusy(true);
    try{
      // Only core companions are shown here; locked special-character identities remain private.
      const ids=(['phan','quin','van','christian','lhen'] as AdventureCharacter[]).filter(id=>id!==hero);
      const companions=await Promise.all(ids.map(id=>loadCharacterAdventure(uid,id)));
      if(currentRef.current.uid!==uid||currentRef.current.hero!==hero)return;
      const ready=companions.find(x=>isDuoUnlocked(profile,x));
      setSynergy(ready?`${ADVENTURE_STORIES[ready.character].name} and ${ADVENTURE_STORIES[hero].name} can open a friendship scene together. Cosmetic storytelling only.`:
        'Build Bond Tier 3 with this hero and another unlocked core character to reveal a special friendship scene.');
    }catch{setSynergy('Could not load the other character journals.');}
    finally{if(currentRef.current.uid===uid)setBusy(false)}
  },[uid,hero,profile]);
  const story=hero?ADVENTURE_STORIES[hero]:null;
  const chapter=profile?([0,1,2] as const).find(i=>profile.chapters[i]===undefined):undefined;
  const xpTarget=profile&&profile.level<20?adventureXpForLevel(profile.level+1):null;
  const xpStart=profile?adventureXpForLevel(profile.level):0;
  const xpProgress=profile&&xpTarget!==null?Math.max(0,Math.min(100,Math.round((profile.xp-xpStart)/(xpTarget-xpStart)*100))):100;
  const set=profile?relicSetProgress(profile):null;
  const ending=profile?adventureEnding(profile):'Unfinished';
  const currentGate=profile?([4,8,12,16] as const).find(g=>profile.level===g&&!profile.gates.includes(g)):undefined;
  const today=adventureManilaDay();
  const tabs=useMemo(()=>[{id:'story',name:'STORY & BOND',icon:'book-open-variant-outline'},{id:'relics',name:'RELICS & SETS',icon:'diamond-stone'},{id:'badges',name:'BADGES',icon:'shield-star-outline'},{id:'atlas',name:'ITEM ATLAS',icon:'treasure-chest-outline'}] as const,[]);
  return <View style={s.root}>
    <LinearGradient colors={['#061925','#0a382f','#071e2c']} style={StyleSheet.absoluteFill}/>
    <ScrollView contentContainerStyle={[s.scroll,{paddingTop:Math.max(12,insets.top)+8,paddingBottom:Math.max(22,insets.bottom)+24}]}>
      <View style={s.top}>
        <Pressable onPress={()=>router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={23} color={C.pale}/>
        </Pressable>
        <View style={{flex:1}}><Caption>BUKLOD KINGDOM</Caption><Text style={s.title}>Living Character Experience</Text></View>
      </View>
      <View style={s.honest}><MaterialCommunityIcons name="information-outline" color={C.emerald} size={18}/>
        <Text style={s.honestText}>LOCAL ADVENTURE • Masayang story progression at offline collection. Hindi ito official Character XP, Circle Rank, BP, Shards o cash. Ang trading at premium purchases ay hindi pa available.</Text>
      </View>
      {!uid?<Card><Text style={s.body}>Mag-sign in para masave ang sariling Adventure Journal.</Text></Card>:null}
      {uid&&loading?<ActivityIndicator color={C.emerald} size="large"/>:null}
      {uid&&!loading&&!hero?<Card><Text style={s.body}>Pumili muna ng active character sa Character Studio.</Text>
        <Pressable style={s.button} onPress={()=>router.push('/(tabs)/me' as any)}><Text style={s.buttonText}>OPEN CHARACTER STUDIO</Text></Pressable></Card>:null}
      {profile&&story? <>
        <LinearGradient colors={['#26644d','#153f40','#122d37']} style={s.hero}>
          <Caption>{story.theme.toUpperCase()} • {story.name.toUpperCase()}</Caption>
          <KingdomAdventureHeroScene character={hero!} officialLevel={officialLevel}
            ascensions={profile.ascensions} moment={moment}/>
          <Text style={s.heroTitle}>{story.title}</Text>
          <Text style={s.body}>{journeyNextGoal(profile)}</Text>
          <View style={s.metrics}>
            <View style={s.metric}><Text style={s.metricNum}>{profile.level}</Text><Text style={s.metricLabel}>ADVENTURE LVL</Text></View>
            <View style={s.metric}><Text style={s.metricNum}>{bondTier(profile.bond)}</Text><Text style={s.metricLabel}>BOND TIER</Text></View>
            <View style={s.metric}><Text style={s.metricNum}>{profile.ascensions}</Text><Text style={s.metricLabel}>ASCENSIONS</Text></View>
            <View style={s.metric}><Text style={s.metricNum}>{strength(profile)}</Text><Text style={s.metricLabel}>PRACTICE POWER</Text></View>
          </View>
          <View style={s.progressTrack}><View style={[s.progressBar,{width:`${xpProgress}%` as `${number}%`}]} /></View>
          <Text style={s.muted}>{xpTarget===null?'Max Adventure XP reached':`${profile.xp} / ${xpTarget} Adventure XP toward next level`}</Text>
        </LinearGradient>
        <View style={s.tabs}>{tabs.map(t=><Pressable key={t.id} accessibilityRole="tab" accessibilityState={{selected:page===t.id}}
          onPress={()=>setPage(t.id)} style={[s.tab,page===t.id&&s.tabActive]}>
          <MaterialCommunityIcons name={t.icon} size={18} color={page===t.id?'#102e26':C.muted}/>
          <Text style={[s.tabText,page===t.id&&s.tabTextActive]}>{t.name}</Text>
        </Pressable>)}</View>
        {page==='story'?<>
          <Card><View style={s.sectionHead}><Text style={s.sectionTitle}>Story Path</Text><Text style={s.meta}>{Object.keys(profile.chapters).length}/3 chapters</Text></View>
            {chapter!==undefined?<>
              <Caption>CHAPTER {chapter+1} • {story.chapters[chapter]}</Caption>
              <Text style={s.question}>{story.dilemmas[chapter]}</Text>
              <Text style={s.muted}>Ang pagpili ay mananatili sa journal at babago sa ending. Isang beses lang ang first-clear reward.</Text>
              {story.choices[chapter].map((choice,i)=><Pressable key={i} disabled={busy}
                onPress={()=>void run({type:'chapter',chapter,choice:i===0?'heart':'courage'})}
                style={[s.choice,busy&&s.disabled]}><MaterialCommunityIcons name={i===0?'heart-outline':'compass-rose'} size={18} color={C.emerald}/>
                <Text style={s.choiceText}>{choice}</Text></Pressable>)}
            </>:<><Text style={s.question}>{ending}</Text><Text style={s.body}>Nakatala na ang mga naging desisyon ng iyong tauhan. Maaari kang magpatuloy sa daily challenges, craft, at bagong story cycle matapos ang Ascension.</Text></>}
          </Card>
          <Card><View style={s.sectionHead}><Text style={s.sectionTitle}>Daily Meaningful Practice</Text><Text style={s.meta}>{profile.streak} day streak</Text></View>
            <Text style={s.muted}>May isang grace day kung makaligtaan ang isang araw. Walang dagdag na reward sa replay ng parehong challenge sa araw na ito.</Text>
            {PRACTICE_TYPES.map(type=>{const info=ADVENTURE_PRACTICE[type];const done=profile.practiceDays.includes(today+':'+type);
              return <View key={type} style={s.practice}>
                <View style={s.sectionHead}><Text style={s.practiceTitle}>{info.title}</Text><Text style={s.meta}>{done?'COMPLETE':'TODAY'}</Text></View>
                <Text style={s.body}>{info.question}</Text>
                {!done?info.answers.map((answer,i)=><Pressable disabled={busy} key={i} style={s.answer} onPress={()=>void run({type:'practice',challenge:type,answer:i as 0|1|2,day:today})}>
                  <Text style={s.answerText}>{String.fromCharCode(65+i)}. {answer}</Text></Pressable>):
                  <Text style={s.won}>{info.explanation}</Text>}
              </View>;
            })}
          </Card>
          <Card><View style={s.sectionHead}><Text style={s.sectionTitle}>Character Bond</Text><Text style={s.meta}>{profile.bond} Bond • Tier {bondTier(profile.bond)}</Text></View>
            <Text style={s.body}>Ang Bond ay lumalago sa mahahalagang desisyon, natapos na practice at thoughtful gifts—hindi sa walang katapusang taps. Nagbubukas ito ng kuwento at friendly combo scene.</Text>
            <Pressable disabled={busy||profile.giftDays.includes(today)||profile.hibla<2} style={[s.button,(busy||profile.giftDays.includes(today)||profile.hibla<2)&&s.disabled]}
              onPress={()=>void run({type:'gift',day:today})}><Text style={s.buttonText}>OFFER STORY GIFT • 2 ADVENTURE HIBLA</Text></Pressable>
            <Pressable disabled={busy} onPress={()=>void checkDuo()} style={s.outline}><Text style={s.outlineText}>CHECK CHARACTER FRIENDSHIP SYNERGY</Text></Pressable>
            {synergy?<Text style={s.body}>{synergy}</Text>:null}
          </Card>
          {currentGate!==undefined?<Card><Text style={s.sectionTitle}>Tier Gate • Level {currentGate}</Text>
            <Text style={s.body}>Hindi sapat ang XP. Kailangan din ang story choices, meaningful practice sa magkakaibang araw, at Bond bago mabuksan ang susunod na tier.</Text>
            <Pressable disabled={busy} style={s.button} onPress={()=>void run({type:'gate',gate:currentGate})}><Text style={s.buttonText}>ATTEMPT STORY GATE</Text></Pressable>
          </Card>:null}
          {profile.level===20?<Card><Text style={s.sectionTitle}>Ascension • Bagong Anyô</Text><Text style={s.body}>I-reset ang *Adventure Level* para sa permanenteng visual crest at panibagong story cycle. Mananatili ang relics, Bond, at official Character Level.</Text>
            <Pressable disabled={busy} onPress={()=>void run({type:'ascend'})} style={s.button}><Text style={s.buttonText}>ASCEND MY ADVENTURE HERO</Text></Pressable></Card>:null}
        </>:null}
        {page==='relics'?<>
          <Card><View style={s.sectionHead}><Text style={s.sectionTitle}>Relic Collection Book</Text><Text style={s.meta}>{set?.count}/5</Text></View>
            <Text style={s.body}>Ang tatlong magkakaparehong fragment ay maaaring buuin bilang personal relic. Habang kumpleto ang set, nagbabago ang itsura ng iyong gallery—walang karagdagang BP o cash.</Text>
            <View style={s.progressTrack}><View style={[s.progressBar,{width:`${(set?.count??0)*20}%` as `${number}%`}]} /></View>
            <Text style={s.won}>CURRENT SET EFFECT: {set?.scene.toUpperCase()}</Text>
          </Card>
          <LinearGradient colors={(set?.count??0)>=5?['#74622c','#2e684f','#12382f']:
            (set?.count??0)>=2?['#2b644e','#163d43','#12382f']:['#1b4d47','#17363a','#113229']}
            style={s.scenePreview}>
            <Text style={s.sceneEyebrow}>LIVING COLLECTION SCENE</Text>
            <View style={s.sceneSymbols}>
              {ADVENTURE_RELICS.map((relic,i)=><View key={relic} style={[s.sceneGem,profile.relics[relic] ? s.sceneGemOwned : null]}>
                <MaterialCommunityIcons name={profile.relics[relic]?'diamond-stone':'diamond-outline'}
                  size={i===2?36:24} color={profile.relics[relic]?C.emerald:C.muted}/>
              </View>)}
            </View>
            <Text style={s.sceneName}>{set?.scene}</Text>
            <Text style={s.sceneNote}>{set?.finished
              ?'Collection page completed • Your legacy room shines with all five relics.'
              :'Each personal relic awakens another part of the scene.'}</Text>
          </LinearGradient>
          {ADVENTURE_RELICS.map(relic=>{
            const owned=Boolean(profile.relics[relic]);const fragments=profile.fragments[relic];
            return <Card key={relic}>
              <View style={s.relic}><MaterialCommunityIcons name={owned?'diamond-stone':'diamond-outline'} color={owned?C.emerald:C.gold} size={34}/>
                <View style={{flex:1}}><Text style={s.relicName}>{relic.toUpperCase()} RELIC</Text>
                  <Text style={s.muted}>{owned?'COLLECTED • Story keepsake':`${fragments}/3 fragments`}</Text></View></View>
              <Text style={s.body}>USE: sariling journal at cosmetic collection gallery. Hindi ito inililipat sa ibang account.</Text>
              {!owned?<Pressable disabled={busy||fragments<3} style={[s.button,(busy||fragments<3)&&s.disabled]}
                onPress={()=>void run({type:'craft',relic})}><Text style={s.buttonText}>CRAFT RELIC • 3 FRAGMENTS</Text></Pressable>:
                <Pressable disabled={busy||fragments<3} style={[s.outline,(busy||fragments<3)&&s.disabled]}
                  onPress={()=>void run({type:'refine',relic})}><Text style={s.outlineText}>REFINE DUPLICATE FRAGMENTS → MEMORY DUST</Text></Pressable>}
              {!owned&&profile.dust>=8?<Pressable disabled={busy} style={s.outline}
                onPress={()=>void run({type:'exchange',relic})}><Text style={s.outlineText}>SELECT THIS MISSING RELIC • 8 MEMORY DUST</Text></Pressable>:null}
            </Card>
          })}
          <Card><Text style={s.sectionTitle}>Inventory & Exchange Rules</Text>
            <Text style={s.body}>Adventure Hibla: {profile.hibla} • Memory Dust: {profile.dust}. Ang duplicates ay nagiging noncash materyales para pumili ng kulang na relic. Ang trading sa ibang player ay naka-disable hanggang magkaroon ng server-verified, consensual cosmetic-only exchange.</Text>
          </Card>
        </>:null}
        {page==='atlas'?<BuklodKingdomCoreAtlas/>:null}
        {page==='badges'?<>
          <Card><Text style={s.sectionTitle}>Mastery Badge Chronicle</Text>
            <Text style={s.body}>Progress, Challenge, Discovery. Ang Tier ay nakabatay sa distinct na gawain, hindi sa dami ng taps. Ang badges ay personal: puwedeng ipakita bilang lokal na title, journal frame o collection effect, pero hindi puwedeng ipagbili.</Text>
          </Card>
          {BADGE_IDS.map((id:AdventureBadgeId)=>{
            const meta=ADVENTURE_BADGE_INFO[id],tier=badgeTier(profile,id),next=badgeNextGoal(profile,id);
            return <Card key={id}>
              <View style={s.badgeRow}><MaterialCommunityIcons name={tier==='none'?'shield-outline':'shield-star'} color={tier==='none'?C.muted:C.gold} size={33}/>
                <View style={{flex:1}}><Text style={s.badgeTitle}>{id==='secret'&&tier==='none'?'??? • Hidden Paths':meta.name}</Text>
                  <Text style={s.won}>TIER: {tier.toUpperCase()}</Text></View></View>
              <Text style={s.body}>{id==='secret'&&tier==='none'?'Explore alternative decisions across story cycles.':meta.purpose}</Text>
              <Text style={s.muted}>UNLOCKED REWARD: {tier==='none'?'Locked':meta.reward}</Text>
              {next!==null&&id!=='secret'?<Text style={s.muted}>NEXT TIER GOAL: {next} distinct accomplishments</Text>:null}
              <Text style={s.bound}>PERSONAL BADGE • NON-TRADABLE • LOCAL ADVENTURE ONLY</Text>
            </Card>;
          })}
        </>:null}
        {notice?<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>:null}
        <Pressable accessibilityRole="button" onPress={()=>router.push('/games/legacy' as any)} style={s.outline}>
          <Text style={s.outlineText}>BACK TO VERIFIED CHARACTER RELICS & SHARDS</Text>
        </Pressable>
      </>:null}
    </ScrollView>
  </View>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.sky},scroll:{maxWidth:750,width:'100%',alignSelf:'center',paddingHorizontal:14,gap:12},
  top:{flexDirection:'row',alignItems:'center',gap:12},back:{width:43,height:43,borderWidth:1,borderColor:C.border,backgroundColor:C.deep,borderRadius:12,alignItems:'center',justifyContent:'center'},
  title:{fontSize:21,fontWeight:'900',color:C.pale},caption:{color:C.emerald,fontSize:10,fontWeight:'900',letterSpacing:1},
  honest:{flexDirection:'row',padding:12,borderRadius:13,borderWidth:1,borderColor:'#4f856e',backgroundColor:'#123a34',gap:9},
  honestText:{color:'#d2e8d8',fontSize:11,lineHeight:17,flex:1},
  hero:{padding:17,borderRadius:21,borderWidth:1,borderColor:'#93c899',gap:10},heroTitle:{color:C.pale,fontSize:26,fontWeight:'900'},
  metrics:{flexDirection:'row',gap:5,justifyContent:'space-between'},metric:{alignItems:'center',flex:1,gap:3},metricNum:{color:C.pale,fontSize:24,fontWeight:'900'},metricLabel:{color:C.emerald,fontSize:8.5,fontWeight:'900',textAlign:'center'},
  progressTrack:{height:9,backgroundColor:'#356458',borderRadius:30,overflow:'hidden'},progressBar:{height:'100%',backgroundColor:C.emerald,borderRadius:30},
  tabs:{flexDirection:'row',gap:5},tab:{flex:1,flexDirection:'column',gap:4,minHeight:52,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.border,borderRadius:12,backgroundColor:C.deep},tabActive:{backgroundColor:C.emerald,borderColor:C.emerald},
  tabText:{fontSize:8.5,fontWeight:'900',color:C.muted},tabTextActive:{color:'#102e26'},
  card:{backgroundColor:'#12392f',borderRadius:18,padding:14,borderWidth:1,borderColor:'#5a8572',gap:12},
  sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},sectionTitle:{fontSize:16,fontWeight:'900',color:'#f3ffe9'},
  meta:{fontSize:10,fontWeight:'900',color:C.gold},body:{fontSize:12,lineHeight:19,color:'#e9fff0'},muted:{fontSize:11,lineHeight:16,color:C.muted},
  question:{fontSize:17,fontWeight:'900',lineHeight:24,color:C.pale},
  choice:{backgroundColor:'#24584a',borderRadius:11,minHeight:45,flexDirection:'row',alignItems:'center',padding:11,gap:9,borderWidth:1,borderColor:'#77ac8a'},
  choiceText:{fontSize:12,fontWeight:'800',color:C.pale,flex:1},practice:{backgroundColor:'#164738',padding:12,borderRadius:13,gap:9,borderWidth:1,borderColor:'#397356'},
  practiceTitle:{fontSize:13,fontWeight:'900',color:C.gold},answer:{padding:11,borderRadius:10,borderWidth:1,borderColor:'#5a9172',backgroundColor:'#205347',minHeight:42,justifyContent:'center'},
  answerText:{fontSize:11,fontWeight:'700',color:C.pale},won:{fontSize:11,fontWeight:'900',color:'#bcefa4'},
  button:{backgroundColor:C.emerald,paddingHorizontal:12,paddingVertical:12,borderRadius:11,minHeight:44,alignItems:'center',justifyContent:'center'},
  buttonText:{fontSize:11,fontWeight:'900',color:'#14302a',textAlign:'center'},
  outline:{borderColor:'#87ccac',borderWidth:1,borderRadius:11,minHeight:44,paddingHorizontal:12,paddingVertical:10,alignItems:'center',justifyContent:'center'},
  outlineText:{fontSize:11,fontWeight:'900',color:C.pale,textAlign:'center'},disabled:{opacity:.43},
  scenePreview:{padding:18,borderRadius:19,borderWidth:1,borderColor:'#a7d697',alignItems:'center',gap:12},
  sceneEyebrow:{color:C.gold,fontSize:10,fontWeight:'900',letterSpacing:1.3},
  sceneSymbols:{flexDirection:'row',justifyContent:'space-around',alignItems:'center',width:'100%'},
  sceneGem:{width:44,height:51,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'#25483e',borderWidth:1,borderColor:'#4d6d5f'},
  sceneGemOwned:{backgroundColor:'#326b4c',borderColor:'#b5e497'},
  sceneName:{color:C.pale,fontSize:21,fontWeight:'900'},
  sceneNote:{color:C.muted,fontSize:11,lineHeight:16,textAlign:'center'},
  relic:{flexDirection:'row',alignItems:'center',gap:12},relicName:{fontSize:15,fontWeight:'900',color:C.pale},
  badgeRow:{flexDirection:'row',alignItems:'center',gap:12},badgeTitle:{fontSize:16,fontWeight:'900',color:C.pale},bound:{fontSize:9,fontWeight:'900',color:C.muted},
  notice:{backgroundColor:'#285746',color:'#f5fbe1',borderRadius:12,padding:12,fontSize:12,lineHeight:18},
});
