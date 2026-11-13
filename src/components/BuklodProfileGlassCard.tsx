import React, {
  useMemo,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  ProfilePressable,
} from '@/components/BuklodProfileMotion';
import {
  withAlpha,
} from '@/lib/buklodContrast';
import {
  buklodRadii,
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

function createGlassStyles(
  theme: BuklodThemeRoles
) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: withAlpha(theme.border, 0.88),
      borderRadius: buklodRadii.card,
      backgroundColor: withAlpha(theme.cardSurface, 0.72),
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: {
        width: 0,
        height: 3,
      },
      elevation: 2,
    },
    row: {
      minHeight: 58,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    icon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(theme.accentSoft, 0.9),
      borderWidth: 1,
      borderColor: withAlpha(theme.border, 0.7),
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '800',
      color: theme.textPrimary,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12.5,
      lineHeight: 17,
      color: theme.textMuted,
    },
  });
}

export function BuklodProfileGlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(
    () => createGlassStyles(theme),
    [theme]
  );

  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function BuklodProfileGlassRow({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  trailing,
}: {
  icon: React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(
    () => createGlassStyles(theme),
    [theme]
  );

  const body = (
    <>
      <View style={styles.icon}>
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={theme.accent}
        />
      </View>

      <View style={styles.copy}>
        <Text
          allowFontScaling
          style={styles.title}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            allowFontScaling
            style={styles.subtitle}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {trailing ?? (
        onPress ? (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.textMuted}
          />
        ) : null
      )}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row}>
        {body}
      </View>
    );
  }

  return (
    <ProfilePressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { opacity: 0.78 },
        disabled && { opacity: 0.55 },
      ]}
    >
      {body}
    </ProfilePressable>
  );
}
