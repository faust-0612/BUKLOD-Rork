import React,{useCallback,useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {resolveBuklodNotificationTarget} from '@/lib/buklodNotificationNavigation';

type Snapshot={
  new_member_count:number;
  latest_kl_title:string|null;
  holiday_title:string|null;
  my_birthday:boolean;
  share_birthday:boolean;
  my_recent_rank:string|null;
  my_recent_reward:string|null;
};
type RecentAlert={id:string;kind:string;title:string;body:string;data:Record<string,unknown>;created_at:string};
type VerifiedPoint={id:string;points:number;description:string;activity_type:string;claim_state:string;created_at:string};
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
  const {user}=useAuth();
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [recentAlerts,setRecentAlerts]=useState<RecentAlert[]>([]);
  const [verifiedPoints,setVerifiedPoints]=useState<VerifiedPoint[]>([]);
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
      if(!user?.id||!active)return;
      try{
        const from=new Date(Date.now()-72*3600000).toISOString();
        const [alertsResult,pointsResult]=await Promise.all([
          supabase.from('notifications')
            .select('id,kind,title,body,data,created_at')
            .eq('user_id',user.id).gte('created_at',from)
            .order('created_at',{ascending:false}).limit(12),
          supabase.from('buklod_points_ledger')
            .select('id,points,description,activity_type,claim_state,created_at')
            .eq('user_id',user.id).eq('direction','credit')
            .gte('created_at',from).order('created_at',{ascending:false}).limit(10),
        ]);
        if(!active)return;
        if(!alertsResult.error)setRecentAlerts(
          (alertsResult.data??[]).filter((row:any)=>
            typeof row.kind==='string'&&typeof row.id==='string').map((row:any)=>({
            id:String(row.id),kind:String(row.kind).toLowerCase(),
            title:cleanText(row.title),body:cleanText(row.body,220),
            data:row.data&&typeof row.data==='object'&&!Array.isArray(row.data)?row.data:{},
            created_at:String(row.created_at??''),
          }))
        );
        if(!pointsResult.error)setVerifiedPoints(
          (pointsResult.data??[]).filter((row:any)=>
            Number(row.points)>0&&Number.isFinite(Number(row.points))).map((row:any)=>({
            id:String(row.id),points:Number(row.points),
            description:cleanText(row.description,120),
            activity_type:cleanText(row.activity_type,70),
            claim_state:cleanText(row.claim_state,30),
            created_at:String(row.created_at??''),
          }))
        );
      }catch{/* The greeting feed is optional and cannot block Wall. */}
    })();
    return ()=>{active=false;};
  },[user?.id]));
  const greetings=useMemo<Greeting[]>(()=>{
    if(!snapshot)return [];
    const cards:Greeting[]=[];
    const socialKinds=new Set(['community_reaction','community_comment','community_reply',
      'post_reaction','post_comment','post_reply','community_commented']);
    for(const alert of recentAlerts.filter(a=>socialKinds.has(a.kind)).slice(0,3)){
      const target=resolveBuklodNotificationTarget(alert.kind,alert.data);
      if(!target?.path)continue;
      const isReaction=alert.kind.includes('reaction');
      const isReply=alert.kind.includes('reply');
      cards.push({
        key:'social-'+alert.id,
        title:isReaction?'May nag-react sa iyong post!':
          isReply?'May bagong reply sa iyong komento!':'May nag-comment sa iyong post!',
        detail:alert.body||alert.title||'Buksan ang mismong post para makita ang bagong interaction.',
        action:isReaction?'Tingnan ang reaction':'Basahin ang komento',
        route:target.path,
        icon:isReaction?'heart-multiple-outline':'comment-text-outline',
      });
    }
    const latest=verifiedPoints[0];
    if(latest){
      const pending=latest.claim_state==='pending';
      cards.push({
        key:'points-'+latest.id,
        title:(pending?'May +':'Nadagdag ang +')+latest.points.toLocaleString('en-PH')+' BUKLOD Points!',
        detail:(latest.description||latest.activity_type.replace(/_/g,' '))+
          (pending?' · Ready to Claim pagkatapos ng verification.':' · Nakarekord sa iyong live Points ledger.'),
        action:pending?'Buksan ang Claim Center':'Tingnan ang Points',
        route:'/points',icon:'star-circle-outline',
      });
    }
    const otherKinds=new Set(['event_reminder','event_created','community_announcement','community_update',
      'attendance_approved','mentoring_approved','reward_approved','formation_assigned',
      'cluster_join_result','achievement_unlocked','support_reply']);
    for(const alert of recentAlerts.filter(a=>otherKinds.has(a.kind)).slice(0,3)){
      const target=resolveBuklodNotificationTarget(alert.kind,alert.data);
      if(!target?.path)continue;
      cards.push({
        key:'update-'+alert.id,title:alert.title||'May bagong update sa BUKLOD!',
        detail:alert.body||'Buksan ang detalye ng bagong kaganapan.',
        action:'Buksan ang update',route:target.path,icon:'bell-badge-outline',
      });
    }
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
      action:'Tingnan ang rank',route:'/points/progression',icon:'trophy-outline',
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
    return cards.slice(0,12);
  },[snapshot,recentAlerts,verifiedPoints]);
  if(!greetings.length)return null;
  const current=greetings[selected%greetings.length];
  return <View style={s.frame}>
    <View style={s.top}>
      <View style={s.iconWell}>
        <MaterialCommunityIcons name={current.icon} size={22} color="#09664A"/>
      </View>
      <View style={{flex:1,minWidth:0}}>
        <Text style={s.eyebrow}>BUKLOD · COMMUNITY UPDATES</Text>
        <Text numberOfLines={expanded?3:2} style={s.title}>{current.title}</Text>
        <Text numberOfLines={expanded?5:1} style={s.detail}>{current.detail}</Text>
      </View>
      {greetings.length>1&&(
        <Pressable accessibilityRole="button" accessibilityLabel="Next community update"
          onPress={()=>{setSelected(i=>i+1);setExpanded(false);}} style={s.next}>
          <Text style={s.counter}>{selected%greetings.length+1}/{greetings.length}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#17644B"/>
        </Pressable>
      )}
    </View>
    <View style={s.actions}>
      <Pressable onPress={()=>router.push(current.route as any)}
        style={s.primary} accessibilityRole="button" accessibilityLabel={'Open '+current.title}>
        <Text style={s.primaryText}>{current.action}</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color="#FFF"/>
      </Pressable>
      <Pressable onPress={()=>setExpanded(v=>!v)} accessibilityRole="button"
        accessibilityState={{expanded}} style={s.secondary}>
        <Text style={s.secondaryText}>{expanded?'Mas kaunti':'Detalye'}</Text>
        <MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={16} color="#17644B"/>
      </Pressable>
      <Pressable onPress={()=>router.push('/notifications' as any)}
        style={s.secondary} accessibilityRole="button">
        <MaterialCommunityIcons name="bell-outline" size={17} color="#17644B"/>
      </Pressable>
    </View>
  </View>;
}
const s=StyleSheet.create({
 frame:{marginBottom:8,borderRadius:17,borderWidth:1.2,borderColor:'#7ED6AB',backgroundColor:'#F1FCF7',
   shadowColor:'#087A51',shadowOpacity:0.09,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:2,overflow:'hidden'},
 top:{paddingHorizontal:12,paddingTop:12,paddingBottom:8,flexDirection:'row',alignItems:'center',gap:9},
 iconWell:{width:45,height:45,borderRadius:14,backgroundColor:'#D6F8E6',alignItems:'center',justifyContent:'center',
   borderWidth:1,borderColor:'#A4E8C4'},
 eyebrow:{color:'#0F7B55',fontWeight:'900',fontSize:9,letterSpacing:.7,marginBottom:3},
 title:{color:'#113E33',fontWeight:'900',fontSize:14,lineHeight:19},
 next:{minWidth:38,minHeight:35,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2},
 counter:{color:'#527969',fontSize:10,fontWeight:'900'},
 details:{paddingHorizontal:12,paddingBottom:12,gap:10},
 detail:{color:'#426657',fontSize:11.5,lineHeight:16,marginTop:3},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:7,alignItems:'center',paddingHorizontal:12,paddingBottom:11},
 primary:{backgroundColor:'#17644B',borderRadius:10,paddingVertical:9,paddingHorizontal:13,
   flexDirection:'row',alignItems:'center',gap:7,minHeight:36},
 primaryText:{color:'#FFF',fontWeight:'900',fontSize:11},
 secondary:{minHeight:34,paddingVertical:8,paddingHorizontal:9,borderRadius:9,
   backgroundColor:'#E0F5EA',flexDirection:'row',alignItems:'center',gap:5},
 secondaryText:{color:'#17644B',fontWeight:'800',fontSize:11}
});
