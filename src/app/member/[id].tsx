import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
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
import BuklodLifetimePointsHero from '@/components/points/BuklodLifetimePointsHero';
import { Button } from '@/components/UI';
import {
  loadMemberCommunityPosts,
  loadMemberPublicProfile,
  loadMemberPublicLifetimePoints,
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
  const [lifetimeSnapshot, setLifetimeSnapshot] = useState<{
    userId: string;
    points: number | null;
  } | null>(null);

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
    setLifetimeSnapshot(null);

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

      // Lifetime earned BP is a public profile metric even for locked members.
      // The RPC returns no cash or redeemable-balance information.
      void loadMemberPublicLifetimePoints(next.user_id)
        .then(points => setLifetimeSnapshot({ userId: next.user_id, points }))
        .catch(() => setLifetimeSnapshot({ userId: next.user_id, points: null }));

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
  const publicLifetimePoints =
    profile?.user_id === memberId && lifetimeSnapshot?.userId === memberId
      ? lifetimeSnapshot.points : null;

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
          gap: 7,
          paddingVertical: 7,
          overflow: 'hidden',
        },
        cover: {
          width: '100%',
          height: 148,
          borderRadius: 14,
          backgroundColor: theme.accentSoft,
        },
        profileBadgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 6,
        },
        badge: {
          backgroundColor: theme.accentSoft,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 5,
        },
        badgeText: {
          fontSize: 12,
          fontWeight: '800',
          color: theme.textPrimary,
          textAlign: 'center',
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


  // Public identity stays visible while locked; private posts and contacts do not.
  const publicIdentity = profile ? (
    <>
      <View style={styles.hero}>
        {!!profile.background_url && (
          <Image
            testID="member-public-profile-background"
            source={{ uri: profile.background_url }}
            style={styles.cover}
            resizeMode="cover"
            accessibilityLabel="Member profile background"
          />
        )}
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
        {profile.is_locked && !profile.is_self && (
          <View style={styles.profileBadgeRow}>
            <MaterialCommunityIcons name="lock-outline" size={14} color={theme.textMuted} />
            <Text style={styles.cardTitle}>PRIVATE PROFILE</Text>
          </View>
        )}
        {!profile.is_locked && !!profile.username && (
          <Text style={styles.username}>@{profile.username.replace(/^@/, '')}</Text>
        )}
      </View>
      {!isOfficialProfile && (
        <BuklodLifetimePointsHero points={publicLifetimePoints} />
      )}
      {(!!profile.circle_rank || profile.all_time_rank != null) && (
        <View style={styles.card} testID="member-public-rank">
          <Text style={styles.cardTitle}>CIRCLE & ALL-TIME RANK</Text>
          <View style={styles.profileBadgeRow}>
            {!!profile.circle_rank && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{profile.circle_rank}</Text>
              </View>
            )}
            {profile.all_time_rank != null && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>All-time #{profile.all_time_rank}</Text>
              </View>
            )}
          </View>
        </View>
      )}
      {!!profile.quick_note && (
        <View style={styles.card} testID="member-public-profile-note">
          <Text style={styles.cardTitle}>PROFILE NOTE</Text>
          <Text style={styles.note}>{profile.quick_note}</Text>
        </View>
      )}
      {profile.cluster_labels.length > 0 && (
        <View style={styles.card} testID="member-public-cluster-memberships">
          <Text style={styles.cardTitle}>CLUSTER MEMBERSHIP</Text>
          <View style={styles.chipRow}>
            {profile.cluster_labels.map(label => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  ) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: isOfficialProfile ? 'BUKLOD Official' : title,
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
          {publicIdentity}
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
          <>
            {publicIdentity}
            <View style={[styles.card, styles.lockedCard]}>
              <MaterialCommunityIcons name="shield-lock-outline" size={23} color={theme.textMuted} />
              <Text style={styles.lockedBody}>
                Contact information and private activities are hidden.
                Public points, rank, note, cluster, photo and background remain visible.
              </Text>
            </View>
          </>
        ) : (
          <>
            {publicIdentity}
            <BuklodSystemAnnouncementBoard slot="profile" />

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
                Contact details, address, and earnings stay private.
                Lifetime Points above show verified earned points only,
                not a redeemable balance or cash amount.
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
