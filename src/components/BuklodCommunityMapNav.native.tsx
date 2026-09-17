/* BUKLOD_ANDROID_COMMUNITY_SATELLITE_MAP_R1 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getBuklodCitySnapshot,
  type BuklodCityPoint,
} from '@/lib/buklodCity';
import {
  loadMyBuklodHomeMapLocation,
  type BuklodHomeMapLocation,
} from '@/lib/buklodHomeLocation';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const FALLBACK_CENTER = {
  latitude: 14.4974,
  longitude: 121.2862,
};
const PREVIEW_HEIGHT = 220;
const POI_RADIUS_METERS = 4500;
const MAX_NEARBY_PLACES = 120;
const POI_RELOAD_DISTANCE_KM = 1.2;

const CATEGORY_COLORS: Record<string, string> = {
  faith: '#7254C8',
  school: '#2877DD',
  market: '#D9971D',
  business: '#DB7040',
  organization: '#168E8A',
  government: '#7753B7',
  community: '#319565',
  event: '#C54A69',
  service: '#35679D',
  bayanihan: '#319565',
  people: '#177552',
};

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

type NearbyPlace = MapCoordinate & {
  id: string;
  title: string;
  type: string;
  address: string;
  pinColor: string;
};

type Destination = MapCoordinate & {
  title: string;
};

function validCoordinate(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function regionForCoordinate(point: MapCoordinate): Region {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  };
}

function distanceKm(a: MapCoordinate, b: MapCoordinate) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function placeType(tags: Record<string, unknown>) {
  const amenity = String(tags.amenity ?? '').toLowerCase();
  const shop = String(tags.shop ?? '').toLowerCase();
  const office = String(tags.office ?? '').toLowerCase();
  const tourism = String(tags.tourism ?? '').toLowerCase();

  if (['hospital', 'clinic', 'doctors'].includes(amenity)) {
    return { type: 'Medical', color: '#D84747' };
  }
  if (amenity === 'pharmacy') return { type: 'Pharmacy', color: '#8E44AD' };
  if (['school', 'college', 'university'].includes(amenity)) {
    return { type: 'School', color: '#2877DD' };
  }
  if (amenity === 'police') return { type: 'Police', color: '#274C77' };
  if (amenity === 'fire_station') return { type: 'Fire station', color: '#C0392B' };
  if (amenity === 'marketplace') return { type: 'Market', color: '#D9971D' };
  if (['restaurant', 'cafe', 'fast_food'].includes(amenity)) {
    return { type: 'Food', color: '#D35400' };
  }
  if (['bank', 'atm'].includes(amenity)) return { type: 'Bank / ATM', color: '#1D6F42' };
  if (amenity === 'fuel') return { type: 'Fuel', color: '#59636E' };
  if (tourism === 'hotel') return { type: 'Hotel', color: '#7D3C98' };
  if (tourism === 'attraction') return { type: 'Attraction', color: '#148F77' };
  if (shop) {
    return {
      type: shop.replace(/_/g, ' '),
      color: '#DB7040',
    };
  }
  if (office) {
    return {
      type: office.replace(/_/g, ' '),
      color: '#607D8B',
    };
  }
  return { type: 'Place', color: '#35679D' };
}

function placeAddress(tags: Record<string, unknown>) {
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:barangay'],
    tags['addr:city'],
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function parseNearbyPlaces(payload: any): NearbyPlace[] {
  const rows = Array.isArray(payload?.elements) ? payload.elements : [];
  const seen = new Set<string>();
  const result: NearbyPlace[] = [];

  for (const element of rows) {
    if (result.length >= MAX_NEARBY_PLACES) break;

    const tags = (element?.tags ?? {}) as Record<string, unknown>;
    const title = String(tags.name ?? '').trim();
    const latitude = Number(element?.lat ?? element?.center?.lat);
    const longitude = Number(element?.lon ?? element?.center?.lon);

    if (!title || !validCoordinate(latitude, longitude)) continue;

    const key = `${title.toLowerCase()}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const meta = placeType(tags);
    result.push({
      id: `osm-${String(element?.type ?? 'place')}-${String(element?.id ?? key)}`,
      title,
      type: meta.type,
      address: placeAddress(tags),
      latitude,
      longitude,
      pinColor: meta.color,
    });
  }

  return result;
}

async function fetchNearbyPlaces(
  center: MapCoordinate,
  signal?: AbortSignal,
): Promise<NearbyPlace[]> {
  const query =
    '[out:json][timeout:10];(' +
    `nwr(around:${POI_RADIUS_METERS},${center.latitude},${center.longitude})["amenity"~"hospital|clinic|doctors|pharmacy|police|fire_station|school|college|university|bank|atm|fuel|marketplace|restaurant|cafe|fast_food"]["name"];` +
    `nwr(around:${POI_RADIUS_METERS},${center.latitude},${center.longitude})["shop"]["name"];` +
    `nwr(around:${POI_RADIUS_METERS},${center.latitude},${center.longitude})["office"]["name"];` +
    `nwr(around:${POI_RADIUS_METERS},${center.latitude},${center.longitude})["tourism"~"hotel|attraction"]["name"];` +
    ');out center 120;';

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!response.ok) continue;
      return parseNearbyPlaces(await response.json());
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
    }
  }

  return [];
}

function isNavigableBuklodPoint(point: BuklodCityPoint) {
  return point.kind !== 'PERSON' && String(point.category).toLowerCase() !== 'people';
}

export default function BuklodCommunityMapNav() {
  const { theme } = useBuklodTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const fullMapRef = useRef<MapView | null>(null);
  const poiAbortRef = useRef<AbortController | null>(null);
  const poiCenterRef = useRef<MapCoordinate | null>(null);
  const poiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [points, setPoints] = useState<BuklodCityPoint[]>([]);
  const [home, setHome] = useState<BuklodHomeMapLocation | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    let active = true;

    void getBuklodCitySnapshot()
      .then((snapshot) => {
        if (!active) return;
        setPoints([
          ...(snapshot.institutions ?? []),
          ...(snapshot.items ?? []),
          ...(snapshot.people ?? []),
        ]);
      })
      .catch(() => {
        if (active) setPoints([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setHome(null);
      return () => {
        active = false;
      };
    }

    void loadMyBuklodHomeMapLocation(user.id)
      .then((location) => {
        if (active) setHome(location);
      })
      .catch(() => {
        if (active) setHome(null);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const center = useMemo<MapCoordinate>(() => {
    if (home && validCoordinate(home.latitude, home.longitude)) {
      return {
        latitude: home.latitude,
        longitude: home.longitude,
      };
    }

    const preferred =
      points.find((point) => point.isMe || point.isMember || point.canManage) ??
      points[0];

    if (preferred && validCoordinate(preferred.latitude, preferred.longitude)) {
      return {
        latitude: preferred.latitude,
        longitude: preferred.longitude,
      };
    }

    return FALLBACK_CENTER;
  }, [home, points]);

  const loadPois = useCallback(async (nextCenter: MapCoordinate, force = false) => {
    const previous = poiCenterRef.current;
    if (
      !force &&
      previous &&
      distanceKm(previous, nextCenter) < POI_RELOAD_DISTANCE_KM
    ) {
      return;
    }

    poiCenterRef.current = nextCenter;
    poiAbortRef.current?.abort();
    const controller = new AbortController();
    poiAbortRef.current = controller;
    setPoiLoading(true);

    try {
      const rows = await fetchNearbyPlaces(nextCenter, controller.signal);
      if (!controller.signal.aborted) {
        setNearbyPlaces(rows);
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        // Keep BUKLOD + Home markers usable when external POI data is unavailable.
      }
    } finally {
      if (!controller.signal.aborted) setPoiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPois(center, true);
    return () => {
      poiAbortRef.current?.abort();
      if (poiTimerRef.current) clearTimeout(poiTimerRef.current);
    };
  }, [center.latitude, center.longitude, loadPois]);

  const initialRegion = useMemo(() => regionForCoordinate(center), [center]);

  const navigateToDestination = useCallback(async () => {
    if (!destination) return;
    const url =
      'https://www.google.com/maps/dir/?api=1' +
      `&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}` +
      '&travelmode=driving&dir_action=navigate';

    try {
      await Linking.openURL(url);
    } catch {
      // Navigation is optional; map itself remains usable.
    }
  }, [destination]);

  const schedulePoiReload = useCallback(
    (region: Region) => {
      if (!expanded) return;
      if (poiTimerRef.current) clearTimeout(poiTimerRef.current);
      poiTimerRef.current = setTimeout(() => {
        void loadPois(
          {
            latitude: region.latitude,
            longitude: region.longitude,
          },
          false,
        );
      }, 900);
    },
    [expanded, loadPois],
  );

  const renderMarkers = (interactive: boolean) => (
    <>
      {points.map((point) => {
        if (!validCoordinate(point.latitude, point.longitude)) return null;
        const navigable = isNavigableBuklodPoint(point);
        return (
          <Marker
            key={`buklod-${point.id}`}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            title={point.title}
            description={
              point.subtitle ||
              (point.verified ? 'Verified BUKLOD place' : 'BUKLOD place')
            }
            pinColor={CATEGORY_COLORS[String(point.category)] ?? '#35679D'}
            onPress={
              interactive && navigable
                ? () =>
                    setDestination({
                      title: point.title,
                      latitude: point.latitude,
                      longitude: point.longitude,
                    })
                : undefined
            }
          />
        );
      })}

      {nearbyPlaces.map((place) => (
        <Marker
          key={place.id}
          coordinate={{ latitude: place.latitude, longitude: place.longitude }}
          title={place.title}
          description={[place.type, place.address].filter(Boolean).join(' • ')}
          pinColor={place.pinColor}
          onPress={
            interactive
              ? () =>
                  setDestination({
                    title: place.title,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  })
              : undefined
          }
        />
      ))}

      {home ? (
        <Marker
          coordinate={{ latitude: home.latitude, longitude: home.longitude }}
          anchor={{ x: 0.5, y: 0.42 }}
          zIndex={1000}
          title="My BUKLOD Home"
          onPress={
            interactive
              ? () => router.push('/personal-home' as any)
              : undefined
          }
        >
          <View style={styles.homeMarker}>
            <View
              style={[
                styles.homeDoor,
                {
                  borderColor: theme.accent,
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <View style={[styles.homeBadge, { backgroundColor: theme.accent }]}>
                <Text style={styles.homeBadgeText}>HOME</Text>
              </View>
              <MaterialCommunityIcons name="home-heart" size={25} color={theme.accent} />
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.homeAddress,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              {home.localityLabel || 'My saved address'}
            </Text>
          </View>
        </Marker>
      ) : null}
    </>
  );

  const map = (interactive: boolean) => (
    <MapView
      ref={interactive ? fullMapRef : undefined}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      mapType="hybrid"
      initialRegion={initialRegion}
      loadingEnabled
      loadingBackgroundColor="#0D1720"
      loadingIndicatorColor={theme.accent}
      showsCompass={interactive}
      showsScale={interactive}
      toolbarEnabled={false}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      onRegionChangeComplete={interactive ? schedulePoiReload : undefined}
    >
      {renderMarkers(interactive)}
    </MapView>
  );

  return (
    <>
      <View
        style={[
          styles.shell,
          {
            borderColor: theme.border,
            backgroundColor: theme.surface,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>BUKLOD LIVE MAP</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Satellite • {poiLoading ? 'loading nearby places…' : `${nearbyPlaces.length} nearby places`}
            </Text>
          </View>
          <MaterialCommunityIcons name="satellite-variant" size={23} color={theme.accent} />
        </View>

        <View style={[styles.preview, { borderColor: theme.border }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {map(false)}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open BUKLOD live satellite map"
            onPress={() => {
              setDestination(null);
              setExpanded(true);
            }}
            style={({ pressed }) => [
              styles.previewTap,
              pressed && styles.previewTapPressed,
            ]}
          >
            <View style={styles.previewPrompt}>
              <MaterialCommunityIcons name="map-search-outline" size={18} color="#FFFFFF" />
              <Text style={styles.previewPromptText}>Tap map to open</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={expanded}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.fullscreen}>
          {map(true)}

          <View style={[styles.fullTop, { paddingTop: Math.max(insets.top + 8, 16) }]} pointerEvents="box-none">
            <View style={styles.statusPill}>
              <MaterialCommunityIcons name="satellite-variant" size={16} color="#FFFFFF" />
              <Text style={styles.statusText}>
                SATELLITE • {poiLoading ? 'LOADING PLACES' : `${nearbyPlaces.length} PLACES`}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close BUKLOD map"
              onPress={() => setExpanded(false)}
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.72 }]}
            >
              <MaterialCommunityIcons name="close" size={24} color="#17384A" />
            </Pressable>
          </View>

          {destination ? (
            <View
              style={[
                styles.navigationBar,
                { paddingBottom: Math.max(insets.bottom + 10, 18) },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.navigationEyebrow}>BUKLOD NAVIGATION</Text>
                <Text numberOfLines={1} style={styles.navigationTitle}>
                  {destination.title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${destination.title}`}
                onPress={() => void navigateToDestination()}
                style={({ pressed }) => [
                  styles.navigateButton,
                  pressed && { opacity: 0.74 },
                ]}
              >
                <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" />
                <Text style={styles.navigateText}>NAVIGATE</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  preview: {
    height: PREVIEW_HEIGHT,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 17,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0D1720',
    position: 'relative',
  },
  previewTap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,30,42,.06)',
  },
  previewTapPressed: {
    backgroundColor: 'rgba(12,30,42,.14)',
  },
  previewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(24,55,72,.86)',
  },
  previewPromptText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  fullscreen: {
    flex: 1,
    backgroundColor: '#0D1720',
  },
  fullTop: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusPill: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(20,48,65,.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D6E2E8',
  },
  navigationBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    minHeight: 72,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 11,
    backgroundColor: 'rgba(255,255,255,.98)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navigationEyebrow: {
    color: '#177552',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  navigationTitle: {
    marginTop: 2,
    color: '#183047',
    fontSize: 12,
    fontWeight: '900',
  },
  navigateButton: {
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 13,
    backgroundColor: '#177552',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navigateText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  homeMarker: {
    width: 150,
    alignItems: 'center',
    gap: 4,
  },
  homeDoor: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  homeBadge: {
    position: 'absolute',
    top: -10,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  homeBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  homeAddress: {
    maxWidth: 146,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
});
