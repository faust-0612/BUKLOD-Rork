import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { launchBuklodHealthCenter } from '@/lib/buklodHealthCenterLauncher';

/**
 * Public Home shows consultation as the primary Health Center action.
 * The standalone PWA remains a separate, explicit door: no health state,
 * BUKLOD tokens, or personal data cross the launcher boundary.
 */
export default function BuklodHomeUtilityCards() {
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale >= 1.5 || width < 370;
  const healthOpeningRef = React.useRef(false);

  const openStandaloneHealth = async () => {
    if (healthOpeningRef.current) return;
    healthOpeningRef.current = true;
    try {
      await launchBuklodHealthCenter(url => Linking.openURL(url));
    } catch {
      router.push('/profile/buklod-health' as any);
    } finally {
      healthOpeningRef.current = false;
    }
  };

  const healthCard = { id:'health', title: 'Health Center' };

  return (
    <View style={s.grid} accessibilityLabel="BUKLOD Home dashboard apps">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open My BUKLOD Home"
        accessibilityHint="Opens your personal household space"
        onPress={() => router.push('/personal-home' as any)}
        style={({ pressed }) => [s.homeLauncher, stacked && s.singleColumn, pressed && s.pressed]}
      >
        <LinearGradient
          colors={['#102D41', '#115A58', '#168A70']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.homeGradient}
        >
          <View style={s.homeHeader}>
            <View style={s.homeCopy}>
              <Text allowFontScaling style={s.homeKicker}>PERSONAL SPACE</Text>
              <Text allowFontScaling style={s.homeTitle}>My BUKLOD Home</Text>
              <Text allowFontScaling style={s.homeDescription}>
                Family · chores · bills · notes · garden
              </Text>
            </View>
            <View style={s.homeEmblem}>
              <MaterialCommunityIcons name="home-heart" size={31} color="#FFFFFF" />
            </View>
          </View>
          <View style={s.homeFooter}>
            <Text allowFontScaling style={s.homeOpen}>Open my home</Text>
            <View style={s.homeArrow}>
              <MaterialCommunityIcons name="arrow-top-right" size={21} color="#0B4D43" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <View style={[s.card, s.healthCard, stacked && s.singleColumn]} accessibilityLabel={healthCard.title}>
        <View style={s.healthHeader}>
          <View style={s.healthIcon}>
            <MaterialCommunityIcons name="heart-pulse" size={24} color="#136348" />
          </View>
          <Text style={s.healthTitle}>{healthCard.title}</Text>
        </View>
        <Text style={s.healthSubtitle} allowFontScaling>AI health guide · urgent sign check</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Online Consultation"
          onPress={() => router.push('/profile/buklod-health' as any)}
          style={({ pressed }) => [s.primaryDoor, pressed && s.pressed]}
        >
          <MaterialCommunityIcons name="message-text-outline" size={16} color="#FFFFFF" />
          <Text style={s.primaryDoorText} allowFontScaling>Online Consultation</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full standalone Health Center"
          onPress={() => void openStandaloneHealth()}
          style={({ pressed }) => [s.secondaryDoor, pressed && s.pressed]}
        >
          <Text style={s.secondaryDoorText} allowFontScaling>Full Health Center</Text>
          <MaterialCommunityIcons name="open-in-new" size={16} color="#155743" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginHorizontal: 0, paddingHorizontal: 0,
  },
  card: {
    width: '48.5%', minHeight: 180, flexGrow: 1,
    borderRadius: 14, borderWidth: 1, padding: 10, gap: 6,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.09,
    shadowRadius: 7, elevation: 3,
  },
  singleColumn: { width: '100%', flexGrow: 0 },
  homeLauncher: {
    width: '48.5%', minHeight: 174, flexGrow: 1, borderRadius: 18,
    overflow: 'hidden', borderWidth: 1, borderColor: '#276B65',
    backgroundColor: '#115A58', shadowColor: '#113F43',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14,
    shadowRadius: 12, elevation: 4,
  },
  homeGradient: {
    flex: 1, padding: 16, justifyContent: 'space-between', gap: 14,
  },
  homeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  homeCopy: { flex: 1, minWidth: 0, gap: 5 },
  homeKicker: {
    fontSize: 10, fontWeight: '900', letterSpacing: 1.15, color: '#A8F4D8',
  },
  homeTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900', color: '#FFFFFF' },
  homeDescription: { fontSize: 13, lineHeight: 19, color: '#E1F4EC' },
  homeEmblem: {
    width: 52, height: 52, flexShrink: 0, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  homeFooter: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 11, gap: 10,
  },
  homeOpen: { flex: 1, fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  homeArrow: {
    width: 33, height: 33, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8FFF3',
  },
  // Keep the approved high-contrast neon Health card identity while adding consultation doors.
  healthCard: { backgroundColor: '#FFF0FD', borderColor: '#F14AE0', shadowColor: '#DD2AD2' },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#D5F1DF', alignItems: 'center', justifyContent: 'center' },
  healthTitle: { color: '#153F36', fontSize: 15, fontWeight: '900', flexShrink: 1 },
  healthSubtitle: { color: '#426258', fontSize: 13, lineHeight: 19 },
  primaryDoor: { backgroundColor: '#126946', borderRadius: 9, minHeight: 48, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  primaryDoorText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  secondaryDoor: { backgroundColor: '#FFFFFF', borderRadius: 9, borderWidth: 1, borderColor: '#91CEB4', minHeight: 48, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  secondaryDoorText: { color: '#155743', fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.76 },
});
