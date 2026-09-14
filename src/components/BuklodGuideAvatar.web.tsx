import React, {
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
  usePathname,
} from 'expo-router';

import {
  buildScopedWorkspacePath,
  firstRouteParam,
} from '@/lib/buklodScopeRoute';

import {
  isBuklodProfileRoute,
  isBuklodScopedWorkspacePath,
  isBuklodScopedWorkspaceScopeType,
  useBuklodPersistentNavOccupiedHeight,
} from '@/lib/buklodSafeArea';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  useNotifications,
} from '@/providers/NotificationProvider';

const GUIDE_SIZE = 58;
const MOBILE_WEB_MAX_WIDTH = 1099;
const MOBILE_DRAG_START_PX = 4;
const EDGE_GAP = 8;
const TOP_GAP = 52;

const GUIDE = {
  male: require('../../assets/buklod-guide/wave.png'),
  female: require('../../assets/buklod-guide/female-wave.png'),
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/*
 * BUKLOD_WEB_PROFILE_AVATAR_R24_MOBILE_TOUCH
 *
 * Web uses a lightweight avatar instead of the continuously animated native
 * GestureDetector version. R24 keeps drag specifically for phone/small web,
 * keeps the hit surface equal to the visible avatar, and preserves browser
 * history when Public Community opens Profile so Back returns to Community.
 *
 * Native Android/iOS still resolve BuklodGuideAvatar.tsx and are untouched.
 */
export function BuklodGuideAvatar() {
  const pathname = usePathname();
  const params =
    useLocalSearchParams<{
      returnScopeId?: string | string[];
    }>();
  const { width, height } = useWindowDimensions();
  const navOccupied = useBuklodPersistentNavOccupiedHeight();

  const {
    session,
    profile,
  } = useAuth();

  const {
    activeScope,
    scopes,
    selectScope,
  } = useBuklodScope();

  const {
    unreadCount,
  } = useNotifications();

  const isMobileWeb = width <= MOBILE_WEB_MAX_WIDTH;
  const baseBottom = isMobileWeb
    ? Math.max(navOccupied, 0) + 12
    : 18;

  const drag = useRef(
    new Animated.ValueXY({ x: 0, y: 0 })
  ).current;
  const dragValueRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedRef = useRef(false);

  const clampDrag = (
    wantedX: number,
    wantedY: number,
  ) => {
    const baseX = width - 18 - GUIDE_SIZE;
    const baseY = height - baseBottom - GUIDE_SIZE;

    const minX = EDGE_GAP - baseX;
    const maxX = width - EDGE_GAP - GUIDE_SIZE - baseX;
    const minY = TOP_GAP - baseY;
    const maxY =
      height -
      Math.max(navOccupied, 0) -
      EDGE_GAP -
      GUIDE_SIZE -
      baseY;

    return {
      x: clamp(
        wantedX,
        Math.min(minX, maxX),
        Math.max(minX, maxX),
      ),
      y: clamp(
        wantedY,
        Math.min(minY, maxY),
        Math.max(minY, maxY),
      ),
    };
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          isMobileWeb &&
          Math.hypot(gesture.dx, gesture.dy) >= MOBILE_DRAG_START_PX,
        onPanResponderGrant: () => {
          dragStartRef.current = dragValueRef.current;
          draggedRef.current = false;
        },
        onPanResponderMove: (_event, gesture) => {
          if (!isMobileWeb) return;

          draggedRef.current = true;
          const next = clampDrag(
            dragStartRef.current.x + gesture.dx,
            dragStartRef.current.y + gesture.dy,
          );
          dragValueRef.current = next;
          drag.setValue(next);
        },
        onPanResponderRelease: () => {
          if (!draggedRef.current) return;
          setTimeout(() => {
            draggedRef.current = false;
          }, 0);
        },
        onPanResponderTerminate: () => {
          if (!draggedRef.current) return;
          setTimeout(() => {
            draggedRef.current = false;
          }, 0);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [
      baseBottom,
      height,
      isMobileWeb,
      navOccupied,
      width,
      drag,
    ],
  );

  useEffect(() => {
    if (!isMobileWeb) {
      dragValueRef.current = { x: 0, y: 0 };
      drag.setValue({ x: 0, y: 0 });
      return;
    }

    const next = clampDrag(
      dragValueRef.current.x,
      dragValueRef.current.y,
    );
    dragValueRef.current = next;
    drag.setValue(next);
  }, [
    baseBottom,
    height,
    isMobileWeb,
    navOccupied,
    width,
    drag,
  ]);

  const isProfileRoute =
    isBuklodProfileRoute(pathname);

  const scopedWorkspaceActive =
    isBuklodScopedWorkspaceScopeType(
      activeScope?.scope_type
    );

  const explicitReturnScopeId =
    firstRouteParam(
      params.returnScopeId
    );

  const profileReturnScopeId =
    useMemo(
      () =>
        explicitReturnScopeId ||
        (
          isProfileRoute &&
          scopedWorkspaceActive
            ? activeScope?.scope_id ?? ''
            : ''
        ),
      [
        explicitReturnScopeId,
        isProfileRoute,
        scopedWorkspaceActive,
        activeScope?.scope_id,
      ]
    );

  const profileReturnMode =
    isProfileRoute &&
    Boolean(profileReturnScopeId);

  const visible =
    Boolean(session) &&
    !pathname.includes('/privacy') &&
    !pathname.includes('/delete-account') &&
    !pathname.includes('/points') &&
    (!isProfileRoute || profileReturnMode);

  if (!visible) {
    return null;
  }

  const openProfileOrReturn = () => {
    if (draggedRef.current) {
      return;
    }

    if (
      profileReturnMode &&
      profileReturnScopeId
    ) {
      void (async () => {
        try {
          await selectScope(
            profileReturnScopeId
          );
        } catch (error) {
          console.warn(
            'BUKLOD web profile return scope select:',
            error
          );
        }

        router.replace(
          buildScopedWorkspacePath(
            'home',
            profileReturnScopeId
          ) as any
        );
      })();

      return;
    }

    const openingFromScopedWorkspace =
      !isProfileRoute &&
      scopedWorkspaceActive &&
      isBuklodScopedWorkspacePath(
        pathname
      );

    if (
      openingFromScopedWorkspace &&
      activeScope?.scope_id
    ) {
      const returnScopeId =
        activeScope.scope_id;

      void (async () => {
        const publicScope =
          scopes.find(
            scope =>
              scope.scope_type === 'PUBLIC'
          );

        if (publicScope) {
          try {
            await selectScope(
              publicScope.scope_id
            );
          } catch (error) {
            console.warn(
              'BUKLOD web avatar Public reset:',
              error
            );
          }
        }

        router.replace(
          `/me?returnScopeId=${encodeURIComponent(returnScopeId)}` as any
        );
      })();

      return;
    }

    const publicScope =
      scopes.find(
        scope =>
          scope.scope_type === 'PUBLIC'
      );

    if (
      scopedWorkspaceActive &&
      publicScope
    ) {
      void selectScope(
        publicScope.scope_id
      ).catch(error => {
        console.warn(
          'BUKLOD web avatar global reset:',
          error
        );
      });
    }

    /*
     * Public Community -> Profile must preserve browser/PWA history. Using
     * replace here would remove Community Wall and let phone Back exit the
     * web app. Push keeps Community immediately behind Profile.
     */
    router.push(
      '/me' as any
    );
  };

  const source =
    (profile as any)?.sex === 'female'
      ? GUIDE.female
      : GUIDE.male;

  return (
    <Animated.View
      {...(isMobileWeb ? panResponder.panHandlers : {})}
      style={[
        styles.root,
        {
          bottom: baseBottom,
          transform: drag.getTranslateTransform(),
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          profileReturnMode
            ? 'Return to organization home'
            : 'Open BUKLOD Profile'
        }
        accessibilityHint={
          isMobileWeb
            ? 'Tap for Profile or drag to reposition.'
            : profileReturnMode
              ? 'Returns to your organization workspace.'
              : 'Opens Profile and My BUKLOD.'
        }
        onPress={openProfileOrReturn}
        hitSlop={0}
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={source}
          style={styles.avatar}
          resizeMode="cover"
        />

        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99
                ? '99+'
                : String(unreadCount)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Text
        pointerEvents="none"
        style={styles.label}
      >
        {profileReturnMode
          ? 'HOME'
          : 'PROFILE'}
      </Text>
    </Animated.View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      position: 'absolute',
      right: 18,
      zIndex: 9999,
      width: GUIDE_SIZE,
      alignItems: 'center',
      gap: 4,
      ...({
        touchAction: 'none',
        userSelect: 'none',
      } as any),
    },

    pressable: {
      width: GUIDE_SIZE,
      height: GUIDE_SIZE,
      borderRadius: GUIDE_SIZE / 2,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      backgroundColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.18,
      shadowRadius: 7,
      elevation: 8,
      position: 'relative',
    },

    pressed: {
      opacity: 0.78,
      transform: [
        { scale: 0.97 },
      ],
    },

    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: GUIDE_SIZE / 2,
    },

    badge: {
      position: 'absolute',
      right: -5,
      top: -5,
      minWidth: 22,
      height: 22,
      paddingHorizontal: 5,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      backgroundColor: '#B45309',
    },

    badgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },

    label: {
      color: '#14532D',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.5,
      backgroundColor: 'rgba(255,255,255,0.94)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
  });
