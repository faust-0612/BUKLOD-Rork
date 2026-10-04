import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';

import BuklodCommunityMapDom from '@/components/BuklodCommunityMapDom';
import type { BuklodCityPoint } from '@/lib/buklodCity';
import {
  BUKLOD_MAP_LEAFLET_CSS_CDN,
  BUKLOD_MAP_LEAFLET_JS_CDN,
  buildBuklodLiveSatelliteMapDocument,
} from '@/lib/buklodLiveSatelliteMapDocument';

const FALLBACK_CENTER = { latitude: 14.4974, longitude: 121.2862 };

type LocationResult = {
  nonce: number;
  type: 'BUKLOD_MAP_LOCATION_RESULT';
  ok: boolean;
  latitude?: number;
  longitude?: number;
  locateOnly?: boolean;
  message?: string;
};

function MapIcon({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mapIconButton,
        disabled && styles.mapIconButtonDisabled,
        pressed && !disabled && styles.mapIconButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={disabled ? '#9AA9B5' : '#214A5D'}
      />
    </Pressable>
  );
}

export function BuklodLiveSatelliteMap({
  points,
  center,
  expanded = false,
  onExpandedChange,
  onShareLocation,
  onManagePlace,
  canManagePlace = true,
}: {
  points: BuklodCityPoint[];
  center?: { latitude: number; longitude: number } | null;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onShareLocation?: () => void;
  onManagePlace?: () => void;
  canManagePlace?: boolean;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mobile = width < 720;
  const previewHeight = mobile ? 190 : 250;
  const screen = Dimensions.get('screen');
  const windowHeight = Dimensions.get('window').height;
  const screenWidth = screen.width;
  const screenHeight = screen.height;
  const statusHeight =
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const systemBottom = Math.max(
    0,
    screenHeight - windowHeight - statusHeight,
  );
  const bottomInset =
    Math.max(
      insets.bottom,
      initialWindowMetrics?.insets.bottom ?? 0,
      systemBottom,
    ) + 12;
  const fullscreenControlTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );
  const mapCenter = center ?? points[0] ?? FALLBACK_CENTER;
  const [locationResult, setLocationResult] =
    useState<LocationResult | null>(null);

  const mapPayload = useMemo(
    () =>
      points.map(point => ({
        id: point.id,
        kind: point.kind,
        title: point.title,
        subtitle: point.subtitle ?? '',
        category: String(point.category || 'community'),
        latitude: point.latitude,
        longitude: point.longitude,
        verified: Boolean(point.verified),
        isMe: Boolean(point.isMe),
      })),
    [points],
  );

  const previewDoc = useMemo(
    () =>
      buildBuklodLiveSatelliteMapDocument({
        points: mapPayload,
        center: {
          latitude: Number(mapCenter.latitude),
          longitude: Number(mapCenter.longitude),
        },
        leafletCss: BUKLOD_MAP_LEAFLET_CSS_CDN,
        leafletJs: BUKLOD_MAP_LEAFLET_JS_CDN,
      }),
    [mapCenter.latitude, mapCenter.longitude, mapPayload],
  );

  const fullDoc = useMemo(
    () =>
      buildBuklodLiveSatelliteMapDocument({
        points: mapPayload,
        center: {
          latitude: Number(mapCenter.latitude),
          longitude: Number(mapCenter.longitude),
        },
        leafletCss: BUKLOD_MAP_LEAFLET_CSS_CDN,
        leafletJs: BUKLOD_MAP_LEAFLET_JS_CDN,
        bottomInset,
      }),
    [
      bottomInset,
      mapCenter.latitude,
      mapCenter.longitude,
      mapPayload,
    ],
  );

  const deliverLocation = useCallback(
    async (locateOnly: boolean) => {
      const nonce = Date.now();

      try {
        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          setLocationResult({
            nonce,
            type: 'BUKLOD_MAP_LOCATION_RESULT',
            ok: false,
            locateOnly,
            message: locateOnly
              ? 'Allow location access to center the BUKLOD map on you.'
              : 'Location permission is needed for an in-app route.',
          });
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setLocationResult({
          nonce,
          type: 'BUKLOD_MAP_LOCATION_RESULT',
          ok: true,
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          locateOnly,
        });

        if (locateOnly) onShareLocation?.();
      } catch {
        setLocationResult({
          nonce,
          type: 'BUKLOD_MAP_LOCATION_RESULT',
          ok: false,
          locateOnly,
          message: locateOnly
            ? 'Allow location access to center the BUKLOD map on you.'
            : 'Location permission is needed for an in-app route.',
        });
      }
    },
    [onShareLocation],
  );

  const onRequestLocation = useCallback(
    (request: { locateOnly: boolean }) => {
      void deliverLocation(request.locateOnly);
    },
    [deliverLocation],
  );

  const onOpenUrl = useCallback((url: string) => {
    const target = String(url ?? '').trim();
    if (!target) return;
    void Linking.openURL(target).catch(() => undefined);
  }, []);

  const frame = (interactive: boolean, frameHeight: number) => (
    <BuklodCommunityMapDom
      srcDoc={interactive ? fullDoc : previewDoc}
      interactive={interactive}
      title={
        interactive
          ? 'BUKLOD live satellite interactive community map'
          : 'BUKLOD live satellite community map preview'
      }
      locationResult={locationResult}
      onRequestLocation={onRequestLocation}
      onOpenUrl={onOpenUrl}
      dom={{
        matchContents: false,
        scrollEnabled: false,
        bounces: false,
        overScrollMode: 'never',
        contentInsetAdjustmentBehavior: 'never',
        automaticallyAdjustsScrollIndicatorInsets: false,
        style: {
          width: '100%',
          height: frameHeight,
          backgroundColor: '#eef2f4',
        },
      }}
    />
  );

  const controls = (showClose = false) => (
    <View
      style={[
        styles.mapControls,
        showClose && { top: fullscreenControlTop },
      ]}
      pointerEvents="box-none"
    >
      <MapIcon
        icon="crosshairs-gps"
        label="Center map on my location"
        onPress={() => {
          void deliverLocation(true);
        }}
      />
      <MapIcon
        icon="pencil"
        label="Manage place"
        onPress={onManagePlace}
        disabled={!canManagePlace}
      />
      {showClose ? (
        <MapIcon
          icon="close"
          label="Close full screen map"
          onPress={() => onExpandedChange?.(false)}
        />
      ) : null}
    </View>
  );

  return (
    <>
      <View style={[styles.previewFrame, { height: previewHeight }]}>
        <View
          pointerEvents="none"
          style={[styles.previewMap, { height: previewHeight }]}
        >
          {frame(false, previewHeight)}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD live satellite map full screen"
          onPress={() => onExpandedChange?.(true)}
          style={({ pressed }) => [
            styles.previewTapLayer,
            pressed && styles.previewTapLayerPressed,
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
        {controls(false)}
      </View>

      <Modal
        visible={expanded}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        presentationStyle="fullScreen"
        onRequestClose={() => onExpandedChange?.(false)}
      >
        <View style={[styles.fullscreenShell, { width: screenWidth, height: screenHeight }]}>
          <View style={{ width: screenWidth, height: screenHeight }}>
            {frame(true, screenHeight)}
          </View>
          {controls(true)}
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
    backgroundColor: '#eef2f4',
    borderWidth: 1,
    borderColor: '#D6E2E8',
    position: 'relative',
  },
  previewMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  previewTapLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,24,34,.05)',
  },
  previewTapLayerPressed: {
    backgroundColor: 'rgba(10,24,34,.14)',
  },
  previewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(10,25,36,.84)',
  },
  previewPromptText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 7,
    zIndex: 20,
  },
  mapIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.96)',
    borderWidth: 1,
    borderColor: '#D6E2E8',
  },
  mapIconButtonDisabled: { opacity: 0.45 },
  mapIconButtonPressed: { opacity: 0.72 },
  fullscreenShell: {
    backgroundColor: '#eef2f4',
    position: 'relative',
  },
  fullscreenMap: { flex: 1, width: '100%' },
});
