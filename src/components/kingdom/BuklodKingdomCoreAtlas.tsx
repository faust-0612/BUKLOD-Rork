/** BUKLOD Kingdom Core Atlas: owner-supplied 120-item artwork, no earned entitlement implied. */
import React,{useMemo,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {CORE_ATLAS_ART,CORE_ATLAS_CELL} from '@/lib/buklodKingdomCoreAtlasArt';
import {KINGDOM_CORE_CLASSES,coreAtlasItem} from '@/lib/buklodKingdomCoreAtlas';

const K={navy:'#0b2232',green:'#103f37',gold:'#efcb84',white:'#f5fff2',muted:'#bed9cf',mint:'#a8f2b6'};
const ITEM_W=112;
const ITEM_H=ITEM_W*CORE_ATLAS_CELL.height/CORE_ATLAS_CELL.width;
const SCALE=ITEM_W/CORE_ATLAS_CELL.width;
function ItemArtwork({classId,index}:{classId:string;index:number}){
 const art=CORE_ATLAS_ART[classId];
 if(!art)return <View style={s.artError}><MaterialCommunityIcons name="image-off-outline" size={22} color={K.gold}/></View>;
 return <View style={s.artFrame} accessibilityLabel={'Reference artwork item '+(index+1)}>
   <Image source={art} resizeMode="stretch" style={{
      position:'absolute',width:CORE_ATLAS_CELL.columns*ITEM_W,
      height:CORE_ATLAS_CELL.rows*ITEM_H,
      left:-(index%CORE_ATLAS_CELL.columns)*ITEM_W,
      top:-Math.floor(index/CORE_ATLAS_CELL.columns)*ITEM_H,
   }}/>
 </View>;
}
export default function BuklodKingdomCoreAtlas(){
 const [classId,setClassId]=useState('armor');
 const [itemIndex,setItemIndex]=useState(0);
 const group=useMemo(()=>KINGDOM_CORE_CLASSES.find(x=>x.id===classId)??KINGDOM_CORE_CLASSES[0],[classId]);
 const selected=coreAtlasItem(group.id,itemIndex);
 return <View style={s.root}>
  <LinearGradient colors={['#194d40','#0d303b','#112839']} style={s.header}>
   <Text style={s.eyebrow}>BUKLOD KINGDOM · OFFICIAL ART LIBRARY</Text>
   <Text style={s.headerTitle}>20 Classes · 120 Designs</Text>
   <Text style={s.lead}>Piliin ang class at item para malaman kung paano ito kukunin, saan gagamitin, at kung puwede itong i-trade kapag aktibo na ang verified inventory.</Text>
   <View style={s.policy}><MaterialCommunityIcons name="shield-check-outline" color={K.mint} size={19}/><Text style={s.policyText}>Artwork verified from your Library. Gameplay unlocks and cross-user trades are not yet enabled.</Text></View>
  </LinearGradient>
  <Text style={s.sub}>PUMILI NG CLASS</Text>
  <View style={s.classes}>
   {KINGDOM_CORE_CLASSES.map(c=><Pressable accessibilityRole="button" accessibilityState={{selected:c.id===group.id}} key={c.id}
    onPress={()=>{setClassId(c.id);setItemIndex(0)}} style={[s.chip,c.id===group.id&&s.chipSelected]}>
     <Text numberOfLines={2} style={[s.chipText,c.id===group.id&&s.chipTextSelected]}>{c.displayName.replace(' Class','')}</Text>
   </Pressable>)}
  </View>
  <Text style={s.sub}>{group.displayName.toUpperCase()}</Text>
  <View style={s.grid}>
   {group.items.map((name,i)=><Pressable accessibilityRole="button" accessibilityState={{selected:itemIndex===i}} key={name}
    accessibilityLabel={name+', item requirements and use'} onPress={()=>setItemIndex(i)}
    style={[s.item,itemIndex===i&&s.itemSelected]}>
    <ItemArtwork classId={group.id} index={i}/>
    <Text style={s.itemName} numberOfLines={2}>{name}</Text>
   </Pressable>)}
  </View>
  <LinearGradient colors={['#224b40','#153b38','#10303b']} style={s.detail}>
   <View style={s.detailHead}><MaterialCommunityIcons name="diamond-stone" size={28} color={K.gold}/>
     <View style={{flex:1}}><Text style={s.eyebrow}>ITEM GUIDE</Text><Text style={s.detailTitle}>{selected.name}</Text></View>
   </View>
   <Text style={s.detailLabel}>PAANO MAKUKUHA (PROPOSED)</Text>
   <Text style={s.detailCopy}>{selected.requirement}</Text>
   <Text style={s.detailLabel}>SAAN GAGAMITIN</Text>
   <Text style={s.detailCopy}>{selected.usage}</Text>
   <Text style={s.detailLabel}>TRADE / CRAFT STATUS</Text>
   <Text style={s.detailCopy}>Hindi pa tradeable o claimable. Ang pagkakakuha ng aktuwal na item ay mangangailangan ng server-verified achievement at transaction receipt. Earned badges, unique story equipment, Shards at financial balances ay hindi ililipat sa ibang user.</Text>
   <Pressable accessibilityRole="button" style={s.adventureButton} onPress={()=>router.push('/games/character-experience' as any)}>
     <Text style={s.adventureButtonText}>OPEN CHARACTER ADVENTURE</Text><MaterialCommunityIcons name="chevron-right" size={20} color="#062e27"/>
   </Pressable>
  </LinearGradient>
 </View>;
}
const s=StyleSheet.create({
 root:{gap:12},header:{padding:15,gap:9,borderRadius:18,borderWidth:1,borderColor:'#6aaf88'},
 eyebrow:{color:K.mint,fontSize:10,fontWeight:'900',letterSpacing:.8},headerTitle:{color:K.white,fontSize:21,fontWeight:'900'},
 lead:{color:K.muted,fontSize:11,lineHeight:18},policy:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#163f39',padding:9,borderRadius:10},policyText:{flex:1,color:K.white,fontSize:10,lineHeight:15},
 sub:{color:K.gold,fontSize:12,fontWeight:'900',letterSpacing:.7},classes:{flexDirection:'row',flexWrap:'wrap',gap:6},
 chip:{width:'23.5%',minHeight:43,alignItems:'center',justifyContent:'center',paddingHorizontal:5,backgroundColor:K.navy,borderColor:'#43695f',borderWidth:1,borderRadius:9},
 chipSelected:{backgroundColor:'#aee9a8',borderColor:'#d1ffc8'},chipText:{color:K.white,textAlign:'center',fontSize:10,fontWeight:'800'},chipTextSelected:{color:'#113b2d'},
 grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:6},item:{width:'48%',padding:6,backgroundColor:'#11353a',borderColor:'#4a7463',borderWidth:1,borderRadius:12,alignItems:'center',gap:5},itemSelected:{borderColor:K.gold,backgroundColor:'#255346'},
 artFrame:{width:ITEM_W,height:ITEM_H,borderRadius:8,overflow:'hidden',backgroundColor:'#12352b'},artError:{width:ITEM_W,height:ITEM_H,alignItems:'center',justifyContent:'center'},
 itemName:{color:K.white,fontSize:11,fontWeight:'900',textAlign:'center',lineHeight:14,minHeight:28},
 detail:{padding:14,gap:8,borderRadius:16,borderWidth:1,borderColor:'#86c2a5'},
 detailHead:{flexDirection:'row',gap:9,alignItems:'center'},detailTitle:{color:K.white,fontSize:17,fontWeight:'900'},
 detailLabel:{color:K.gold,fontSize:10,letterSpacing:.5,fontWeight:'900',marginTop:4},detailCopy:{color:'#ebf8ee',fontSize:12,lineHeight:18},
 adventureButton:{minHeight:44,backgroundColor:K.mint,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:12,marginTop:4},
 adventureButtonText:{color:'#082f27',fontSize:11,fontWeight:'900'},
});
