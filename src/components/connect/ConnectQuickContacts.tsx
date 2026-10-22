import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  connectSpacing,
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  graphemeLength,
  truncateGraphemes,
} from '@/lib/buklodGraphemeText';
import {
  type ConnectSuggestedContact,
} from '@/lib/buklodConnectSuggestedContacts';
import {
  markConnectStatusNoteSeen,
} from '@/lib/buklodConnectStatusNoteSeen';
import {
  loadMessagesStatusNote,
  saveMessagesStatusNote,
  type MessagesStatusNote,
} from '@/lib/buklodMessagesStatusNote';
import {
  repairMojibakeText,
} from '@/lib/repairMojibakeText';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';
import {
  ConnectTappableAvatar,
} from '@/components/connect/ConnectTappableAvatar';

const MAX_NOTE_CHARS = 80;
const NOTE_LINE_HEIGHT = 12;
const NOTE_MAX_LINES = 3;
const NOTE_ZONE_HEIGHT =
  NOTE_LINE_HEIGHT * NOTE_MAX_LINES + 12;
const NOTE_ZONE_EDIT_HEIGHT =
  NOTE_ZONE_HEIGHT + 34;
const AVATAR_SIZE = 56;
const COLUMN_WIDTH = 78;

type CurrentUser = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

type Props = {
  contacts: ConnectSuggestedContact[];
  currentUser: CurrentUser | null;
  onOpenContact: (
    contact: ConnectSuggestedContact
  ) => void;
  onStatusNoteSaved?: () => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 2,
      paddingTop: 4,
    },
    scroll: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: connectSpacing.screenHorizontal,
      paddingBottom: 8,
    },
    column: {
      width: COLUMN_WIDTH,
      marginRight: 10,
      alignItems: 'center',
    },
    noteZone: {
      width: COLUMN_WIDTH,
      minHeight: NOTE_ZONE_HEIGHT,
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 4,
    },
    bubble: {
      maxWidth: COLUMN_WIDTH,
      minWidth: 58,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bubbleTail: {
      width: 10,
      height: 10,
      marginTop: -5,
      backgroundColor: theme.surfaceElevated,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      transform: [{ rotate: '45deg' }],
    },
    bubbleText: {
      fontSize: 9.5,
      lineHeight: NOTE_LINE_HEIGHT,
      fontWeight: '400',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    bubblePlaceholder: {
      color: theme.textMuted,
      fontWeight: '400',
    },
    noteZoneEditing: {
      width: COLUMN_WIDTH,
      minHeight: NOTE_ZONE_EDIT_HEIGHT,
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 4,
    },
    postButton: {
      marginTop: 4,
      minHeight: 22,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postButtonDisabled: {
      opacity: 0.45,
    },
    postButtonText: {
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 0.4,
      color: '#FFFFFF',
    },
    charCount: {
      marginTop: 2,
      fontSize: 8,
      fontWeight: '700',
      color: theme.textMuted,
      textAlign: 'center',
    },
    addedBubble: {
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.accent,
    },
    addedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    addedText: {
      fontSize: 9,
      fontWeight: '900',
      color: theme.accent,
    },
    bubbleInput: {
      width: '100%',
      minHeight: NOTE_LINE_HEIGHT,
      maxHeight: NOTE_LINE_HEIGHT * NOTE_MAX_LINES,
      padding: 0,
      margin: 0,
      fontSize: 9.5,
      lineHeight: NOTE_LINE_HEIGHT,
      fontWeight: '400',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      position: 'relative',
    },
    unreadDot: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#C9332D',
      borderWidth: 2,
      borderColor: theme.canvas,
    },
    emptyHint: {
      marginHorizontal: connectSpacing.screenHorizontal,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
    },
    emptyHintText: {
      fontSize: 11,
      lineHeight: 16,
      color: theme.textMuted,
      textAlign: 'center',
    },
    name: {
      ...connectTypography.quickContactName,
      marginTop: 5,
      width: COLUMN_WIDTH,
      textAlign: 'center',
      color: theme.textSecondary,
    },
    rank: {
      marginTop: 1,
      width: COLUMN_WIDTH,
      textAlign: 'center',
      fontSize: 8,
      lineHeight: 11,
      fontWeight: '700',
      color: theme.textMuted,
    },
    seenMeta: {
      marginTop: 2,
      width: COLUMN_WIDTH,
      textAlign: 'center',
      fontSize: 8,
      lineHeight: 11,
      fontWeight: '700',
      color: theme.textMuted,
    },
  });
}

function NoteBubble({
  note,
  placeholder,
  editable,
  saving,
  onSave,
  ownerId,
  styles,
  theme,
}: {
  note: string;
  placeholder: string;
  editable?: boolean;
  saving?: boolean;
  onSave?: (value: string) => Promise<boolean> | boolean | void;
  ownerId?: string | null;
  styles: ReturnType<typeof createStyles>;
  theme: ConnectThemeRoles;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [justAdded, setJustAdded] = useState(false);
  const postingRef = useRef(false);

  useEffect(() => {
    if (!editable && ownerId && note.trim()) {
      void markConnectStatusNoteSeen(ownerId);
    }
  }, [editable, ownerId, note]);

  useEffect(() => {
    if (!editing) {
      setDraft(note);
    }
  }, [note, editing]);

  useEffect(() => {
    if (!justAdded) {
      return;
    }

    const timer = setTimeout(() => {
      setJustAdded(false);
    }, 2200);

    return () => {
      clearTimeout(timer);
    };
  }, [justAdded]);

  const displayNote = repairMojibakeText(note).trim();
  const trimmed = displayNote;
  const showPlaceholder = !trimmed;
  const draftTrimmed = draft.trim();
  const draftLength = graphemeLength(draftTrimmed);
  const canPost =
    draftTrimmed.length > 0 &&
    draftTrimmed !== note.trim() &&
    draftLength <= MAX_NOTE_CHARS &&
    !saving;

  const handlePost = async () => {
    if (!canPost || !onSave) {
      return;
    }

    const result = await onSave(draftTrimmed);
    const ok = result !== false;

    if (!ok) {
      return;
    }

    setEditing(false);
    setJustAdded(true);
  };

  if (!editable && !trimmed) {
    return <View style={styles.noteZone} />;
  }

  if (justAdded) {
    return (
      <View style={styles.noteZone}>
        <View style={[styles.bubble, styles.addedBubble]}>
          <View style={styles.addedRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={12}
              color={theme.accent}
            />
            <Text style={styles.addedText}>Added!</Text>
          </View>
        </View>
        <View style={styles.bubbleTail} />
      </View>
    );
  }

  if (editing) {
    return (
      <View style={styles.noteZoneEditing}>
        <View style={styles.bubble}>
          <TextInput
            value={draft}
            onChangeText={(value) =>
              setDraft(
                truncateGraphemes(
                  value,
                  MAX_NOTE_CHARS
                )
              )
            }
            onBlur={() => {
              if (postingRef.current) {
                return;
              }

              setEditing(false);
              setDraft(note);
            }}
            autoFocus
            multiline
            scrollEnabled={false}
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            style={styles.bubbleInput}
            returnKeyType="default"
          />
          <Text style={styles.charCount}>
            {draftLength}/{MAX_NOTE_CHARS}
          </Text>
          {saving ? (
            <ActivityIndicator
              size="small"
              color={theme.accent}
              style={{ marginTop: 2 }}
            />
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post note"
          disabled={!canPost}
          onPressIn={() => {
            postingRef.current = true;
          }}
          onPress={() => {
            void handlePost().finally(() => {
              postingRef.current = false;
            });
          }}
          style={[
            styles.postButton,
            !canPost && styles.postButtonDisabled,
          ]}
        >
          <Text style={styles.postButtonText}>POST</Text>
        </Pressable>

        <View style={styles.bubbleTail} />
      </View>
    );
  }

  const content = (
    <Text
      numberOfLines={NOTE_MAX_LINES}
      style={[
        styles.bubbleText,
        showPlaceholder && styles.bubblePlaceholder,
      ]}
    >
      {trimmed || placeholder}
    </Text>
  );

  return (
    <Pressable
      style={styles.noteZone}
      disabled={!editable}
      onPress={() => {
        if (editable) {
          setEditing(true);
        }
      }}
    >
      <View style={styles.bubble}>{content}</View>
      <View style={styles.bubbleTail} />
    </Pressable>
  );
}

function ContactColumn({
  contact,
  styles,
  theme,
  onOpenContact,
  selfNote,
  selfSaving,
  onSaveSelfNote,
}: {
  contact: ConnectSuggestedContact | null;
  styles: ReturnType<typeof createStyles>;
  theme: ConnectThemeRoles;
  onOpenContact?: (contact: ConnectSuggestedContact) => void;
  selfNote?: MessagesStatusNote | null;
  selfSaving?: boolean;
  onSaveSelfNote?: (value: string) => Promise<boolean> | boolean | void;
}) {
  if (!contact) {
    return null;
  }

  const isSelf = !!onSaveSelfNote;
  const firstName = String(contact.full_name ?? 'Member')
    .trim()
    .split(/\s+/)[0];
  const unread = Number(contact.unread_count ?? 0);

  return (
    <View style={styles.column}>
      {isSelf ? (
        <>
        <NoteBubble
          note={selfNote?.quick_note ?? ''}
          placeholder="Post a note..."
          editable
          saving={selfSaving}
          onSave={onSaveSelfNote}
          styles={styles}
          theme={theme}
        />
        {Number(selfNote?.viewer_count ?? 0) > 0 ? (
          <Text style={styles.seenMeta}>
            Seen by {selfNote?.viewer_count}
          </Text>
        ) : null}
        </>
      ) : (
        <NoteBubble
          note={contact.quick_note ?? ''}
          placeholder=""
          ownerId={contact.user_id}
          styles={styles}
          theme={theme}
        />
      )}

      <View style={styles.avatarWrap}>
        <ConnectTappableAvatar
          userId={contact.user_id}
          name={contact.full_name}
          uri={contact.avatar_url}
          size={AVATAR_SIZE}
          enableLongPressSheet={!isSelf}
          onPress={isSelf ? null : undefined}
        />

        {!isSelf && unread > 0 && (
          <View
            pointerEvents="none"
            style={styles.unreadDot}
          />
        )}
      </View>

      {isSelf ? (
        <Text
          numberOfLines={1}
          style={styles.name}
        >
          {firstName}
        </Text>
      ) : (
        <ConnectPressable
          instant={false}
          onPress={() => onOpenContact?.(contact)}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              unread > 0 && { fontWeight: '900' },
            ]}
          >
            {firstName}
          </Text>
        </ConnectPressable>
      )}

      {!isSelf && (
        <Text
          numberOfLines={1}
          style={styles.rank}
        >
          {contact.rank_name || 'Circle Starter V'}
        </Text>
      )}
    </View>
  );
}

export function ConnectSuggestedContacts({
  contacts,
  currentUser,
  onOpenContact,
  onStatusNoteSaved,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  const [selfNote, setSelfNote] =
    useState<MessagesStatusNote | null>(null);
  const [selfSaving, setSelfSaving] = useState(false);

  const loadSelfNote = useCallback(async () => {
    try {
      const active = await loadMessagesStatusNote();
      setSelfNote(active);
    } catch (error) {
      console.warn(
        'Messages status note:',
        String((error as Error)?.message ?? error)
      );
      setSelfNote(null);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      void loadSelfNote();
    }
  }, [currentUser, loadSelfNote]);

  const persistSelfNote = useCallback(async (value: string) => {
    setSelfSaving(true);

    try {
      const saved = await saveMessagesStatusNote(value);
      setSelfNote(saved);
      onStatusNoteSaved?.();
      return true;
    } catch (error) {
      Alert.alert(
        'Could not post note',
        String((error as Error)?.message ?? 'Please try again.')
      );
      return false;
    } finally {
      setSelfSaving(false);
    }
  }, [onStatusNoteSaved]);

  const visibleContacts = useMemo(() => {
    const deduped = contacts.filter(
      (contact) =>
        contact.user_id &&
        contact.user_id !== currentUser?.user_id
    );

    return deduped;
  }, [contacts, currentUser?.user_id]);

  if (!currentUser && visibleContacts.length === 0) {
    return null;
  }

  const selfContact: ConnectSuggestedContact | null = currentUser
    ? {
        user_id: currentUser.user_id,
        full_name: currentUser.full_name,
        avatar_url: currentUser.avatar_url,
        shared_scope_label: null,
        rank_name: null,
        thread_id: null,
        unread_count: 0,
        quick_note: selfNote?.quick_note ?? null,
      }
    : null;

  return (
    <View style={styles.wrap}>
      {visibleContacts.length === 0 ? (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>
            No suggested contacts yet. Join a Cluster or Organization, message
            someone, or share the same Local to see people here.
          </Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        contentContainerStyle={styles.scroll}
      >
        {selfContact && (
          <ContactColumn
            contact={selfContact}
            styles={styles}
            theme={theme}
            selfNote={selfNote}
            selfSaving={selfSaving}
            onSaveSelfNote={persistSelfNote}
          />
        )}

        {visibleContacts.map((contact) => (
          <ContactColumn
            key={contact.user_id}
            contact={contact}
            styles={styles}
            theme={theme}
            onOpenContact={onOpenContact}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** @deprecated Use ConnectSuggestedContacts */
export function ConnectQuickContacts({
  contacts,
  onOpenThread,
}: {
  contacts: Array<{
    thread_id: string;
    other_user_id: string;
    other_user_name: string;
    unread_count: number;
  }>;
  onOpenThread: (threadId: string) => void;
}) {
  const mapped: ConnectSuggestedContact[] = contacts.map(
    (contact) => ({
      user_id: contact.other_user_id,
      full_name: contact.other_user_name,
      avatar_url: null,
      shared_scope_label: null,
      rank_name: null,
      thread_id: contact.thread_id,
      unread_count: contact.unread_count,
      quick_note: null,
    })
  );

  return (
    <ConnectSuggestedContacts
      contacts={mapped}
      currentUser={null}
      onOpenContact={(contact) => {
        if (contact.thread_id) {
          onOpenThread(contact.thread_id);
        }
      }}
    />
  );
}

export type { ConnectSuggestedContact as QuickContact };
