/**
 * Maps global BUKLOD semantic tokens to legacy presentation shapes
 * so existing screens can adopt theming incrementally.
 */

import {
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';

/** Legacy color shape from src/lib/theme.ts */
export type LegacyThemeColors = {
  green: string;
  greenDark: string;
  greenSoft: string;
  blue: string;
  text: string;
  muted: string;
  line: string;
  background: string;
  white: string;
  danger: string;
  amber: string;
};

export function mapThemeToLegacyColors(
  theme: BuklodThemeRoles
): LegacyThemeColors {
  return {
    green: theme.accent,
    greenDark: theme.accent,
    greenSoft: theme.accentSoft,
    blue: theme.accent,
    text: theme.textPrimary,
    muted: theme.textMuted,
    line: theme.border,
    background: theme.canvas,
    white: theme.surface,
    danger: theme.danger,
    amber: theme.warning,
  };
}

export type BuklodSharedStyles = {
  screen: ViewStyle;
  content: ViewStyle;
  h1: TextStyle;
  h2: TextStyle;
  muted: TextStyle;
  body: TextStyle;
  row: ViewStyle;
};

export function createBuklodSharedStyles(
  theme: BuklodThemeRoles
): BuklodSharedStyles {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.canvas,
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
      color: theme.textPrimary,
    },
    h2: {
      fontSize: 19,
      lineHeight: 25,
      fontWeight: '800',
      color: theme.textPrimary,
    },
    muted: {
      fontSize: 15,
      lineHeight: 20,
      color: theme.textMuted,
    },
    body: {
      fontSize: 16,
      lineHeight: 23,
      color: theme.textPrimary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
  });
}

export function createBuklodCardStyle(
  theme: BuklodThemeRoles
): ViewStyle {
  return {
    backgroundColor: theme.cardSurface,
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
  };
}

export function createBuklodButtonStyles(
  theme: BuklodThemeRoles
) {
  return StyleSheet.create({
    button: {
      minHeight: 46,
      backgroundColor: theme.buttonPrimary,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: theme.white,
      fontSize: 15.5,
      lineHeight: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    outline: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.buttonPrimary,
    },
    outlineText: {
      color: theme.buttonPrimary,
    },
    section: {
      marginTop: 7,
      marginBottom: 4,
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '900',
      letterSpacing: 0.35,
    },
  });
}
