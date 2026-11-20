/**
 * Non-network Genesis Android device visual inspection. This uses the SAME
 * shipped Genesis backgrounds, hero, halo, seal, rank art and reward motion,
 * but no real account, Kingdom gameplay, user data, ad calls or grants.
 */
import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GenesisAtmosphere, GenesisHomeHero, GenesisSeal, GenesisLivingButton } from './GenesisVisuals';
import GenesisCosmicSky, { GenesisOrbitHalo } from './GenesisCosmicSky';
import GenesisRankBadgeArtwork from './GenesisRankBadgeArtwork';
import GenesisRewardReveal from './GenesisRewardReveal';
import { GENESIS_IDENTITY, GENESIS_PALETTE, GENESIS_SURFACE_DESIGN } from './genesisContract';

const TABS = ['Home', 'Wall', 'Connect', 'Profile', 'Bible', 'Kingdom'] as const;
type Screen = typeof TABS[number];
const ICONS: Record<Screen, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  Home: 'home-variant-outline',
  Wall: 'view-dashboard-outline',
  Connect: 'chat-outline',
  Profile: 'account-circle-outline',
  Bible: 'book-open-outline',
  Kingdom: 'crown-outline',
};
const SAMPLE: Record<Screen, { title:string; note:string; lines:string[] }> = {
  Home:{title:'Creation begins in light',note:'Real Genesis hero · cosmic ambient layer',lines:['Season 2 wordmark','Moving cosmic rays','Responsive light and touch']},
  Wall:{title:'Community Wall',note:'Visual treatment only · no real posts',lines:['Compact text-first cards','Quiet orbits behind feed','Space reserved for real video and ads']},
  Connect:{title:'Connect',note:'Visual treatment only · no messages sent',lines:['Readable message surfaces','High-contrast message bubbles','No network requests']},
  Profile:{title:'Profile and rank',note:'Rank badge artwork preview · no ranking data',lines:['Original circle rank atlas','Celestial halo lighting','Locked live account information']},
  Bible:{title:'Word and creation',note:'Visual treatment only · no chapter rewards',lines:['Scripture contrast','Quiet creation background','No points granted']},
  Kingdom:{title:'The Creation realms',note:'Real Genesis cosmos and orbital art · no playable 3D pack yet',lines:['Godot native runtime packaged','No approved Godot PCK yet','13 Rive rigs not yet approved']},
};
function VisualReview() {
  const [tab,setTab]=useState<Screen>('Home');
  const [rewardOpen,setRewardOpen]=useState(false);
  const data=SAMPLE[tab];
  const surface=tab.toLowerCase() as 'home'|'wall'|'connect'|'profile'|'bible'|'kingdom';
  return <SafeAreaView style={styles.screen} edges={['top','bottom']}>
    <StatusBar backgroundColor="#050A19" barStyle="light-content"/>
    <View style={styles.head}>
      <View style={{flex:1}}>
        <Text style={styles.eyebrow}>BUKLOD · GENESIS</Text>
        <Text style={styles.brand}>{GENESIS_IDENTITY.title}</Text>
        <Text style={styles.small}>Genesis 1:3 · Android native visual inspection</Text>
      </View>
      <GenesisSeal size={54} active={tab==='Home'}/>
    </View>
    <View style={styles.qaFlag}>
      <MaterialCommunityIcons name="shield-check-outline" size={16} color="#F5D39C"/>
      <Text style={styles.qaText}>OFFLINE VISUAL QA · NO LOGIN · NO LIVE DATA</Text>
    </View>
    <ScrollView contentContainerStyle={styles.page} key={tab}>
      {tab==='Home' ? <GenesisHomeHero onExplore={()=>setTab('Kingdom')} active quality="balanced"/> :
      <View style={styles.cosmosCard}>
        <GenesisCosmicSky active={tab==='Kingdom'||tab==='Profile'}/>
        {tab==='Kingdom'||tab==='Profile' ? <GenesisOrbitHalo active size={185}/>:null}
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>SEASON 2 · {tab.toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{data.title}</Text>
          <Text style={styles.heroNote}>{data.note}</Text>
        </View>
      </View>}
      <View style={styles.infoCard}>
        <Text style={styles.section}>{tab.toUpperCase()} · CREATION THEME</Text>
        <Text style={styles.infoTitle}>{tab==='Home'?'Let there be light.':data.title}</Text>
        <Text style={styles.infoNote}>{data.note}</Text>
        {data.lines.map((line,i)=><View style={styles.detailRow} key={line}>
          <View style={styles.dot}/>
          <Text style={styles.detail}>{line}</Text>
        </View>)}
        {tab==='Profile'?<View style={styles.badgeRow}>
          <GenesisRankBadgeArtwork rankName="Circle Starter I" size={75}/>
          <Text style={styles.detail}>Actual atlas crop preview. Does not represent a signed-in member.</Text>
        </View>:null}
      </View>
      {tab==='Wall'||tab==='Connect'?<View style={styles.sampleCard}>
        <View style={styles.avatar}/>
        <View style={{flex:1,gap:5}}>
          <Text style={styles.sampleTitle}>Genesis UI demonstration</Text>
          <Text style={styles.detail}>{tab==='Wall'?'Example post typography and feed spacing.':'Example message bubble and contrast.'}</Text>
        </View>
      </View>:null}
      <View style={styles.bottomActions}>
        <GenesisLivingButton label="Preview reward motion" onPress={()=>setRewardOpen(true)}/>
        <Text style={styles.disclaimer}>Visual-only demonstration. This app cannot authenticate, send messages, award points, sync Drive or enter a live Kingdom.</Text>
        <Text style={styles.disclaimer}>Visual engine: {GENESIS_SURFACE_DESIGN[surface].scene} · {GENESIS_SURFACE_DESIGN[surface].motion}</Text>
      </View>
    </ScrollView>
    <View style={styles.nav}>
      {TABS.map(item=><Pressable key={item} accessibilityRole="tab"
          accessibilityState={{selected:tab===item}} onPress={()=>setTab(item)}
          style={[styles.navItem,tab===item&&styles.navSelected]}>
        <MaterialCommunityIcons name={ICONS[item]} size={18} color={tab===item?GENESIS_PALETTE.gold:'#B9CBDF'}/>
        <Text style={[styles.navText,tab===item&&{color:GENESIS_PALETTE.gold}]}>{item}</Text>
      </Pressable>)}
    </View>
    <GenesisRewardReveal visible={rewardOpen} onClose={()=>setRewardOpen(false)}
      title="Motion preview only" message="No actual reward, points or account change was made."
      rewardText="VISUAL TEST · NO BP AWARDED"/>
  </SafeAreaView>;
}
export default function GenesisRenderQaEntry() {
  return <SafeAreaProvider><VisualReview/></SafeAreaProvider>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:GENESIS_PALETTE.void},
  head:{minHeight:92,paddingHorizontal:14,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:9},
  brand:{fontSize:21,lineHeight:26,fontWeight:'900',color:'#F8FAFF',marginTop:2},
  eyebrow:{fontSize:10,color:GENESIS_PALETTE.gold,fontWeight:'900',letterSpacing:1.2},
  small:{fontSize:11,color:'#ADC6DC',marginTop:3},
  qaFlag:{minHeight:30,backgroundColor:'#172540',borderTopWidth:1,borderBottomWidth:1,borderColor:'#556C8D',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
  qaText:{fontSize:10,fontWeight:'800',color:'#F7DBA5'},
  page:{gap:12,paddingHorizontal:11,paddingTop:12,paddingBottom:24},
  cosmosCard:{height:200,borderWidth:1,borderColor:'#A58E64',borderRadius:17,overflow:'hidden',backgroundColor:'#06172C'},
  heroCopy:{position:'absolute',left:14,right:125,bottom:13,zIndex:2},
  heroTitle:{fontSize:23,lineHeight:28,fontWeight:'900',color:'#FFF3D4',marginTop:8},
  heroNote:{fontSize:11,lineHeight:16,color:'#E0EBF5',marginTop:5},
  infoCard:{backgroundColor:'#101E3C',borderColor:'#415877',borderWidth:1,borderRadius:15,padding:14,gap:8},
  section:{fontSize:10,letterSpacing:1.2,color:'#F3D399',fontWeight:'900'},
  infoTitle:{fontSize:18,fontWeight:'900',color:'#FFF7E7'},
  infoNote:{fontSize:12,color:'#D0DDED',lineHeight:18},
  detailRow:{flexDirection:'row',gap:9,alignItems:'center'},
  dot:{width:5,height:5,borderRadius:3,backgroundColor:'#F3D399'},
  detail:{fontSize:12,lineHeight:18,color:'#DCE7F5',flex:1},
  badgeRow:{flexDirection:'row',gap:12,alignItems:'center',marginTop:5},
  sampleCard:{flexDirection:'row',padding:12,gap:10,borderWidth:1,borderColor:'#425B73',borderRadius:14,backgroundColor:'#0C2139'},
  avatar:{width:33,height:33,borderRadius:17,backgroundColor:'#6CAEB6',borderWidth:1,borderColor:'#BCE3DF'},
  sampleTitle:{fontSize:12,fontWeight:'800',color:'#F5F6FA'},
  bottomActions:{gap:9},
  disclaimer:{color:'#A5BCD0',fontSize:11,lineHeight:17},
  nav:{flexDirection:'row',backgroundColor:'#081329',borderTopWidth:1,borderTopColor:'#526282',paddingHorizontal:3,paddingVertical:4},
  navItem:{flex:1,alignItems:'center',justifyContent:'center',minHeight:51,gap:3,borderRadius:7},
  navSelected:{backgroundColor:'#1C2C4A'},
  navText:{fontSize:10,color:'#C5D4E1',fontWeight:'700'},
});
