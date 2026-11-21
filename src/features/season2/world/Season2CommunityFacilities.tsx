/**
 * Complete neighborhood feature index. This is a compact DISCOVERY explorer,
 * not an asset registry or permission substitute. Permissioned real routes
 * are controlled by their destination screens; planned rows never navigate.
 */
import React,{useMemo,useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,TextInput,useWindowDimensions,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {communityFacilitySummary,getCommunityZones,listCommunityFacilities} from './communityFacilityDirectory.mjs';

type World='home'|'village';
type IconName=React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const BATCH=12;
export default function Season2CommunityFacilities({world}:{world:World}){
 const {width}=useWindowDimensions();
 const {activeScope}=useBuklodScope();
 const showFaith=Boolean(activeScope?.show_faith_content);
 const [expanded,setExpanded]=useState(false);
 const [zone,setZone]=useState('all');
 const [query,setQuery]=useState('');
 const [limit,setLimit]=useState(BATCH);
 const [onlyLinked,setOnlyLinked]=useState(false);
 const lastNavigation=useRef(0);
 const zones=useMemo(()=>getCommunityZones(world,showFaith),[world,showFaith]);
 const stats=useMemo(()=>communityFacilitySummary(world,showFaith),[world,showFaith]);
 const activeZone=zone==='all'||zones.some(z=>z.id===zone)?zone:'all';
 const all=useMemo(()=>expanded?listCommunityFacilities({world,zone:activeZone,query,showFaith}):[],
  [expanded,world,activeZone,query,showFaith]);
 const results=useMemo(()=>onlyLinked?all.filter(v=>v.status==='linked'):all,[all,onlyLinked]);
 const cards=results.slice(0,limit);
 const open=(route:string|null)=>{
  if(!route)return;
  const now=Date.now();
  if(now-lastNavigation.current<600)return;
  lastNavigation.current=now;
  router.push(route as any);
 };
 return <View style={styles.shell}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded}}
   accessibilityLabel={expanded?'Hide neighborhood facilities':'Explore neighborhood facilities'}
   onPress={()=>setExpanded(x=>!x)} style={styles.header}>
   <View style={styles.headerIcon}><MaterialCommunityIcons name={world==='home'?'home-group':'city-variant-outline'}
    size={23} color="#F6DEAF"/></View>
   <View style={{flex:1,minWidth:0}}>
    <Text style={styles.title}>{world==='home'?'Explore Your Home':'Explore The Village'}</Text>
    <Text style={styles.subtitle}>{stats.total} destinations · {stats.linked} linked · {stats.planned} future</Text>
   </View>
   <MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={22} color="#F5D9A7"/>
  </Pressable>
  {expanded?<View style={styles.body}>
   <Text style={styles.helper}>Tuklasin ang mga lugar at serbisyo. Existing features open in one tap. Future areas are shown as plans only.</Text>
   <View style={styles.searchRow}>
    <MaterialCommunityIcons name="magnify" size={20} color="#A5C9B8"/>
    <TextInput value={query} onChangeText={value=>{setQuery(value);setLimit(BATCH);}}
     accessibilityLabel="Find community facility" placeholder="Search bahay, garden, school, market…"
     placeholderTextColor="#9EBAB0" maxLength={80} style={styles.input} autoCorrect={false}/>
   </View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
    contentContainerStyle={styles.filters}>
    {[{id:'all',title:'All places'},...zones].map(z=>
     <Pressable key={z.id} accessibilityRole="button" accessibilityState={{selected:activeZone===z.id}}
      onPress={()=>{setZone(z.id);setLimit(BATCH);}} style={[styles.filter,activeZone===z.id&&styles.filterActive]}>
      <Text style={[styles.filterLabel,activeZone===z.id&&styles.filterLabelActive]}>{z.title}</Text>
     </Pressable>)}
   </ScrollView>
   <Pressable onPress={()=>{setOnlyLinked(v=>!v);setLimit(BATCH);}}
    accessibilityRole="checkbox" accessibilityState={{checked:onlyLinked}} style={styles.linkedFilter}>
    <MaterialCommunityIcons name={onlyLinked?'checkbox-marked-circle':'checkbox-blank-circle-outline'} size={19} color="#BDE6B6"/>
    <Text style={styles.linkedText}>Show available destinations only</Text>
    <Text style={styles.count}>{results.length}</Text>
   </Pressable>
   <View style={styles.cards}>{cards.map(item=>{
    const parent=zones.find(z=>z.id===item.zone);
    const available=item.status==='linked'&&!!item.route;
    return <Pressable key={item.id} accessibilityRole="button" disabled={!available}
      accessibilityLabel={item.label+(available?', linked feature':', planned only')}
      accessibilityHint={available?'Open existing feature':'This service is not yet available'}
      onPress={()=>open(item.route)}
      style={[styles.card,width>=540&&styles.cardTwo, !available&&styles.cardPlanned]}>
      <View style={styles.cardTop}>
       <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={(parent?.icon||'map-marker-outline') as IconName} size={22} color="#F3DFAF"/>
       </View>
       <View style={{flex:1,minWidth:0}}>
        <Text style={styles.cardName} numberOfLines={2}>{item.label}</Text>
        <Text style={[styles.cardStatus,!available&&styles.plannedStatus]}>{available?'OPEN EXISTING FEATURE':'FUTURE FEATURE'}</Text>
       </View>
       {available?<MaterialCommunityIcons name="arrow-top-right" size={18} color="#F1D9AD"/>:
        <MaterialCommunityIcons name="lock-clock" size={17} color="#A8BAA7"/>}
      </View>
      <Text style={styles.cardDescription} numberOfLines={3}>{item.description}</Text>
     </Pressable>
   })}</View>
   {results.length===0?<Text style={styles.helper}>No matching facility. Change the keyword or select All places.</Text>:null}
   {results.length>limit?<Pressable accessibilityRole="button" style={styles.more}
    onPress={()=>setLimit(x=>x+BATCH)}><Text style={styles.moreText}>See more places</Text>
    <MaterialCommunityIcons name="chevron-down" size={17} color="#EAD9B4"/></Pressable>:null}
  </View>:null}
 </View>;
}
const styles=StyleSheet.create({
 shell:{backgroundColor:'#122F32',borderRadius:16,borderWidth:1,borderColor:'#4B756C',overflow:'hidden'},
 header:{flexDirection:'row',minHeight:66,paddingHorizontal:12,paddingVertical:9,gap:9,alignItems:'center'},
 headerIcon:{height:44,width:44,borderRadius:13,backgroundColor:'#26514A',alignItems:'center',justifyContent:'center'},
 title:{color:'#FFE8BA',fontWeight:'900',fontSize:16},
 subtitle:{color:'#BFDBCA',fontSize:11,marginTop:3},
 body:{gap:10,paddingHorizontal:12,paddingBottom:14},
 helper:{fontSize:11,color:'#BDD6D0',lineHeight:16},
 searchRow:{minHeight:44,borderRadius:10,backgroundColor:'#0A242A',borderWidth:1,
  borderColor:'#52786D',flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:11},
 input:{flex:1,color:'#FAF7ED',fontSize:12,minWidth:0},
 filters:{gap:6,paddingVertical:2},
 filter:{minHeight:36,borderRadius:18,borderWidth:1,borderColor:'#52766B',
  paddingHorizontal:12,alignItems:'center',justifyContent:'center',backgroundColor:'#213F43'},
 filterActive:{backgroundColor:'#CDE5B0',borderColor:'#DCECB6'},
 filterLabel:{fontSize:11,color:'#EAF0DC',fontWeight:'700'},
 filterLabelActive:{color:'#244333'},
 linkedFilter:{flexDirection:'row',alignItems:'center',gap:8,minHeight:32,paddingHorizontal:3},
 linkedText:{color:'#D5E3D2',fontWeight:'700',fontSize:11,flex:1},
 count:{color:'#E3D2A9',fontWeight:'900',fontSize:11},
 cards:{flexDirection:'row',flexWrap:'wrap',gap:8},
 card:{minWidth:0,width:'100%',borderWidth:1,borderColor:'#54756D',backgroundColor:'#214044',
  borderRadius:13,padding:11,gap:7},
 cardTwo:{width:'48.8%'},
 cardPlanned:{opacity:.76},
 cardTop:{flexDirection:'row',alignItems:'flex-start',gap:8},
 iconCircle:{width:36,height:36,borderRadius:10,backgroundColor:'#315B51',
  alignItems:'center',justifyContent:'center'},
 cardName:{color:'#FFF2D4',fontWeight:'900',fontSize:12,lineHeight:16},
 cardStatus:{color:'#A9E8BE',fontSize:8,fontWeight:'900',marginTop:3},
 plannedStatus:{color:'#EDCFA4'},
 cardDescription:{color:'#D0E0D7',fontSize:11,lineHeight:15},
 more:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,minHeight:43,
  backgroundColor:'#2A574B',borderRadius:11},
 moreText:{color:'#F8E6BC',fontSize:12,fontWeight:'900'},
});
