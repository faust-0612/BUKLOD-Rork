import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  loadSystemAnnouncementBoard,
  type SystemAnnouncementSlot,
} from '@/lib/buklodSystemAnnouncementBoard';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type Props = {
  slot: SystemAnnouncementSlot;
  style?: object;
};

export function BuklodSystemAnnouncementBoard({
  slot,
  style,
}: Props) {
  const { theme } = useBuklodTheme();
  const { hasRole } = useAuth();
  const canEdit = hasRole('system_admin');

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const board = await loadSystemAnnouncementBoard(slot);
      setMessage(board?.message?.trim() ?? '');
    } catch (error) {
      console.warn(
        'System announcement board:',
        String((error as Error)?.message ?? error)
      );
      setMessage('');
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginHorizontal: slot === 'public_home' ? 12 : 0,
          marginTop: slot === 'public_home' ? 4 : 0,
          marginBottom: slot === 'public_home' ? 2 : 10,
        },
        board: {
          borderRadius: slot === 'public_home' ? 18 : 16,
          borderWidth: 1,
          borderColor:
            slot === 'public_home'
              ? colors.greenDark
              : theme.border,
          backgroundColor:
            slot === 'public_home'
              ? '#F4FBF7'
              : theme.cardSurface,
          paddingHorizontal: slot === 'public_home' ? 18 : 14,
          paddingVertical: slot === 'public_home' ? 16 : 12,
        },
        label: {
          fontSize: slot === 'public_home' ? 11 : 10,
          fontWeight: '900',
          letterSpacing: 1.1,
          color:
            slot === 'public_home'
              ? colors.greenDark
              : theme.textMuted,
          marginBottom: slot === 'public_home' ? 8 : 6,
        },
        message: {
          color:
            slot === 'public_home'
              ? colors.text
              : theme.textPrimary,
          fontWeight: slot === 'public_home' ? '900' : '800',
          fontSize: slot === 'public_home' ? 22 : 15,
          lineHeight: slot === 'public_home' ? 30 : 22,
        },
        editBtn: {
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        editText: {
          fontSize: 11,
          fontWeight: '900',
          color: colors.greenDark,
        },
        adminSetup: {
          marginHorizontal: slot === 'public_home' ? 12 : 0,
          marginTop: slot === 'public_home' ? 4 : 0,
          marginBottom: slot === 'public_home' ? 2 : 10,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: withAlpha(colors.greenDark, 0.25),
          borderStyle: 'dashed',
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: withAlpha(colors.greenDark, 0.04),
        },
        adminSetupText: {
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '700',
          color: theme.textMuted,
          textAlign: 'center',
        },
      }),
    [slot, theme]
  );

  if (loading) {
    return null;
  }

  if (!message) {
    if (!canEdit) {
      return null;
    }

    return (
      <Pressable
        style={[styles.adminSetup, style]}
        onPress={() =>
          router.push('/admin/system-announcement-boards' as any)
        }
      >
        <Text style={styles.adminSetupText}>
          {slot === 'public_home'
            ? 'Set the Public Home announcement board'
            : 'Set the profile announcement board'}
        </Text>
        <View style={styles.editBtn}>
          <Text style={styles.editText}>OPEN ANNOUNCEMENT BOARDS</Text>
          <MaterialCommunityIcons
            name="bullhorn-outline"
            size={14}
            color={colors.greenDark}
          />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.board}>
        <Text style={styles.label}>
          {slot === 'public_home'
            ? 'ANNOUNCEMENT'
            : 'FROM BUKLOD'}
        </Text>
        <Text style={styles.message}>{message}</Text>

        {canEdit && (
          <Pressable
            onPress={() =>
              router.push('/admin/system-announcement-boards' as any)
            }
            style={styles.editBtn}
          >
            <Text style={styles.editText}>
              EDIT ANNOUNCEMENT BOARD
            </Text>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={14}
              color={colors.greenDark}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function BuklodSystemAnnouncementBoardLoader() {
  return (
    <View style={{ paddingVertical: 8, alignItems: 'center' }}>
      <ActivityIndicator color={colors.greenDark} />
    </View>
  );
}
