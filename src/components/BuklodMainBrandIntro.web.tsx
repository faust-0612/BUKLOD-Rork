import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/*
 * BUKLOD_WEB_STARTUP_ANIMATION_R3
 *
 * Web-only startup intro.
 * The browser Web Animations API keeps logo/copy/fade motion on the browser
 * compositor instead of React Native's JS-driven animation loop while the app
 * is hydrating underneath.
 */
export default function BuklodMainBrandIntro({
  children,
}: {
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(() => {
    try {
      return window.sessionStorage.getItem('buklod.web.brand-intro.v2') !== 'shown';
    } catch {
      return true;
    }
  });

  const overlayRef = useRef<any>(null);
  const markRef = useRef<any>(null);
  const copyRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) return;

    try {
      window.sessionStorage.setItem('buklod.web.brand-intro.v2', 'shown');
    } catch {
      // Session storage is optional.
    }

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const animations: any[] = [];
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      setVisible(false);
    };

    raf = window.requestAnimationFrame(() => {
      const overlay = overlayRef.current;
      const mark = markRef.current;
      const copy = copyRef.current;

      if (
        !overlay ||
        !mark ||
        !copy ||
        typeof overlay.animate !== 'function' ||
        typeof mark.animate !== 'function' ||
        typeof copy.animate !== 'function'
      ) {
        fallbackTimer = setTimeout(
          finish,
          reducedMotion ? 220 : 2550,
        );
        return;
      }

      if (reducedMotion) {
        const fade = overlay.animate(
          [
            { opacity: 1 },
            { opacity: 0 },
          ],
          {
            duration: 220,
            easing: 'ease-out',
            fill: 'forwards',
          },
        );
        animations.push(fade);
        fade.onfinish = finish;
        return;
      }

      const markAnimation = mark.animate(
        [
          {
            opacity: 0,
            transform: 'scale(0.94)',
          },
          {
            opacity: 1,
            transform: 'scale(1)',
          },
        ],
        {
          duration: 560,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        },
      );

      const copyAnimation = copy.animate(
        [
          {
            opacity: 0,
            transform: 'translateY(8px)',
          },
          {
            opacity: 1,
            transform: 'translateY(0)',
          },
        ],
        {
          delay: 140,
          duration: 520,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        },
      );

      const overlayAnimation = overlay.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.82 },
          { opacity: 0, offset: 1 },
        ],
        {
          duration: 2550,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards',
        },
      );

      animations.push(
        markAnimation,
        copyAnimation,
        overlayAnimation,
      );

      overlayAnimation.onfinish = finish;
    });

    return () => {
      window.cancelAnimationFrame(raf);
      if (fallbackTimer) clearTimeout(fallbackTimer);

      for (const animation of animations) {
        try {
          animation.cancel();
        } catch {
          // Best-effort cleanup only.
        }
      }
    };
  }, [visible]);

  return (
    <View style={styles.root}>
      {children}

      {visible ? (
        <View
          ref={overlayRef}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.overlay}
        >
          <View style={styles.brand}>
            <View
              ref={markRef}
              style={styles.markInitial}
            >
              <Image
                source={require('../../assets/release/buklod-main-canonical.png')}
                resizeMode="contain"
                style={styles.logo}
              />
            </View>

            <View
              ref={copyRef}
              style={styles.copyInitial}
            >
              <Text style={styles.tagline}>
                Your Daily Companion in Life
              </Text>
            </View>
          </View>
        </View>
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
  markInitial: {
    opacity: 0,
    transform: [{ scale: 0.94 }],
  },
  logo: {
    width: 220,
    height: 220,
  },
  copyInitial: {
    marginTop: 8,
    alignItems: 'center',
    opacity: 0,
    transform: [{ translateY: 8 }],
    willChange: 'opacity, transform' as any,
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
