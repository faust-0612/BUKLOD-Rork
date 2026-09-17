import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import {
  getBuklodCityPointRoute,
  getBuklodCitySnapshot,
  type BuklodCityPoint,
} from '@/lib/buklodCity';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type NativeMapType = 'standard' | 'satellite' | 'hybrid';

type Shortcut = {
  key: string;
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
};

const SHORTCUTS: Shortcut[] = [
  { key: 'faith', title: 'Faith / Church', icon: 'church-outline', route: '/church' },
  { key: 'school', title: 'School', icon: 'school-outline', route: '/profile/buklod-classrooms' },
  { key: 'market', title: 'Palengke', icon: 'shopping-outline', route: '/profile/buklod-market' },
  { key: 'business', title: 'Businesses', icon: 'storefront-outline', route: '/profile/buklod-business' },
  { key: 'organizations', title: 'Organizations', icon: 'account-group-outline', route: '/organizations' },
  { key: 'local', title: 'Local / Government', icon: 'bank-outline', route: '/profile/buklod-local' },
  { key: 'bayanihan', title: 'Bayanihan', icon: 'hand-heart-outline', route: '/bayanihan' },
  { key: 'home', title: 'My Home', icon: 'home-heart', route: '/personal-home' },
];

const DEFAULT_REGION: Region = {
  latitude: 12.8797,
  longitude: 121.774,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

function categoryIcon(category: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  switch (category) {
    case 'faith': return 'church-outline';
    case 'school': return 'school-outline';
    case 'market': return 'shopping-outline';
    case 'business': return 'storefront-outline';
    case 'government': return 'bank-outline';
    case 'organization': return 'account-group-outline';
    case 'event': return 'calendar-star';
    case 'service': return 'hand-heart-outline';
    case 'bayanihan': return 'account-heart-outline';
    default: return 'map-marker-outline';
  }
}

async function openTurnByTurn(point: BuklodCityPoint) {
  if (point.kind === 'PERSON' || String(point.category).toLowerCase() === 'people') {
    Alert.alert('Navigation unavailable', 'People-presence pins are not exposed as travel destinations.');
    return;
  }

  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  const encoded = encodeURIComponent(`${latitude},${longitude}`);
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving&dir_action=navigate`;

  try {
    if (Platform.OS === 'android') {
      await Linking.openURL(`google.navigation:q=${encoded}&mode=d`);
      return;
    }
    if (Platform.OS === 'ios') {
      await Linking.openURL(`comgooglemaps://?daddr=${encoded}&directionsmode=driving`);
      return;
    }
  } catch {
    // Fall through to the universal Google Maps URL.
  }

  await Linking.openURL(fallback);
}

export default function BuklodCommunityMapNav() {
  const { theme } = useBuklodTheme();
  const mapRef = useRef<MapView | null>(null);
  const [mapType, setMapType] = useState<NativeMapType>('hybrid');
  const [points, setPoints] = useState<BuklodCityPoint[]>([]);
  const [selected, setSelected] = useState<BuklodCityPoint | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const snapshot = await getBuklodCitySnapshot();
        if (!active) return;
        setPoints([...snapshot.institutions, ...snapshot.items].filter(point => point.kind !== 'PERSON'));
      } catch (error) {
        console.warn('BUKLOD native map snapshot', error);
      } finally {
        if (active) setLoadingPoints(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let active = true;

    void (async () => {
      try {
        const current = await Location.getForegroundPermissionsAsync();
        const permission = current.status === 'granted'
          ? current
          : await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') return;

        setLocationGranted(true);
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        setUserLocation(first.coords);
        mapRef.current?.animateToRegion({
          latitude: first.coords.latitude,
          longitude: first.coords.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        }, 600);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 20,
            timeInterval: 5000,
          },
          update => {
            if (active) setUserLocation(update.coords);
          },
        );
      } catch (error) {
        console.warn('BUKLOD native map location', error);
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const styles = useMemo(() => StyleSheet.create({
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
      minHeight: 54,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
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
      fontSize: 10.5,
      lineHeight: 14,
      fontWeight: '700',
    },
    mapWrap: {
      height: 355,
      marginHorizontal: 10,
      borderRadius: 17,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.canvas,
    },
    map: { flex: 1 },
    mapControls: {
      position: 'absolute',
      right: 9,
      top: 9,
      gap: 7,
      alignItems: 'flex-end',
    },
    control: {
      minHeight: 34,
      paddingHorizontal: 9,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.94)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#C8D5CF',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    controlText: { fontSize: 9, fontWeight: '900', color: '#174D31' },
    markerBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detail: {
      marginHorizontal: 10,
      marginTop: 8,
      padding: 10,
      borderRadius: 14,
      backgroundColor: theme.headerSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    detailTitle: { color: theme.textPrimary, fontSize: 12, fontWeight: '900' },
    detailSub: { marginTop: 2, color: theme.textMuted, fontSize: 10, lineHeight: 14 },
    detailActions: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    primaryAction: {
      minHeight: 34,
      borderRadius: 10,
      paddingHorizontal: 11,
      backgroundColor: theme.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    primaryActionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
    secondaryAction: {
      minHeight: 34,
      borderRadius: 10,
      paddingHorizontal: 11,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    secondaryActionText: { color: theme.textPrimary, fontSize: 9, fontWeight: '900' },
    status: { marginHorizontal: 12, marginTop: 7, fontSize: 9, color: theme.textMuted },
    shortcuts: { paddingHorizontal: 10, paddingVertical: 10, gap: 7 },
    shortcut: {
      minHeight: 38,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    shortcutText: { color: theme.textPrimary, fontSize: 9, fontWeight: '900' },
  }), [theme]);

  const recenter = () => {
    if (!userLocation) {
      Alert.alert('Location unavailable', 'Allow location access to center the BUKLOD map on your live position.');
      return;
    }
    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    }, 500);
  };

  const cycleMapType = () => {
    setMapType(current => current === 'hybrid' ? 'satellite' : current === 'satellite' ? 'standard' : 'hybrid');
  };

  const openSelectedInBuklod = () => {
    if (!selected) return;
    const route = getBuklodCityPointRoute(selected);
    if (route) router.push(route as any);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BUKLOD NAVIGATION</Text>
          <Text style={styles.subtitle}>Live GPS + native Google map · satellite/hybrid view · real turn-by-turn handoff.</Text>
        </View>
        <MaterialCommunityIcons name="navigation-variant-outline" size={23} color={theme.accent} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          mapType={mapType}
          showsUserLocation={locationGranted}
          showsMyLocationButton={false}
          showsCompass
          showsTraffic
          showsBuildings
          toolbarEnabled={false}
          onPress={() => setSelected(null)}
        >
          {points.map(point => (
            <Marker
              key={point.id}
              coordinate={{ latitude: point.latitude, longitude: point.longitude }}
              title={point.title}
              description={point.subtitle ?? point.description ?? undefined}
              onPress={() => setSelected(point)}
              tracksViewChanges={false}
            >
              <View style={styles.markerBubble}>
                <MaterialCommunityIcons name={categoryIcon(String(point.category))} size={16} color="#FFFFFF" />
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={styles.mapControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change map type" onPress={cycleMapType} style={({ pressed }) => [styles.control, pressed && { opacity: .7 }]}>
            <MaterialCommunityIcons name="layers-triple-outline" size={15} color="#174D31" />
            <Text style={styles.controlText}>{mapType.toUpperCase()}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Center map on my location" onPress={recenter} style={({ pressed }) => [styles.control, pressed && { opacity: .7 }]}>
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#174D31" />
            <Text style={styles.controlText}>MY LOCATION</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.status}>
        {loadingPoints ? 'Loading BUKLOD places…' : `${points.length} BUKLOD places loaded.`} Satellite imagery is map-provider imagery; your GPS position is live when location is allowed.
      </Text>

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>{selected.title}</Text>
          <Text style={styles.detailSub}>{selected.subtitle ?? selected.description ?? 'BUKLOD destination'}</Text>
          <View style={styles.detailActions}>
            <Pressable onPress={() => void openTurnByTurn(selected)} style={({ pressed }) => [styles.primaryAction, pressed && { opacity: .72 }]}>
              <MaterialCommunityIcons name="navigation-variant" size={15} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>START NAVIGATION</Text>
            </Pressable>
            {getBuklodCityPointRoute(selected) ? (
              <Pressable onPress={openSelectedInBuklod} style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: .72 }]}>
                <MaterialCommunityIcons name="open-in-app" size={15} color={theme.textPrimary} />
                <Text style={styles.secondaryActionText}>OPEN IN BUKLOD</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
        {SHORTCUTS.map(item => (
          <Pressable key={item.key} onPress={() => router.push(item.route as any)} style={({ pressed }) => [styles.shortcut, pressed && { opacity: .72 }]}>
            <MaterialCommunityIcons name={item.icon} size={15} color={theme.accent} />
            <Text style={styles.shortcutText}>{item.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
