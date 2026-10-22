import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,

  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  router,
  usePathname,
} from 'expo-router';

import {
  useResolvedScope,
} from '@/hooks/useResolvedScope';

import {
  colors,
} from '@/lib/theme';

/* PATCH_173B_MZB_PAPER_STACK */
/* PATCH_184D_MZB_NAV_HOME_CLEANUP */
/* PATCH_173B_R12_MZB_SAFE_AREA */

type IconName =
  React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];

type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  route: string;
};

/* PATCH_173B_R13_SWAP_COMMUNITY_CONNECT_ICONS */
const NAV_ITEMS: NavItem[] = [
  {
      key: 'home',
      label: 'Home',
      icon: 'home-outline',
      route: '/mzb/home',
    },
  {
      key: 'messages',
      label: 'Messages',
      icon: 'message-text-outline',
      route: '/mzb/messages',
    },
  {
      key: 'community',
      label: 'Community',
      icon: 'account-group-outline',
      route: '/mzb/community',
    },
  {
      key: 'prayer',
      label: 'Prayer',
      icon: 'hands-pray',
      route: '/mzb/prayer',
    },
  {
      key: 'word',
      label: 'Word',
      icon: 'book-open-page-variant-outline',
      route: '/mzb/word',
    },
  {
      key: 'learn',
      label: 'Progress',
      icon: 'school-outline',
      route: '/mzb/learn',
    }
];

const SCREEN_WIDTH =
  Dimensions.get('window').width;

function PreviewLines({
  count = 3,
}: {
  count?: number;
}) {
  return (
    <View style={styles.previewLines}>
      {Array.from({
        length: count,
      }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.previewLine,
            {
              width:
                index === count - 1
                  ? '62%'
                  : index % 2 === 0
                    ? '88%'
                    : '76%',
            },
          ]}
        />
      ))}
    </View>
  );
}

function DestinationPreview({
  item,
}: {
  item: NavItem;
}) {
  const card = (
    icon: IconName,
    title: string,
    wide = false,
  ) => (
    <View
      style={[
        styles.previewTile,
        wide && styles.previewTileWide,
      ]}
    >
      <View style={styles.previewIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={16}
          color={colors.greenDark}
        />
      </View>

      <Text
        numberOfLines={1}
        style={styles.previewTileTitle}
      >
        {title}
      </Text>

      <PreviewLines count={2} />
    </View>
  );

  return (
    <View style={styles.previewPage}>
      <View style={styles.previewPageTop}>
        <View>
          <Text style={styles.previewEyebrow}>
            MZB MINISTRY
          </Text>

          <Text style={styles.previewTitle}>
            {item.label}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={item.icon}
          size={24}
          color={colors.greenDark}
        />
      </View>

      {item.key === 'home' && (
        <>
          <View style={styles.previewHero}>
            <Text style={styles.previewHeroText}>
              Ministry Home
            </Text>
            <PreviewLines count={2} />
          </View>

          <View style={styles.previewGrid}>
            {card(
              'book-open-variant',
              'Daily Bible',
            )}
            {card(
              'hand-heart-outline',
              'Bayanihan',
            )}
            {card(
              'hands-pray',
              'Prayer',
            )}
            {card(
              'account-group-outline',
              'Community',
            )}
          </View>
        </>
      )}

      {item.key === 'community' && (
        <>
          <View style={styles.previewComposer}>
            <View style={styles.previewAvatar} />
            <View style={styles.previewComposerInput}>
              <Text style={styles.previewMuted}>
                Share with MZB Community...
              </Text>
            </View>
          </View>

          <View style={styles.previewPost}>
            <View style={styles.previewPostTop}>
              <View style={styles.previewAvatar} />
              <View style={{ flex: 1 }}>
                <View style={styles.previewNameLine} />
                <View style={styles.previewTinyLine} />
              </View>
            </View>
            <PreviewLines count={3} />
            <View style={styles.previewMedia} />
          </View>

          <View style={styles.previewPost}>
            <View style={styles.previewPostTop}>
              <View style={styles.previewAvatar} />
              <View style={{ flex: 1 }}>
                <View style={styles.previewNameLine} />
                <View style={styles.previewTinyLine} />
              </View>
            </View>
            <PreviewLines count={2} />
          </View>
        </>
      )}

      {item.key === 'messages' && (
        <View style={styles.previewList}>
          {[
            'MZB Community Room',
            'Ministry Team',
            'Members',
          ].map((title, index) => (
            <View
              key={title}
              style={styles.previewThread}
            >
              <View style={styles.previewAvatar}>
                <Text style={styles.previewAvatarText}>
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewThreadTitle}>
                  {title}
                </Text>
                <View style={styles.previewTinyLine} />
              </View>
            </View>
          ))}
        </View>
      )}

      {item.key === 'prayer' && (
        <View style={styles.previewList}>
          {card(
            'hands-pray',
            'Prayer Requests',
            true,
          )}
          {card(
            'heart-outline',
            'Pray Together',
            true,
          )}
          {card(
            'check-circle-outline',
            'Answered Prayers',
            true,
          )}
        </View>
      )}

      {item.key === 'word' && (
        <>
          <View style={styles.previewHero}>
            <Text style={styles.previewHeroText}>
              The Word
            </Text>
            <PreviewLines count={3} />
          </View>
          {card(
            'book-open-page-variant-outline',
            'Today’s Reflection',
            true,
          )}
          {card(
            'bookmark-outline',
            'Saved Devotionals',
            true,
          )}
        </>
      )}

      {item.key === 'learn' && (
        <View style={styles.previewList}>
          {[
            'Formation',
            'Bible',
            'Ministry Progress',
          ].map((title, index) => (
            <View
              key={title}
              style={styles.previewProgressCard}
            >
              <View style={styles.previewPostTop}>
                <MaterialCommunityIcons
                  name={
                    index === 0
                      ? 'school-outline'
                      : index === 1
                        ? 'book-open-variant'
                        : 'chart-line'
                  }
                  size={18}
                  color={colors.greenDark}
                />
                <Text style={styles.previewThreadTitle}>
                  {title}
                </Text>
              </View>
              <View style={styles.previewProgressTrack}>
                <View
                  style={[
                    styles.previewProgressFill,
                    {
                      width:
                        index === 0
                          ? '72%'
                          : index === 1
                            ? '48%'
                            : '63%',
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function
MzbEnvironmentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useResolvedScope({
    mzbOnly: true,
    syncActiveScope: true,
  });

  const insets =
    useSafeAreaInsets();

  const pathname =
    usePathname();

  const routeIndex =
    useMemo(() => {
      const found =
        NAV_ITEMS.findIndex(
          item =>
            pathname === item.route ||
            pathname.startsWith(
              `${item.route}/`,
            ),
        );

      return found >= 0
        ? found
        : 0;
    }, [pathname]);

  const translateX =
    useRef(
      new Animated.Value(0),
    ).current;

  const [previewIndex, setPreviewIndex] =
    useState<number | null>(null);

  const previewIndexRef =
    useRef<number | null>(null);

  const navigatingRef =
    useRef(false);

  const setPreview =
    useCallback(
      (index: number | null) => {
        if (
          previewIndexRef.current ===
          index
        ) {
          return;
        }

        previewIndexRef.current =
          index;

        setPreviewIndex(index);
      },
      [],
    );

  const resetCard =
    useCallback(() => {
      Animated.spring(
        translateX,
        {
          toValue: 0,
          useNativeDriver: true,
          speed: 22,
          bounciness: 5,
        },
      ).start(() => {
        setPreview(null);
      });
    }, [
      setPreview,
      translateX,
    ]);

  useEffect(() => {
    navigatingRef.current = false;
    translateX.setValue(0);
    setPreview(null);
  }, [
    pathname,
    setPreview,
    translateX,
  ]);

  const finishNavigation =
    useCallback(
      (
        index: number,
        _direction: -1 | 1,
      ) => {
        if (
          index < 0 ||
          index >= NAV_ITEMS.length ||
          index === routeIndex ||
          navigatingRef.current
        ) {
          return;
        }

        navigatingRef.current = true;

        /*
         * PATCH_173B_R11_ZERO_FLICK_ROUTE
         *
         * One route commit only:
         * no preview swap, no timing animation,
         * no translated page during replacement.
         */
        translateX.stopAnimation();
        translateX.setValue(0);
        setPreview(null);

        router.replace(
          NAV_ITEMS[index]
            .route as any,
        );
      },
      [
        routeIndex,
        setPreview,
        translateX,
      ],
    );
  const navigateTo =
    useCallback(
      (index: number) => {
        if (
          index === routeIndex ||
          navigatingRef.current
        ) {
          return;
        }

        const direction: -1 | 1 =
          index > routeIndex
            ? -1
            : 1;

        finishNavigation(
          index,
          direction,
        );
      },
      [
        finishNavigation,
        routeIndex,
      ],
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => false,

          onMoveShouldSetPanResponder:
            (_event, gesture) => {
              const horizontal =
                Math.abs(
                  gesture.dx,
                );

              const vertical =
                Math.abs(
                  gesture.dy,
                );

              return (
                horizontal >= 10 &&
                horizontal > vertical * 1.55
              );
            },

          onPanResponderGrant:
            () => {
              translateX.stopAnimation();
            },

          onPanResponderMove:
            (_event, gesture) => {
              if (
                navigatingRef.current
              ) {
                return;
              }

              const direction =
                gesture.dx < 0
                  ? 1
                  : -1;

              const target =
                routeIndex +
                direction;

              if (
                target < 0 ||
                target >=
                  NAV_ITEMS.length
              ) {
                translateX.setValue(
                  gesture.dx * 0.18,
                );
                setPreview(null);
                return;
              }

              setPreview(target);

              /*
               * PATCH_173B_R11_STABLE_SURFACE
               * Track swipe intent without moving the live route tree.
               */
              translateX.setValue(0);
            },

          onPanResponderRelease:
            (_event, gesture) => {
              if (
                navigatingRef.current
              ) {
                return;
              }

              const target =
                previewIndexRef.current;

              if (target === null) {
                resetCard();
                return;
              }

              const enoughDistance =
                Math.abs(
                  gesture.dx,
                ) >= 62;

              const enoughVelocity =
                Math.abs(
                  gesture.vx,
                ) >= 0.48;

              if (
                !enoughDistance &&
                !enoughVelocity
              ) {
                resetCard();
                return;
              }

              finishNavigation(
                target,
                gesture.dx < 0
                  ? -1
                  : 1,
              );
            },

          onPanResponderTerminate:
            () => {
              if (
                !navigatingRef.current
              ) {
                resetCard();
              }
            },
        }),
      [
        finishNavigation,
        resetCard,
        routeIndex,
        setPreview,
        translateX,
      ],
    );

  const cardRotate =
    translateX.interpolate({
      inputRange: [
        -SCREEN_WIDTH,
        0,
        SCREEN_WIDTH,
      ],
      outputRange: [
        '-4.5deg',
        '0deg',
        '4.5deg',
      ],
      extrapolate: 'clamp',
    });

  const cardScale =
    translateX.interpolate({
      inputRange: [
        -SCREEN_WIDTH,
        0,
        SCREEN_WIDTH,
      ],
      outputRange: [
        0.985,
        1,
        0.985,
      ],
      extrapolate: 'clamp',
    });

  const previewScale =
    translateX.interpolate({
      inputRange: [
        -SCREEN_WIDTH,
        0,
        SCREEN_WIDTH,
      ],
      outputRange: [
        1,
        0.965,
        1,
      ],
      extrapolate: 'clamp',
    });

  const previewOpacity =
    translateX.interpolate({
      inputRange: [
        -SCREEN_WIDTH * 0.55,
        0,
        SCREEN_WIDTH * 0.55,
      ],
      outputRange: [
        1,
        0.72,
        1,
      ],
      extrapolate: 'clamp',
    });

  const active =
    NAV_ITEMS[routeIndex];

  /*
   * PATCH_173B_R11_NO_FAKE_PREVIEW
   *
   * Keep a normal non-null NavItem expression so TypeScript can
   * safely type-check the existing preview JSX. The JSX mount
   * itself is hard-disabled below, so no synthetic page is shown.
   */
  const previewItem: NavItem =
    NAV_ITEMS[
      previewIndex ??
        routeIndex
    ] ??
    NAV_ITEMS[routeIndex];
  return (
    <View
      style={styles.screen}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop:
              Math.max(
                insets.top,
                8,
              ) + 8,
            paddingBottom: 8,
            minHeight:
              62 +
              Math.max(
                insets.top,
                8,
              ) +
              8,
          },
        ]}
      >
        <View style={styles.brandIcon}>
          <MaterialCommunityIcons
            name="church"
            size={21}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.brandCopy}>
          <Text style={styles.brand}>
            MZB Ministry
          </Text>

          <View
            style={
              styles.environmentRow
            }
          >
            <View
              style={
                styles.environmentDot
              }
            />

            <Text
              style={
                styles.environment
              }
            >
              MINISTRY ENVIRONMENT
            </Text>
          </View>
        </View>

        <View style={styles.activePill}>
          <MaterialCommunityIcons
            name={active.icon}
            size={14}
            color={colors.greenDark}
          />
          <Text
            numberOfLines={1}
            style={styles.activePillText}
          >
            {active.label}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push(
              '/(tabs)/me' as any,
            )
          }
          style={({ pressed }) => [
            styles.accountButton,
            pressed && {
              opacity: 0.7,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="account-circle-outline"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        {false && !!previewItem && (
          <Animated.View
            pointerEvents="none"
            style={styles.paper}        >
            <DestinationPreview
              item={previewItem}
            />

            <View
              style={
                styles.previewRevealBadge
              }
            >
              <MaterialCommunityIcons
                name="gesture-swipe-horizontal"
                size={14}
                color={colors.greenDark}
              />
              <Text
                style={
                  styles.previewRevealText
                }
              >
                {previewItem.label}
              </Text>
            </View>
          </Animated.View>
        )}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.paper,
            {
              transform: [
                {
                  translateX,
                },
                {
                  rotateZ:
                    cardRotate,
                },
                {
                  scale:
                    cardScale,
                },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>

      <View
        style={[
          styles.nav,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                12,
              ) + 8,
            minHeight:
              64 +
              Math.max(
                insets.bottom,
                12,
              ) +
              8,
          },
        ]}
      >
        {NAV_ITEMS.map(
          (item, index) => {
            const isActive =
              index === routeIndex;

            return (
              <Pressable
                key={item.key}
                onPress={() =>
                  navigateTo(index)
                }
                style={({ pressed }) => [
                  styles.navItem,
                  pressed && {
                    opacity: 0.66,
                  },
                ]}
              >
                <View
                  style={[
                    styles.navIconWrap,
                    isActive &&
                      styles.navIconWrapActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={19}
                    color={
                      isActive
                        ? colors.greenDark
                        : colors.muted
                    }
                  />
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.navLabel,
                    isActive &&
                      styles.navLabelOn,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          },
        )}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#E8EFEA',
    },

    header: {
      minHeight: 62,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
      backgroundColor:
        colors.white,
      zIndex: 20,
    },

    brandIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenDark,
    },

    brandCopy: {
      flex: 1,
      minWidth: 0,
    },

    brand: {
      fontSize: 15.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    environmentRow: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    environmentDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor:
        colors.greenDark,
    },

    environment: {
      fontSize: 7.7,
      fontWeight: '900',
      letterSpacing: 0.72,
      color:
        colors.muted,
    },

    activePill: {
      maxWidth: 92,
      minHeight: 30,
      paddingHorizontal: 9,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor:
        colors.greenSoft,
    },

    activePillText: {
      flexShrink: 1,
      fontSize: 8.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    accountButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    body: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      paddingHorizontal: 5,
      paddingVertical: 4,
    },

    underCard: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      marginHorizontal: 5,
      marginVertical: 4,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor:
        'rgba(27,86,58,0.12)',
      backgroundColor:
        '#F5F8F6',
      shadowColor: '#000000',
      shadowOpacity: 0.10,
      shadowRadius: 10,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      elevation: 2,
    },

    paper: {
      flex: 1,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor:
        colors.background,
      shadowColor: '#000000',
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 6,
      },
      elevation: 5,
    },

    previewPage: {
      flex: 1,
      padding: 14,
      backgroundColor:
        '#F7FAF8',
    },

    previewPageTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingBottom: 11,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
    },

    previewEyebrow: {
      fontSize: 7.5,
      fontWeight: '900',
      letterSpacing: 0.8,
      color:
        colors.muted,
    },

    previewTitle: {
      marginTop: 2,
      fontSize: 20,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    previewHero: {
      marginTop: 12,
      minHeight: 92,
      borderRadius: 18,
      padding: 14,
      backgroundColor:
        colors.greenDark,
    },

    previewHeroText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    previewGrid: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    previewTile: {
      width: '48.6%',
      minHeight: 84,
      borderRadius: 15,
      padding: 10,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    previewTileWide: {
      width: '100%',
      marginTop: 9,
    },

    previewIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    previewTileTitle: {
      marginTop: 6,
      fontSize: 9.5,
      fontWeight: '900',
      color:
        colors.text,
    },

    previewLines: {
      marginTop: 6,
      gap: 4,
    },

    previewLine: {
      height: 4,
      borderRadius: 3,
      backgroundColor:
        'rgba(58,77,67,0.14)',
    },

    previewComposer: {
      marginTop: 12,
      minHeight: 56,
      padding: 9,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor:
        colors.white,
    },

    previewAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    previewAvatarText: {
      fontSize: 8,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    previewComposerInput: {
      flex: 1,
      minHeight: 34,
      borderRadius: 12,
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor:
        colors.background,
    },

    previewMuted: {
      fontSize: 8.5,
      color:
        colors.muted,
    },

    previewPost: {
      marginTop: 9,
      borderRadius: 16,
      padding: 11,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    previewPostTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    previewNameLine: {
      width: '42%',
      height: 5,
      borderRadius: 3,
      backgroundColor:
        'rgba(30,76,54,0.24)',
    },

    previewTinyLine: {
      marginTop: 5,
      width: '64%',
      height: 4,
      borderRadius: 3,
      backgroundColor:
        'rgba(58,77,67,0.12)',
    },

    previewMedia: {
      marginTop: 10,
      height: 80,
      borderRadius: 13,
      backgroundColor:
        '#E2EAE5',
    },

    previewList: {
      marginTop: 10,
      gap: 8,
    },

    previewThread: {
      minHeight: 56,
      borderRadius: 15,
      padding: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    previewThreadTitle: {
      fontSize: 9.5,
      fontWeight: '900',
      color:
        colors.text,
    },

    previewProgressCard: {
      minHeight: 72,
      borderRadius: 15,
      padding: 11,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    previewProgressTrack: {
      marginTop: 12,
      height: 7,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor:
        colors.greenSoft,
    },

    previewProgressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor:
        colors.greenDark,
    },

    previewRevealBadge: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      minHeight: 28,
      paddingHorizontal: 9,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor:
        colors.greenSoft,
    },

    previewRevealText: {
      fontSize: 8.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    nav: {
      minHeight: 64,
      paddingHorizontal: 4,
      paddingTop: 6,
      paddingBottom: 7,
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor:
        colors.line,
      backgroundColor:
        colors.white,
      zIndex: 20,
    },

    navItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },

    navIconWrap: {
      minWidth: 33,
      minHeight: 25,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },

    navIconWrapActive: {
      backgroundColor:
        colors.greenSoft,
    },

    navLabel: {
      maxWidth: '100%',
      fontSize: 7.3,
      fontWeight: '800',
      color:
        colors.muted,
    },

    navLabelOn: {
      color:
        colors.greenDark,
      fontWeight: '900',
    },
  });