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

import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { BuklodCommunityPhotoCollage } from '@/components/BuklodCommunityPhotoCollage';
import { CommunityVideo } from '@/components/CommunityVideo';
import { BuklodSystemAnnouncementBoard } from '@/components/BuklodSystemAnnouncementBoard';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { Button } from '@/components/UI';
import {
  loadMemberCommunityPosts,
  loadMemberPublicProfile,
  openMemberConnect,
  type MemberPublicPost,
  type MemberPublicProfile,
} from '@/lib/buklodMemberProfile';
import { formatSpecificDateTime } from '@/lib/dateTime';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

function firstString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }

  return '';
}

export default function MemberPublicProfileScreen() {
  const { theme } = useBuklodTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const memberId = firstString(params.id);
  const routeName = firstString(params.name);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] =
    useState<MemberPublicProfile | null>(null);
  const [posts, setPosts] = useState<MemberPublicPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isOfficialProfile, setIsOfficialProfile] = useState(false);

  const load = useCallback(async () => {
    if (!memberId) {
      setProfile(null);
      setPosts([]);
      setError('Member not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsOfficialProfile(false);

    try {
      const next = await loadMemberPublicProfile(memberId);
      if (!next) {
        setProfile(null);
        setPosts([]);
        setError('This member profile is not available.');
        return;
      }

      setProfile(next);
      if (next.display_name.trim().toUpperCase() === 'BUKLOD') {
        const { data: official, error: officialError } = await (supabase as any).rpc(
          'get_buklod_official_identity_v1',
          { p_user_id: next.user_id },
        );
        setIsOfficialProfile(!officialError && official === true);
      }

      if (next.is_locked && !next.is_self && !next.can_view_details) {
        setPosts([]);
        return;
      }

      const rows = await loadMemberCommunityPosts(
        next.user_id,
        user?.id ?? null,
      );
      setPosts(rows);
    } catch (loadError: unknown) {
      setProfile(null);
      setPosts([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load this profile.',
      );
    } finally {
      setLoading(false);
    }
  }, [memberId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = profile?.display_name || routeName || 'Member Profile';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          paddingHorizontal: 18,
          paddingTop: 20,
          paddingBottom: 28,
          gap: 14,
        },
        hero: {
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
        },
        name: {
          fontSize: 24,
          fontWeight: '900',
          color: theme.textPrimary,
          textAlign: 'center',
        },
        username: {
          fontSize: 14,
          fontWeight: '700',
          color: theme.textMuted,
        },
        card: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 16,
          backgroundColor: theme.surface,
          padding: 16,
          gap: 10,
        },
        cardTitle: {
          fontSize: 11,
          fontWeight: '900',
          letterSpacing: 0.7,
          color: theme.textMuted,
        },
        cardBody: {
          fontSize: 14,
          lineHeight: 21,
          color: theme.textPrimary,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        chip: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: theme.accentSoft,
        },
        chipText: {
          fontSize: 12,
          fontWeight: '800',
          color: theme.accent,
        },
        lockedCard: {
          alignItems: 'center',
          gap: 8,
          paddingVertical: 18,
        },
        lockedTitle: {
          fontSize: 16,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        lockedBody: {
          fontSize: 13,
          lineHeight: 20,
          color: theme.textMuted,
          textAlign: 'center',
        },
        center: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          gap: 10,
        },
        muted: {
          color: theme.textMuted,
          textAlign: 'center',
          lineHeight: 20,
        },
        note: {
          fontSize: 15,
          lineHeight: 22,
          fontStyle: 'italic',
          color: theme.textPrimary,
        },
        postsCard: {
          gap: 12,
        },
        postRow: {
          gap: 8,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        },
        postRowFirst: {
          paddingTop: 0,
          borderTopWidth: 0,
        },
        postBody: {
          fontSize: 14,
          lineHeight: 20,
          color: theme.textPrimary,
        },
        postMeta: {
          fontSize: 11,
          fontWeight: '700',
          color: theme.textMuted,
        },
        postEmpty: {
          fontSize: 13,
          lineHeight: 19,
          color: theme.textMuted,
        },
      }),
    [theme],
  );

  if (!memberId) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockedTitle}>Member not found</Text>
      </View>
    );
  }

  const postsSection = (
    <View style={[styles.card, styles.postsCard]}>
      <Text style={styles.cardTitle}>POSTS</Text>
      {posts.length === 0 ? (
        <Text style={styles.postEmpty}>
          No public posts yet.
        </Text>
      ) : (
        posts.map((post, index) => (
          <Pressable
            key={post.id}
            onPress={() =>
              router.push({
                pathname: '/post/[id]',
                params: { id: post.id },
              } as never)
            }
            style={[
              styles.postRow,
              index === 0 && styles.postRowFirst,
            ]}
          >
            {!!post.body && (
              <Text numberOfLines={4} style={styles.postBody}>
                {repairMojibakeText(post.body)}
              </Text>
            )}
            {!!post.media_url && !post.is_video && (
              <BuklodCommunityPhotoCollage
                items={[{ media_url: post.media_url, media_mime_type: 'image/jpeg' }]}
                onPressPhoto={() => router.push({ pathname: '/post/[id]', params: { id: post.id } } as never)}
              />
            )}
            {post.is_video && post.media_url ? (
              <CommunityVideo
                uri={post.media_url}
                height={240}
                active={false}
                onOpenFullscreen={() => router.push({ pathname: '/post/[id]', params: { id: post.id } } as never)}
              />
            ) : null}
            {post.is_video && !post.media_url && (
              <Text style={styles.postMeta}>Video post</Text>
            )}
            {!!post.created_at && (
              <Text style={styles.postMeta}>
                {formatSpecificDateTime(post.created_at)}
              </Text>
            )}
          </Pressable>
        ))
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: isOfficialProfile ? 'BUKLOD Official' : 'Member Profile',
          headerBackTitle: 'Back',
        }}
      />

      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.lockedTitle}>Profile unavailable</Text>
            <Text style={styles.muted}>{error}</Text>
            <Button title="TRY AGAIN" onPress={() => void load()} />
          </View>
        ) : profile?.is_self ? (
          <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>YOUR PROFILE</Text>
            <Text style={styles.cardBody}>
              This is your own profile. Open the Me tab to edit your details,
              cover photo, and privacy settings.
            </Text>
            <Button
              title="OPEN MY PROFILE"
              onPress={() => router.push('/(tabs)/me' as never)}
            />
          </View>
          {postsSection}
          </>
        ) : profile?.is_locked || !profile?.can_view_details ? (
          <View style={[styles.card, styles.lockedCard]}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={34}
              color={theme.textMuted}
            />
            <Text style={styles.lockedTitle}>{title}</Text>
            <Text style={styles.lockedBody}>
              BUKLOD community member · Private profile. Contact details, personal activities and memberships are hidden by the member’s choice.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <ProfileAvatar
                userId={profile.user_id}
                uri={profile.avatar_url}
                name={profile.display_name}
                size={92}
              />
              <Text style={styles.name}>{profile.display_name}</Text>
              {isOfficialProfile && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>✓ VERIFIED PLATFORM ACCOUNT · NO MEMBER POINTS</Text>
                </View>
              )}
              {!!profile.username && (
                <Text style={styles.username}>
                  @{profile.username.replace(/^@/, '')}
                </Text>
              )}
            </View>

            <BuklodSystemAnnouncementBoard slot="profile" />

            {!!profile.quick_note && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>PROFILE NOTE</Text>
                <Text style={styles.note}>{profile.quick_note}</Text>
              </View>
            )}

            {!!profile.member_since && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>MEMBER SINCE</Text>
                <Text style={styles.cardBody}>{profile.member_since}</Text>
              </View>
            )}

            {profile.shared_scope_labels.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>SHARED COMMUNITIES</Text>
                <View style={styles.chipRow}>
                  {profile.shared_scope_labels.map((label) => (
                    <View key={label} style={styles.chip}>
                      <Text style={styles.chipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>PRIVATE BY DESIGN</Text>
              <Text style={styles.cardBody}>
                Contact details, address, earnings, and exact points are not
                shown on member profiles.
              </Text>
            </View>

            <Button
              title="MESSAGE ON CONNECT"
              onPress={() =>
                openMemberConnect(
                  profile.user_id,
                  profile.display_name,
                )
              }
            />

            {postsSection}
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}
