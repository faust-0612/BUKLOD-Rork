/** Optional coverage explorer beneath the Village/Home scene, never above the approved world map.
 * Linked cards navigate once to established feature routes; planned facilities cannot trigger writes.
 */
import React,{useMemo,useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {communityFacilitySummary,getCommunityZones,listCommunityFacilities} from './communityFacilityDirectory.mjs';
type World='village'|'home';
const PAGE_SIZE=16;
export default function Season2CommunityFacilities({world}:{world:World}) {
  const {activeScope}=useBuklodScope();
  const showFaith=Boolean(activeScope?.show_faith_content);
  const [expanded,setExpanded]=useState(false);
  const [zone,setZone]=useState('all');
  const [query,setQuery]=useState('');
  const [limit,setLimit]=useState(PAGE_SIZE);
  const lastNavigation=useRef(0);
  const zones=useMemo(()=>getCommunityZones(world,showFaith),[world,showFaith]);
  const stats=useMemo(()=>communityFacilitySummary(world,showFaith),[world,showFaith]);
  const validZone=zone==='all'||zones.some(z=>z.id===zone)?zone:'all';
  const results=useMemo(()=>expanded?listCommunityFacilities({world,zone:validZone,query,showFaith}):[],[expanded,world,validZone,query,showFaith]);
  const visible=results.slice(0,limit);
  const selectZone=(next:string)=>{setZone(next);setLimit(PAGE_SIZE);};
  const openLinked=(route:string|null)=>{
    if(!route)return; // planned features may never navigate or mutate state.
    const now=Date.now();
    if(now-lastNavigation.current<650)return;
    lastNavigation.current=now;
    router.push(route as any); // existing destination handles scope and authorization.
  };
  return <View style={styles.panel}>
    <Pressable accessibilityRole="button"
      accessibilityLabel={expanded?'Close community facilities directory':'Explore all community facilities'}
      accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)} style={styles.heading}>
      <View style={styles.titleArea}>
        <Text style={styles.title}>{world==='village'?'VILLAGE FACILITIES & SERVICES':'PERSONAL HOME FACILITIES'}</Text>
        <Text style={styles.subtitle}>{stats.total} mapped facilities · {stats.linked} linked · {stats.planned} planned</Text>
      </View>
      <MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={23} color="#FFE4AC"/>
    </Pressable>
    {expanded ? <>
      <Text style={styles.note}>Linked = opens an existing BUKLOD feature, not a claim that every service is fully launched. Planned = information only, no fake building or payment.</Text>
      <TextInput accessibilityLabel="Search community facilities" maxLength={80}
        value={query} onChangeText={value=>{setQuery(value);setLimit(PAGE_SIZE);}}
        placeholder="Hanapin: paaralan, kalsada, health, tulong..." placeholderTextColor="#9BB5AC"
        style={styles.input} autoCorrect={false} returnKeyType="search"/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.zones} keyboardShouldPersistTaps="handled">
        {[{id:'all',title:'All areas'},...zones].map(item=>(
          <Pressable key={item.id} accessibilityRole="button"
            accessibilityLabel={'Show '+item.title} accessibilityState={{selected:validZone===item.id}}
            style={[styles.chip,validZone===item.id&&styles.chipSelected]}
            onPress={()=>selectZone(item.id)}>
            <Text style={[styles.chipText,validZone===item.id&&styles.chipTextSelected]}>{item.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.counter}>{results.length} matching facilities{results.length>limit?' · first '+limit+' displayed':''}</Text>
      {visible.map(item=>(
        <View key={item.id} style={styles.facility}>
          <View style={styles.facilityBody}>
            <Text style={styles.facilityTitle}>{item.label}</Text>
            <Text style={styles.facilityDesc}>{item.description}</Text>
            <Text style={item.status==='planned'?styles.planned:styles.linked}>
              {item.status==='planned'?'PLANNED · not available':'EXISTING ROUTE · feature permissions apply'}
            </Text>
          </View>
          {item.status==='linked'&&item.route ? (
            <Pressable accessibilityRole="button" accessibilityLabel={'Open '+item.label}
              accessibilityHint="Opens the existing authorized feature in one tap"
              style={styles.open} onPress={()=>openLinked(item.route)}>
              <MaterialCommunityIcons name="arrow-right" size={23} color="#FFE8B5"/>
            </Pressable>
          ):<MaterialCommunityIcons name="lock-clock" size={20} color="#94B2A7"/>}
        </View>
      ))}
      {results.length===0?<Text style={styles.note}>Walang tugmang facility. Subukang ibang salita o All areas.</Text>:null}
      {results.length>limit?<Pressable accessibilityRole="button"
        accessibilityLabel="Show more matching facilities" style={styles.more}
        onPress={()=>setLimit(v=>v+PAGE_SIZE)}>
        <Text style={styles.moreText}>MORE FACILITIES</Text>
      </Pressable>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  panel:{backgroundColor:'#112B30',borderWidth:1,borderColor:'#62847B',borderRadius:15,padding:11,gap:8},
  heading:{flexDirection:'row',alignItems:'center',minHeight:48,gap:7},
  titleArea:{flex:1,minWidth:0,gap:3},
  title:{fontSize:13,fontWeight:'900',color:'#FFE8B5'},
  subtitle:{fontSize:11,color:'#C6DED7'},
  note:{fontSize:11,lineHeight:17,color:'#D2E4DF'},
  input:{minHeight:45,backgroundColor:'#0B2027',borderRadius:11,borderWidth:1,borderColor:'#6A8A81',color:'#FFFFFF',fontSize:13,paddingHorizontal:11},
  zones:{gap:7,paddingVertical:2},
  chip:{paddingVertical:8,paddingHorizontal:11,borderRadius:18,borderWidth:1,borderColor:'#617B76',backgroundColor:'#17333A',minHeight:38,justifyContent:'center'},
  chipSelected:{backgroundColor:'#D8EAB4',borderColor:'#D8EAB4'},
  chipText:{fontSize:11,color:'#F3F5E8',fontWeight:'700'},
  chipTextSelected:{color:'#153C33'},
  counter:{color:'#A8CABC',fontSize:10,fontWeight:'800'},
  facility:{borderTopWidth:StyleSheet.hairlineWidth,borderColor:'#637E79',paddingVertical:9,minHeight:60,flexDirection:'row',alignItems:'center',gap:10},
  facilityBody:{flex:1,minWidth:0,gap:3},
  facilityTitle:{fontWeight:'800',color:'#FFFFFF',fontSize:13},
  facilityDesc:{color:'#CFDED8',fontSize:11,lineHeight:15},
  linked:{fontSize:9,color:'#A3E0C7',fontWeight:'800'},
  planned:{fontSize:9,color:'#E6CE9C',fontWeight:'800'},
  open:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:'#2A564E'},
  more:{minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:'#275348',borderRadius:10},
  moreText:{color:'#FFE5B3',fontWeight:'900',fontSize:12},
});
