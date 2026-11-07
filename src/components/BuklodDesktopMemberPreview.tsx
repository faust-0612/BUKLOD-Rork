import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import {
  loadMemberPublicProfile,
  type MemberPublicProfile,
} from '@/lib/buklodMemberProfile';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

/** BUKLOD_DESKTOP_MEMBER_PREVIEW_R1
 * A privacy-aware side preview using the existing public profile permission
 * boundary. Full profile routing remains a separate, explicit Expand action.
 */
export default function BuklodDesktopMemberPreview({
  userId,
  onMessage,
}: {
  userId: string;
  onMessage: () => void;
}) {
  const { session } = useAuth();
  const { theme } = useBuklodTheme();
  const viewerId = session?.user?.id ?? null;
  const [result, setResult] = useState<{
    viewerId: string; profile: MemberPublicProfile | null; error: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    setResult(null);
    if (!viewerId || !userId) return () => { alive = false; };
    void loadMemberPublicProfile(userId)
      .then(profile => {
        if (alive) setResult({ viewerId, profile, error: null });
      })
      .catch(() => {
        if (alive) setResult({ viewerId, profile: null, error: 'Profile is unavailable.' });
      });
    return () => { alive = false; };
  }, [userId, viewerId]);

  const profile = result?.viewerId === viewerId ? result.profile : null;
  const pending = !result || result.viewerId !== viewerId;
  return (
    <ScrollView style={[styles.root, { backgroundColor: theme.surface }]}
      contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {pending ? (
        <ActivityIndicator accessibilityLabel="Loading member profile" color={theme.accent} />
      ) : result?.error || !profile ? (
        <Text style={[styles.message, { color: theme.textMuted }]}>
          {result?.error || 'Member profile not available.'}
        </Text>
      ) : (
        <>
          <View style={styles.hero}>
            <ProfileAvatar userId={profile.user_id}
              uri={profile.can_view_details ? profile.avatar_url : null}
              name={profile.display_name} size={72} />
            <Text style={[styles.name, { color: theme.textPrimary }]}>{profile.display_name}</Text>
            {profile.can_view_details && profile.username ? (
              <Text style={[styles.message, { color: theme.textMuted }]}>@{profile.username}</Text>
            ) : null}
          </View>
          {!profile.can_view_details ? (
            <Text style={[styles.message, { color: theme.textMuted }]}>
              This member has restricted their profile details.
            </Text>
          ) : (
            <>
              {profile.quick_note ? (
                <Text style={[styles.message, { color: theme.textPrimary }]}>
                  {profile.quick_note}
                </Text>
              ) : null}
              {profile.member_since ? (
                <Text style={[styles.message, { color: theme.textMuted }]}>
                  Member since {profile.member_since}
                </Text>
              ) : null}
              {profile.shared_scope_labels?.length ? (
                <Text style={[styles.message, { color: theme.textMuted }]}>
                  {profile.shared_scope_labels.join(' · ')}
                </Text>
              ) : null}
              {!profile.is_self ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Message member"
                  onPress={onMessage}
                  style={[styles.messageButton, { backgroundColor: theme.accentSoft }]}>
                  <MaterialCommunityIcons name="message-outline" color={theme.accent} size={21} />
                  <Text style={[styles.buttonText, { color: theme.accent }]}>Send Message</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  content: { padding: 20, gap: 16 },
  hero: { alignItems: 'center', gap: 10 },
  name: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19 },
  messageButton: { flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 44, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { fontSize: 13, fontWeight: '800' },
});
