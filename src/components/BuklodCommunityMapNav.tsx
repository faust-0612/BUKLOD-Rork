import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const compact = width < 560;

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
          minHeight: 64,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        headerCopy: {
          flex: 1,
          minWidth: 0,
        },
        eyebrow: {
          color: theme.accent,
          fontSize: 10,
          lineHeight: 13,
          fontWeight: '900',
          letterSpacing: 1.15,
        },
        subtitle: {
          marginTop: 3,
          color: theme.textMuted,
          fontSize: 11,
          lineHeight: 16,
          fontWeight: '700',
        },
        mapButton: {
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.headerSurface,
        },
        mapButtonPressed: {
          opacity: 0.7,
        },
        mapCta: {
          marginHorizontal: 12,
          marginBottom: 10,
          minHeight: 48,
          borderRadius: 14,
          paddingHorizontal: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.headerSurface,
        },
        mapCtaCopy: {
          flex: 1,
          minWidth: 0,
        },
        mapCtaTitle: {
          color: theme.textPrimary,
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '900',
        },
        mapCtaSub: {
          marginTop: 1,
          color: theme.textMuted,
          fontSize: 9.5,
          lineHeight: 13,
          fontWeight: '700',
        },
        doors: {
          paddingHorizontal: 12,
          paddingBottom: 12,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 9,
        },
        door: {
          width: compact ? '100%' : '48.6%',
          minHeight: 58,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        doorIcon: {
          width: 34,
          height: 34,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.headerSurface,
        },
        doorTitle: {
          flex: 1,
          minWidth: 0,
          color: theme.textPrimary,
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '900',
        },
      }),
    [compact, theme],
  );

  const openMap = () => {
    router.push('/city' as any);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD NAVIGATION</Text>
          <Text style={styles.subtitle}>
            Community places, organizations, Bayanihan and your Home.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Community Map"
          onPress={openMap}
          style={({ pressed }) => [
            styles.mapButton,
            pressed && styles.mapButtonPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="map-marker-radius-outline"
            size={23}
            color={theme.accent}
          />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open live Community Map"
        onPress={openMap}
        style={({ pressed }) => [
          styles.mapCta,
          pressed && styles.mapButtonPressed,
        ]}
      >
        <MaterialCommunityIcons
          name="map-outline"
          size={23}
          color={theme.accent}
        />
        <View style={styles.mapCtaCopy}>
          <Text style={styles.mapCtaTitle}>Community Map</Text>
          <Text style={styles.mapCtaSub}>
            Open the interactive BUKLOD City map and places.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={19}
          color={theme.textMuted}
        />
      </Pressable>

      <View style={styles.doors}>
        {MAP_DOORS.map((door) => (
          <Pressable
            key={door.key}
            accessibilityRole="button"
            accessibilityLabel={`Open ${door.title}`}
            onPress={() => router.push(door.route as any)}
            style={({ pressed }) => [
              styles.door,
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <View style={styles.doorIcon}>
              <MaterialCommunityIcons
                name={door.icon}
                size={20}
                color={theme.accent}
              />
            </View>
            <Text
              numberOfLines={compact ? 1 : 2}
              style={styles.doorTitle}
            >
              {door.title}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.textMuted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
