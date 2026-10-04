import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { BuklodCityPoint } from '@/lib/buklodCity';
import { buildBuklodLiveSatelliteMapDocument } from '@/lib/buklodLiveSatelliteMapDocument';

/* BUKLOD_LIVE_SATELLITE_MAP_R1 */
const FALLBACK_CENTER = { latitude: 14.4974, longitude: 121.2862 };

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
  const mobile = width < 720;
  const previewHeight = mobile ? 190 : 250;
  const mapCenter = center ?? points[0] ?? FALLBACK_CENTER;
  const previewIframeRef = useRef<any>(null);
  const fullIframeRef = useRef<any>(null);

  /* BUKLOD_MAP_MY_LOCATION_R6 */
  const locateCurrentPosition = () => {
    const targets = [
      previewIframeRef.current?.contentWindow,
      fullIframeRef.current?.contentWindow,
    ].filter(Boolean);

    const send = (payload: Record<string, unknown>) => {
      for (const target of targets) {
        try {
          target.postMessage(payload, '*');
        } catch {}
      }
    };

    if (!navigator?.geolocation) {
      send({
        type: 'BUKLOD_MAP_LOCATION_RESULT',
        ok: false,
        message: 'Current location is unavailable in this browser.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        send({
          type: 'BUKLOD_MAP_LOCATION_RESULT',
          ok: true,
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          locateOnly: true,
        });
        onShareLocation?.();
      },
      () => {
        send({
          type: 'BUKLOD_MAP_LOCATION_RESULT',
          ok: false,
          message: 'Allow location access to center the BUKLOD map on you.',
          locateOnly: true,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  /*
   * BUKLOD_WEB_MAP_PARENT_GEO_R2
   * srcDoc iframes may be denied geolocation by in-app browsers even when
   * the top-level HTTPS page is allowed. Ask the parent page for location and
   * send only the coordinate result back to the requesting map iframe.
   */
  useEffect(() => {
    const handleMessage = (event: any) => {
      if (event?.data?.type === 'BUKLOD_MAP_OPEN_URL' && event.data.url) {
        window.open(String(event.data.url), '_blank', 'noopener,noreferrer');
        return;
      }

      if (
        event?.data?.type !== 'BUKLOD_MAP_REQUEST_LOCATION' ||
        !event?.source
      ) {
        return;
      }

      const target = event.source as any;

      if (!navigator?.geolocation) {
        target.postMessage(
          {
            type: 'BUKLOD_MAP_LOCATION_RESULT',
            ok: false,
            message: 'Current location is unavailable in this browser.',
          },
          '*'
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          target.postMessage(
            {
              type: 'BUKLOD_MAP_LOCATION_RESULT',
              ok: true,
              latitude: Number(position.coords.latitude),
              longitude: Number(position.coords.longitude),
              locateOnly: Boolean(event?.data?.locateOnly),
            },
            '*'
          );
        },
        () => {
          target.postMessage(
            {
              type: 'BUKLOD_MAP_LOCATION_RESULT',
              ok: false,
              message: 'Location permission is needed for an in-app route.',
            },
            '*'
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const srcDoc = useMemo(() => {
    const payload = points.map((point) => ({
      id: point.id,
      kind: point.kind,
      title: point.title,
      subtitle: point.subtitle ?? '',
      category: String(point.category || 'community'),
      latitude: point.latitude,
      longitude: point.longitude,
      verified: Boolean(point.verified),
      isMe: Boolean(point.isMe),
    }));

    return buildBuklodLiveSatelliteMapDocument({
      points: payload,
      center: {
        latitude: Number(mapCenter.latitude),
        longitude: Number(mapCenter.longitude),
      },
    });
  }, [
    mapCenter.latitude,
    mapCenter.longitude,
    points,
  ]);

  const iframe = (interactive: boolean) =>
    React.createElement('iframe', {
      ref: (node: any) => {
        if (interactive) fullIframeRef.current = node;
        else previewIframeRef.current = node;
      },
      title: interactive
        ? 'BUKLOD live satellite interactive community map'
        : 'BUKLOD live satellite community map preview',
      srcDoc,
      style: {
        border: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        background: '#eef2f4',
        pointerEvents: interactive ? 'auto' : 'none',
      },
      referrerPolicy: 'no-referrer',
      allow: 'geolocation',
    });

  const controls = (showClose = false) => (
    <View style={styles.mapControls} pointerEvents="box-none">
      <MapIcon
        icon="crosshairs-gps"
        label="Center map on my location"
        onPress={locateCurrentPosition}
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
        {iframe(false)}
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
            <Text style={styles.previewPromptText}>Open clear map + navigation</Text>
          </View>
        </Pressable>
        {controls(false)}
      </View>

      <Modal
        visible={expanded}
        animationType="fade"
        onRequestClose={() => onExpandedChange?.(false)}
      >
        <View style={styles.fullscreenShell}>
          <View style={styles.fullscreenMap}>{iframe(true)}</View>
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
    backgroundColor: '#0D1720',
    borderWidth: 1,
    borderColor: '#D6E2E8',
    position: 'relative',
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
    boxShadow: '0 5px 16px rgba(18,45,62,.16)',
  } as any,
  mapIconButtonDisabled: { opacity: 0.45 },
  mapIconButtonPressed: { opacity: 0.72 },
  fullscreenShell: {
    flex: 1,
    backgroundColor: '#0D1720',
    position: 'relative',
  },
  fullscreenMap: { flex: 1, width: '100%' },
});
