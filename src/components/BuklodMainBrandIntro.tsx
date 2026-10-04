import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import BuklodCenteredBrandMark, {
  BUKLOD_BRAND_LOGO_NATIVE,
  BUKLOD_BRAND_LOGO_WEB,
} from '@/components/BuklodCenteredBrandMark';
import {
  markBuklodStartupChromeReady,
  subscribeBuklodStartupChromeReady,
} from '@/lib/buklodStartupChrome';

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
  const isWeb = Platform.OS === 'web';

  /* BUKLOD_WEB_INTRO_ONCE_PER_TAB_R2
   * The web startup brand is a boot-only experience. Browser back/forward
   * or route remounts must never replay the startup overlay.
   */
  const [visible, setVisible] = useState(() => {
    if (!isWeb) return true;
    try {
      return window.sessionStorage.getItem('buklod.web.brand-intro.v2') !== 'shown';
    } catch {
      return true;
    }
  });

  /*
   * Native mounts the app only after the splash icon is gone. The overlay
   * stays until the fingerprint prompt finishes, because that prompt shrinks
   * the window and would drag a flex-centered logo upward.
   */
  const [splashGone, setSplashGone] = useState(isWeb);
  const [holdDone, setHoldDone] = useState(isWeb);
  const [chromeReady, setChromeReady] = useState(isWeb);
  const mountChildren = isWeb || splashGone;

  const markOpacity = useRef(new Animated.Value(isWeb ? 0 : 1)).current;
  const markScale = useRef(new Animated.Value(isWeb ? 1 : 1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const splashHidden = useRef(false);

  const hideNativeSplash = () => {
    if (isWeb || splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
    setSplashGone(true);
  };

  useEffect(() => {
    if (isWeb) return;
    const timer = setTimeout(hideNativeSplash, 700);
    return () => clearTimeout(timer);
  }, [isWeb]);

  useEffect(() => {
    if (isWeb) return;
    return subscribeBuklodStartupChromeReady(() => {
      setChromeReady(true);
    });
  }, [isWeb]);

  useEffect(() => {
    if (isWeb || chromeReady) return;
    const timer = setTimeout(
      () => markBuklodStartupChromeReady(),
      20000
    );
    return () => clearTimeout(timer);
  }, [chromeReady, isWeb]);

  useEffect(() => {
    if (isWeb || !holdDone || !chromeReady) return;
    setVisible(false);
  }, [chromeReady, holdDone, isWeb]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (isWeb) {
      try {
        window.sessionStorage.setItem('buklod.web.brand-intro.v2', 'shown');
      } catch {
        // Session storage is optional; intro still completes normally.
      }
    }

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

    const driver = !isWeb;

    /*
     * Native keeps the logo pinned to the screen center. The tagline only
     * fades. The overlay stays through the fingerprint prompt so the mark
     * does not travel upward when Android resizes the window.
     */
    const sequence = isWeb
      ? Animated.sequence([
          Animated.timing(markOpacity, {
            toValue: 1,
            duration: webIntroMs.mark,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: webIntroMs.copy,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.delay(webIntroMs.hold),
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: webIntroMs.fade,
            easing: Easing.in(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      : Animated.sequence([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: driver,
          }),
          Animated.delay(720),
          Animated.timing(textOpacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: driver,
          }),
        ]);

    sequence.start(({ finished }) => {
      if (!finished) return;
      if (isWeb) setVisible(false);
      else setHoldDone(true);
    });

    return () => {
      sequence.stop();
    };
  }, [
    isWeb,
    markOpacity,
    markScale,
    screenOpacity,
    textOpacity,
    visible,
  ]);

  return (
    <View
      style={[
        styles.root,
        !isWeb && styles.nativeRoot,
      ]}
    >
      {mountChildren ? children : null}

      {visible ? (
        <Animated.View
          pointerEvents={isWeb ? 'none' : 'auto'}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            isWeb ? styles.overlay : styles.nativeOverlay,
            { opacity: screenOpacity },
          ]}
        >
          <BuklodCenteredBrandMark
            logoSize={isWeb ? BUKLOD_BRAND_LOGO_WEB : BUKLOD_BRAND_LOGO_NATIVE}
            lockToScreen={!isWeb}
            onLogoLoad={hideNativeSplash}
            markStyle={{
              opacity: markOpacity,
              transform: [{ scale: markScale }],
            }}
            taglineStyle={{ opacity: textOpacity }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const NATIVE_SCREEN = Dimensions.get('screen');

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  nativeRoot: {
    backgroundColor: '#FFFFFF',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF7',
  },
  nativeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: NATIVE_SCREEN.width,
    height: NATIVE_SCREEN.height,
    zIndex: 99999,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
});
