import React, {
  useCallback,
  useEffect,
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

import BuklodQuizStudentEntry from '@/components/classroom/BuklodQuizStudentEntry';
import {
  loadSystemAnnouncementBoard,
  type SystemAnnouncementSlot,
} from '@/lib/buklodSystemAnnouncementBoard';
import { colors } from '@/lib/theme';
import { getBuklodCardTone, isBuklodDarkPaletteId } from '@/lib/buklodCardTones';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
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
  const { activeScope } = useBuklodScope();
  const canEdit = hasRole('system_admin');
  const showPublicQuizDoor =
    slot === 'public_home' && activeScope?.scope_type === 'PUBLIC';

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
              : announcementTone.border,
          backgroundColor:
            slot === 'public_home'
              ? '#F4FBF7'
              : announcementTone.surface,
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
              : announcementTone.ink,
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
          minHeight: 36,
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
          color: theme.textMuted,
          textAlign: 'center',
        },
        publicQuizDoor: {
          marginHorizontal: 12,
          marginTop: 4,
        },
      }),
    [slot, theme, announcementTone, editTone]
  );

  const publicQuizDoor = showPublicQuizDoor ? (
    <View style={styles.publicQuizDoor}>
      <BuklodQuizStudentEntry />
    </View>
  ) : null;

  if (loading) {
    return publicQuizDoor;
  }

  if (!message) {
    if (!canEdit) {
      return publicQuizDoor;
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
        {publicQuizDoor}
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
      {publicQuizDoor}
    </>
  );
}

export function BuklodSystemAnnouncementBoardLoader() {
  return (
    <View style={{ paddingVertical: 8, alignItems: 'center' }}>
      <ActivityIndicator color={editTone.ink} />
    </View>
  );
}
