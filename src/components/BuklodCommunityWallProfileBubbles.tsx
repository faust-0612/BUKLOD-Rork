/* BUKLOD_WEB_COMMUNITY_CONNECT_SCROLL_HEADER_R2_NOTES_24H */
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ConnectInboxSearch } from '@/components/connect/ConnectInboxSearch';
import { ConnectTappableAvatar } from '@/components/connect/ConnectTappableAvatar';
import {
  enrichConnectSuggestedContactsWithNotes,
  loadConnectSuggestedContacts,
  type ConnectSuggestedContact,
} from '@/lib/buklodConnectSuggestedContacts';
import { markConnectStatusNoteSeen } from '@/lib/buklodConnectStatusNoteSeen';
import {
  loadMessagesStatusNote,
  saveMessagesStatusNote,
  type MessagesStatusNote,
} from '@/lib/buklodMessagesStatusNote';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { ConnectThemeProvider } from '@/providers/ConnectThemeProvider';

const MAX_BUBBLES = 14;
const AVATAR_SIZE = 56;
const COLUMN_WIDTH = 78;
const NOTE_MAX_LINES = 2;
const NOTE_MAX_CHARS = 80;
const NOTE_REFRESH_MS = 30_000;

function firstName(name: string) {
  return String(name ?? 'Member').trim().split(/\s+/)[0] || 'Member';
}

function isExpired(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  return Number.isFinite(expires) && expires <= now;
}

async function pruneExpiredContactNotes(
  rows: ConnectSuggestedContact[],
): Promise<ConnectSuggestedContact[]> {
  const ids = [
    ...new Set(
      rows
        .map(row => String(row.user_id ?? '').trim())
        .filter(Boolean),
    ),
  ];

  if (!ids.length) return rows;

  try {
    const { data, error } = await supabase
      .from('buklod_profile_status')
      .select('user_id, quick_note_expires_at')
      .in('user_id', ids);

    if (error) return rows;

    const expired = new Set<string>();
    const now = Date.now();

    for (const row of data ?? []) {
      const userId = String(row.user_id ?? '').trim();
      if (
        userId &&
        row.quick_note_expires_at &&
        isExpired(String(row.quick_note_expires_at), now)
      ) {
        expired.add(userId);
      }
    }

    if (!expired.size) return rows;

    return rows.map(row =>
      expired.has(row.user_id)
        ? { ...row, quick_note: null }
        : row,
    );
  } catch {
    return rows;
  }
}

function hoursLeftLabel(
  expiresAt: string | null | undefined,
  now: number,
) {
  if (!expiresAt) return '';
  const diff = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return '';
  const hours = Math.min(24, Math.max(1, Math.ceil(diff / 3600000)));
  return `${hours}h`;
}

function NoteBubble({
  note,
  textColor,
  editable = false,
  mine = false,
  expiresAt = null,
  now = Date.now(),
  saving = false,
  onSave,
}: {
  note?: string | null;
  textColor: string;
  editable?: boolean;
  mine?: boolean;
  expiresAt?: string | null;
  now?: number;
  saving?: boolean;
  onSave?: (value: string) => Promise<boolean>;
}) {
  const value = repairMojibakeText(String(note ?? '')).trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const timeLabel = mine ? hoursLeftLabel(expiresAt, now) : '';

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  if (editing && editable) {
    const trimmed = draft.trim();
    const canSave = !!trimmed && trimmed !== value && !saving;

    return (
      <View style={styles.noteZoneEditing}>
        <View style={[styles.noteBubble, styles.noteBubbleMine]}>
          <TextInput
            autoFocus
            multiline
            maxLength={NOTE_MAX_CHARS}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add note"
            placeholderTextColor="rgba(23,54,38,0.45)"
            style={[styles.noteInput, { color: textColor }]}
          />
          <Text style={[styles.noteCount, { color: textColor }]}>
            {draft.length}/{NOTE_MAX_CHARS}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post profile note"
          disabled={!canSave}
          onPress={() => {
            if (!canSave || !onSave) return;
            void onSave(trimmed).then(ok => {
              if (ok) setEditing(false);
            });
          }}
          style={[
            styles.notePostButton,
            !canSave && styles.notePostButtonDisabled,
          ]}
        >
          <Text style={styles.notePostButtonText}>
            {saving ? '...' : 'Post'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!value && !editable) {
    return null;
  }

  if (!value && editable) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add profile note"
        onPress={() => setEditing(true)}
        style={styles.noteAddWrap}
      >
        <Text style={[styles.noteAddText, { color: textColor }]}>
          Add note
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={!editable}
      onPress={() => {
        if (editable) setEditing(true);
      }}
      style={styles.noteZone}
    >
      <View style={[styles.noteBubble, mine && styles.noteBubbleMine]}>
        <Text
          numberOfLines={NOTE_MAX_LINES}
          style={[styles.noteText, { color: textColor }]}
        >
          {value}
        </Text>
      </View>
      {timeLabel ? (
        <Text style={[styles.noteTime, { color: textColor }]}>
          {timeLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

function BuklodCommunityConnectRail() {
  const { theme } = useBuklodTheme();
  const { profile, user } = useAuth();
  const [contacts, setContacts] = useState<ConnectSuggestedContact[]>([]);
  const [searchContacts, setSearchContacts] = useState<ConnectSuggestedContact[]>([]);
  const [query, setQuery] = useState('');
  const [selfNote, setSelfNote] = useState<MessagesStatusNote | null>(null);
  const [selfSaving, setSelfSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const currentUser = useMemo(() => {
    const userId = String(
      (profile as any)?.id ??
        (profile as any)?.user_id ??
        (user as any)?.id ??
        '',
    ).trim();

    if (!userId) return null;

    return {
      user_id: userId,
      full_name: String(
        (profile as any)?.full_name ??
          (profile as any)?.display_name ??
          'You',
      ),
      avatar_url: (profile as any)?.avatar_url
        ? String((profile as any).avatar_url)
        : null,
    };
  }, [profile, user]);

  const refreshRail = useCallback(async () => {
    const [contactsResult, selfNoteResult] = await Promise.allSettled([
      loadConnectSuggestedContacts(MAX_BUBBLES),
      loadMessagesStatusNote(),
    ]);

    if (contactsResult.status === 'fulfilled') {
      const clean = await pruneExpiredContactNotes(
        contactsResult.value.slice(0, MAX_BUBBLES),
      );
      setContacts(clean);
    }

    if (selfNoteResult.status === 'fulfilled') {
      setSelfNote(selfNoteResult.value);
    }

    setNow(Date.now());
  }, []);

  useEffect(() => {
    void refreshRail();

    const interval = setInterval(() => {
      void refreshRail();
    }, NOTE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [refreshRail]);

  useEffect(() => {
    if (selfNote && isExpired(selfNote.expires_at, now)) {
      setSelfNote(null);
    }
  }, [now, selfNote]);

  useEffect(() => {
    const clean = query.trim();

    if (clean.length < 2) {
      setSearchContacts([]);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        const result = await (supabase as any).rpc(
          'buklod_connect_people_search',
          {
            _query: clean,
            _limit: 20,
          },
        );

        if (cancelled || result.error) return;

        const mapped: ConnectSuggestedContact[] = (result.data ?? [])
          .map((row: any) => {
            const known = contacts.find(
              contact => contact.user_id === String(row.user_id ?? ''),
            );

            return {
              user_id: String(row.user_id ?? ''),
              full_name: String(row.full_name ?? 'Member'),
              avatar_url: row.avatar_url ? String(row.avatar_url) : null,
              shared_scope_label: known?.shared_scope_label ?? 'Search',
              rank_name: known?.rank_name ?? null,
              thread_id: known?.thread_id ?? null,
              unread_count: known?.unread_count ?? 0,
              quick_note: known?.quick_note ?? null,
            };
          })
          .filter((row: ConnectSuggestedContact) => !!row.user_id);

        const enriched =
          await enrichConnectSuggestedContactsWithNotes(mapped);
        const cleanRows = await pruneExpiredContactNotes(enriched);

        if (!cancelled) setSearchContacts(cleanRows);
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contacts, query]);

  const searching = query.trim().length >= 2;
  const sourceContacts = searching ? searchContacts : contacts;

  const visibleContacts = useMemo(
    () => sourceContacts.filter(contact => contact.user_id !== currentUser?.user_id),
    [sourceContacts, currentUser?.user_id],
  );

  useEffect(() => {
    for (const contact of visibleContacts) {
      if (String(contact.quick_note ?? '').trim()) {
        void markConnectStatusNoteSeen(contact.user_id).catch(() => undefined);
      }
    }
  }, [visibleContacts]);

  const openConversation = useCallback((contact: ConnectSuggestedContact) => {
    if (contact.thread_id) {
      router.push({
        pathname: '/connect/personal/[threadId]' as any,
        params: {
          threadId: contact.thread_id,
          otherUserName: contact.full_name,
          otherUserId: contact.user_id,
        },
      } as any);
      return;
    }

    router.push({
      pathname: '/connect/personal/[threadId]' as any,
      params: {
        threadId: 'new',
        targetUserId: contact.user_id,
        otherUserName: contact.full_name,
      },
    } as any);
  }, []);

  const persistSelfNote = useCallback(async (value: string) => {
    setSelfSaving(true);
    try {
      const saved = await saveMessagesStatusNote(value);
      setSelfNote(saved);
      setNow(Date.now());
      return !!saved;
    } catch (error) {
      console.warn(
        'Community profile note:',
        String((error as Error)?.message ?? error),
      );
      return false;
    } finally {
      setSelfSaving(false);
    }
  }, []);

  const selfContact = useMemo<ConnectSuggestedContact | null>(() => {
    if (!currentUser) return null;

    return {
      user_id: currentUser.user_id,
      full_name: currentUser.full_name,
      avatar_url: currentUser.avatar_url,
      shared_scope_label: null,
      rank_name: null,
      thread_id: null,
      unread_count: 0,
      quick_note:
        selfNote && !isExpired(selfNote.expires_at, now)
          ? selfNote.quick_note
          : null,
    };
  }, [currentUser, now, selfNote]);

  if (!selfContact && !visibleContacts.length && !searching) {
    return null;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.searchWrap}>
        <ConnectInboxSearch
          inline
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages or people"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {!searching && selfContact ? (
          <View style={styles.person}>
            <NoteBubble
              note={selfContact.quick_note}
              textColor={theme.textPrimary}
              editable
              mine
              expiresAt={selfNote?.expires_at}
              now={now}
              saving={selfSaving}
              onSave={persistSelfNote}
            />

            <ConnectTappableAvatar
              userId={selfContact.user_id}
              name={selfContact.full_name}
              uri={selfContact.avatar_url}
              size={AVATAR_SIZE}
              onPress={null}
              enableLongPressSheet={false}
            />

            <Text
              numberOfLines={1}
              style={[styles.name, { color: theme.textPrimary }]}
            >
              {firstName(selfContact.full_name)}
            </Text>
          </View>
        ) : null}

        {visibleContacts.map(contact => (
          <View key={contact.user_id} style={styles.person}>
            <NoteBubble
              note={contact.quick_note}
              textColor={theme.textPrimary}
            />

            <View style={styles.avatarWrap}>
              <ConnectTappableAvatar
                userId={contact.user_id}
                name={contact.full_name}
                uri={contact.avatar_url}
                size={AVATAR_SIZE}
                onPress={() => openConversation(contact)}
                enableLongPressSheet
              />

              {contact.unread_count > 0 ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.unreadDot,
                    {
                      backgroundColor: '#C9332D',
                      borderColor: theme.canvas,
                    },
                  ]}
                />
              ) : null}
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.name,
                {
                  color: theme.textSecondary,
                  fontWeight: contact.unread_count > 0 ? '900' : '800',
                },
              ]}
            >
              {firstName(contact.full_name)}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.rank, { color: theme.textMuted }]}
            >
              {contact.rank_name || 'Circle Starter V'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function BuklodCommunityConnectHeaderWeb() {
  return (
    <ConnectThemeProvider>
      <BuklodCommunityConnectRail />
    </ConnectThemeProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
  person: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
  },
  noteZone: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  noteZoneEditing: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  noteAddWrap: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
    marginBottom: 6,
    paddingVertical: 2,
  },
  noteAddText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
    opacity: 0.55,
    textAlign: 'center',
  },
  noteBubble: {
    maxWidth: COLUMN_WIDTH,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#173626',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  noteBubbleMine: {
    backgroundColor: '#E8F6EE',
  },
  noteText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  noteTime: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    opacity: 0.55,
    textAlign: 'center',
  },
  noteInput: {
    width: 62,
    minHeight: 32,
    maxHeight: 46,
    padding: 0,
    margin: 0,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  noteCount: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    opacity: 0.55,
  },
  notePostButton: {
    marginTop: 6,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#177552',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notePostButtonDisabled: {
    opacity: 0.4,
  },
  notePostButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
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
    borderWidth: 2,
  },
  name: {
    marginTop: 5,
    width: '100%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  rank: {
    marginTop: 1,
    width: '100%',
    textAlign: 'center',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
  },
});
