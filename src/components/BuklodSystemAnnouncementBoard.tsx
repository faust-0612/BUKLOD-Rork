import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  loadSystemAnnouncementBoard,
  type SystemAnnouncementSlot,
} from '@/lib/buklodSystemAnnouncementBoard';
import { colors } from '@/lib/theme';
import { readableAccentOnSurface } from '@/lib/buklodTheme';
import { getBuklodCardTone, isBuklodDarkPaletteId } from '@/lib/buklodCardTones';
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
  const { theme, paletteId } = useBuklodTheme();
  const announcementTone = getBuklodCardTone('amber', isBuklodDarkPaletteId(paletteId));
  const editTone = getBuklodCardTone('sky', isBuklodDarkPaletteId(paletteId));
  const { hasRole } = useAuth();
  const canEdit = hasRole('system_admin');

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);

  // A single focus-scoped request replaces duplicate mount + focus fetches.
  // Refetch without hiding previously rendered content to prevent blank flashes.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          const board = await loadSystemAnnouncementBoard(slot);
          if (!active) return;
          setMessage(board?.message?.trim() ?? '');
          setLoadError(false);
        } catch (error) {
          console.warn(
            'System announcement board:',
            String((error as Error)?.message ?? error)
          );
          if (active) setLoadError(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [slot])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginHorizontal: 0,
          marginTop: slot === 'public_home' ? 1 : 0,
          marginBottom: slot === 'public_home' ? 2 : 6,
        },
        board: {
          borderRadius: slot === 'public_home' ? 14 : 16,
          borderWidth: 1,
          borderColor:
            slot === 'public_home'
              ? theme.border
              : announcementTone.border,
          backgroundColor:
            slot === 'public_home'
              ? theme.cardSurface
              : announcementTone.surface,
          paddingHorizontal: 14,
          paddingVertical: slot === 'public_home' ? 10 : 12,
        },
        label: {
          fontSize: slot === 'public_home' ? 11 : 10,
          fontWeight: '900',
          letterSpacing: 1.1,
          color:
            slot === 'public_home'
              ? readableAccentOnSurface(theme)
              : announcementTone.ink,
          marginBottom: slot === 'public_home' ? 4 : 6,
        },
        message: {
          color:
            theme.textPrimary,
          fontWeight: slot === 'public_home' ? '900' : '800',
          fontSize: slot === 'public_home' ? 18 : 15,
          lineHeight: slot === 'public_home' ? 24 : 22,
        },
        editBtn: {
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: 44,
          alignSelf: 'center',
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: editTone.soft,
          borderWidth: 1,
          borderColor: editTone.border,
        },
        editText: {
          fontSize: 11,
          fontWeight: '900',
          color: editTone.ink,
        },
        adminSetup: {
          marginHorizontal: slot === 'public_home' ? 12 : 0,
          marginTop: slot === 'public_home' ? 4 : 0,
          marginBottom: slot === 'public_home' ? 2 : 10,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: announcementTone.border,
          borderStyle: 'dashed',
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: announcementTone.surface,
        },
        adminSetupText: {
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '700',
          color: announcementTone.ink,
          textAlign: 'center',
        },
      }),
    [slot, theme, announcementTone, editTone]
  );

  if (loading) {
    return null;
  }

  if (!message) {
    if (loadError) return null;
    if (!canEdit) {
      return null;
    }

    return (
      <>
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
              color={editTone.ink}
            />
          </View>
        </Pressable>
      </>
    );
  }

  return (
    <>
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
                color={editTone.ink}
              />
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

export function BuklodSystemAnnouncementBoardLoader() {
  return (
    <View style={{ paddingVertical: 8, alignItems: 'center' }}>
      <ActivityIndicator color={colors.greenDark} />
    </View>
  );
}
