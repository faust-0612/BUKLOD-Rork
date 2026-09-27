import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/*
 * BUKLOD_MAIN_CANONICAL_BRAND_R1
 *
 * One canonical startup identity for Android + web.
 * Asset source is the same canonical app icon used by Expo config.
 * No alternate/legacy logo may be rendered here.
 */
export default function BuklodMainBrandIntro({
  children,
}: {
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(true);
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.86)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(8)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    /*
     * BUKLOD_WEB_FAST_BRAND_R1
     *
     * Keep the full native startup identity for APK, but web must not add
     * more than a brief transition on top of JS/network startup.
     */
    const webFast =
      Platform.OS === 'web';

    /*
     * BUKLOD_WEB_BRAND_3S_R1
     *
     * Keep the canonical B mark visible for about 3 seconds on web while the
     * app hydrates underneath. This is intentional brand time, not a blocking
     * data fetch.
     */
    const webIntroMs = {
      mark: 320,
      copy: 320,
      hold: 1960,
      fade: 400,
    };

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: webFast ? webIntroMs.mark : 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(markScale, {
          toValue: 1,
          speed: 16,
          bounciness: 4,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: webFast ? webIntroMs.copy : 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: webFast ? webIntroMs.copy : 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.delay(webFast ? webIntroMs.hold : 420),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: webFast ? webIntroMs.fade : 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    sequence.start(({ finished }) => {
      if (finished) setVisible(false);
    });

    return () => {
      sequence.stop();
    };
  }, [
    markOpacity,
    markScale,
    screenOpacity,
    textOpacity,
    textTranslate,
  ]);

  return (
    <View style={styles.root}>
      {children}

      {visible ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.overlay,
            { opacity: screenOpacity },
          ]}
        >
          <View style={styles.brand}>
            <Animated.View
              style={{
                opacity: markOpacity,
                transform: [{ scale: markScale }],
              }}
            >
              <Image
                source={require('../../assets/release/buklod-main-canonical.png')}
                resizeMode="contain"
                style={styles.logo}
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.copy,
                {
                  opacity: textOpacity,
                  transform: [
                    { translateY: textTranslate },
                  ],
                },
              ]}
            >
              <Text style={styles.tagline}>
                Your Daily Companion in Life
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF7',
  },
  brand: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: 220,
    height: 220,
  },
  copy: {
    marginTop: 8,
    alignItems: 'center',
  },
  name: {
    color: '#0B6535',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  tagline: {
    marginTop: 5,
    color: '#5D6D63',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.25,
    textAlign: 'center',
  },
});
