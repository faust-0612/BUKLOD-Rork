/* BUKLOD_ANDROID_COMMUNITY_PROFILE_BUBBLES_R2_CONNECT_NOTES */
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  loadConnectSuggestedContacts,
  type ConnectSuggestedContact,
} from '@/lib/buklodConnectSuggestedContacts';
import { markConnectStatusNoteSeen } from '@/lib/buklodConnectStatusNoteSeen';
import {
  loadMessagesStatusNote,
  type MessagesStatusNote,
} from '@/lib/buklodMessagesStatusNote';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const MAX_BUBBLES = 14;
const AVATAR_SIZE = 56;
const COLUMN_WIDTH = 78;
const NOTE_MAX_LINES = 3;

function initials(name: string) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return 'B';
  return parts.map(part => part[0]?.toUpperCase() ?? '').join('');
}

function firstName(name: string) {
  return String(name ?? 'Member').trim().split(/\s+/)[0] || 'Member';
}

function NoteBubble({
  note,
  textColor,
}: {
  note?: string | null;
  textColor: string;
}) {
  const value = repairMojibakeText(String(note ?? '')).trim();

  if (!value) {
    return <View style={styles.noteZone} />;
  }

  return (
    <View style={styles.noteZone} pointerEvents="none">
      <View style={styles.noteBubble}>
        <Text
          numberOfLines={NOTE_MAX_LINES}
          style={[styles.noteText, { color: textColor }]}
        >
          {value}
        </Text>
      </View>
      <View style={styles.noteTail} />
    </View>
  );
}

export default function BuklodCommunityMapNav() {
  const { theme } = useBuklodTheme();
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<ConnectSuggestedContact[]>([]);
  const [selfNote, setSelfNote] = useState<MessagesStatusNote | null>(null);

  const currentUser = useMemo(() => {
    const userId = String((profile as any)?.id ?? '').trim();
    if (!userId) return null;

    return {
      user_id: userId,
      full_name: String((profile as any)?.full_name ?? 'You'),
      avatar_url: (profile as any)?.avatar_url
        ? String((profile as any).avatar_url)
        : null,
    };
  }, [profile]);

  useEffect(() => {
    let active = true;

    void loadConnectSuggestedContacts(MAX_BUBBLES)
      .then(rows => {
        if (!active) return;
        setContacts(rows.slice(0, MAX_BUBBLES));
      })
      .catch(() => {
        if (active) setContacts([]);
      });

    void loadMessagesStatusNote()
      .then(note => {
        if (active) setSelfNote(note);
      })
      .catch(() => {
        if (active) setSelfNote(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    for (const contact of contacts) {
      if (String(contact.quick_note ?? '').trim()) {
        void markConnectStatusNoteSeen(contact.user_id).catch(() => undefined);
      }
    }
  }, [contacts]);

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

  const openProfile = useCallback((contact: ConnectSuggestedContact) => {
    router.push({
      pathname: '/member/[id]' as any,
      params: {
        id: contact.user_id,
        name: contact.full_name,
      },
    } as any);
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
      quick_note: selfNote?.quick_note ?? null,
    };
  }, [currentUser, selfNote?.quick_note]);

  const visibleContacts = useMemo(
    () => contacts.filter(contact => contact.user_id !== currentUser?.user_id),
    [contacts, currentUser?.user_id],
  );

  if (!selfContact && !visibleContacts.length) {
    return null;
  }

  return (
    <View style={styles.shell}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {selfContact ? (
          <View style={styles.person}>
            <NoteBubble
              note={selfContact.quick_note}
              textColor={theme.textPrimary}
            />

            <View
              style={[
                styles.avatarRing,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
              ]}
            >
              {selfContact.avatar_url ? (
                <Image
                  source={{ uri: selfContact.avatar_url }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Text style={[styles.initials, { color: theme.textPrimary }]}>
                    {initials(selfContact.full_name)}
                  </Text>
                </View>
              )}
            </View>

            <Text
              numberOfLines={1}
              style={[styles.name, { color: theme.textPrimary }]}
            >
              {firstName(selfContact.full_name)}
            </Text>
          </View>
        ) : null}

        {visibleContacts.map(contact => (
          <Pressable
            key={contact.user_id}
            delayLongPress={420}
            onPress={() => openConversation(contact)}
            onLongPress={() => openProfile(contact)}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${contact.full_name}`}
            accessibilityHint="Tap to open personal conversation. Long press to view profile."
            style={({ pressed }) => [
              styles.person,
              pressed && styles.pressed,
            ]}
          >
            <NoteBubble
              note={contact.quick_note}
              textColor={theme.textPrimary}
            />

            <View
              style={[
                styles.avatarRing,
                {
                  borderColor:
                    contact.unread_count > 0
                      ? theme.accent
                      : theme.border,
                  backgroundColor: theme.surface,
                },
              ]}
            >
              {contact.avatar_url ? (
                <Image
                  source={{ uri: contact.avatar_url }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Text style={[styles.initials, { color: theme.textPrimary }]}>
                    {initials(contact.full_name)}
                  </Text>
                </View>
              )}

              {contact.unread_count > 0 ? (
                <View
                  style={[
                    styles.unreadBadge,
                    { backgroundColor: theme.accent },
                  ]}
                >
                  <Text style={styles.unreadText}>
                    {contact.unread_count > 9 ? '9+' : contact.unread_count}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              numberOfLines={1}
              style={[styles.name, { color: theme.textPrimary }]}
            >
              {firstName(contact.full_name)}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.rank, { color: theme.textMuted }]}
            >
              {contact.rank_name || 'Circle Starter V'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingTop: 4,
    paddingBottom: 4,
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
  pressed: {
    opacity: 0.62,
    transform: [{ scale: 0.97 }],
  },
  noteZone: {
    width: COLUMN_WIDTH,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  noteBubble: {
    maxWidth: COLUMN_WIDTH,
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    backgroundColor: 'rgba(127,127,127,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTail: {
    width: 10,
    height: 10,
    marginTop: -5,
    backgroundColor: 'rgba(127,127,127,0.08)',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    transform: [{ rotate: '45deg' }],
  },
  noteText: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    padding: 2,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  avatarFallback: {
    flex: 1,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 17,
    fontWeight: '900',
  },
  unreadBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
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
