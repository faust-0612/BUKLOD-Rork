import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/providers/NotificationProvider';
import { useAuth } from '@/providers/AuthProvider';

type Pose = 'wave' | 'celebrate' | 'think';

const GUIDE = {
  wave: require('../../assets/buklod-guide/wave.png'),
  celebrate: require('../../assets/buklod-guide/celebrate.png'),
  think: require('../../assets/buklod-guide/think.png'),
} as const;
/* PATCH_167M_R2_GENDER_GUIDE */
const FEMALE_GUIDE = {
  wave: require('../../assets/buklod-guide/female-wave.png'),
  celebrate: require('../../assets/buklod-guide/female-celebrate.png'),
  think: require('../../assets/buklod-guide/female-think.png'),
} as const;

function routePose(pathname: string): Pose {
  if (pathname.includes('prayer')) return 'think';
  return 'wave';
}

function routeMessage(pathname: string) {
  if (pathname.includes('prayer')) {
    return "I'm with you. Let's pray.";
  }
  if (pathname.includes('buklod')) {
    return 'Your community is active. Stay connected.';
  }
  if (pathname.includes('learn')) {
    return 'One lesson at a time. Keep growing.';
  }
  if (pathname.includes('word')) {
    return "Ready for today's Word?";
  }
  if (pathname.includes('me')) {
    return 'Your BUKLOD tools are all here.';
  }
  return "I'm here. Let's check what matters today.";
}

export function BuklodGuideAvatar() {
  const pathname = usePathname();
  const {
    width: screenWidth,
    height: screenHeight,
  } = useWindowDimensions();
  const { unreadCount } = useNotifications();
  const { session, profile } = useAuth();
  /* PATCH_163A_R_MEMBER_ROUTE_GUARD */
  /* PATCH_167M_ALL_DASHBOARDS_EXCEPT_PROFILE */
  const guideVisible =
    Boolean(session) &&
    !/^\/(me|profile)(?:\/|$)/.test(pathname);


  const basePose = useMemo(
    () => routePose(pathname),
    [pathname]
  );

  const [pose, setPose] = useState<Pose>(basePose);
  const [bubbleText, setBubbleText] = useState(
    routeMessage(pathname)
  );
  const [bubbleMounted, setBubbleMounted] =
    useState(true);
  const [reduceMotion, setReduceMotion] =
    useState(false);

  /* PATCH_167H_TOUCH_TO_SHOW */
  const [guideOpen, setGuideOpen] =
    useState(true);

  const previousUnread = useRef(unreadCount);
  const bubbleTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const reactionTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const guideHideTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const lastRealtimeReaction = useRef(0);

  const entryOpacity = useSharedValue(0);
  const entryY = useSharedValue(22);
  /* PATCH_167M_R2_GESTURE_DRAG */
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .maxPointers(1)
        .onBegin(() => {
          dragStartX.value = dragX.value;
          dragStartY.value = dragY.value;
        })
        .onUpdate((event) => {
          const baseX =
            screenWidth - 12 - 94;
          const baseY =
            screenHeight - 88 - 104;

          const minX =
            8 - baseX;
          const maxX =
            screenWidth - 8 - 94 - baseX;

          const minY =
            58 - baseY;
          const maxY =
            screenHeight - 92 - 104 - baseY;

          const wantedX =
            dragStartX.value +
            event.translationX;

          const wantedY =
            dragStartY.value +
            event.translationY;

          dragX.value =
            Math.min(
              Math.max(minX, wantedX),
              Math.max(minX, maxX)
            );

          dragY.value =
            Math.min(
              Math.max(minY, wantedY),
              Math.max(minY, maxY)
            );
        }),
    [
      dragStartX,
      dragStartY,
      dragX,
      dragY,
      screenHeight,
      screenWidth,
    ]
  );
  const floatY = useSharedValue(0);
  const breath = useSharedValue(1);
  const tilt = useSharedValue(0);
  const pop = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.3);
  const bubbleOpacity = useSharedValue(0);
  const blinkOpacity = useSharedValue(0);

  const clearBubbleTimer = useCallback(() => {
    if (bubbleTimer.current) {
      clearTimeout(bubbleTimer.current);
      bubbleTimer.current = null;
    }
  }, []);

  const showBubble = useCallback(
    (message: string, duration = 3600) => {
      clearBubbleTimer();
      setBubbleText(message);
      setBubbleMounted(true);
      bubbleOpacity.value = reduceMotion
        ? 1
        : withTiming(1, { duration: 180 });

      bubbleTimer.current = setTimeout(() => {
        if (reduceMotion) {
          bubbleOpacity.value = 0;
          setBubbleMounted(false);
          return;
        }

        bubbleOpacity.value = withTiming(
          0,
          { duration: 180 }
        );

        setTimeout(() => {
          setBubbleMounted(false);
        }, 210);
      }, duration);
    },
    [
      bubbleOpacity,
      clearBubbleTimer,
      reduceMotion,
    ]
  );

  const clearGuideHideTimer =
    useCallback(() => {
      if (guideHideTimer.current) {
        clearTimeout(guideHideTimer.current);
        guideHideTimer.current = null;
      }
    }, []);

  const hideGuide =
    useCallback(() => {
      clearGuideHideTimer();

      if (reduceMotion) {
        entryOpacity.value = 0;
        entryY.value = 14;
        setGuideOpen(false);
        return;
      }

      entryOpacity.value =
        withTiming(
          0,
          { duration: 160 }
        );

      entryY.value =
        withTiming(
          14,
          { duration: 160 }
        );

      guideHideTimer.current =
        setTimeout(() => {
          guideHideTimer.current = null;
          setGuideOpen(false);
        }, 185);
    }, [
      clearGuideHideTimer,
      entryOpacity,
      entryY,
      reduceMotion,
    ]);

  const scheduleGuideHide =
    useCallback(
      (delay = 3600) => {
        /* PATCH_167M_KEEP_AVATAR_VISIBLE */
        clearGuideHideTimer();
        void delay;
        void hideGuide;
      },
      [
        clearGuideHideTimer,
        hideGuide,
      ]
    );

  const revealGuide =
    useCallback(() => {
      clearGuideHideTimer();

      setGuideOpen(true);
      setPose(basePose);

      if (reduceMotion) {
        entryOpacity.value = 1;
        entryY.value = 0;
      } else {
        entryOpacity.value = 0;
        entryY.value = 14;

        entryOpacity.value =
          withTiming(
            1,
            { duration: 180 }
          );

        entryY.value =
          withSpring(
            0,
            {
              damping: 14,
              stiffness: 165,
            }
          );
      }

      showBubble(
        routeMessage(pathname),
        2600
      );

      scheduleGuideHide(3600);
    }, [
      basePose,
      clearGuideHideTimer,
      entryOpacity,
      entryY,
      pathname,
      reduceMotion,
      scheduleGuideHide,
      showBubble,
    ]);
  const animateTap = useCallback(() => {
    if (reduceMotion) {
      pop.value = 1;
      return;
    }

    pop.value = withSequence(
      withTiming(0.9, { duration: 90 }),
      withSpring(1.1, {
        damping: 8,
        stiffness: 270,
      }),
      withSpring(1, {
        damping: 10,
        stiffness: 210,
      })
    );
  }, [pop, reduceMotion]);

  const triggerReaction = useCallback(
    (
      nextPose: Pose,
      message: string,
      duration = 3900
    ) => {
      const now = Date.now();

      // Avoid a noisy guide when multiple realtime events
      // arrive almost simultaneously.
      if (
        now - lastRealtimeReaction.current <
        900
      ) {
        return;
      }

      lastRealtimeReaction.current = now;

      if (reactionTimer.current) {
        clearTimeout(reactionTimer.current);
      }

      setPose(nextPose);
      animateTap();
      showBubble(message, duration);

      reactionTimer.current = setTimeout(() => {
        setPose(basePose);
      }, duration);
    },
    [
      animateTap,
      basePose,
      showBubble,
    ]
  );

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription =
      AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (enabled) => {
          if (active) setReduceMotion(enabled);
        }
      );

    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    entryOpacity.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 420 });
    entryY.value = reduceMotion
      ? 0
      : withSpring(0, {
          damping: 13,
          stiffness: 145,
        });

    if (reduceMotion) {
      floatY.value = 0;
      breath.value = 1;
      tilt.value = 0;
      ringScale.value = 1;
      ringOpacity.value = 0.34;
      blinkOpacity.value = 0;
      return;
    }

    floatY.value = withRepeat(
      withSequence(
        withTiming(-5, {
          duration: 1750,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: 1750,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );

    breath.value = withRepeat(
      withSequence(
        withTiming(1.018, {
          duration: 1450,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: 1450,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );

    tilt.value = withRepeat(
      withSequence(
        withTiming(-1.2, {
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1.2, {
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      true
    );

    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.1, {
          duration: 1300,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, {
          duration: 1300,
          easing: Easing.in(Easing.quad),
        })
      ),
      -1,
      false
    );

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.12, { duration: 1300 }),
        withTiming(0.42, { duration: 1300 })
      ),
      -1,
      false
    );

    // A tiny eyelid overlay creates an actual visible
    // blink on the idle/waving pose without a GIF.
    blinkOpacity.value = withRepeat(
      withSequence(
        withDelay(
          3000,
          withTiming(1, { duration: 55 })
        ),
        withTiming(0, { duration: 110 }),
        withDelay(
          2100,
          withTiming(0, { duration: 1 })
        )
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(floatY);
      cancelAnimation(breath);
      cancelAnimation(tilt);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
      cancelAnimation(blinkOpacity);
    };
  }, [
    blinkOpacity,
    breath,
    entryOpacity,
    entryY,
    floatY,
    reduceMotion,
    ringOpacity,
    ringScale,
    tilt,
  ]);

  useEffect(() => {
    setPose(basePose);
    showBubble(routeMessage(pathname), 2600);
  }, [basePose, pathname, showBubble]);

  useEffect(() => {
    const before = previousUnread.current;

    if (unreadCount > before) {
      const added = unreadCount - before;
      triggerReaction(
        'celebrate',
        added === 1
          ? 'You have a new BUKLOD update.'
          : `You have ${added} new BUKLOD updates.`
      );
    }

    previousUnread.current = unreadCount;
  }, [triggerReaction, unreadCount]);

  useEffect(() => {
    // Prayer-aware realtime reaction. This is display-only:
    // the guide never exposes prayer text or member identity.
    const channel = supabase
      .channel('buklod-guide-prayer-activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prayer_requests',
        },
        () => {
          triggerReaction(
            'think',
            'A new prayer request just came in.'
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prayer_responses',
        },
        () => {
          triggerReaction(
            'celebrate',
            'Someone just prayed with the community.'
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [triggerReaction]);

  useEffect(
    () => () => {
      clearBubbleTimer();
      clearGuideHideTimer();

      if (reactionTimer.current) {
        clearTimeout(reactionTimer.current);
      }
    },
    [
      clearBubbleTimer,
      clearGuideHideTimer,
    ]
  );

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [
      { translateX: dragX.value },
      {
        translateY:
          entryY.value + dragY.value,
      },
    ],
  }));

  const motionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${tilt.value}deg` },
      { scale: breath.value * pop.value },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [
      { scale: ringScale.value },
    ],
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
    transform: [
      {
        translateY:
          (1 - bubbleOpacity.value) * 7,
      },
      {
        scale:
          0.96 +
          bubbleOpacity.value * 0.04,
      },
    ],
  }));

  const blinkStyle = useAnimatedStyle(() => ({
    opacity:
      pose === 'wave'
        ? blinkOpacity.value
        : 0,
  }));

  /* PATCH_167I_AVATAR_IS_PROFILE */
  const onPress = () => {
    animateTap();
    scheduleGuideHide(3600);

    router.navigate(
      '/me' as any
    );
  };
  const badgeText =
    unreadCount > 99
      ? '99+'
      : String(unreadCount);

  if (!guideVisible) {
    return null;
  }

  return (
    <>
      {!guideOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0
              ? `Open BUKLOD Profile. ${unreadCount} unread updates.`
              : 'Open BUKLOD Profile'
          }
          accessibilityHint="Shows the BUKLOD Profile avatar temporarily."
          onPress={revealGuide}
          hitSlop={10}
          style={({ pressed }) => [
            styles.touchActivator,
            pressed && styles.touchActivatorPressed,
          ]}
        >
          <Text style={styles.touchActivatorText}>
            PROFILE
          </Text>

          {unreadCount > 0 && (
            <View style={styles.touchActivatorBadge}>
              <Text style={styles.touchActivatorBadgeText}>
                {badgeText}
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {guideOpen && (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.floatingRoot,
        entryStyle,
      ]}
    >
      {bubbleMounted && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            bubbleStyle,
          ]}
        >
          <Text style={styles.bubbleEyebrow}>
            BUKLOD GUIDE
          </Text>
          <Text style={styles.bubbleText}>
            {bubbleText}
          </Text>
          <View style={styles.bubbleTail} />
        </Animated.View>
      )}

      <GestureDetector gesture={dragGesture}>
        {/* PATCH_173G_R6_GESTURE_SINGLE_CHILD */}
        <View
          collapsable={false}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            overflow: 'visible',
          }}
        >
              {/* PATCH_173G_R4_PROFILE_STATUS_MOUNT */}
{/* PATCH_173G_R4_PROFILE_STATUS_LONG_PRESS */}<Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? `BUKLOD Guide. ${unreadCount} unread updates.`
            : 'BUKLOD Profile'
        }
        accessibilityHint={
          unreadCount > 0
            ? 'Opens the Notification Center.'
            : 'Opens your Profile and My BUKLOD.'
        }
onPress={onPress}
        hitSlop={10}
        style={styles.pressable}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.statusPulse,
            unreadCount > 0
              ? styles.statusPulseUnread
              : styles.statusPulseReady,
            ringStyle,
          ]}
        />

        <Animated.View
          style={[
            styles.avatarShell,
            motionStyle,
          ]}
        >
          <View
            style={[
              styles.avatarClip,
              unreadCount > 0
                ? styles.avatarClipUnread
                : styles.avatarClipReady,
            ]}
          >
            <Image
              source={
                profile?.sex === 'female'
                  ? FEMALE_GUIDE[pose]
                  : GUIDE[pose]
              }
              style={styles.avatar}
              resizeMode="cover"
            />

            {pose === 'wave' && (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  blinkStyle,
                ]}
              >
                <View
                  style={[
                    styles.eyelid,
                    styles.leftEyelid,
                  ]}
                />
                <View
                  style={[
                    styles.eyelid,
                    styles.rightEyelid,
                  ]}
                />
              </Animated.View>
            )}
          </View>

          <View
            style={[
              styles.statusDot,
              unreadCount > 0
                ? styles.statusDotUnread
                : styles.statusDotReady,
            ]}
          />

          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeText}
              </Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
              </View></GestureDetector>
    </Animated.View>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  touchActivator: {
    position: 'absolute',
    right: 0,
    bottom: 112,
    minWidth: 48,
    height: 34,
    paddingLeft: 10,
    paddingRight: 8,
    borderTopLeftRadius: 17,
    borderBottomLeftRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(39,93,69,0.88)',
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.72)',
    zIndex: 999,
    elevation: 18,
    shadowColor: '#0F2F22',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  touchActivatorPressed: {
    opacity: 0.68,
    transform: [
      { scale: 0.96 },
    ],
  },

  touchActivatorText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  touchActivatorBadge: {
    position: 'absolute',
    left: -7,
    top: -7,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B98219',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  touchActivatorBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  floatingRoot: {
    position: 'absolute',
    right: 12,
    bottom: 88,
    width: 220,
    height: 200,
    zIndex: 999,
    elevation: 24,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    overflow: 'visible',  },

  pressable: {
    width: 94,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusPulse: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
  },

  statusPulseReady: {
    borderColor: '#6DA77E',
    backgroundColor: 'rgba(39,93,69,0.05)',
  },

  statusPulseUnread: {
    borderColor: '#D6A83F',
    backgroundColor: 'rgba(214,168,63,0.08)',
  },

  avatarShell: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F2F22',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 12,
  },

  avatarClip: {
    width: 78,
    height: 78,
    borderRadius: 39,
    overflow: 'hidden',
    backgroundColor: '#F8F4E8',
    borderWidth: 2.2,
  },

  avatarClipReady: {
    borderColor: '#275D45',
  },

  avatarClipUnread: {
    borderColor: '#D6A83F',
  },

  avatar: {
    width: '100%',
    height: '100%',
  },

  eyelid: {
    position: 'absolute',
    width: 9,
    height: 4,
    borderRadius: 7,
    backgroundColor: '#EFA06D',
    borderBottomWidth: 1.3,
    borderBottomColor: '#2B1A13',
  },

  leftEyelid: {
    left: 25,
    top: 28,
    transform: [
      { rotate: '4deg' },
    ],
  },

  rightEyelid: {
    left: 43,
    top: 28,
    transform: [
      { rotate: '-4deg' },
    ],
  },

  statusDot: {
    position: 'absolute',
    right: 5,
    bottom: 7,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  statusDotReady: {
    backgroundColor: '#2F8A5A',
  },

  statusDotUnread: {
    backgroundColor: '#D6A83F',
  },

  badge: {
    position: 'absolute',
    right: -1,
    top: -2,
    minWidth: 23,
    height: 23,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: '#B98219',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  bubble: {
    position: 'absolute',
    right: 82,
    bottom: 45,
    width: 218,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE8E1',
    shadowColor: '#0F2F22',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 10,
  },

  bubbleEyebrow: {
    color: '#2D6A4F',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.05,
  },

  bubbleText: {
    marginTop: 3,
    color: '#22332B',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '700',
  },

  bubbleTail: {
    position: 'absolute',
    right: -7,
    bottom: 14,
    width: 15,
    height: 15,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: '#DDE8E1',
    transform: [
      { rotate: '45deg' },
    ],
  },
});
