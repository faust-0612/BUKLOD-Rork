import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
} from 'expo-router';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  supabase,
} from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

import {
  colors,
} from '@/lib/theme';

import {
  useAuth,
} from '@/providers/AuthProvider';

type IgpatRow = {
  id: string;
  user_id?: string | null;
  author_name: string;
  audience: string;
  body: string;
  created_at: string;
  media_path: string;
  media_duration_seconds: number;
  reaction_count: number;
  comment_count: number;
  media_url?: string | null;
};

function HomeIgpatVideo({
  uri,
}: {
  uri: string;
}) {
  const player = useVideoPlayer(
    uri,
    instance => {
      instance.loop = false;
      instance.muted = true;
    }
  );

  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls={false}
      contentFit="contain"
    />
  );
}

/**
 * Backward-compatible component name retained so existing Home imports do not
 * need a risky broad edit. User-facing product identity is now BUKLOD IGPAT.
 */
export default function BuklodHomeReelsExtension() {
  const {
    user,
    profile,
  } = useAuth();

  const [rows, setRows] =
    useState<IgpatRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const load =
    useCallback(
      async () => {
        if (!user?.id) {
          setRows([]);
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          // Keep the proven legacy RPC name for database compatibility while
          // the product surface migrates to the canonical IGPAT identity.
          const {
            data,
            error,
          } = await (
            supabase as any
          ).rpc(
            'get_buklod_reels_v1',
            {
              p_limit: 4,
            }
          );

          if (error) {
            throw error;
          }

          const visibleRows =
            (
              data ?? []
            ) as IgpatRow[];

          const signed =
            await Promise.all(
              visibleRows.map(
                async row => {
                  if (!row.media_path) {
                    return {
                      ...row,
                      media_url: null,
                    };
                  }

                  const {
                    data: mediaData,
                  } = await (
                    supabase as any
                  )
                    .storage
                    .from(
                      'community-media'
                    )
                    .createSignedUrl(
                      row.media_path,
                      1200
                    );

                  return {
                    ...row,
                    media_url:
                      mediaData
                        ?.signedUrl ??
                      null,
                  };
                }
              )
            );

          setRows(
            signed.filter(
              row =>
                Boolean(
                  row.media_url
                )
            )
          );
        } catch (error) {
          console.warn(
            'Home IGPAT:',
            String(
              (error as any)
                ?.message ??
                error
            )
          );

          setRows([]);
        } finally {
          setLoading(false);
        }
      },
      [
        user?.id,
        profile?.church_id,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  if (
    !loading &&
    rows.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Pressable
          style={styles.headingIdentity}
          onPress={() => router.push('/igpat' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD IGPAT"
        >
          <Text style={styles.sectionTitle}>
            BUKLOD IGPAT
          </Text>
          <Text style={styles.tagline}>
            An Instant Bond.
          </Text>
        </Pressable>

        <View style={styles.headingActions}>
          <Pressable
            style={styles.createButton}
            onPress={() => router.push('/igpat/create' as any)}
            accessibilityRole="button"
            accessibilityLabel="Create an IGPAT"
          >
            <Text style={styles.createButtonText}>CREATE</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/igpat' as any)}
            accessibilityRole="button"
            accessibilityLabel="Watch all IGPAT videos"
          >
            <Text style={styles.sectionMeta}>WATCH ›</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={colors.green}
          />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.igpatRow
          }
        >
          {rows.map(row => (
            <Pressable
              key={row.id}
              style={styles.igpatCard}
              onPress={() => router.push('/igpat' as any)}
              accessibilityRole="button"
              accessibilityLabel="Watch in BUKLOD IGPAT"
            >
              {!!row.media_url && (
                <HomeIgpatVideo
                  uri={row.media_url}
                />
              )}

              <View style={styles.copy}>
                <View style={styles.authorRow}>
                  <Text
                    numberOfLines={1}
                    style={styles.author}
                  >
                    {resolvePersonDisplayName(
                      row.author_name,
                      row.user_id,
                    )}
                  </Text>

                  <Text style={styles.audience}>
                    {String(
                      row.audience ?? ''
                    ).toUpperCase()}
                  </Text>
                </View>

                {!!row.body && (
                  <Text
                    numberOfLines={2}
                    style={styles.body}
                  >
                    {row.body}
                  </Text>
                )}

                <Text style={styles.stats}>
                  Tap to watch in IGPAT
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
    marginBottom: 8,
  },

  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },

  headingIdentity: {
    flex: 1,
  },

  headingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  createButton: {
    borderRadius: 999,
    backgroundColor: colors.green,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  sectionTitle: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  tagline: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: '700',
  },

  sectionMeta: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
  },

  loading: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },

  igpatRow: {
    gap: 10,
    paddingRight: 4,
  },

  igpatCard: {
    width: 278,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.white,
  },

  video: {
    width: '100%',
    height: 250,
    backgroundColor: '#0E1511',
  },

  copy: {
    padding: 11,
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  author: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },

  audience: {
    color: colors.greenDark,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.35,
  },

  body: {
    marginTop: 6,
    color: colors.text,
    fontSize: 11,
    lineHeight: 16,
  },

  stats: {
    marginTop: 7,
    color: colors.greenDark,
    fontSize: 8.5,
    fontWeight: '800',
  },
});