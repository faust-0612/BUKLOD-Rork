import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminGate } from '@/components/AdminGate';
import { Button, Card, useThemedShared } from '@/components/UI';
import { getBuklodCardTone, isBuklodDarkPaletteId } from '@/lib/buklodCardTones';
import {
  loadSystemAnnouncementBoardForAdmin,
  saveSystemAnnouncementBoard,
  type SystemAnnouncementSlot,
} from '@/lib/buklodSystemAnnouncementBoard';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type BoardDraft = {
  message: string;
  is_active: boolean;
};

const EMPTY_BOARD: BoardDraft = { message: '', is_active: true };

function BoardEditor({
  slot,
  title,
  subtitle,
}: {
  slot: SystemAnnouncementSlot;
  title: string;
  subtitle: string;
}) {
  const { profile } = useAuth();
  const { theme, paletteId } = useBuklodTheme();
  const themedShared = useThemedShared();
  const dark = isBuklodDarkPaletteId(paletteId);
  const announcementTone = useMemo(() => getBuklodCardTone('amber', dark), [dark]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BoardDraft>(EMPTY_BOARD);
  const [saved, setSaved] = useState<BoardDraft>(EMPTY_BOARD);
  const isPublic = slot === 'public_home';
  const dirty = draft.message !== saved.message || draft.is_active !== saved.is_active;

  const styles = useMemo(
    () => StyleSheet.create({
      cardTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: theme.textPrimary,
        marginBottom: 3,
      },
      subtitle: { color: theme.textSecondary, marginBottom: 10 },
      switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        minHeight: 44,
      },
      switchLabel: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
      input: {
        minHeight: 96,
        maxHeight: 220,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        backgroundColor: theme.inputSurface,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        lineHeight: 22,
        color: theme.textPrimary,
        textAlignVertical: 'top',
      },
      counterRow: {
        marginTop: 5,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
      },
      counter: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
      unsaved: { fontSize: 11, fontWeight: '800', color: theme.textPrimary },
      preview: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isPublic ? theme.border : announcementTone.border,
        backgroundColor: isPublic ? theme.cardSurface : announcementTone.surface,
        paddingHorizontal: 13,
        paddingVertical: 10,
        marginBottom: 10,
      },
      previewLabel: {
        fontSize: isPublic ? 11 : 10,
        fontWeight: '900',
        letterSpacing: 1.1,
        color: isPublic ? theme.textPrimary : announcementTone.ink,
        marginBottom: isPublic ? 4 : 6,
      },
      previewMessage: {
        fontSize: isPublic ? 18 : 15,
        lineHeight: isPublic ? 24 : 22,
        fontWeight: isPublic ? '900' : '800',
        color: theme.textPrimary,
      },
    }),
    [theme, announcementTone, isPublic]
  );

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const board = await loadSystemAnnouncementBoardForAdmin(slot);
      const next = {
        message: board?.message ?? '',
        is_active: board?.is_active !== false,
      };
      setDraft(next);
      setSaved(next);
    } catch (error: unknown) {
      Alert.alert(
        'Announcement Board',
        error instanceof Error ? error.message : 'Could not load announcement board.'
      );
    } finally {
      if (initial) setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const save = async () => {
    if (saving) return;
    const cleanMessage = draft.message.trim();
    if (draft.is_active && !cleanMessage) {
      Alert.alert('Announcement Board', 'Enter a message or turn the board off.');
      return;
    }

    setSaving(true);
    try {
      const confirmed = await saveSystemAnnouncementBoard({
        slot,
        message: cleanMessage,
        is_active: draft.is_active,
        updated_by: profile?.id ?? null,
      });
      const next = { message: confirmed.message, is_active: confirmed.is_active };
      setDraft(next);
      setSaved(next);
      Alert.alert('Saved', isPublic
        ? 'Public Home announcement verified on the server.'
        : 'Profile announcement verified on the server.');
    } catch (error: unknown) {
      Alert.alert(
        'Announcement Not Saved',
        error instanceof Error ? error.message : 'Could not verify the server update. Your draft is kept.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={theme.accent} />
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[themedShared.muted, styles.subtitle]}>{subtitle}</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Show board</Text>
        <Switch
          accessibilityLabel={isPublic ? 'Show Public Home Board' : 'Show Profile Board'}
          disabled={saving}
          value={draft.is_active}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, is_active: value }))
          }
          trackColor={{ false: theme.border, true: theme.accentSoft }}
          thumbColor={draft.is_active ? theme.accent : theme.textMuted}
        />
      </View>
      <TextInput
        accessibilityLabel={isPublic ? 'Public Home announcement message' : 'Profile announcement message'}
        value={draft.message}
        editable={!saving}
        onChangeText={(value) =>
          setDraft((current) => ({ ...current, message: value.slice(0, 2000) }))
        }
        placeholder="Type announcement message…"
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.accent}
        multiline
        style={styles.input}
      />
      <View style={styles.counterRow}>
        <Text style={styles.unsaved}>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</Text>
        <Text style={styles.counter}>{draft.message.length}/2000</Text>
      </View>
      {!!draft.message.trim() && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>
            {isPublic ? 'ANNOUNCEMENT' : 'FROM BUKLOD'}
          </Text>
          <Text style={styles.previewMessage}>{draft.message.trim()}</Text>
        </View>
      )}
      <Button
        title={saving
          ? 'SAVING…'
          : isPublic ? 'SAVE HOME BOARD' : 'SAVE PROFILE BOARD'}
        onPress={() => {
          if (!saving) void save();
        }}
      />
    </Card>
  );
}

export default function SystemAnnouncementBoardsAdminScreen() {
  const { theme } = useBuklodTheme();
  const themedShared = useThemedShared();
  const insets = useSafeAreaInsets();

  return (
    <AdminGate>
      <ScrollView
        style={themedShared.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: Math.max(14, insets.top + 8),
          paddingBottom: Math.max(20, insets.bottom + 18),
          gap: 12,
        }}
      >
        <Text style={{
          fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: theme.textPrimary,
        }}>HOME & PROFILES</Text>
        <Text style={themedShared.h1}>Announcement Boards</Text>
        <Text style={[themedShared.muted, { marginBottom: 4 }]}>
          Boards appear only when they have a saved message and are enabled.
        </Text>
        <BoardEditor
          slot="public_home"
          title="Public Home Board"
          subtitle="Large announcement on the public Home screen."
        />
        <BoardEditor
          slot="profile"
          title="Profile Board"
          subtitle="Separate message shown on member profiles."
        />
      </ScrollView>
    </AdminGate>
  );
}
