import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

export default function BuklodFamilyPortal() {
  return (
    <>
      <Stack.Screen options={{ title: 'Family' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open My BUKLOD Home"
          onPress={() => router.push('/personal-home' as any)}
          style={({ pressed }) => [styles.house, pressed && styles.pressed]}>
          <LinearGradient colors={['#102D41', '#115A58', '#168A70']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
            <View style={styles.head}>
              <View style={styles.copy}>
                <Text allowFontScaling style={styles.kicker}>PERSONAL SPACE</Text>
                <Text allowFontScaling style={styles.houseTitle}>My BUKLOD Home</Text>
                <Text allowFontScaling style={styles.description}>Family · chores · bills · notes · garden</Text>
              </View>
              <MaterialCommunityIcons name="home-heart" size={34} color="#E7FFF0" />
            </View>
            <View style={styles.houseFooter}>
              <Text allowFontScaling style={styles.open}>Buksan ang bahay</Text>
              <MaterialCommunityIcons name="arrow-top-right" size={24} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Children's Story World"
          onPress={() => router.push('/children-stories' as any)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="book-open-page-variant" size={28} color="#17644B" />
          <View style={styles.rowCopy}>
            <Text allowFontScaling style={styles.rowTitle}>Children's Story World</Text>
            <Text allowFontScaling style={styles.rowDescription}>Mga kuwentong babasahin at pakikinggan</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#17644B" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Family workspace"
          onPress={() => router.push('/profile/buklod-family-workspace' as any)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="account-group-outline" size={27} color="#17644B" />
          <View style={styles.rowCopy}>
            <Text allowFontScaling style={styles.rowTitle}>Family Workspace</Text>
            <Text allowFontScaling style={styles.rowDescription}>Para sa may Family workspace access</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#17644B" />
        </Pressable>
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, paddingBottom: 32, gap: 12 },
  house: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#3D8579' },
  gradient: { padding: 18, gap: 17 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  kicker: { color: '#A8F4D8', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  houseTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  description: { color: '#E1F4EC', fontSize: 15, lineHeight: 22 },
  houseFooter: { paddingTop: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  open: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  row: { minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: '#CCE3D6', backgroundColor: '#F9FEFB', flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: '#153D30', fontSize: 17, fontWeight: '800' },
  rowDescription: { color: '#4F695D', fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.76 },
});
