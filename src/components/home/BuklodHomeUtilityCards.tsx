import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { launchBuklodHealthCenter } from '@/lib/buklodHealthCenterLauncher';

/**
 * Public Home shows consultation as the primary Health Center action.
 * The standalone PWA remains a separate, explicit door: no health state,
 * BUKLOD tokens, or personal data cross the launcher boundary.
 */
export default function BuklodHomeUtilityCards() {
  const { theme } = useBuklodTheme();
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
        onPress={() => router.push('/personal-home' as any)}
        style={({ pressed }) => [s.card, s.homeCard, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={s.miniHouse} accessibilityLabel="Bahay room layout preview">
          <View style={s.roof}>
            <MaterialCommunityIcons name="home-roof" size={19} color="#FFFFFF" />
          </View>
          <View style={s.houseRooms}>
            {(['sofa-outline', 'silverware-fork-knife', 'bed-outline', 'flower-outline'] as const)
              .map(icon => (
                <View key={icon} style={s.miniRoom}>
                  <MaterialCommunityIcons name={icon} size={13} color="#31543E" />
                </View>
              ))}
          </View>
        </View>
        <Text style={s.title}>My BUKLOD Home</Text>
        <Text style={s.subtitle} numberOfLines={3}>
          Family · chores · bills · notes · garden
        </Text>
        <View style={s.bottom}>
          <Text style={[s.open, { color: theme.accent }]}>Open my home</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={theme.accent} />
        </View>
      </Pressable>

      <View style={[s.card, s.healthCard]} accessibilityLabel={healthCard.title}>
        <View style={s.healthHeader}>
          <View style={s.healthIcon}>
            <MaterialCommunityIcons name="heart-pulse" size={24} color="#136348" />
          </View>
          <Text style={s.healthTitle}>{healthCard.title}</Text>
        </View>
        <Text style={s.healthSubtitle} numberOfLines={2}>Health guide · urgent warning-sign check</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Online Consultation"
          onPress={() => router.push('/profile/buklod-health' as any)}
          style={({ pressed }) => [s.primaryDoor, pressed && s.pressed]}
        >
          <MaterialCommunityIcons name="message-text-outline" size={16} color="#FFFFFF" />
          <Text style={s.primaryDoorText} numberOfLines={2}>Online Consultation</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full standalone Health Center"
          onPress={() => void openStandaloneHealth()}
          style={({ pressed }) => [s.secondaryDoor, pressed && s.pressed]}
        >
          <Text style={s.secondaryDoorText} numberOfLines={2}>Full Health Center</Text>
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
    width: '48.5%', aspectRatio: 1, minHeight: 216, flexGrow: 1,
    borderRadius: 12, borderWidth: 2, padding: 10, gap: 6,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.17,
    shadowRadius: 7, elevation: 3,
  },
  homeCard: { backgroundColor: '#E0FFF7', borderColor: '#00E6B5', shadowColor: '#00CFA5' },
  // Keep the approved high-contrast neon Health card identity while adding consultation doors.
  healthCard: { backgroundColor: '#FFF0FD', borderColor: '#F14AE0', shadowColor: '#DD2AD2' },
  miniHouse: { width: 86, borderWidth: 1, borderColor: '#C6D8C8', borderRadius: 3, overflow: 'hidden' },
  roof: { height: 20, backgroundColor: '#6D4A31', alignItems: 'center', justifyContent: 'center' },
  houseRooms: { flexDirection: 'row', flexWrap: 'wrap', padding: 3, gap: 3, backgroundColor: '#F1F7EF' },
  miniRoom: { width: 36, height: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DBE6DA' },
  title: { fontWeight: '900', fontSize: 15, lineHeight: 19, color: '#153F36' },
  subtitle: { fontSize: 12, lineHeight: 16, flex: 1, color: '#426258' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  open: { fontSize: 12, fontWeight: '800', flex: 1 },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#D5F1DF', alignItems: 'center', justifyContent: 'center' },
  healthTitle: { color: '#153F36', fontSize: 15, fontWeight: '900', flexShrink: 1 },
  healthSubtitle: { color: '#426258', fontSize: 11, lineHeight: 15 },
  primaryDoor: { backgroundColor: '#126946', borderRadius: 9, minHeight: 42, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  primaryDoorText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  secondaryDoor: { backgroundColor: '#FFFFFF', borderRadius: 9, borderWidth: 1, borderColor: '#91CEB4', minHeight: 38, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  secondaryDoorText: { color: '#155743', fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.76 },
});
