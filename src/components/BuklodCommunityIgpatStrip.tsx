import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
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
  resolveCommunityMediaUrl,
} from '@/lib/buklodMediaUrl';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type IgpatTile = {
  id: string;
  user_id?: string | null;
  author_name?: string | null;
  body?: string | null;
  media_path: string;
  media_duration_seconds?: number | null;
  media_url?: string | null;
};

const TILE_LIMIT = 8;
const DOUBLE_TAP_MS = 320;

const sessionRows = new Map<string, IgpatTile[]>();

function IgpatTilePreview({
  uri,
  playing,
}: {
  uri: string;
  playing: boolean;
}) {
  const player = useVideoPlayer(
    {
      uri,
      useCaching: true,
    },
    instance => {
      instance.loop = true;
      instance.muted = true;
    },
  );

  useEffect(() => {
    try {
      if (playing) {
        player.play();
      } else {
        player.pause();
      }
    } catch {}
  }, [player, playing]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

export default function BuklodCommunityIgpatStrip() {
  const { user } = useAuth();
  const cacheKey = String(user?.id ?? '');
  const [rows, setRows] = useState<IgpatTile[]>(
    () => sessionRows.get(cacheKey) ?? [],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const lastTapRef = useRef<{
    id: string;
    at: number;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setRows([]);
      setActiveId(null);
      setPlaying(false);
      return;
    }

    const cached = sessionRows.get(user.id);
    if (cached?.length) {
      setRows(cached);
    }

    let active = true;

    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc(
          'get_buklod_igpat_feed_v2',
          {
            p_mode: 'for-you',
            p_limit: TILE_LIMIT,
          },
        );
        if (error) throw error;

        const source = ((data ?? []) as IgpatTile[])
          .filter(row => Boolean(row?.id && row?.media_path))
          .slice(0, TILE_LIMIT);

        const signed = await Promise.all(
          source.map(async row => ({
            ...row,
            media_url: await resolveCommunityMediaUrl(
              row.media_path,
              row.media_url,
            ),
          })),
        );

        const usable = signed.filter(row => Boolean(row.media_url));
        if (!active) return;

        sessionRows.set(user.id, usable);
        setRows(usable);
      } catch {
        // Community Wall remains usable even when IGPAT preview is unavailable.
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (
      activeId &&
      !rows.some(row => row.id === activeId)
    ) {
      setActiveId(null);
      setPlaying(false);
    }
  }, [activeId, rows]);

  const title = useMemo(
    () => rows.length ? 'BUKLOD IGPAT' : '',
    [rows.length],
  );

  if (!rows.length) {
    return null;
  }

  const handleTilePress = (item: IgpatTile) => {
    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap =
      last?.id === item.id &&
      now - last.at <= DOUBLE_TAP_MS;

    lastTapRef.current = {
      id: item.id,
      at: now,
    };

    if (isDoubleTap) {
      setPlaying(false);
      router.push({
        pathname: '/igpat',
        params: {
          start: item.id,
        },
      } as any);
      return;
    }

    if (activeId === item.id) {
      setPlaying(current => !current);
      return;
    }

    setActiveId(item.id);
    setPlaying(true);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>
            Tap to preview · Double tap to open
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD IGPAT"
          onPress={() => router.push('/igpat' as any)}
          style={styles.openButton}
        >
          <Text style={styles.openText}>VIEW ALL</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={17}
            color="#245B3D"
          />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {rows.map(item => {
          const selected = activeId === item.id;
          const isPlaying = selected && playing;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={
                isPlaying
                  ? 'Pause IGPAT preview. Double tap to open full IGPAT.'
                  : 'Play IGPAT preview. Double tap to open full IGPAT.'
              }
              onPress={() => handleTilePress(item)}
              style={[
                styles.tile,
                selected && styles.tileSelected,
              ]}
            >
              <View style={styles.media}>
                {selected && item.media_url ? (
                  <IgpatTilePreview
                    uri={item.media_url}
                    playing={isPlaying}
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <MaterialCommunityIcons
                      name="play-circle"
                      size={34}
                      color="#FFFFFF"
                    />
                  </View>
                )}

                <View style={styles.scrim} />

                <View style={styles.playBadge}>
                  <MaterialCommunityIcons
                    name={isPlaying ? 'pause' : 'play'}
                    size={14}
                    color="#FFFFFF"
                  />
                </View>

                {!!item.media_duration_seconds && (
                  <Text style={styles.duration}>
                    {Math.max(
                      1,
                      Math.round(
                        Number(item.media_duration_seconds),
                      ),
                    )}s
                  </Text>
                )}
              </View>

              <Text
                style={styles.author}
                numberOfLines={1}
              >
                {String(item.author_name ?? 'BUKLOD Member')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    minHeight: 42,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    color: '#1F5638',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hint: {
    marginTop: 2,
    color: '#718077',
    fontSize: 9.5,
    fontWeight: '700',
  },
  openButton: {
    minHeight: 34,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openText: {
    color: '#245B3D',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  row: {
    gap: 9,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 10,
  },
  tile: {
    width: 112,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4DC',
  },
  tileSelected: {
    borderWidth: 2,
    borderColor: '#2D6B4F',
  },
  media: {
    width: '100%',
    height: 150,
    overflow: 'hidden',
    backgroundColor: '#17251E',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#244C36',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  playBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.64)',
  },
  duration: {
    position: 'absolute',
    right: 7,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.60)',
    fontSize: 9,
    fontWeight: '900',
  },
  author: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    color: '#294536',
    fontSize: 10,
    fontWeight: '800',
  },
});
