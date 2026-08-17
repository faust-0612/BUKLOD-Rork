import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/lib/theme';

export function Card({
  children,
}: {
  children: ReactNode;
}) {
  return <View style={styles.card}>{children}</View>;
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
  return (
    <Pressable
      onPress={onPress}
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
    </Pressable>
  );
}

export function SectionTitle({
  children,
}: {
  children: ReactNode;
}) {
  return <Text style={styles.section}>{children}</Text>;
}

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // App-wide content using shared primitives:
  // tighter outer spacing, but not cramped.
  content: {
    paddingHorizontal: 11,
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
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },

  body: {
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.text,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});

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