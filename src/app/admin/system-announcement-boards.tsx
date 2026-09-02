import {
  useCallback,
  useEffect,
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
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, shared } from '@/components/UI';
import {
  loadSystemAnnouncementBoardForAdmin,
  saveSystemAnnouncementBoard,
  type SystemAnnouncementSlot,
} from '@/lib/buklodSystemAnnouncementBoard';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type BoardDraft = {
  message: string;
  is_active: boolean;
};

function BoardEditor({
  slot,
  title,
  subtitle,
  profilePreview,
}: {
  slot: SystemAnnouncementSlot;
  title: string;
  subtitle: string;
  profilePreview?: boolean;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BoardDraft>({
    message: '',
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const board = await loadSystemAnnouncementBoardForAdmin(slot);
      setDraft({
        message: board?.message ?? '',
        is_active: board?.is_active !== false,
      });
    } catch (error: unknown) {
      Alert.alert(
        'Announcement Board',
        error instanceof Error
          ? error.message
          : 'Could not load announcement board.'
      );
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const cleanMessage = draft.message.trim();

    if (draft.is_active && !cleanMessage) {
      Alert.alert(
        'Announcement Board',
        'Enter a message or turn the board off.'
      );
      return;
    }

    setSaving(true);

    try {
      await saveSystemAnnouncementBoard({
        slot,
        message: cleanMessage,
        is_active: draft.is_active,
        updated_by: profile?.id ?? null,
      });

      Alert.alert(
        'Saved',
        'Announcement board updated. Members will see it once a message is saved and the board is turned on.'
      );
      await load();
    } catch (error: unknown) {
      Alert.alert(
        'Announcement Board',
        error instanceof Error
          ? error.message
          : 'Could not save announcement board.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={colors.green} />
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[shared.muted, { marginBottom: 12 }]}>
        {subtitle}
      </Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Show board</Text>
        <Switch
          value={draft.is_active}
          onValueChange={(value) =>
            setDraft((current) => ({
              ...current,
              is_active: value,
            }))
          }
        />
      </View>

      <TextInput
        value={draft.message}
        onChangeText={(value) =>
          setDraft((current) => ({
            ...current,
            message: value.slice(0, 2000),
          }))
        }
        placeholder="Type announcement message…"
        placeholderTextColor="#9CA3AF"
        multiline
        style={styles.input}
      />

      <Text style={styles.counter}>
        {draft.message.length}/2000
      </Text>

      {!!draft.message.trim() && (
        <View
          style={[
            styles.preview,
            profilePreview && styles.previewProfile,
          ]}
        >
          <Text
            style={[
              styles.previewLabel,
              profilePreview && styles.previewLabelProfile,
            ]}
          >
            {slot === 'public_home' ? 'ANNOUNCEMENT' : 'FROM BUKLOD'}
          </Text>
          <Text
            style={[
              styles.previewMessage,
              profilePreview && styles.previewMessageProfile,
            ]}
          >
            {draft.message.trim()}
          </Text>
        </View>
      )}

      <Button
        title={saving ? 'SAVING…' : 'SAVE ANNOUNCEMENT'}
        onPress={() => {
          if (!saving) {
            void save();
          }
        }}
      />
    </Card>
  );
}

export default function SystemAnnouncementBoardsAdminScreen() {
  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>HOME & PROFILES</Text>
        <Text style={shared.h1}>Announcement Boards</Text>
        <Text style={[shared.muted, { marginBottom: 16 }]}>
          These boards only appear when there is a message and the board is
          turned on.
        </Text>

        <BoardEditor
          slot="public_home"
          title="Public Home Board"
          subtitle="Large, bold announcement on the public Home screen."
        />

        <BoardEditor
          slot="profile"
          title="Profile Board"
          subtitle="Separate message shown on all member profiles."
          profilePreview
        />
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 16,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.greenDark,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    textAlignVertical: 'top',
  },
  counter: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'right',
  },
  preview: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.greenDark,
    backgroundColor: '#F4FBF7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  previewProfile: {
    borderColor: '#D8E7DE',
    backgroundColor: '#FFFFFF',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: colors.greenDark,
    marginBottom: 8,
  },
  previewLabelProfile: {
    fontSize: 10,
    marginBottom: 6,
    color: '#6B7280',
  },
  previewMessage: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.text,
  },
  previewMessageProfile: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
  },
});
