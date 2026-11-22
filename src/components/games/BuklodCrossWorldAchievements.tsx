/**
 * Single compact, opt-in cross-world receipt surface for Kingdom/House/Arena.
 * Zero first-paint network work, no advertisements, no auto-mint, and no
 * claims that a display receipt is equipped inventory.
 */
import React, {useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useAuth} from '@/providers/AuthProvider';
import {
  CROSS_WORLD_COSMETIC_CATALOG,
  claimMyBuklodCrossWorldCosmetics,getMyBuklodCrossWorldCosmetics,
  type BuklodCrossWorldDestination,type BuklodCrossWorldSnapshot,
} from '@/lib/buklodCrossWorldCosmetics';

export default function BuklodCrossWorldAchievements({
  world,
}:Readonly<{world:BuklodCrossWorldDestination}>){
  const {user}=useAuth();
  const userId=user?.id??'';
  const [expanded,setExpanded]=useState(false);
  const [snapshot,setSnapshot]=useState<BuklodCrossWorldSnapshot|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    setSnapshot(null);setError('');setExpanded(false);
  },[userId]);

  useEffect(()=>{
    if(!expanded||!userId)return;
    let active=true;
    setBusy(true);
    void getMyBuklodCrossWorldCosmetics(userId).then(next=>{
      if(active)setSnapshot(next);
    }).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[expanded,userId]);

  const sync=async()=>{
    if(!userId||busy)return;
    setBusy(true);setError('');
    try{
      const next=await claimMyBuklodCrossWorldCosmetics(userId);
      setSnapshot(next);
    }catch{
      setError('Could not verify rewards. Nothing was granted locally.');
    }finally{setBusy(false);}
  };
  const owned=snapshot?.status==='verified'
    ?snapshot.items.filter(item=>item.destination===world):[];
  return <View style={s.shell}>
    <Pressable accessibilityRole="button"
      accessibilityLabel={expanded?'Hide verified cross-world achievements':'Show verified cross-world achievements'}
      onPress={()=>setExpanded(v=>!v)} style={s.toggle}>
      <MaterialCommunityIcons name="trophy-outline" size={17} color="#E7D69E"/>
      <Text style={s.title}>CROSS-WORLD ACHIEVEMENTS</Text>
      <MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={18} color="#E7D69E"/>
    </Pressable>
    {expanded?<View style={s.body}>
      <Text style={s.note}>Server-verified Kingdom checks unlock display-only House / Arena showcase cosmetics. No BP, Diamonds, combat stats or tradable items.</Text>
      {!userId?<Text style={s.note}>Sign in to verify your achievements.</Text>:null}
      {busy?<ActivityIndicator color="#E4D7A1" size="small"/>:null}
      {userId&&snapshot?.status==='verified'?<>
        <Text style={s.count}>Verified Kingdom checks: {snapshot.verifiedChecks} · Showcase unlocks: {snapshot.items.length}</Text>
        {owned.length?owned.map(item=><View style={s.ownedRow} key={item.key}>
          <MaterialCommunityIcons name="check-decagram" size={15} color="#A6F6C9"/>
          <Text style={s.ownedText}>{CROSS_WORLD_COSMETIC_CATALOG[item.key].name} · Verified showcase</Text>
        </View>):<Text style={s.note}>No verified showcase unlock in this world yet.</Text>}
      </>:userId&&!busy?<Text style={s.note}>Receipt server not yet available on this environment. No rewards were assumed.</Text>:null}
      {!!error?<Text style={s.error}>{error}</Text>:null}
      {userId?<Pressable accessibilityRole="button" accessibilityLabel="Verify and sync earned showcase achievements"
        disabled={busy} onPress={()=>void sync()} style={[s.sync,busy&&{opacity:.6}]}>
        <MaterialCommunityIcons name="shield-check-outline" size={15} color="#16362C"/>
        <Text style={s.syncText}>VERIFY / SYNC ACHIEVEMENTS</Text>
      </Pressable>:null}
      <Text style={s.note}>House construction and ranked Arena results have separate authorities; this panel does not grant either. Full decorations require verified catalog art.</Text>
    </View>:null}
  </View>;
}

const s=StyleSheet.create({
  shell:{backgroundColor:'#102E35',borderWidth:1,borderColor:'#6F9B8C',borderRadius:10,marginVertical:5,overflow:'hidden'},
  toggle:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,minHeight:39},
  title:{flex:1,color:'#F3EAC9',fontSize:11,fontWeight:'800',letterSpacing:.3},
  body:{paddingHorizontal:10,paddingBottom:10,gap:7},
  note:{fontSize:10,color:'#C7DAD1',lineHeight:15},
  count:{fontSize:11,color:'#E9F8CF',fontWeight:'800'},
  ownedRow:{flexDirection:'row',alignItems:'center',gap:7},
  ownedText:{color:'#E9F8CF',fontSize:11,flex:1},
  error:{color:'#FFE1C9',fontSize:10},
  sync:{backgroundColor:'#ADDCC4',paddingHorizontal:10,minHeight:36,borderRadius:8,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  syncText:{fontWeight:'800',color:'#16362C',fontSize:10},
});
