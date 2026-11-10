import {
  ReactNode,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import BuklodPressable from '@/components/BuklodPressable';
import { playBuklodCue } from '@/lib/buklodSounds';
import {
  createBuklodButtonStyles,
  createBuklodCardStyle,
  createBuklodSharedStyles,
} from '@/lib/buklodThemePresentation';
import { colors } from '@/lib/theme';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const { theme } = useBuklodTheme();
  const cardStyle = useMemo(
    () => createBuklodCardStyle(theme),
    [theme]
  );

  return (
    <View style={[cardStyle, style]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  outline = false,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
}) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(
    () => createBuklodButtonStyles(theme),
    [theme]
  );

  return (
    <BuklodPressable
      instant
      onPress={() => {
        void playBuklodCue('button');
        onPress();
      }}
      style={[
        styles.button,
        outline && styles.outline,
      ]}>
      <Text
        style={[
          styles.buttonText,
          outline && styles.outlineText,
        ]}>
        {title}
      </Text>
    </BuklodPressable>
  );
}

export { BuklodPressable };

export function SectionTitle({
  children,
}: {
  children: ReactNode;
}) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(
    () => createBuklodButtonStyles(theme),
    [theme]
  );

  return (
    <Text style={styles.section}>
      {children}
    </Text>
  );
}

/** @deprecated Prefer useBuklodPresentation().shared for reactive theming. */
export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 8,
  },
  h1: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    color: colors.text,
  },
  h2: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.muted,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});

export function useThemedShared() {
  const { theme } = useBuklodTheme();

  return useMemo(
    () => createBuklodSharedStyles(theme),
    [theme]
  );
}

export type ThemedTextStyle = TextStyle;
export type ThemedViewStyle = ViewStyle;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  button: {
    minHeight: 46,
    backgroundColor: colors.green,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.green,
  },
  outlineText: {
    color: colors.green,
  },
  section: {
    marginTop: 7,
    marginBottom: 4,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
});

// Legacy static styles kept for any direct StyleSheet references
void styles;
