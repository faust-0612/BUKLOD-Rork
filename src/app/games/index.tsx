import React from 'react';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const GAME_CARDS = [
  { href:'/games/jawo-forest-trail' as const, character:'Jawo', world:'Whispering Forest', title:'Forest Trail', mechanic:'Swipe movement • obstacle reading • Trail Light collection • combo flow' },
  { href:'/games/trudice-playground-memory' as const, character:'Trudice', world:"Children's Haven", title:'Wonder Path', mechanic:'Spatial sequence memory • progressive rounds • playground station interaction' },
  { href:'/games/ace-rescue-grid' as const, character:'Ace', world:'Strategy District', title:'Rescue Grid', mechanic:'Tactical routing • limited energy • rescue beacons • extraction planning' },
  { href:'/games/mitch-restore-mural' as const, character:'Mitch', world:'Art Village', title:'Restore the Mural', mechanic:'Direct drag restoration • precision placement • combo scoring • staged visual reveal' },
  { href:'/games/niel-mission-trail' as const, character:'Niel', world:'Mission Frontier', title:'Mission Trail', mechanic:'Expedition choices • resource management • risk/reward routes • mission arrival' },
  { href:'/games/angel-kingdom-treasury' as const, character:'Angel', world:'Treasury City', title:'Kingdom Treasury', mechanic:'Budget strategy • reserve planning • emergency response • kingdom health consequences' },
  { href:'/games/vhen-farm-to-market' as const, character:'Vhen', world:'Agricultural Valley', title:'Farm to Market', mechanic:'Crop planning • weather timing • demand reading • delivery/spoilage tradeoff' },
  { href:'/games/elesur-village-builder' as const, character:'ELESUR', world:'Highland Community', title:'Village Builder', mechanic:'Priority building • limited workers/materials • community health balancing' },
  { href:'/games/phan-enterprise-builder' as const, character:'Phan', world:'Farmstead to Enterprise', title:'Enterprise Builder', mechanic:'Production chain • processing • sales • expansion • cash-flow survival' },
  { href:'/games/van-living-city-dispatch' as const, character:'Van', world:'The Living City', title:'City Dispatch', mechanic:'Service prioritization • team specialization • capacity • public trust' },
  { href:'/games/christian-civic-leadership' as const, character:'Christian', world:'Civic Academy', title:'Leadership Council', mechanic:'Branching civic decisions • trust • unity • budget • time consequences' },
  { href:'/games/lhen-rhythm-journey' as const, character:'Lhen', world:'Music & Mission City', title:'Rhythm Journey', mechanic:'Real timing windows • accents • combo • accuracy • miss recovery' },
  { href:'/games/quin-discovery-expedition' as const, character:'Quin', world:'Discovery World', title:'Discovery Expedition', mechanic:'Fog-of-war exploration • clues • hazards • energy • relic discovery' },
];

export default function BuklodGameLabScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.kicker}>BUKLOD KINGDOM</Text>
        <Text style={styles.title}>Game Lab</Text>
        <Text style={styles.copy}>13 standalone premium gameplay modules. They intentionally do not write character XP, Kingdom progress, Circle Rank, collectibles, or map unlocks yet.</Text>
      </View>
      <View style={styles.grid}>
        {GAME_CARDS.map((game) => (
          <Link key={game.href} href={game.href} style={styles.link}>
            <View style={styles.card}>
              <Text style={styles.character}>{game.character}</Text>
              <Text style={styles.world}>{game.world}</Text>
              <Text style={styles.gameTitle}>{game.title}</Text>
              <Text style={styles.mechanic}>{game.mechanic}</Text>
              <Text style={styles.play}>PLAY GAME LAB →</Text>
            </View>
          </Link>
        ))}
      </View>
      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>Integration rule</Text>
        <Text style={styles.ruleText}>Game Lab → verify gameplay → connect final character art/animation → attach result contract → place at Kingdom station → persist rewards and visible world changes. No game directly mutates live Kingdom progress before that integration stage.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{flexGrow:1,backgroundColor:'#07130d',paddingHorizontal:18,paddingTop:48,paddingBottom:72,gap:24},
  header:{width:'100%',maxWidth:1180,alignSelf:'center',gap:8},kicker:{color:'#d5b85a',fontSize:12,fontWeight:'900',letterSpacing:1.4},title:{color:'#fff',fontSize:42,fontWeight:'900'},copy:{color:'#b9cdbf',fontSize:16,lineHeight:24,maxWidth:820},
  grid:{width:'100%',maxWidth:1180,alignSelf:'center',flexDirection:'row',flexWrap:'wrap',gap:16},link:{minWidth:270,flexGrow:1,flexBasis:300,textDecorationLine:'none'},card:{minHeight:225,borderRadius:22,backgroundColor:'#10251a',borderWidth:1,borderColor:'#294b37',padding:20,gap:6},character:{color:'#d5b85a',fontSize:13,fontWeight:'900',letterSpacing:1},world:{color:'#91b59d',fontSize:13,fontWeight:'700'},gameTitle:{color:'#fff',fontSize:27,fontWeight:'900',marginTop:12},mechanic:{color:'#c6d7cb',fontSize:14,lineHeight:21,flexGrow:1},play:{color:'#f3d779',fontSize:13,fontWeight:'900',marginTop:12},
  ruleCard:{width:'100%',maxWidth:1180,alignSelf:'center',borderRadius:18,backgroundColor:'#0e2017',padding:18,gap:6},ruleTitle:{color:'#fff',fontSize:17,fontWeight:'900'},ruleText:{color:'#a9c0af',lineHeight:21}
});
