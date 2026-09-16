import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type MapDoor = {
  key: string;
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
  placement: 'topLeft' | 'topRight' | 'middleLeft' | 'middleRight' | 'bottomLeft' | 'bottomRight';
};

const MAP_DOORS: MapDoor[] = [
  {
    key: 'faith',
    title: 'Faith',
    icon: 'church-outline',
    route: '/church',
    placement: 'topLeft',
  },
  {
    key: 'school',
    title: 'School',
    icon: 'school-outline',
    route: '/profile/buklod-classrooms',
    placement: 'topRight',
  },
  {
    key: 'market',
    title: 'Market',
    icon: 'shopping-outline',
    route: '/profile/buklod-market',
    placement: 'middleLeft',
  },
  {
    key: 'business',
    title: 'Business',
    icon: 'storefront-outline',
    route: '/profile/buklod-business',
    placement: 'middleRight',
  },
  {
    key: 'plaza',
    title: 'Bayanihan',
    icon: 'account-group-outline',
    route: '/bayanihan',
    placement: 'bottomLeft',
  },
  {
    key: 'home',
    title: 'My Home',
    icon: 'home-heart',
    route: '/personal-home',
    placement: 'bottomRight',
  },
];

export default function BuklodCommunityMapNav() {
  const { theme } = useBuklodTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          marginHorizontal: 12,
          marginTop: 8,
          marginBottom: 10,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          overflow: 'hidden',
        },
        header: {
          minHeight: 48,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        },
        eyebrow: {
          color: theme.accent,
          fontSize: 10,
          lineHeight: 13,
          fontWeight: '900',
          letterSpacing: 1.15,
        },
        subtitle: {
          marginTop: 2,
          color: theme.textMuted,
          fontSize: 11,
          lineHeight: 15,
          fontWeight: '700',
        },
        map: {
          position: 'relative',
          minHeight: 214,
          marginHorizontal: 10,
          marginBottom: 10,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.canvas,
          overflow: 'hidden',
        },
        roadHorizontal: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: '48%',
          height: 18,
          backgroundColor: theme.border,
          opacity: 0.55,
        },
        roadVertical: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '48%',
          width: 18,
          backgroundColor: theme.border,
          opacity: 0.55,
        },
        door: {
          position: 'absolute',
          width: '39%',
          minHeight: 52,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          paddingHorizontal: 9,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        topLeft: { left: '5%', top: 12 },
        topRight: { right: '5%', top: 12 },
        middleLeft: { left: '5%', top: 80 },
        middleRight: { right: '5%', top: 80 },
        bottomLeft: { left: '5%', bottom: 12 },
        bottomRight: { right: '5%', bottom: 12 },
        doorIcon: {
          width: 30,
          height: 30,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.headerSurface,
        },
        doorTitle: {
          flex: 1,
          color: theme.textPrimary,
          fontSize: 10,
          lineHeight: 13,
          fontWeight: '900',
        },
      }),
    [theme],
  );

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BUKLOD NAV</Text>
          <Text style={styles.subtitle}>Your community and home, one tap away.</Text>
        </View>
        <MaterialCommunityIcons
          name="map-marker-radius-outline"
          size={23}
          color={theme.accent}
        />
      </View>

      <View style={styles.map}>
        <View pointerEvents="none" style={styles.roadHorizontal} />
        <View pointerEvents="none" style={styles.roadVertical} />

        {MAP_DOORS.map((door) => (
          <Pressable
            key={door.key}
            accessibilityRole="button"
            accessibilityLabel={`Open ${door.title}`}
            onPress={() => router.push(door.route as any)}
            style={({ pressed }) => [
              styles.door,
              styles[door.placement],
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <View style={styles.doorIcon}>
              <MaterialCommunityIcons
                name={door.icon}
                size={19}
                color={theme.accent}
              />
            </View>
            <Text numberOfLines={2} style={styles.doorTitle}>
              {door.title}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={17}
              color={theme.textMuted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
