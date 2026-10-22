import React, {
  useEffect,
  useRef,
} from 'react';

import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import {
  useGlobalSearchParams,
  usePathname,
} from 'expo-router';

import BuklodTabAdStrip
  from '@/components/BuklodTabAdStrip';

function dashboardIndex(
  pathname: string,
  section?: string
) {
  if (
    pathname === '/scope'
  ) {
    if (
      section ===
      'community'
    ) {
      return 2;
    }

    if (
      section ===
      'connect'
    ) {
      return 1;
    }

    return 0;
  }

  if (
    pathname === '/home'
  ) {
    return 0;
  }

  if (
    pathname === '/messages'
  ) {
    return 1;
  }

  if (
    pathname === '/buklod'
  ) {
    return 2;
  }

  if (
    pathname === '/prayer'
  ) {
    return 3;
  }

  if (
    pathname === '/me'
  ) {
    return 4;
  }

  return 0;
}

/*
 * The ad container animates on dashboard navigation,
 * but the AdMob child is deliberately NOT keyed/remounted
 * per swipe. This preserves compliant SDK refresh behavior
 * while still giving the user the requested directional
 * visual motion.
 */
export default function
BuklodDashboardAdRail() {
  const pathname =
    usePathname();

  const params =
    useGlobalSearchParams<{
      section?: string;
    }>();

  const section =
    Array.isArray(
      params.section
    )
      ? params.section[0]
      : params.section;

  const previousIndex =
    useRef(
      dashboardIndex(
        pathname,
        section
      )
    );

  const translateY =
    useRef(
      new Animated.Value(0)
    ).current;

  const opacity =
    useRef(
      new Animated.Value(1)
    ).current;

  useEffect(() => {
    const next =
      dashboardIndex(
        pathname,
        section
      );

    const forward =
      next >=
      previousIndex.current;

    previousIndex.current =
      next;

    translateY.setValue(
      forward
        ? 18
        : -18
    );

    opacity.setValue(0.72);

    Animated.parallel([
      Animated.timing(
        translateY,
        {
          toValue: 0,
          duration: 240,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),

      Animated.timing(
        opacity,
        {
          toValue: 1,
          duration: 220,
          easing:
            Easing.out(
              Easing.quad
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }, [
    pathname,
    section,
    opacity,
    translateY,
  ]);

  return (
    <View style={styles.clip}>
      <Animated.View
        style={{
          opacity,
          transform: [
            {
              translateY,
            },
          ],
        }}
      >
        <BuklodTabAdStrip />
      </Animated.View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    clip: {
      overflow: 'hidden',
    },
  });
