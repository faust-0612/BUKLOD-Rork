/* BUKLOD_NATIVE_COMMUNITY_MAP_R1_GOOGLE */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

import {
  getBuklodCitySnapshot,
  type BuklodCityPoint,
} from '@/lib/buklodCity';
import { useAuth } from '@/providers/AuthProvider';

const FALLBACK_REGION: Region = {
  latitude: 14.4974,
  longitude: 121.2862,
  latitudeDelta: 0.11,
  longitudeDelta: 0.11,
};

type Destination = {
  title: string;
  latitude: number;
  longitude: number;
  subtitle?: string | null;
};

function navigationUrl(destination: Destination) {
  return (
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(
      destination.latitude + ',' + destination.longitude,
    ) +
    '&travelmode=driving&dir_action=navigate'
  );
}

async function openDrivingNavigation(destination: Destination) {
  const fallback = navigationUrl(destination);

  if (Platform.OS === 'android') {
    const native =
      'google.navigation:q=' +
      encodeURIComponent(
        destination.latitude + ',' + destination.longitude,
      ) +
      '&mode=d';

    try {
      const supported = await Linking.canOpenURL(native);
      if (supported) {
        await Linking.openURL(native);
        return;
      }
    } catch {
      // Fall through to the universal Google Maps URL.
    }
  }

  await Linking.openURL(fallback);
}

function pointDestination(point: BuklodCityPoint): Destination {
  return {
    title: point.title,
    latitude: point.latitude,
    longitude: point.longitude,
    subtitle: point.subtitle ?? null,
  };
}

export default function BuklodNativeCommunityMapHeader() {
  const { user } = useAuth();
  const [points, setPoints] = useState<BuklodCityPoint[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [selected, setSelected] = useState<Destination | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setPoints([]);
      return () => {
        active = false;
      };
    }

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
  }, [user?.id]);

  const region = useMemo<Region>(() => {
    const preferred =
      points.find(
        (point) =>
          point.isMe ||
          point.isMember ||
          point.canManage,
      ) ??
      points[0] ??
      null;

    if (!preferred) return FALLBACK_REGION;

    return {
      latitude: preferred.latitude,
      longitude: preferred.longitude,
      latitudeDelta: 0.09,
      longitudeDelta: 0.09,
    };
  }, [points]);

  const fitBuklodPoints = () => {
    const coords = points
      .filter(
        (point) =>
          Number.isFinite(point.latitude) &&
          Number.isFinite(point.longitude),
      )
      .map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));

    if (!coords.length) return;

    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: 90,
        right: 55,
        bottom: 160,
        left: 55,
      },
      animated: true,
    });
  };

  const map = (interactive: boolean) => (
    <MapView
      ref={interactive ? mapRef : undefined}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      mapType={mapType}
      toolbarEnabled={false}
      showsTraffic
      showsBuildings
      showsPointsOfInterest
      pitchEnabled={interactive}
      rotateEnabled={interactive}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      onPoiClick={(event: any) => {
        const coordinate = event?.nativeEvent?.coordinate;
        const name = String(
          event?.nativeEvent?.name ??
          'Selected place',
        ).trim();

        if (
          !coordinate ||
          !Number.isFinite(coordinate.latitude) ||
          !Number.isFinite(coordinate.longitude)
        ) {
          return;
        }

        setSelected({
          title: name || 'Selected place',
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      }}
    >
      {points
        .filter(
          (point) =>
            Number.isFinite(point.latitude) &&
            Number.isFinite(point.longitude),
        )
        .map((point) => (
          <Marker
            key={point.id}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            title={point.title}
            description={
              point.subtitle ??
              point.description ??
              undefined
            }
            pinColor={
              point.kind === 'PERSON'
                ? '#177552'
                : point.category === 'business' ||
                    point.category === 'market'
                  ? '#D9971D'
                  : '#2877DD'
            }
            onPress={() => {
              if (
                point.kind === 'PERSON' ||
                String(point.category).toLowerCase() === 'people'
              ) {
                setSelected(null);
                return;
              }

              setSelected(
                pointDestination(point),
              );
            }}
          />
        ))}
    </MapView>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.preview}>
        {map(false)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD community map full screen"
          onPress={() => {
            setExpanded(true);
          }}
          style={styles.previewOverlay}
        >
          <View style={styles.previewPrompt}>
            <MaterialCommunityIcons
              name="map-marker-path"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.previewPromptText}>
              Tap map to open
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={expanded}
        animationType="fade"
        onRequestClose={() => {
          setExpanded(false);
        }}
      >
        <View style={styles.fullscreen}>
          {map(true)}

          <View style={styles.topControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fit BUKLOD places"
              onPress={fitBuklodPoints}
              style={styles.iconButton}
            >
              <MaterialCommunityIcons
                name="fit-to-screen-outline"
                size={21}
                color="#214A5D"
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch map type"
              onPress={() => {
                setMapType((current) =>
                  current === 'standard'
                    ? 'hybrid'
                    : 'standard',
                );
              }}
              style={styles.iconButton}
            >
              <MaterialCommunityIcons
                name={
                  mapType === 'standard'
                    ? 'satellite-variant'
                    : 'map-outline'
                }
                size={21}
                color="#214A5D"
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close map"
              onPress={() => {
                setExpanded(false);
              }}
              style={styles.iconButton}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color="#214A5D"
              />
            </Pressable>
          </View>

          <View style={styles.infoBar}>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>
                {selected?.title ??
                  'Tap a BUKLOD pin or Google place'}
              </Text>
              <Text style={styles.infoSub}>
                {selected
                  ? 'Ready for driving navigation and voice guidance.'
                  : 'Google Maps handles place names, traffic and zoom-level label density.'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start driving navigation"
              disabled={!selected}
              onPress={() => {
                if (selected) {
                  void openDrivingNavigation(selected);
                }
              }}
              style={[
                styles.navigateButton,
                !selected &&
                  styles.navigateButtonDisabled,
              ]}
            >
              <MaterialCommunityIcons
                name="navigation-variant"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.navigateText}>
                Navigate
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 8,
    marginBottom: 10,
  },
  preview: {
    height: 190,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E2E8',
    backgroundColor: '#E8EEF1',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,24,34,0.03)',
  },
  previewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(10,25,36,0.84)',
  },
  previewPromptText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  fullscreen: {
    flex: 1,
    backgroundColor: '#DDE5E8',
  },
  topControls: {
    position: 'absolute',
    top: 18,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    gap: 7,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D6E2E8',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  infoBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    zIndex: 12,
    minHeight: 76,
    padding: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: '#D6E2E8',
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoTitle: {
    color: '#173748',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  infoSub: {
    marginTop: 3,
    color: '#647B88',
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '700',
  },
  navigateButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#177552',
  },
  navigateButtonDisabled: {
    opacity: 0.4,
  },
  navigateText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
