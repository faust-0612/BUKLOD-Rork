/* BUKLOD_WEB_COMMUNITY_MAP_R6_SATELLITE */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BuklodLiveSatelliteMap } from '@/components/BuklodLiveSatelliteMap.web';
import {
  getBuklodCitySnapshot,
  type BuklodCityPoint,
} from '@/lib/buklodCity';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Real BUKLOD live satellite map for the web Community Wall.
 * It remains inside the Wall list header so it scrolls with Community content.
 * The preview stays tap-to-open; full screen enables map interaction and live
 * nearby-place discovery while preserving BUKLOD/Home pins.
 */
export default function BuklodWebCommunityMapHeader() {
  const { user } = useAuth();
  const [points, setPoints] = useState<BuklodCityPoint[]>([]);
  const [expanded, setExpanded] = useState(false);

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

  const center = useMemo(() => {
    const preferred =
      points.find((point) => point.isMe || point.isMember || point.canManage) ??
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
