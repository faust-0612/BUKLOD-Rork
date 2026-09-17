/* BUKLOD_ANDROID_COMMUNITY_PROFILE_BUBBLES_R1 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const MAX_BUBBLES = 14;

function initials(name: string) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return 'B';
  return parts.map(part => part[0]?.toUpperCase() ?? '').join('');
}

export default function BuklodCommunityMapNav() {
  const { theme } = useBuklodTheme();
  const [contacts, setContacts] = useState<ConnectSuggestedContact[]>([]);

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

    return () => {
      active = false;
    };
  }, []);

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

  if (!contacts.length) {
    return null;
  }

  return (
    <View style={styles.shell}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {contacts.map(contact => (
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
                    { backgroundColor: theme.surfaceRaised },
                  ]}
                >
                  <Text
                    style={[
                      styles.initials,
                      { color: theme.textPrimary },
                    ]}
                  >
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
              style={[
                styles.name,
                { color: theme.textPrimary },
              ]}
            >
              {contact.full_name.split(/\s+/)[0] || 'Member'}
            </Text>

            <View style={styles.hintRow}>
              <MaterialCommunityIcons
                name="message-text-outline"
                size={10}
                color={theme.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.hint,
                  { color: theme.textMuted },
                ]}
              >
                Hold: profile
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  row: {
    paddingHorizontal: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  person: {
    width: 72,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.62,
    transform: [{ scale: 0.97 }],
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    padding: 2,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarFallback: {
    flex: 1,
    borderRadius: 26,
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
  hintRow: {
    marginTop: 2,
    maxWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  hint: {
    fontSize: 8,
    fontWeight: '600',
  },
});
