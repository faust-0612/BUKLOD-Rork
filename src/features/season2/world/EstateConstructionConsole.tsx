/** Verified estate UI: no preview may alter BP, wallets, levels or ownership. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {
 completeVerifiedEstateBuild,contributeVerifiedEstate,enoughEstateMaterials,
 fetchVerifiedEstate,newEstateOperationKey,saveVerifiedEstateDesign,startVerifiedEstateBuild,
 type EstateCosmetics,type EstateOwnerKind,type EstateSnapshot,type EstateTrack,type EstateWallet,
} from './estateProgressClient';
type Identity={kind:EstateOwnerKind;ownerId:string;track:EstateTrack};
type Props={identity:Identity|null;userId:string;design:EstateCosmetics;
 onVerified:(snapshot:EstateSnapshot)=>void;onApplyDesign:(design:EstateCosmetics)=>void};
const ZERO:EstateWallet={development_xp:0,timber:0,stone:0,metal:0};
const fmt=(n:number)=>Math.max(0,n).toLocaleString();
type IconName=React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const materialNames:readonly [keyof EstateWallet,string,IconName][]=[
 ['development_xp','Development XP','star-four-points-circle-outline'],
 ['timber','Timber','pine-tree'],
 ['stone','Stone','wall'],
 ['metal','Metal','anvil'],
];
export default function EstateConstructionConsole({identity,userId,design,onVerified,onApplyDesign}:Props){
 const kind=identity?.kind||'USER',ownerId=identity?.ownerId||'',track=identity?.track||'lot';
 const key=identity?kind+':'+ownerId+':'+track:'no-scope';
 const [verified,setVerified]=useState<EstateSnapshot|null>(null);
 const [personalWallet,setPersonalWallet]=useState<EstateWallet|null>(null);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [now,setNow]=useState(Date.now());
 const [showDonation,setShowDonation]=useState(false);
 const [donation,setDonation]=useState<EstateWallet>({...ZERO});
 const sequence=useRef(0);
 const actionSeq=useRef(0);
 const inFlight=useRef(false);
 const startKey=useRef<string|null>(null);
 const donationKey=useRef<string|null>(null);
 const onVerifiedRef=useRef(onVerified);
 const onApplyRef=useRef(onApplyDesign);
 useEffect(()=>{onVerifiedRef.current=onVerified;onApplyRef.current=onApplyDesign;},[onVerified,onApplyDesign]);
 const apply=(snapshot:EstateSnapshot)=>{setVerified(snapshot);onVerifiedRef.current(snapshot);setError('');};
 const refresh=useCallback(async()=>{
  const n=++sequence.current;
  if(!ownerId)return;
  setLoading(true);
  try{
   const id={kind,ownerId,track} as Identity;
   const [snapshot,mine]=await Promise.all([
    fetchVerifiedEstate(id),
    kind==='SCOPE'&&userId?fetchVerifiedEstate({kind:'USER',ownerId:userId,track:'lot'}).catch(()=>null):Promise.resolve(null),
   ]);
   if(n!==sequence.current)return;
   apply(snapshot);
   setPersonalWallet(mine?.wallet??null);
  }catch(e){
   if(n===sequence.current){setError(e instanceof Error?e.message:'Could not verify construction data.');setVerified(null);}
  }finally{if(n===sequence.current)setLoading(false);}
 },[kind,ownerId,track,userId]);
 useEffect(()=>{
  ++sequence.current;++actionSeq.current;inFlight.current=false;setBusy(false);
  setVerified(null);setPersonalWallet(null);setError('');setMessage('');
  startKey.current=null;donationKey.current=null;setDonation({...ZERO});
 },[key]);
 useFocusEffect(useCallback(()=>{void refresh();return()=>{++sequence.current;};},[refresh]));
 useEffect(()=>{
  if(!verified?.build_finish_at)return;
  const timer=setInterval(()=>setNow(Date.now()),15000);
  return()=>clearInterval(timer);
 },[verified?.build_finish_at]);
 const act=async(fn:()=>Promise<EstateSnapshot>,done:string)=>{
  if(inFlight.current||busy||loading)return;
  const request=++actionSeq.current;
  inFlight.current=true;setBusy(true);setMessage('');setError('');
  try{
    const snapshot=await fn();
    if(request!==actionSeq.current)return;
    apply(snapshot);setMessage(done);setNow(Date.now());
  }catch(e){
    if(request===actionSeq.current)setError(e instanceof Error?e.message:'Could not verify estate action.');
  }finally{
    if(request===actionSeq.current){inFlight.current=false;setBusy(false);}
  }
 };
 const start=()=>{if(!verified||!verified.can_build)return;
  if(!startKey.current)startKey.current=newEstateOperationKey();
  const operationKey=startKey.current;
  void act(async()=>{
   const snapshot=await startVerifiedEstateBuild({kind,ownerId,track},operationKey!);
   if(startKey.current===operationKey)startKey.current=null;
   return snapshot;
  },'Construction started. Verified materials were deducted once.');
 };
 const finish=()=>{if(!verified||!verified.can_build)return;
  void act(()=>completeVerifiedEstateBuild({kind,ownerId,track}),
   'Verified milestone completed and recorded.');
 };
 const save=()=>{if(!verified||!verified.can_build)return;
  void act(async()=>{
   const next=await saveVerifiedEstateDesign({kind,ownerId,track},design);
   onApplyRef.current(next.cosmetics);return next;
  },'Design saved to your account or scope.');
 };
 const donate=()=>{if(kind!=='SCOPE'||!ownerId||!userId||!personalWallet)return;
  const amount={...donation};
  if(materialNames.every(([k])=>amount[k]<=0))return;
  if(!materialNames.every(([k])=>Number.isSafeInteger(amount[k])&&amount[k]>=0&&amount[k]<=1000000))return;
  if(!donationKey.current)donationKey.current=newEstateOperationKey();
  const operationKey=donationKey.current;
  void act(async()=>{
   const next=await contributeVerifiedEstate(ownerId,operationKey!,amount);
   if(donationKey.current===operationKey)donationKey.current=null;
   const mine=await fetchVerifiedEstate({kind:'USER',ownerId:userId,track:'lot'}).catch(()=>null);
   setPersonalWallet(mine?.wallet??null);
   setDonation({...ZERO});return next;
  },'Earned materials transferred to your community. No BP was created.');
 };
 if(!ownerId)return <View style={styles.panel}><Text style={styles.title}>CONSTRUCTION CONTROL</Text><Text style={styles.hint}>Choose an active verified Cluster or Organization first.</Text></View>;
 const cost=verified?.next_cost??null;
 const readyAt=verified?.build_finish_at?Date.parse(verified.build_finish_at):0;
 const timeLeft=Math.max(0,Math.ceil((readyAt-now)/60000));
 const constructing=Boolean(verified?.pending_key);
 const ready=constructing&&Number.isFinite(readyAt)&&readyAt>0&&readyAt<=now;
 const afford=Boolean(verified&&cost&&enoughEstateMaterials(verified.wallet,cost));
 const activeDisabled=busy||!verified?.can_build||(constructing?!ready:!afford);
 return <View style={styles.panel}>
   <View style={styles.heading}>
    <View style={styles.headingText}>
     <Text style={styles.title}>MY ESTATE · VERIFIED PROGRESS</Text>
     <Text style={styles.hint}>Separate from Circle Rank, BP, QMP and character rewards</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh verified estate progress"
      onPress={()=>void refresh()} disabled={busy||loading} style={styles.refresh}>
     <MaterialCommunityIcons name="refresh" size={21} color="#FFE9C3"/>
    </Pressable>
   </View>
   {loading&&!verified?<View style={styles.center}><ActivityIndicator color="#FFE2A3"/><Text style={styles.hint}>Checking server records…</Text></View>:null}
   {!!error?<View style={styles.error}><MaterialCommunityIcons name="shield-alert-outline" size={17} color="#FFE1B8"/><Text style={styles.errorText}>{error}</Text></View>:null}
   {!!message?<Text style={styles.success}>{message}</Text>:null}
   {verified?<React.Fragment>
    <View style={styles.progressHead}>
     <View style={styles.levelSeal}><MaterialCommunityIcons name="home-city" color="#FFE5AE" size={26}/></View>
     <View style={{flex:1,minWidth:0}}>
      <Text style={styles.earnedTitle}>{track.toUpperCase()+' · LEVEL '+verified.level+(verified.mastery>0?' · MASTERY '+fmt(verified.mastery):'')}</Text>
      <Text style={styles.hint}>{'Milestone '+(verified.stage+1)+' of 5 · '+(constructing?'Building':'Ready for next stage')}</Text>
     </View>
     <MaterialCommunityIcons name="check-decagram" size={20} color="#BFE7BA"/>
    </View>
    <View style={styles.progressTrack}><View style={[styles.progressFill,{width:String(Math.max(2,verified.stage/5*100))+'%' as any}]}/></View>
    <Text style={styles.section}>VERIFIED MATERIALS</Text>
    <View style={styles.materials}>
     {materialNames.map(([field,label,icon])=><View key={field} style={styles.material}>
      <MaterialCommunityIcons name={icon} size={18} color="#D2E4B1"/>
      <Text style={styles.materialValue}>{fmt(verified.wallet[field])}</Text>
      <Text style={styles.materialName}>{label}</Text>
     </View>)}
    </View>
    {cost?<View style={styles.cost}>
      <View style={styles.costHead}><Text style={styles.section}>{constructing?'CONSTRUCTION TIMER':'NEXT REQUIRED MATERIALS'}</Text><Text style={styles.small}>{cost.build_minutes+' min build'}</Text></View>
      {constructing?<Text style={styles.timer}>{ready?'Construction complete — claim progress':timeLeft+' min remaining · server verified'}</Text>:
       <Text style={styles.costText}>{fmt(cost.development_xp)+' XP · '+fmt(cost.timber)+' timber · '+fmt(cost.stone)+' stone · '+fmt(cost.metal)+' metal'}</Text>}
     </View>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={constructing?'Finish ready construction':'Start verified construction'}
      disabled={activeDisabled} onPress={constructing?finish:start}
      style={[styles.primary,activeDisabled&&styles.disabled]}>
      {busy?<ActivityIndicator color="#152E2C"/>:<MaterialCommunityIcons name={constructing?'check-circle-outline':'hammer-wrench'} size={19} color="#17362F"/>}
      <Text style={styles.primaryText}>{constructing?(ready?'CLAIM COMPLETED STAGE':'CONSTRUCTION IN PROGRESS'):'BUILD NEXT MILESTONE'}</Text>
    </Pressable>
    {!verified.can_build?<Text style={styles.notice}>View only. Construction and design require verified ownership or scope administrator authority.</Text>
     :!constructing&&!afford?<Text style={styles.notice}>Earn verified materials through BUKLOD participation. Scope members may also contribute materials to community development.</Text>:null}
    <Pressable accessibilityRole="button" accessibilityLabel="Save exterior customization to your account or scope"
      onPress={save} disabled={busy||!verified.can_build} style={[styles.secondary,(busy||!verified.can_build)&&styles.disabled]}>
     <MaterialCommunityIcons name="content-save-check-outline" size={18} color="#FFE5B5"/>
     <Text style={styles.secondaryText}>SAVE DESIGN TO SERVER</Text>
    </Pressable>
    <Text style={styles.notice}>Blueprint previews do not grant upgrades. Only verified construction changes permanent level records.</Text>
    {kind==='SCOPE'?<View style={styles.donation}>
     <Pressable accessibilityRole="button" onPress={()=>setShowDonation(v=>!v)} style={styles.costHead}>
       <Text style={styles.section}>BAYANIHAN · SHARE YOUR EARNED MATERIALS</Text>
       <MaterialCommunityIcons name={showDonation?'chevron-up':'chevron-down'} size={21} color="#F3DDA8"/>
     </Pressable>
     {showDonation?<React.Fragment>
      <Text style={styles.hint}>{personalWallet?'Your earned balance: '+materialNames.map(([field,label])=>label+' '+fmt(personalWallet[field])).join(' · '):'Personal wallet unavailable. Transfers require verification.'}</Text>
      <View style={styles.donationGrid}>
       {materialNames.map(([field,label])=><View key={field} style={styles.donationField}>
        <Text style={styles.small}>{label}</Text>
        <TextInput keyboardType="number-pad" accessibilityLabel={'Donate '+label}
         value={donation[field]?String(donation[field]):''} placeholder="0" placeholderTextColor="#9DB4A8"
         onChangeText={value=>{donationKey.current=null;const num=Number(value.replace(/[^0-9]/g,''));setDonation(prev=>({...prev,[field]:Math.min(1000000,Number.isSafeInteger(num)?num:0)}));}}
         style={styles.input}/>
       </View>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Transfer earned resources to this scope"
       onPress={donate} disabled={busy||!personalWallet||!materialNames.every(([k])=>donation[k]<=personalWallet[k])||materialNames.every(([k])=>donation[k]===0)}
       style={[styles.secondary,(busy||!personalWallet||!materialNames.every(([k])=>donation[k]<=personalWallet[k])||materialNames.every(([k])=>donation[k]===0))&&styles.disabled]}>
        <MaterialCommunityIcons name="hand-heart-outline" size={18} color="#FFE5B5"/><Text style={styles.secondaryText}>CONTRIBUTE VERIFIED MATERIALS</Text>
      </Pressable>
     </React.Fragment>:null}
    </View>:null}
   </React.Fragment>:null}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderRadius:16,backgroundColor:'#152C34',borderWidth:1,borderColor:'#668B7D',gap:9},
 heading:{flexDirection:'row',alignItems:'center',gap:8},headingText:{flex:1,minWidth:0},
 title:{color:'#FFE6B7',fontWeight:'900',fontSize:15},
 hint:{color:'#C6D9CD',fontSize:11,lineHeight:16},small:{color:'#B9D5C3',fontSize:10},
 section:{color:'#E9D9AF',fontWeight:'900',fontSize:11},
 refresh:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:'#2E5147'},
 center:{minHeight:65,gap:8,alignItems:'center',justifyContent:'center'},
 error:{flexDirection:'row',gap:7,alignItems:'flex-start',padding:8,borderRadius:8,backgroundColor:'#603A34'},
 errorText:{flex:1,color:'#FFF0DC',fontSize:11,lineHeight:16},
 success:{fontWeight:'700',fontSize:11,color:'#B7F0D1'},
 progressHead:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#203E3A',padding:9,borderRadius:12},
 levelSeal:{height:43,width:43,alignItems:'center',justifyContent:'center',backgroundColor:'#425D4B',borderRadius:11},
 earnedTitle:{fontSize:13,fontWeight:'900',color:'#FFF0CC'},
 progressTrack:{height:6,overflow:'hidden',backgroundColor:'#284849',borderRadius:6},
 progressFill:{height:'100%',backgroundColor:'#E6D08F',borderRadius:6},
 materials:{flexDirection:'row',gap:5},
 material:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',gap:3,paddingVertical:9,paddingHorizontal:2,borderRadius:10,backgroundColor:'#244443'},
 materialValue:{fontSize:13,fontWeight:'900',color:'#FFF5D9'},
 materialName:{fontSize:9,color:'#D5DFD1',textAlign:'center'},
 cost:{gap:6,backgroundColor:'#1A383B',padding:9,borderRadius:10},
 costHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:6},
 costText:{fontSize:12,color:'#FFF0CF',fontWeight:'700',lineHeight:19},
 timer:{fontSize:12,color:'#EED5A2',fontWeight:'900'},
 primary:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,minHeight:47,borderRadius:11,backgroundColor:'#DCEAB2'},
 primaryText:{fontSize:12,fontWeight:'900',color:'#17362F'},
 secondary:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,minHeight:44,borderRadius:10,borderWidth:1,borderColor:'#8DA98D',backgroundColor:'#2C4B43'},
 secondaryText:{fontWeight:'900',fontSize:11,color:'#FFF1D2'},
 disabled:{opacity:.42},
 notice:{fontSize:10,lineHeight:15,color:'#B7D1C5'},
 donation:{borderTopWidth:1,borderTopColor:'#496A5D',paddingTop:9,gap:8},
 donationGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},
 donationField:{flexBasis:'47%',flexGrow:1,gap:4},
 input:{height:41,paddingHorizontal:9,borderRadius:9,borderColor:'#6F9786',borderWidth:1,backgroundColor:'#0F2830',color:'#FFF5E2',fontSize:13},
});
