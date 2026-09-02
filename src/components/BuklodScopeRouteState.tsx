import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { colors } from '@/lib/theme';
import type { ResolvedScopeAccess } from '@/lib/buklodScopeRoute';

type BuklodScopeRouteStateProps = {
  access: ResolvedScopeAccess;
  title?: string;
  message?: string;
  loadingLabel?: string;
  onRetry?: () => void;
  onBack?: () => void;
};

export default function BuklodScopeRouteState({
  access,
  title,
  message,
  loadingLabel = 'Loading workspace...',
  onRetry,
  onBack,
}: BuklodScopeRouteStateProps) {
  if (access === 'authorized') {
    return null;
  }

  if (access === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.green}
          size="large"
        />
        <Text style={styles.loadingText}>
          {loadingLabel}
        </Text>
      </View>
    );
  }

  const icon =
    access === 'error'
      ? 'alert-circle-outline'
      : access === 'not_found'
        ? 'map-search-outline'
        : 'shield-lock-outline';

  const defaultTitle =
    access === 'error'
      ? 'Unable to load workspace'
      : access === 'not_found'
        ? 'Workspace not found'
        : 'Workspace unavailable';

  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={colors.greenDark}
        />
      </View>

      <Text style={styles.title}>
        {title ?? defaultTitle}
      </Text>

      {!!message && (
        <Text style={styles.message}>
          {message}
        </Text>
      )}

      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={styles.primaryButton}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.primaryButtonText}>
            RETRY
          </Text>
        </Pressable>
      )}

      {onBack && (
        <Pressable
          onPress={onBack}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            GO BACK
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: colors.background,
  },

  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },

  title: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '900',
    color: colors.greenDark,
    textAlign: 'center',
  },

  message: {
    marginTop: 8,
    maxWidth: 320,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.muted,
    textAlign: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
  },

  primaryButton: {
    marginTop: 16,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.greenDark,
  },

  primaryButtonText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  secondaryButton: {
    marginTop: 8,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },

  secondaryButtonText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.greenDark,
  },
});
