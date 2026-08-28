import React, { memo } from 'react';

import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';

export default memo(function BuklodCommunityInlineAd({
  slotId,
  active = true,
}: {
  slotId?: string;
  active?: boolean;
}) {
  const { width } = useWindowDimensions();
  const adWidth = Math.max(280, Math.floor(width - 32));

  if (!active) {
    return (
      <View
        testID={slotId}
        style={styles.placeholder}
        accessibilityLabel="Sponsored advertisement"
      />
    );
  }

  return (
    <View
      testID={slotId}
      style={styles.shell}
      accessibilityLabel="Sponsored advertisement"
    >
      <Text style={styles.label}>Sponsored</Text>
      <View style={[styles.adArea, { width: adWidth }]}>
        <BuklodAdMobBanner
          placement="community"
          compact
          format="inline"
          diagnosticName="community_inline"
          requireViewport={false}
          showLabel={false}
        />
      </View>
    </View>
  );
});

const styles =
  StyleSheet.create({
    placeholder: {
      height: 108,
      marginVertical: 8,
    },
    shell: {
      width: '100%',
      marginTop: 10,
      marginBottom: 14,
      paddingTop: 7,
      paddingBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    label: {
      width: '100%',
      marginBottom: 5,
      paddingHorizontal: 4,
      textAlign: 'center',
      color: '#7A857E',
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      letterSpacing: 0.35,
    },
    adArea: {
      maxHeight: 120,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
