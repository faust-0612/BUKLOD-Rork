import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  getCommunityPublishNotice,
  subscribeCommunityPublishQueue,
} from '@/lib/buklodCommunityPublishQueue';

export function BuklodPublishBanner() {
  const [notice, setNotice] = useState(getCommunityPublishNotice());

  useEffect(() => {
    return subscribeCommunityPublishQueue(jobs => {
      const active =
        jobs.find(job => job.status === 'running') ??
        jobs.find(job => job.status === 'error') ??
        jobs[0];
      setNotice(active?.notice ?? null);
    });
  }, []);

  if (!notice) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={notice}
      style={styles.banner}
    >
      <Text numberOfLines={1} style={styles.text}>
        {notice}
      </Text>
    </View>
  );
}

export default BuklodPublishBanner;

const styles = StyleSheet.create({
  banner: {
    minHeight: 26,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#315b43',
  },
  text: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
