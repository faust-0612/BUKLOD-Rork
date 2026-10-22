import React, { useEffect, useRef } from 'react';

import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';

type Props = {
  text: string | null;
  onDismiss?: () => void;
  /** Auto-dismiss after ms. 0 = no auto dismiss. */
  autoDismissMs?: number;
  anchor?: 'left' | 'center' | 'right';
};

/** Premium dialogue bubble anchored near the character stage. */
export default function BuklodCharacterDialogue({
  text,
  onDismiss,
  autoDismissMs = 3600,
  anchor = 'center',
}: Props) {
  const { theme } = useBuklodPresentation();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!text) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 6,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    if (autoDismissMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss?.();
      }, autoDismissMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoDismissMs, onDismiss, opacity, text, translateY]);

  if (!text) return null;

  const alignSelf =
    anchor === 'left'
      ? 'flex-start'
      : anchor === 'right'
        ? 'flex-end'
        : 'center';

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          alignSelf,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: withAlpha(theme.surface, 0.94),
            borderColor: withAlpha(theme.accent, 0.28),
          },
        ]}
      >
        <Text
          style={[styles.text, { color: theme.textPrimary }]}
          numberOfLines={3}
        >
          {text}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={BUKLOD_HIT_SLOP}
          style={styles.dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss character message"
        >
          <MaterialCommunityIcons
            name="close"
            size={14}
            color={theme.textMuted}
          />
        </Pressable>
      </View>
      <View
        style={[
          styles.tail,
          {
            borderTopColor: withAlpha(theme.surface, 0.94),
            alignSelf:
              anchor === 'left'
                ? 'flex-start'
                : anchor === 'right'
                  ? 'flex-end'
                  : 'center',
            marginLeft: anchor === 'left' ? 18 : 0,
            marginRight: anchor === 'right' ? 18 : 0,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 8,
    marginTop: -4,
    marginBottom: 6,
    zIndex: 40,
  },
  bubble: {
    maxWidth: '92%',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 32,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  text: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  dismiss: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
