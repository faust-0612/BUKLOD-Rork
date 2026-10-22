import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import {
  BuklodLiveSatelliteMap,
} from '@/components/BuklodLiveSatelliteMap.native';
import {
  getBuklodCitySnapshot,
  type BuklodCityPoint,
} from '@/lib/buklodCity';
import {
  useAuth,
} from '@/providers/AuthProvider';

/*
 * BUKLOD_NATIVE_COMMUNITY_MAP_PARITY_R1
 *
 * Native counterpart of BuklodWebCommunityMapHeader.web.tsx.
 * Compact preview in the Wall; tap opens the interactive full-screen map.
 */
export default function BuklodNativeCommunityMapHeader() {
  const { user } = useAuth();
  const [
    points,
    setPoints,
  ] = useState<BuklodCityPoint[]>([]);
  const [
    expanded,
    setExpanded,
  ] = useState(false);

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
        if (active) {
          setPoints([]);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const center = useMemo(() => {
    const preferred =
      points.find(
        (point) =>
          point.isMe ||
          point.isMember ||
          point.canManage,
      ) ??
      points[0] ??
      null;

    if (!preferred) return null;

    return {
      latitude: preferred.latitude,
      longitude: preferred.longitude,
    };
  }, [points]);

  return (
    <View style={styles.wrap}>
      <BuklodLiveSatelliteMap
        points={points}
        center={center}
        expanded={expanded}
        onExpandedChange={setExpanded}
        canManagePlace={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 8,
    marginBottom: 10,
  },
});
