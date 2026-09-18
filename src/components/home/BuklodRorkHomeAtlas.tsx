import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';

type RoomId = 'night' | 'study' | 'relax' | 'kitchen' | 'living' | 'drawer' | 'budget' | 'bayanihan' | 'door';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Room = {
  id: RoomId;
  label: string;
  icon: IconName;
  accent: string;
  left: string;
  top: string;
  width: string;
  height: string;
  route?: string;
};

const ROOMS: readonly Room[] = [
  { id: 'night', label: 'Good Night', icon: 'weather-night', accent: '#2A2118', left: '18%', top: '14%', width: '64%', height: '19%', route: '/personal-home/reminders' },
  { id: 'study', label: 'Study & Work', icon: 'laptop', accent: '#16565A', left: '6%', top: '35%', width: '40%', height: '16%', route: '/profile/buklod-classrooms' },
  { id: 'relax', label: 'Relax & Enjoy', icon: 'sofa-outline', accent: '#6E8C3A', left: '54%', top: '35%', width: '40%', height: '16%', route: '/igpat' },
  { id: 'kitchen', label: 'Kitchen', icon: 'silverware-fork-knife', accent: '#C9552F', left: '4%', top: '53%', width: '28%', height: '17.5%', route: '/personal-home/recipe' },
  { id: 'living', label: 'Living / Character', icon: 'account-star-outline', accent: '#16565A', left: '34%', top: '53%', width: '32%', height: '17.5%', route: '/points' },
  { id: 'drawer', label: 'My Drawer', icon: 'archive-outline', accent: '#7A4A28', left: '68%', top: '53%', width: '28%', height: '17.5%' },
  { id: 'budget', label: 'Budget & Money', icon: 'wallet-outline', accent: '#E8A22B', left: '8%', top: '72.5%', width: '38%', height: '11.5%', route: '/personal-home/budget' },
  { id: 'bayanihan', label: 'Household / Bayanihan', icon: 'account-group-outline', accent: '#C9552F', left: '54%', top: '72.5%', width: '38%', height: '11.5%', route: '/bayanihan' },
  { id: 'door', label: 'Main Door / Market / City', icon: 'door-open', accent: '#7A4A28', left: '0%', top: '86%', width: '100%', height: '10.5%', route: '/city' },
] as const;

const P = {
  cream: '#F4E6CE',
  plaster: '#EFDFC4',
  terracotta: '#C9552F',
  teal: '#16565A',
  wood: '#7A4A28',
  woodDark: '#4A2C1A',
  ink: '#2A2118',
  white: '#FFF8EC',
};

export default function BuklodRorkHomeAtlas({ onOpenDetails }: { onOpenDetails: () => void }) {
  const { width } = useWindowDimensions();
  const [night, setNight] = useState(false);
  const sceneWidth = Math.min(Math.max(width - 20, 320), 620);
  const sceneHeight = sceneWidth / 0.74;
  const characterHeight = Math.max(56, Math.min(102, sceneWidth * 0.18));

  const stars = useMemo(() => [11, 26, 39, 55, 73, 88], []);

  const openRoom = (room: Room) => {
    if (room.id === 'drawer') {
      onOpenDetails();
      Alert.alert('My Drawer', 'Opened Home details where your personal drawer and notes are kept.');
      return;
    }
    if (room.route) router.push(room.route as any);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { width: sceneWidth }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>BUKLOD</Text>
          <Text style={styles.greeting}>{night ? 'Magandang gabi.' : 'Magandang umaga.'}</Text>
          <Text style={styles.sub}>Your personal digital house — tap a room to step in.</Text>
        </View>
        <Pressable
          onPress={() => setNight((value) => !value)}
          style={styles.themeButton}
          accessibilityRole="button"
          accessibilityLabel={night ? 'Switch Home to day' : 'Switch Home to night'}
        >
          <MaterialCommunityIcons name={night ? 'weather-night' : 'white-balance-sunny'} size={20} color={P.ink} />
        </Pressable>
      </View>

      <View style={[styles.scene, { width: sceneWidth, height: sceneHeight, backgroundColor: night ? '#1D2430' : '#9FD8D2' }]}>
        {night
          ? stars.map((x, index) => (
              <View
                key={x}
                style={[styles.star, { left: x + '%', top: 5 + (index % 3) * 4 + '%' }]}
              />
            ))
          : null}
        <View style={[styles.sun, { backgroundColor: night ? '#F4E6CE' : '#F2C15C', opacity: night ? 0.6 : 0.85 }]} />
        <View style={styles.roof} />
        <View style={[styles.houseBody, { backgroundColor: night ? '#34291F' : '#D8BC8A' }]} />

        {[33, 51, 70.5, 84].map((top) => (
          <View key={top} style={[styles.beam, { top: top + '%' }]} />
        ))}

        {ROOMS.map((room) => {
          const dark = night && room.id !== 'night';
          return (
            <Pressable
              key={room.id}
              onPress={() => openRoom(room)}
              accessibilityRole="button"
              accessibilityLabel={'Open ' + room.label}
              style={({ pressed }) => [
                styles.room,
                {
                  left: room.left as any,
                  top: room.top as any,
                  width: room.width as any,
                  height: room.height as any,
                  backgroundColor: dark ? '#3A332B' : P.plaster,
                  borderColor: room.accent,
                },
                pressed && styles.roomPressed,
              ]}
            >
              <View style={[styles.roomGlow, { backgroundColor: room.accent, opacity: dark ? 0.08 : 0.13 }]} />
              <MaterialCommunityIcons name={room.icon} size={room.id === 'door' ? 22 : 28} color={dark ? '#CFC5B5' : room.accent} />
              {room.id === 'living' ? (
                <View pointerEvents="none" style={styles.characterSlot}>
                  <BuklodActiveCharacterArt
                    fallbackCharacter={DEFAULT_CHARACTER}
                    height={characterHeight}
                    viewportWidth={characterHeight * 0.72}
                  />
                </View>
              ) : null}
              <View style={styles.plaque}>
                <View style={[styles.plaqueIcon, { backgroundColor: room.accent }]}>
                  <MaterialCommunityIcons name={room.icon} size={10} color={P.white} />
                </View>
                <Text numberOfLines={1} style={styles.plaqueText}>{room.label}</Text>
              </View>
            </Pressable>
          );
        })}

        <View pointerEvents="none" style={styles.floorShade} />
      </View>

      <Pressable
        onPress={onOpenDetails}
        style={[styles.detailsButton, { width: sceneWidth }]}
        accessibilityRole="button"
        accessibilityLabel="Open full Home details and tools"
      >
        <MaterialCommunityIcons name="view-dashboard-outline" size={18} color={P.teal} />
        <Text style={styles.detailsText}>Open full Home details & tools</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: P.cream, paddingTop: 12, paddingBottom: 8 },
  header: { minHeight: 78, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  brand: { color: P.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  greeting: { marginTop: 4, color: P.ink, fontSize: 27, fontWeight: '900', letterSpacing: -0.8 },
  sub: { marginTop: 3, color: 'rgba(42,33,24,0.62)', fontSize: 12, fontWeight: '600' },
  themeButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: P.plaster, borderWidth: 1, borderColor: 'rgba(122,74,40,0.28)' },
  scene: { position: 'relative', overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(122,74,40,0.32)', shadowColor: '#3A2A1C', shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  star: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: P.white, opacity: 0.8 },
  sun: { position: 'absolute', right: '8%', top: '4%', width: 58, height: 58, borderRadius: 29 },
  roof: { position: 'absolute', left: '8%', right: '8%', top: '6%', height: '10%', backgroundColor: '#9E3F22', borderTopLeftRadius: 220, borderTopRightRadius: 220 },
  houseBody: { position: 'absolute', left: 0, right: 0, top: '13.5%', bottom: '3.5%' },
  beam: { position: 'absolute', left: '4%', width: '92%', height: 9, marginTop: -4, borderRadius: 5, backgroundColor: P.wood, zIndex: 12, shadowColor: P.woodDark, shadowOpacity: 0.28, shadowRadius: 4 },
  room: { position: 'absolute', zIndex: 10, borderWidth: 1.3, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: P.woodDark, shadowOpacity: 0.2, shadowRadius: 5 },
  roomPressed: { transform: [{ scale: 0.975 }], opacity: 0.9 },
  roomGlow: { ...StyleSheet.absoluteFillObject },
  plaque: { position: 'absolute', left: 5, right: 5, bottom: 5, minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, borderRadius: 12, backgroundColor: 'rgba(255,248,236,0.93)' },
  plaqueIcon: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  plaqueText: { flex: 1, color: P.ink, fontSize: 8.4, fontWeight: '900' },
  characterSlot: { position: 'absolute', bottom: 17, alignItems: 'center', justifyContent: 'flex-end' },
  floorShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '7%', backgroundColor: 'rgba(74,44,26,0.20)' },
  detailsButton: { marginTop: 10, minHeight: 44, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(22,86,90,0.20)', backgroundColor: '#FFF8EC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  detailsText: { color: P.teal, fontSize: 12, fontWeight: '900' },
});
