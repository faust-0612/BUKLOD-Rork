import React,{useCallback,useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {supabase} from '@/lib/supabase';

type Snapshot={
  new_member_count:number;
  latest_kl_title:string|null;
  holiday_title:string|null;
  my_birthday:boolean;
  share_birthday:boolean;
  my_recent_rank:string|null;
  my_recent_reward:string|null;
};
type Greeting={
  key:string; title:string; detail:string; action:string; route:string;
  icon:React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};
const cleanCount=(value:unknown)=>Number.isFinite(Number(value))?
  Math.min(9999,Math.max(0,Math.trunc(Number(value)))):0;
const cleanText=(value:unknown,max=150)=>
  typeof value==='string'?value.trim().slice(0,max):'';
// Deterministic daily variation: copy can feel personal without unstable random
// text that changes during scrolling, loading, or hydration.
const variation=(seed:string,options:string[])=>{
  const day=new Date().getUTCDate();
  let hash=day;
  for(const letter of seed)hash=(Math.imul(hash,31)+letter.charCodeAt(0))>>>0;
  return options[hash%options.length];
};

/**
 * A living, contextual interaction strip. Text is based on verified server
 * events only: a published KL chapter, personal accomplishments, the owner's
 * own birthday, aggregate new members, or a scheduled holiday. The member
 * never needs an admin to approve an automatic birthday greeting.
 */
export default function BuklodLivingGreetingsBanner(){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [expanded,setExpanded]=useState(false);
  const [selected,setSelected]=useState(0);
  useFocusEffect(useCallback(()=>{
    let active=true;
    void (async()=>{
      try{
        const {data,error}=await (supabase as any).rpc('buklod_my_living_greetings_v1');
        if(error||!data||!active)return;
        setSnapshot({
          new_member_count:cleanCount(data.new_member_count),
          latest_kl_title:cleanText(data.latest_kl_title)||null,
          holiday_title:cleanText(data.holiday_title)||null,
          my_birthday:data.my_birthday===true,
          share_birthday:data.share_birthday===true,
          my_recent_rank:cleanText(data.my_recent_rank,80)||null,
          my_recent_reward:cleanText(data.my_recent_reward,80)||null,
        });
      }catch{
        // Legacy/offline clients keep Wall usable without inventing events.
      }
    })();
    return ()=>{active=false;};
  },[]));
  const greetings=useMemo<Greeting[]>(()=>{
    if(!snapshot)return [];
    const cards:Greeting[]=[];
    if(snapshot.my_birthday)cards.push({
      key:'birthday',title:variation('birthday',[
        'Happy birthday! BUKLOD celebrates with you today.',
        'Maligayang kaarawan! May pagbati para sa iyo.',
        'Happy birthday! May personal na pagbati ang BUKLOD.',
        'Araw mo ngayon. Happy birthday mula sa BUKLOD!',
      ]),
      detail:'Ngayong araw, ikaw naman ang ipinagdiriwang natin. Tingnan ang iyong pagbati.',
      action:'Tingnan ang pagbati',route:'/notifications',icon:'cake-variant-outline',
    });
    if(snapshot.my_recent_rank)cards.push({
      key:'rank',title:variation(snapshot.my_recent_rank,[
        'Rank up! Naabot mo ang '+snapshot.my_recent_rank+'.',
        'Milestone reached: '+snapshot.my_recent_rank+'.',
        'New rank unlocked — '+snapshot.my_recent_rank+'.',
        'Congrats! Umangat ka sa '+snapshot.my_recent_rank+'.',
      ]),
      detail:'Bagong milestone sa iyong BUKLOD journey. Tuloy-tuloy ang progreso!',
      action:'Tingnan ang rank',route:'/(tabs)/me',icon:'trophy-outline',
    });
    if(snapshot.my_recent_reward)cards.push({
      key:'reward',title:variation(snapshot.my_recent_reward,[
        'Unlocked! May '+snapshot.my_recent_reward+' ka.',
        'Bagong achievement: '+snapshot.my_recent_reward+'.',
        'Character update! Nakuha mo ang '+snapshot.my_recent_reward+'.',
        'Nice progress! May '+snapshot.my_recent_reward+' ka na.',
      ]),
      detail:'May bagong na-unlock sa iyong Character. Silipin ang achievement mo.',
      action:'Tingnan ang Character',route:'/(tabs)/me',icon:'star-circle-outline',
    });
    if(snapshot.latest_kl_title)cards.push({
      key:'kl',title:snapshot.latest_kl_title,
      detail:variation(snapshot.latest_kl_title,[
        'May bagong kabanatang maaari nang basahin. Ipagpatuloy ang kuwento.',
        'Available na ang bagong release. Balikan ang mundo ng Kabihasnang Ligaw.',
        'Nagpatuloy ang kuwento. Basahin ang bagong kabanata ngayon.',
        'Bagong kabanata, bagong mga lihim. Available na sa BUKLOD.',
      ]),
      action:'Basahin ngayon',route:'/kabihasnang-ligaw',icon:'book-open-page-variant-outline',
    });
    if(snapshot.new_member_count>0)cards.push({
      key:'welcome',title:snapshot.new_member_count===1
        ?'May bagong ka-BUKLOD!':'May '+snapshot.new_member_count+' bagong ka-BUKLOD!',
      detail:variation(String(snapshot.new_member_count),[
        'May mga bagong sumali sa komunidad. Kilalanin at i-welcome sila.',
        'Mas lumalawak ang BUKLOD. Batiin natin ang mga bagong kasama.',
        'May mga bagong miyembro ngayon. Isang welcome ang magandang simula.',
        'Bagong mga mukha sa BUKLOD. Huwag palampasin ang pagkakataong bumati.',
      ]),
      action:'Tingnan ang updates',route:'/notifications',icon:'account-plus-outline',
    });
    if(snapshot.holiday_title)cards.push({
      key:'holiday',title:snapshot.holiday_title+' — mula sa BUKLOD.',
      detail:'Isang pagbati para sa buong komunidad ngayong araw.',
      action:'Tingnan ang updates',route:'/notifications',icon:'party-popper',
    });
    return cards;
  },[snapshot]);
  if(!greetings.length)return null;
  const current=greetings[selected%greetings.length];
  return <View style={s.frame}>
    <View style={s.top}>
      <MaterialCommunityIcons name={current.icon} size={21} color="#17644B"/>
      <View style={{flex:1,minWidth:0}}>
        <Text style={s.eyebrow}>BUKLOD • COMMUNITY UPDATES</Text>
        <Text numberOfLines={expanded?3:1} style={s.title}>{current.title}</Text>
      </View>
      {greetings.length>1&&<Pressable accessibilityRole="button"
        accessibilityLabel="Next community update" onPress={()=>{setSelected(i=>i+1);setExpanded(false);}}
        style={s.next}>
        <Text style={s.counter}>{selected%greetings.length+1}/{greetings.length}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#17644B"/>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="Expand community update"
        accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={s.next}>
        <MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={20} color="#17644B"/>
      </Pressable>
    </View>
    {expanded&&<View style={s.details}>
      <Text style={s.detail}>{current.detail}</Text>
      <View style={s.actions}>
        <Pressable onPress={()=>router.push(current.route as any)}
          style={s.primary} accessibilityRole="button">
          <Text style={s.primaryText}>{current.action}</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color="#FFF"/>
        </Pressable>
        <Pressable onPress={()=>router.push('/notifications' as any)}
          style={s.secondary} accessibilityRole="button">
          <Text style={s.secondaryText}>Lahat ng updates</Text>
        </Pressable>
      </View>
    </View>}
  </View>;
}
const s=StyleSheet.create({
 frame:{marginBottom:8,borderRadius:14,borderWidth:1,borderColor:'#C7E4D5',backgroundColor:'#F5FBF7',overflow:'hidden'},
 top:{minHeight:61,paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:8},
 eyebrow:{color:'#527969',fontWeight:'800',fontSize:9,letterSpacing:.6,marginBottom:3},
 title:{flex:1,color:'#154D3C',fontWeight:'800',fontSize:13,lineHeight:19},
 next:{minWidth:24,minHeight:34,flexDirection:'row',alignItems:'center',justifyContent:'center'},
 counter:{color:'#527969',fontSize:10,fontWeight:'700'},
 details:{paddingHorizontal:12,paddingBottom:12,gap:10},
 detail:{color:'#3D6754',fontSize:12,lineHeight:18},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},
 primary:{backgroundColor:'#17644B',borderRadius:10,paddingVertical:9,paddingHorizontal:13,
   flexDirection:'row',alignItems:'center',gap:7},
 primaryText:{color:'#FFF',fontWeight:'800',fontSize:11},
 secondary:{paddingVertical:8,paddingHorizontal:7},
 secondaryText:{color:'#17644B',fontWeight:'700',fontSize:11}
});
