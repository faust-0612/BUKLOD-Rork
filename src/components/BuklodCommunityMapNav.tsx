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
  placement:
    | 'topLeft'
    | 'topRight'
    | 'upperMiddleLeft'
    | 'upperMiddleRight'
    | 'lowerMiddleLeft'
    | 'lowerMiddleRight'
    | 'bottomLeft'
    | 'bottomRight';
};

/*
 * BUKLOD COMMUNITY MAP NAVIGATION
 *
 * Keep this map focused on canonical community destinations only.
 * Focus/support apps (Report, Quiz, Classroom utilities, Quick Check, etc.)
 * belong in Profile -> BUKLOD Focus Apps and must not be duplicated here.
 */
const MAP_DOORS: MapDoor[] = [
  {
    key: 'faith',
    title: 'Faith / Church',
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
    title: 'Palengke',
    icon: 'shopping-outline',
    route: '/profile/buklod-market',
    placement: 'upperMiddleLeft',
  },
  {
    key: 'business',
    title: 'Businesses',
    icon: 'storefront-outline',
    route: '/profile/buklod-business',
    placement: 'upperMiddleRight',
  },
  {
    key: 'organizations',
    title: 'Organizations',
    icon: 'account-group-outline',
    route: '/organizations',
    placement: 'lowerMiddleLeft',
  },
  {
    key: 'local',
    title: 'Local / Government',
    icon: 'bank-outline',
    route: '/profile/buklod-local',
    placement: 'lowerMiddleRight',
  },
  {
    key: 'bayanihan',
    title: 'Bayanihan',
    icon: 'hand-heart-outline',
    route: '/bayanihan',
    placement: 'bottomLeft',
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
          minHeight: 300,
          marginHorizontal: 10,
          marginBottom: 10,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.canvas,
          overflow: 'hidden',
        },
        roadHorizontalTop: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: '25%',
          height: 14,
          backgroundColor: theme.border,
          opacity: 0.5,
        },
        roadHorizontalMiddle: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 14,
          backgroundColor: theme.border,
          opacity: 0.5,
        },
        roadHorizontalBottom: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: '75%',
          height: 14,
          backgroundColor: theme.border,
          opacity: 0.5,
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
        centerMarker: {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 26,
          height: 26,
          marginLeft: -13,
          marginTop: -6,
          borderRadius: 13,
          borderWidth: 3,
          borderColor: theme.canvas,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
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
          zIndex: 2,
        },
        topLeft: { left: '5%', top: 10 },
        topRight: { right: '5%', top: 10 },
        upperMiddleLeft: { left: '5%', top: 82 },
        upperMiddleRight: { right: '5%', top: 82 },
        lowerMiddleLeft: { left: '5%', top: 154 },
        lowerMiddleRight: { right: '5%', top: 154 },
        bottomLeft: { left: '5%', bottom: 10 },
        bottomRight: { right: '5%', bottom: 10 },
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
          <Text style={styles.eyebrow}>BUKLOD NAVIGATION</Text>
          <Text style={styles.subtitle}>
            Community places, organizations, Bayanihan and your Home.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="map-marker-radius-outline"
          size={23}
          color={theme.accent}
        />
      </View>

      <View style={styles.map}>
        <View pointerEvents="none" style={styles.roadHorizontalTop} />
        <View pointerEvents="none" style={styles.roadHorizontalMiddle} />
        <View pointerEvents="none" style={styles.roadHorizontalBottom} />
        <View pointerEvents="none" style={styles.roadVertical} />
        <View pointerEvents="none" style={styles.centerMarker}>
          <MaterialCommunityIcons
            name="map-marker"
            size={15}
            color={theme.surface}
          />
        </View>

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
