import React from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';

import BuklodKingdomMap from '@/features/games/kingdom/BuklodKingdomMapPremium';

export default function BuklodKingdomScreen() {
  return (
    <View style={{ flex: 1 }}>
      <BuklodKingdomMap />
      <Pressable accessibilityRole="button" accessibilityLabel="Enter BUKLOD Empire Arena practice inside this app" onPress={() => router.push('/games/empire-arena' as never)} style={styles.arenaLink}>
        <MaterialCommunityIcons name="sword-cross" size={19} color="#fde7b5" />
        <View><Text style={styles.arenaTitle}>EMPIRE ARENA</Text><Text style={styles.arenaMeta}>In-app practice • Season 2 DEV</Text></View>
      </Pressable>
      <BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" />
    </View>
  );
}

const styles = StyleSheet.create({
  arenaLink: { position:'absolute', right:12, bottom:85, zIndex:3, flexDirection:'row', alignItems:'center', gap:8, minHeight:48, paddingHorizontal:12, paddingVertical:7, borderWidth:1, borderColor:'#f0d18d', borderRadius:14, backgroundColor:'#092d3be8' },
  arenaTitle: { fontSize:12, fontWeight:'900', color:'#ffe6b5' },
  arenaMeta: { fontSize:9, color:'#c3d4d0' },
});
