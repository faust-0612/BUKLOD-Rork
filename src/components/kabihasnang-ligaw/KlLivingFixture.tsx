import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { resolveLivingMotion } from '@/lib/kabihasnang-ligaw/livingMotion';

const DROPS = [8, 22, 36, 51, 67, 80, 14, 44, 60, 73, 28, 90];

type Props = {
  visible: boolean;
  appActive: boolean;
  reduceMotion: boolean;
  userMotionEnabled: boolean;
  batterySaver: boolean;
  lowBandwidth: boolean;
};

/** Abstract motion test. It does not depict a story scene or character. */
export default function KlLivingFixture(props: Props) {
  const decision = resolveLivingMotion({
    boundToManuscriptParagraph: false,
    manuscriptApprovedComplete: false,
    ownerApproved: false,
    depictsStory: false,
    technicalFixture: true,
    allowUnapprovedPreview: true,
    visible: props.visible,
    appActive: props.appActive,
    reduceMotion: props.reduceMotion,
    userMotionEnabled: props.userMotionEnabled,
    batterySaver: props.batterySaver,
    lowBandwidth: props.lowBandwidth,
  });
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!decision.animate) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [decision.animate, drift]);

  return (
    <View style={styles.wrap} accessibilityLabel="Motion test, not a story scene">
      <Text style={styles.label}>Pansamantalang pagsubok ng galaw. Hindi ito eksena ng kuwento.</Text>
      {decision.animate ? (
        <View style={styles.stage}>
          {DROPS.map((left, index) => (
            <Animated.View
              key={left}
              style={[
                styles.drop,
                {
                  left: `${left}%`,
                  opacity: 0.35 + (index % 3) * 0.12,
                  transform: [
                    {
                      translateY: drift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-8, 72],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.still}>Naka-pause ang galaw.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: '#3d4c46',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#132026',
  },
  label: { color: '#d6c8ad', fontSize: 13, lineHeight: 20 },
  stage: { height: 88, marginTop: 12, overflow: 'hidden', backgroundColor: '#0d171c', borderRadius: 12 },
  drop: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#d5e4ea',
  },
  still: { color: '#f1ece3', marginTop: 10, fontSize: 15 },
});
