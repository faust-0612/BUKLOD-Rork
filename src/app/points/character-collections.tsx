/* Character System Tasks & Collections (read-only).
 * Character XP, rank, badges and items are from authenticated server snapshots.
 * Kingdom gameplay cannot mint awards through this surface.
 */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {
 CORE_CHARACTER_ORDER,SPECIAL_CHARACTER_ORDER,SPECIAL_REQUIRED_RANK_ORDER,
 CHARACTER_DISPLAY_NAME,getMyBuklodCharacterSelectionV2,
 type BuklodCharacterId,type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';
import {getMyCharacterCollectibles,type CharacterCollectibleState} from '@/lib/buklodCharacterCollectibles';
import {
 storyStageItems,verifiedStoryKeys,storyStageProgress,savedCharacterLevel,
 characterStageLabels,describeCharacterTaskRequirement,type TaskBadge,
} from '@/lib/buklodCharacterCollectionLogic';
import type {BuklodCharacterWorldId} from '@/lib/buklodCharacterWorldCatalog';

type BadgeResult={collectibles?:TaskBadge[]};
const C={bg:'#071823',panel:'#112C3A',text:'#FAFFF6',muted:'#C7D8DA',green:'#AFF079',gold:'#F4D18B'};
const CORE=new Set<string>(CORE_CHARACTER_ORDER);
const SPECIAL=new Set<string>(SPECIAL_CHARACTER_ORDER);
const MAX_STAGE=20;

export default function CharacterCollectionsScreen(){
 const [uid,setUid]=useState<string|null>(null);
 const [selection,setSelection]=useState<BuklodCharacterSelectionV2State|null>(null);
 const [selected,setSelected]=useState<BuklodCharacterId>('phan');
 const [level,setLevel]=useState(1);
 const [items,setItems]=useState<CharacterCollectibleState|null>(null);
 const [badgeResult,setBadgeResult]=useState<BadgeResult|null>(null);
 const [busy,setBusy]=useState(true);
 const [detailsBusy,setDetailsBusy]=useState(false);
 const [error,setError]=useState('');
 const [detailError,setDetailError]=useState('');
 const [showBadges,setShowBadges]=useState(false);
 const [revision,setRevision]=useState(0);
 const req=useRef(0),detailReq=useRef(0);

 const load=useCallback(async()=>{
  const epoch=++req.current;setBusy(true);setError('');
  try{
   const auth=await supabase.auth.getSession();
   if(auth.error)throw auth.error;
   const userId=auth.data.session?.user?.id;
   if(!userId)throw new Error('Sign in to view your Character journey.');
   const state=await getMyBuklodCharacterSelectionV2(userId,true);
   if(epoch!==req.current)return;
   setUid(userId);setSelection(state);setSelected(old=>old==='phan'?state.active_character_id:old);
   setRevision(x=>x+1);
  }catch(e){
   if(epoch===req.current){setUid(null);setSelection(null);
    setError(e instanceof Error?e.message:'Could not load Character progress.');}
  }finally{if(epoch===req.current)setBusy(false);}
 },[]);
 useEffect(()=>{void load();return()=>{req.current++;detailReq.current++;};},[load]);

 const core=CORE.has(selected),special=SPECIAL.has(selected);
 const unlocked=Boolean(selection && (!special ||
    selection.visible_special_character_ids.includes(selected as typeof SPECIAL_CHARACTER_ORDER[number]) ||
    selection.circle_rank_order>=SPECIAL_REQUIRED_RANK_ORDER[selected as typeof SPECIAL_CHARACTER_ORDER[number]]));
 const saved=selection?savedCharacterLevel(selection.character_levels,selected,
    selection.active_character_id,selection.character_level):1;
 useEffect(()=>{setLevel(saved);setShowBadges(false);},[selected,saved]);
 useEffect(()=>{
  if(!uid||!selection||!unlocked){setItems(null);setBadgeResult(null);return;}
  const epoch=++detailReq.current;
  setItems(null);setBadgeResult(null);setDetailError('');setDetailsBusy(true);
  const run=async()=>{
   if(core){
    const data=await getMyCharacterCollectibles(selected as typeof CORE_CHARACTER_ORDER[number]);
    if(epoch===detailReq.current)setItems(data);
   }else if(special){
    const {data,error:err}=await (supabase as any).rpc('get_my_buklod_special_collectibles_v2',
     {p_character_id:selected});
    if(err)throw err;
    if(epoch===detailReq.current)setBadgeResult((data??{}) as BadgeResult);
   }
  };
  void run().catch(e=>{if(epoch===detailReq.current)
   setDetailError(e instanceof Error?e.message:'Task records unavailable.');})
   .finally(()=>{if(epoch===detailReq.current)setDetailsBusy(false);});
  return ()=>{detailReq.current++;};
 },[uid,selection?.active_character_id,selection?.circle_rank_order,unlocked,selected,core,special,revision]);
 
 const known=selection?[...CORE_CHARACTER_ORDER,...SPECIAL_CHARACTER_ORDER.filter(id=>
    selection.visible_special_character_ids.includes(id)||
    selection.circle_rank_order>=SPECIAL_REQUIRED_RANK_ORDER[id])]:[];
 const next=selection?SPECIAL_CHARACTER_ORDER.find(id=>!known.includes(id)):undefined;
 const visible=next?[...known,next]:known;
 const worldId=selected as BuklodCharacterWorldId;
 const story=unlocked?storyStageItems(worldId,level):[];
 const owned=useMemo(()=>verifiedStoryKeys(items?.items??[],worldId),[items,worldId]);
 const stage=unlocked?storyStageProgress(worldId,level,owned):null;
 const title=unlocked?characterStageLabels(worldId,level):null;
 const badges=badgeResult?.collectibles??[];
 const earned=badges.filter(b=>b.earned&&b.collectible_id).length;

 return <ScrollView style={s.root} contentContainerStyle={s.page}
   refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>void load()} tintColor={C.green}/>}>
  <View style={s.head}>
   <Pressable accessibilityRole="button" onPress={()=>router.back()} style={s.back}>
    <MaterialCommunityIcons name="arrow-left" size={23} color={C.green}/>
   </Pressable>
   <View style={{flex:1}}>
    <Text style={s.kicker}>MY BUKLOD • CHARACTER SYSTEM</Text>
    <Text style={s.h1}>Tasks & Collections</Text>
    <Text style={s.body}>Character stories, task badges and permanent collections, connected to Kingdom.</Text>
   </View>
  </View>
  <View style={s.banner}>
   <Text style={s.kicker}>13 CHARACTERS • 20 STAGES EACH</Text>
   <Text style={s.h2}>1,300 Story Collectibles</Text>
   <Text style={s.body}>Each character saves its own level. Badges prove tasks; story items require separate verified ownership.</Text>
  </View>
  {busy&&!selection?<ActivityIndicator color={C.green}/>:null}
  {error?<View style={s.card}><Text style={s.error}>{error}</Text>
    <Pressable onPress={()=>void load()} accessibilityRole="button"><Text style={s.actionText}>RETRY</Text></Pressable>
  </View>:null}
  {selection?<>
   <Text style={s.section}>CHARACTERS</Text>
   <View style={s.rail}>
    {visible.map(id=>{
     const available=known.includes(id),chosen=id===selected;
     const current=savedCharacterLevel(selection.character_levels,id,selection.active_character_id,selection.character_level);
     return <Pressable key={id} accessibilityRole="button"
       accessibilityLabel={available?'Open '+CHARACTER_DISPLAY_NAME[id]:'Next locked Special Character'}
       onPress={()=>setSelected(id)} style={[s.chip,chosen&&s.chosen]}>
      <Text style={[s.chipText,chosen&&s.chosenText]}>
       {available?CHARACTER_DISPLAY_NAME[id]+(selection.active_character_id===id?' • Active':' • L'+current):'🔒 NEXT SPECIAL'}
      </Text>
     </Pressable>;
    })}
   </View>
   {!unlocked?<View style={s.card}>
    <Text style={s.h2}>Next Special Character</Text>
    <Text style={s.body}>Unlock at Circle Rank {SPECIAL_REQUIRED_RANK_ORDER[selected as typeof SPECIAL_CHARACTER_ORDER[number]]}. Future identities stay hidden.</Text>
   </View>:<>
    <View style={s.card}>
     <Text style={s.kicker}>{CHARACTER_DISPLAY_NAME[selected].toUpperCase()} • SAVED LEVEL {saved}</Text>
     <Text style={s.h2}>{title?.title}</Text>
     <Text style={s.body}>Select any stage below to inspect its five story objects. Reaching a level does not automatically mean owning its items.</Text>
     <View style={s.rail}>
      {Array.from({length:MAX_STAGE},(_,i)=>i+1).map(n=>
       <Pressable key={n} accessibilityRole="button" accessibilityLabel={'Level '+n+(n<=saved?', reached':', future')}
         onPress={()=>setLevel(n)} style={[s.stage,n===level&&s.chosen]}>
        <Text style={[s.chipText,n===level&&s.chosenText]}>{n}{n<=saved?' ✓':''}</Text>
       </Pressable>)}
     </View>
    </View>
    <View style={s.card}>
     <View style={s.rowBetween}><Text style={s.section}>STAGE {level} • OBJECTS</Text>
      <Text style={s.kicker}>{core&&items?stage?.owned+'/5 VERIFIED':'AWARD STATUS UNKNOWN'}</Text></View>
     {detailsBusy?<ActivityIndicator color={C.green}/>:null}
     {story.map(item=>{
      const isOwned=core&&owned.has(item.key);
      return <View key={item.key} style={s.itemRow}>
       <View style={s.iconBox}><MaterialCommunityIcons
        name={isOwned?'check-decagram':'package-variant-closed'} size={24}
        color={isOwned?C.green:C.gold}/></View>
       <View style={{flex:1}}>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.caption}>{item.slot}</Text>
        <Text style={s.caption}>{isOwned?'OWNED • SERVER VERIFIED':
         level>saved?'FUTURE STAGE':core?'NOT VERIFIED AS CLAIMED':'STORY OBJECT • NOT A VERIFIED AWARD'}</Text>
       </View>
      </View>;
     })}
     {core&&stage?.mastered?<Text style={s.success}>All five server-owned objects verified: collection stage mastered.</Text>:null}
     {core?<Pressable accessibilityRole="button" onPress={()=>router.push('/games/legacy' as any)} style={s.action}>
      <Text style={s.actionText}>OPEN OFFICIAL ITEM CLAIMS</Text>
     </Pressable>:null}
    </View>
    <View style={s.card}>
     <Text style={s.section}>BADGES & TASKS</Text>
     <Text style={s.name}>{title?.signature}</Text>
     <Text style={s.body}>Stage badge: {title?.badge}. Badges and the five story items are different rewards.</Text>
     {detailError?<Text style={s.error}>{detailError}</Text>:null}
     {special?<>
      <Text style={s.kicker}>{earned} VERIFIED TASK BADGES</Text>
      {(showBadges?badges:badges.slice(0,5)).map(b=>
       <View key={b.collectible_id} style={s.itemRow}>
        <MaterialCommunityIcons name={b.earned?'medal':'lock-outline'} size={22}
         color={b.earned?C.gold:C.muted}/>
        <View style={{flex:1}}>
         <Text style={s.name}>{b.secret&&!b.earned?'Secret task':b.badge_name}</Text>
         <Text style={s.caption}>{b.earned?'EARNED • SERVER VERIFIED':
          describeCharacterTaskRequirement(b.requirement,b.secret)}</Text>
        </View>
       </View>)}
      {badges.length>5?<Pressable accessibilityRole="button" onPress={()=>setShowBadges(!showBadges)}>
       <Text style={s.actionText}>{showBadges?'SHOW LESS':'VIEW ALL TASK BADGES'}</Text>
      </Pressable>:null}
      <Pressable accessibilityRole="button" onPress={()=>router.push('/(tabs)/buklod' as any)} style={s.action}>
       <Text style={s.actionText}>OPEN PUBLIC WALL TASKS</Text>
      </Pressable>
      <Text style={s.caption}>Only qualifying, server-counted activities count. Bible, lessons, mentoring and other task sources await verified backend wiring.</Text>
     </>:<Text style={s.caption}>Core item awards are verified by the existing Character collection RPC. This page creates no awards or economy credits.</Text>}
    </View>
    <Pressable accessibilityRole="button" onPress={()=>router.push('/games/legacy' as any)} style={s.secondary}>
     <Text style={s.name}>VIEW CONNECTED KINGDOM LEGACY</Text>
    </Pressable>
   </>}
  </>:null}
  <Text style={s.caption}>Previewing, scrolling and refreshing never grants BP, character XP, badges, collectibles or Shards. Missing artwork uses a lightweight fallback until the 1,300 images are mapped.</Text>
 </ScrollView>;
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg},page:{padding:15,paddingBottom:40,gap:13},
 head:{flexDirection:'row',gap:10,alignItems:'flex-start'},back:{padding:8,backgroundColor:C.panel,borderRadius:10},
 kicker:{color:C.green,fontWeight:'800',fontSize:11,letterSpacing:.5},
 h1:{color:C.text,fontSize:25,fontWeight:'900'},h2:{color:C.text,fontSize:19,fontWeight:'900'},
 body:{color:C.muted,fontSize:13,lineHeight:20},banner:{backgroundColor:'#194154',padding:17,borderRadius:16,gap:7},
 section:{color:C.gold,fontSize:12,fontWeight:'900',letterSpacing:.8},
 rail:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{padding:11,backgroundColor:C.panel,borderRadius:12},
 chosen:{backgroundColor:'#245E47',borderColor:C.green,borderWidth:1},chosenText:{color:C.text},
 chipText:{fontSize:12,fontWeight:'800',color:C.muted},
 card:{backgroundColor:C.panel,borderRadius:15,padding:15,gap:11},
 stage:{minWidth:46,alignItems:'center',paddingHorizontal:9,paddingVertical:11,backgroundColor:'#194154',borderRadius:9},
 rowBetween:{flexDirection:'row',justifyContent:'space-between',flexWrap:'wrap',alignItems:'center',gap:8},
 itemRow:{flexDirection:'row',gap:11,paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#335462'},
 iconBox:{width:44,height:44,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#1B4654'},
 name:{fontSize:14,fontWeight:'800',color:C.text},caption:{color:C.muted,fontSize:12,lineHeight:18},
 error:{fontSize:13,color:'#FFBBAF'},success:{color:C.green,fontSize:13,fontWeight:'800'},
 action:{backgroundColor:C.green,borderRadius:11,alignItems:'center',padding:13,marginTop:7},
 actionText:{fontSize:12,fontWeight:'900',color:'#123A28',paddingVertical:4},
 secondary:{backgroundColor:'#1D534E',alignItems:'center',padding:14,borderRadius:12},
});
