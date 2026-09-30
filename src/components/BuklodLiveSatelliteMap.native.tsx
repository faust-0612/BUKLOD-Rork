import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BuklodCommunityMapDom from '@/components/BuklodCommunityMapDom';
import type { BuklodCityPoint } from '@/lib/buklodCity';
import {
  loadMyBuklodHomeMapLocation,
  type BuklodHomeMapLocation,
} from '@/lib/buklodHomeLocation';
import { useAuth } from '@/providers/AuthProvider';

const FALLBACK_CENTER = {
  latitude: 14.4974,
  longitude: 121.2862,
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Destination = Coordinate & {
  title: string;
  subtitle?: string | null;
  kind?: string | null;
  category?: string | null;
};

function finiteCoordinate(value: unknown): value is Coordinate {
  const point = value as Coordinate | null | undefined;

  return (
    !!point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

async function openVoiceNavigation(destination: Destination) {
  const coordinate =
    `${destination.latitude},${destination.longitude}`;

  const nativeUrl =
    Platform.OS === 'android'
      ? `google.navigation:q=${encodeURIComponent(coordinate)}&mode=d`
      : `comgooglemaps://?daddr=${encodeURIComponent(coordinate)}` +
        '&directionsmode=driving';

  const fallbackUrl =
    'https://www.google.com/maps/dir/?api=1' +
    `&destination=${encodeURIComponent(coordinate)}` +
    '&travelmode=driving&dir_action=navigate';

  try {
    if (await Linking.canOpenURL(nativeUrl)) {
      await Linking.openURL(nativeUrl);
      return true;
    }
  } catch {}

  try {
    await Linking.openURL(fallbackUrl);
    return true;
  } catch {
    return false;
  }
}

export function BuklodLiveSatelliteMap({
  points,
  center,
  expanded = false,
  onExpandedChange,
}: {
  points: BuklodCityPoint[];
  center?: Coordinate | null;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onShareLocation?: () => void;
  onManagePlace?: () => void;
  canManagePlace?: boolean;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const mobile = width < 720;
  const previewHeight = mobile ? 190 : 250;

  const [
    privateHomePoint,
    setPrivateHomePoint,
  ] = useState<BuklodHomeMapLocation | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!user?.id) {
      setPrivateHomePoint(null);

      return () => {
        mounted = false;
      };
    }

    void loadMyBuklodHomeMapLocation(user.id)
      .then(location => {
        if (mounted) {
          setPrivateHomePoint(location);
        }
      })
      .catch(() => {
        if (mounted) {
          setPrivateHomePoint(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const mapCenter = useMemo<Coordinate>(() => {
    if (finiteCoordinate(privateHomePoint)) {
      return {
        latitude: privateHomePoint.latitude,
        longitude: privateHomePoint.longitude,
      };
    }

    if (finiteCoordinate(center)) {
      return {
        latitude: center.latitude,
        longitude: center.longitude,
      };
    }

    const preferred =
      points.find(
        point =>
          point.isMe ||
          point.isMember ||
          point.canManage,
      ) ??
      points.find(finiteCoordinate) ??
      null;

    if (finiteCoordinate(preferred)) {
      return {
        latitude: preferred.latitude,
        longitude: preferred.longitude,
      };
    }

    return FALLBACK_CENTER;
  }, [center, points, privateHomePoint]);

  const domPoints = useMemo(
    () =>
      points
        .filter(finiteCoordinate)
        .map(point => ({
          id: String(point.id),
          kind: String(point.kind || ''),
          title: String(point.title || 'BUKLOD place'),
          subtitle: point.subtitle
            ? String(point.subtitle)
            : '',
          category: String(point.category || 'community'),
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          verified: Boolean(point.verified),
          isMe: Boolean(point.isMe),
        })),
    [points],
  );

  const domHome = useMemo(
    () =>
      finiteCoordinate(privateHomePoint)
        ? {
            latitude: privateHomePoint.latitude,
            longitude: privateHomePoint.longitude,
            localityLabel:
              privateHomePoint.localityLabel || '',
          }
        : null,
    [privateHomePoint],
  );

  const requestLocation = async () => {
    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        return {
          ok: false as const,
          message:
            'Allow location access to use BUKLOD Navigation.',
        };
      }

      const position =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      return {
        ok: true as const,
        latitude: Number(position.coords.latitude),
        longitude: Number(position.coords.longitude),
      };
    } catch {
      return {
        ok: false as const,
        message:
          'Current location is unavailable right now.',
      };
    }
  };

  const openNavigation = async (
    destination: Destination,
  ) => openVoiceNavigation(destination);

  const openHome = async () => {
    try {
      router.push('/personal-home' as any);
      return true;
    } catch {
      return false;
    }
  };

  const mapDom = (interactive: boolean) => (
    <BuklodCommunityMapDom
      points={domPoints}
      center={mapCenter}
      home={domHome}
      interactive={interactive}
      requestLocation={requestLocation}
      openNavigation={openNavigation}
      openHome={openHome}
      dom={
        {
          scrollEnabled: false,
          bounces: false,
          overScrollMode: 'never',
          javaScriptEnabled: true,
          domStorageEnabled: true,
          style: {
            width: '100%',
            height: '100%',
            backgroundColor: '#EEF2F4',
          },
        } as any
      }
    />
  );

  return (
    <>
      <View
        style={[
          styles.previewFrame,
          { height: previewHeight },
        ]}
      >
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {mapDom(false)}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD map and navigation"
          onPress={() =>
            onExpandedChange?.(true)
          }
          style={({ pressed }) => [
            styles.previewTapLayer,
            pressed &&
              styles.previewTapLayerPressed,
          ]}
        >
          <View style={styles.previewPrompt}>
            <MaterialCommunityIcons
              name="map-marker-path"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.previewPromptText}>
              Open clear map + navigation
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={expanded}
        animationType="fade"
        onRequestClose={() =>
          onExpandedChange?.(false)
        }
      >
        <View style={styles.fullscreenShell}>
          <View style={StyleSheet.absoluteFill}>
            {mapDom(true)}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close BUKLOD map"
            onPress={() =>
              onExpandedChange?.(false)
            }
            style={({ pressed }) => [
              styles.closeButton,
              {
                top: Math.max(insets.top + 8, 14),
              },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color="#17384A"
            />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  previewFrame: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#EEF2F4',
    borderWidth: 1,
    borderColor: '#D6E2E8',
    position: 'relative',
  },
  previewTapLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,24,34,0.04)',
  },
  previewTapLayerPressed: {
    backgroundColor: 'rgba(10,24,34,0.12)',
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
  fullscreenShell: {
    flex: 1,
    backgroundColor: '#EEF2F4',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: '#D6E2E8',
  },
  pressed: {
    opacity: 0.72,
  },
});
