/**
 * BUKLOD Season 2 — Community Village EXPLORATION MAP (visual preview).
 * Original nature-first art; no fake property ownership, wallet transfers,
 * Character rewards, level approvals, or BP/QMP settlement.
 * Every accessible destination opens an existing permissioned BUKLOD feature.
 */
import React,{useState} from 'react';
import {ImageBackground,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Redirect,router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {useRorkGameAmbience} from '@/features/games/runtime/rorkAudio';

const REGIONS=[
 {id:'lot',title:'Personal Lot',icon:'map-marker-path',x:'14%',y:'42%',
  description:'Permanent Levels 1–10 + endless Mastery. Start with ground markers and foundation, not a finished mansion.',
  route:'/personal-home'},
 {id:'house',title:'House & Rooms',icon:'home-city-outline',x:'35%',y:'52%',
  description:'Foundation, frame, walls, roof and later amenities; interior colors and furniture require approved owned assets.',
  route:'/personal-home'},
 {id:'cluster',title:'Community Estate',icon:'account-group-outline',x:'58%',y:'43%',
  description:'Actual Cluster, Sub-organization and Organization permissions remain authoritative.',
  route:'/clusters'},
 {id:'market',title:'Business & Farm',icon:'storefront-outline',x:'81%',y:'55%',
  description:'Items, farming and trade must transfer legitimately earned BP. Businesses never mint BP.',
  route:'/profile/buklod-business'},
] as const;
type RegionId=typeof REGIONS[number]['id'];
const STAGES=['Land markers','Foundation','Structure','Roof & exterior','Amenities & expansion'] as const;
export default function CommunityVillageScreen(){
 const {session,loading,profile}=useAuth();
 const {requiresAcceptance}=useCompliance();
 const {config}=useRuntimeConfig();
 const insets=useSafeAreaInsets();
 const {musicEnabled,musicSuspended,toggleMusic}=useRorkGameAmbience('kingdom-map');
 const [activeId,setActiveId]=useState<RegionId>('lot');
 const [previewLevel,setPreviewLevel]=useState(1);
 const [previewStage,setPreviewStage]=useState(0);
 const region=REGIONS.find(r=>r.id===activeId)!;
 if(!isGenesisPreviewBuild())return <Redirect href="/(tabs)/buklod"/>;
 if(loading&&!session)return <View style={styles.root}/>;
 if(!session)return <Redirect href="/(auth)/login"/>;
 if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
 if(config?.update_required)return <Redirect href="/system/update-required"/>;
 if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
 if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
 if(!profile)return <Redirect href="/onboarding"/>;
 return <View style={styles.root}>
   <ScrollView contentContainerStyle={[styles.content,{paddingTop:Math.max(8,insets.top),paddingBottom:Math.max(25,insets.bottom)}]}>
    <View style={styles.topBar}>
      <Pressable onPress={()=>router.replace('/buklod-map' as any)} accessibilityRole="button" accessibilityLabel="Back to BUKLOD Entry Map" style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={21} color="#FBE5BA"/><Text style={styles.backText}>WORLD MAP</Text>
      </Pressable>
      <Text style={styles.tag}>GENESIS · COMMUNITY VILLAGE</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={musicEnabled?'Mute Village background music':'Enable Village background music'}
        onPress={toggleMusic} style={styles.music}>
        <MaterialCommunityIcons name={musicEnabled&&!musicSuspended?'music-note':'music-note-off'} size={19} color="#FFE8B4"/>
      </Pressable>
    </View>
    <Text style={styles.title}>Community Village</Text>
    <Text style={styles.subtitle}>Lupa, tahanan, farm, business at tunay na komunidad — bawat uri may sariling development track.</Text>
    <View style={styles.map}>
      <ImageBackground source={require('../../assets/season2/genesis/kingdom/kingdom-nature-panorama.webp')}
        resizeMode="cover" style={StyleSheet.absoluteFillObject}>
        <LinearGradient colors={['rgba(4,30,31,.25)','rgba(4,31,31,.04)','rgba(2,18,28,.42)']}
          style={StyleSheet.absoluteFillObject}/>
      </ImageBackground>
      {REGIONS.map(r=><Pressable key={r.id} accessibilityRole="button"
        accessibilityLabel={'Explore '+r.title} accessibilityState={{selected:r.id===activeId}}
        onPress={()=>setActiveId(r.id)}
        style={[styles.pin,{left:r.x as any,top:r.y as any},r.id===activeId&&styles.pinActive]}>
        <MaterialCommunityIcons name={r.icon} size={20} color={r.id===activeId?'#133D33':'#FBF1D5'}/>
      </Pressable>)}
      <View pointerEvents="none" style={styles.mapNote}>
        <Text style={styles.mapNoteText}>Tap a village district to inspect its development pathway</Text>
      </View>
    </View>
    <View style={styles.detail}>
      <View style={styles.detailTop}>
        <MaterialCommunityIcons name={region.icon} size={24} color="#FFE2A6"/>
        <View style={{flex:1}}>
          <Text style={styles.detailTitle}>{region.title}</Text>
          <Text style={styles.small}>STRUCTURE PREVIEW · NO CLAIMED PROPERTY</Text>
        </View>
      </View>
      <Text style={styles.body}>{region.description}</Text>
      <Text style={styles.body}>Each major level has five visible construction stages. Higher levels require more verified effort and obtainable items. After Level 10, Mastery can continue without unlimited Arena combat power.</Text>
      <View style={styles.levelRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Preview previous major level"
          onPress={()=>{setPreviewLevel(x=>Math.max(1,x-1));setPreviewStage(0);}} style={styles.arrow}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FBE6B4"/>
        </Pressable>
        <Text style={styles.level}>Preview Level {previewLevel} / 10</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Preview next major level"
          onPress={()=>{setPreviewLevel(x=>Math.min(10,x+1));setPreviewStage(0);}} style={styles.arrow}>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#FBE6B4"/>
        </Pressable>
      </View>
      <View style={styles.stageRow}>
        {STAGES.map((name,i)=><Pressable key={name} accessibilityRole="button"
          accessibilityLabel={'Preview stage '+(i+1)+': '+name}
          accessibilityState={{selected:i===previewStage}} onPress={()=>setPreviewStage(i)}
          style={[styles.stage,i===previewStage&&styles.stageSelected]}>
            <Text style={styles.stageIndex}>{i+1}</Text>
          </Pressable>)}
      </View>
      <Text style={styles.preview}>Stage {previewStage+1}/5: {STAGES[previewStage]} · sample progression only. No real materials or BP spent.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={'Open existing '+region.title+' features'}
        onPress={()=>router.push(region.route as any)} style={styles.open}>
        <Text style={styles.openText}>OPEN {region.title.toUpperCase()}</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color="#0C342C"/>
      </Pressable>
    </View>
    <Text style={styles.footer}>The permanent BP, QMP, items, property ownership and trade authority remains on the existing verified backend. Live construction and customization unlock only after approved asset-stage receipts and security gates.</Text>
   </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#061917'},
 content:{paddingHorizontal:12,maxWidth:850,width:'100%',alignSelf:'center',gap:10},
 topBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},
 back:{minHeight:44,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8},
 backText:{fontSize:11,fontWeight:'900',color:'#FBE5BA'},
 tag:{fontSize:9,fontWeight:'900',color:'#A5E6D0',flexShrink:1},
 music:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
 title:{fontSize:26,fontWeight:'900',color:'#FFF5D8'},
 subtitle:{fontSize:12,lineHeight:18,color:'#CFE7D9'},
 map:{aspectRatio:16/9,width:'100%',borderRadius:18,overflow:'hidden',
  backgroundColor:'#183C2A',borderWidth:1,borderColor:'#ADBE9C'},
 pin:{position:'absolute',width:44,height:44,marginLeft:-22,marginTop:-22,
  borderRadius:22,borderWidth:2,borderColor:'#FDE5AF',backgroundColor:'rgba(11,55,50,.86)',
  alignItems:'center',justifyContent:'center'},
 pinActive:{backgroundColor:'#F8D99C',borderColor:'#EFFFF1'},
 mapNote:{position:'absolute',left:6,right:6,bottom:6,borderRadius:9,
  backgroundColor:'rgba(3,21,20,.78)',padding:7,alignItems:'center'},
 mapNoteText:{fontSize:10,fontWeight:'700',color:'#EBF8E4'},
 detail:{padding:13,borderRadius:18,gap:10,borderWidth:1,borderColor:'#7D9B84',
  backgroundColor:'#0C2D2A'},
 detailTop:{flexDirection:'row',gap:9,alignItems:'center'},
 detailTitle:{fontSize:17,fontWeight:'900',color:'#FFF3D6'},
 small:{fontSize:9,fontWeight:'800',color:'#B2EBD6'},
 body:{fontSize:12,lineHeight:18,color:'#D7EEE1'},
 levelRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9},
 level:{fontSize:14,fontWeight:'900',color:'#FFF0CE',minWidth:180,textAlign:'center'},
 arrow:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',
  borderRadius:11,backgroundColor:'#28534A'},
 stageRow:{flexDirection:'row',justifyContent:'space-between',gap:6},
 stage:{flex:1,minHeight:39,borderRadius:11,borderWidth:1,borderColor:'#779688',
  justifyContent:'center',alignItems:'center',backgroundColor:'#204238'},
 stageSelected:{backgroundColor:'#735C34',borderColor:'#FDE6A5'},
 stageIndex:{fontSize:13,fontWeight:'900',color:'#FFECC2'},
 preview:{fontSize:11,color:'#D5E4CF',lineHeight:16},
 open:{minHeight:46,backgroundColor:'#F4D99B',borderRadius:11,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 openText:{color:'#0C342C',fontSize:12,fontWeight:'900'},
 footer:{fontSize:10,lineHeight:16,color:'#9EC2AE',paddingBottom:18},
});
