/* One official in-app practice route for the 39 Kingdom games.
 * Account-scoped offline levels award NO BP or other real rewards.
 */
import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import gameCatalog from '@/features/games/kingdom/platform/game-catalog.json';
import { KingdomOfflineContinuation } from '@/features/games/kingdom/platform/KingdomOfflineContinuation';

const ALL_IDS = new Set(gameCatalog.characters.flatMap(center => center.games.map(game => game.id)));

export default function KingdomPracticeScreen() {
  const { user } = useAuth();
  const { gameId: gameParam } = useLocalSearchParams<{ gameId?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const gameId = typeof gameParam === 'string' && ALL_IDS.has(gameParam) ? gameParam : null;
  return <View style={styles.root}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[
      styles.container, {paddingTop:Math.max(12,insets.top)+10,paddingBottom:Math.max(20,insets.bottom)+20},
    ]}>
      <Pressable accessibilityRole="button" onPress={()=>router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#f2dbad"/>
        <Text style={styles.backText}>BACK TO KINGDOM GAMES</Text>
      </Pressable>
      <Text style={styles.title}>Kingdom Adventure Levels</Text>
      <Text style={styles.help}>5,000 deterministic practice levels per official game, playable without internet. Only separate server-verified Mastery earns BP; this practice awards no BP, XP or cash.</Text>
      {!user?.id ? <Text style={styles.notice}>Sign in to start or resume your offline adventure.</Text>
        : !gameId ? <Text style={styles.notice}>This game is not in the official Kingdom catalog.</Text>
        : <KingdomOfflineContinuation key={user.id+':'+gameId} gameId={gameId}/>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0b273a'},
  container:{flexGrow:1,width:'100%',maxWidth:730,alignSelf:'center',paddingHorizontal:13,gap:15},
  back:{alignSelf:'flex-start',minHeight:44,padding:10,flexDirection:'row',alignItems:'center',gap:8},
  backText:{color:'#f0d99c',fontWeight:'900',fontSize:12},
  title:{fontSize:24,fontWeight:'900',color:'#fff2d3'},
  help:{color:'#c4d9d6',fontSize:12,lineHeight:19},
  notice:{color:'#ffe1a3',fontSize:13,padding:14},
});
