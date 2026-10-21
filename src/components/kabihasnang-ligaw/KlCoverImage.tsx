import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { klCopy } from '@/lib/kabihasnang-ligaw/copy';

const COVER = require('../../../assets/kabihasnang-ligaw/kl-r5-approved-cover.webp');

const CROP = {
  card: 16 / 7,
  hero: 3 / 1,
} as const;

const LABEL = {
  card: 'Cinematic fantasy concept landscape',
  hero: 'Orihinal na pantasyang pamayanan sa lambak',
} as const;

/** Owner-supplied card cover only. Not a scene-approval. */
export default function KlCoverImage({
  variant,
  lowBandwidth,
}: {
  variant: keyof typeof CROP;
  lowBandwidth: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [bypassWeak, setBypassWeak] = useState(false);
  const withheld = lowBandwidth && !bypassWeak;

  const retry = () => {
    setFailed(false);
    setBypassWeak(true);
    setAttempt((value) => value + 1);
  };

  if (withheld || failed) {
    return (
      <View style={[styles.frame, { aspectRatio: CROP[variant] }]}>
        <Text style={styles.note}>{failed ? klCopy.couldNotOpen : klCopy.imageWithheld}</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
          <Text style={styles.retryText}>{klCopy.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Image
      key={`${variant}-${attempt}`}
      source={COVER}
      contentFit="cover"
      cachePolicy="memory-disk"
      accessibilityLabel={LABEL[variant]}
      onError={() => setFailed(true)}
      style={[styles.image, { aspectRatio: CROP[variant] }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%' },
  frame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#101a20',
    paddingHorizontal: 16,
  },
  note: { color: '#d6c8ad', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a28b5a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: '#f1d39b', fontSize: 14, fontWeight: '800' },
});
