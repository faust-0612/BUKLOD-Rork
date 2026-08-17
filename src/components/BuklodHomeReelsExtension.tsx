import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  useAuth,
} from '@/providers/AuthProvider';

type ReelRow = {
  id: string;
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

function HomeReelVideo({
  uri,
}: {
  uri: string;
}) {
  const player = useVideoPlayer(
    uri,
    instance => {
      instance.loop = false;
    }
  );

  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="cover"
    />
  );
}

export default function BuklodHomeReelsExtension() {
  const {
    user,
    profile,
  } = useAuth();

  const [rows, setRows] =
    useState<ReelRow[]>([]);

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
            ) as ReelRow[];

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
                      3600
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
            'Home reels:',
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
        <Text style={styles.sectionTitle}>
          REELS
        </Text>

        <Text style={styles.sectionMeta}>
          Latest content
        </Text>
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
            styles.reelRow
          }
        >
          {rows.map(row => (
            <View
              key={row.id}
              style={styles.reelCard}
            >
              {!!row.media_url && (
                <HomeReelVideo
                  uri={row.media_url}
                />
              )}

              <View style={styles.copy}>
                <View style={styles.authorRow}>
                  <Text
                    numberOfLines={1}
                    style={styles.author}
                  >
                    {row.author_name ||
                      'BUKLOD Member'}
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
                  {Number(
                    row.reaction_count ?? 0
                  )}{' '}
                  reactions
                  {'  •  '}
                  {Number(
                    row.comment_count ?? 0
                  )}{' '}
                  comments
                </Text>
              </View>
            </View>
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
    justifyContent:
      'space-between',
    marginBottom: 8,
  },

  sectionTitle: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  sectionMeta: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },

  loading: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reelRow: {
    gap: 10,
    paddingRight: 4,
  },

  reelCard: {
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
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: '700',
  },
});