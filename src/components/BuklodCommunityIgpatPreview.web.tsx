import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

type IgpatPreviewRow = {
  id: string;
  user_id?: string | null;
  author_name?: string | null;
  body?: string | null;
  media_path: string;
  media_duration_seconds?: number | null;
  media_url?: string | null;
};

type Props = {
  slotId?: string;
  active?: boolean;
};

const PREVIEW_LIMIT = 10;
const IGPAT_PREVIEW_TIMEOUT_MS = 8_000;
const SIGNED_URL_TTL_SECONDS = 1200;

let previewCache: IgpatPreviewRow[] | null = null;
let previewRequest: Promise<IgpatPreviewRow[]> | null = null;

function hashSlot(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

async function fetchIgpatPreviews(): Promise<IgpatPreviewRow[]> {
  if (previewCache) return previewCache;
  if (previewRequest) return previewRequest;

  previewRequest = (async () => {
    const { data, error } = await withBuklodTimeout<any>(
      (supabase as any).rpc('get_buklod_igpat_feed_v4', {
        p_mode: 'for-you',
        p_limit: PREVIEW_LIMIT,
        p_before_created_at: null,
        p_before_id: null,
      }),
      IGPAT_PREVIEW_TIMEOUT_MS,
      'Community IGPAT preview feed'
    );

    if (error) throw error;

    const source = ((data ?? []) as IgpatPreviewRow[])
      .filter(row => Boolean(row?.id && row?.media_path))
      .slice(0, PREVIEW_LIMIT);

    const signed = await Promise.all(
      source.map(async row => {
        const { data: signedData, error: signError } =
          await withBuklodTimeout<any>(
            supabase.storage
              .from('community-media')
              .createSignedUrl(row.media_path, SIGNED_URL_TTL_SECONDS),
            IGPAT_PREVIEW_TIMEOUT_MS,
            'Community IGPAT preview media'
          ).catch((timeoutError) => ({
            data: null,
            error: timeoutError,
          }));

        if (signError || !signedData?.signedUrl) {
          return null;
        }

        return {
          ...row,
          media_url: signedData.signedUrl,
        };
      }),
    );

    previewCache = signed.filter(Boolean) as IgpatPreviewRow[];
    return previewCache;
  })().catch(error => {
    previewRequest = null;
    throw error;
  });

  return previewRequest;
}

function InlineIgpatVideo({
  uri,
  active,
}: {
  uri: string;
  active: boolean;
}) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    try {
      player.muted = true;
      player.loop = true;
      if (active) player.play();
      else player.pause();
    } catch {}
  }, [active, player]);

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
      nativeControls={false}
      contentFit="contain"
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function BuklodCommunityIgpatPreview({
  slotId = 'community-igpat',
  active = true,
}: Props) {
  const [rows, setRows] = useState<IgpatPreviewRow[]>(previewCache ?? []);
  const [loading, setLoading] = useState(!previewCache);

  useEffect(() => {
    let mounted = true;

    if (previewCache) {
      setRows(previewCache);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    void fetchIgpatPreviews()
      .then(next => {
        if (!mounted) return;
        setRows(next);
      })
      .catch(error => {
        console.warn('BUKLOD Community IGPAT preview:', String(error?.message ?? error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selected = useMemo(() => {
    if (!rows.length) return null;
    return rows[hashSlot(slotId) % rows.length] ?? rows[0] ?? null;
  }, [rows, slotId]);

  if (loading && !selected) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#EAF6EE" />
        <Text style={styles.loadingText}>Loading IGPAT…</Text>
      </View>
    );
  }

  if (!selected?.media_url) {
    return null;
  }

  const openIgpat = () => {
    router.push(`/igpat?post=${encodeURIComponent(selected.id)}` as any);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open IGPAT by ${selected.author_name || 'BUKLOD Member'}`}
      accessibilityHint="Opens this exact video in the full BUKLOD IGPAT experience."
      onPress={openIgpat}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="play" size={15} color="#07100B" />
          </View>
          <View>
            <Text style={styles.brand}>BUKLOD IGPAT</Text>
            <Text style={styles.tagline}>An Instant Bond.</Text>
          </View>
        </View>
        <View style={styles.openPill}>
          <Text style={styles.openPillText}>OPEN</Text>
          <MaterialCommunityIcons name="arrow-up-right" size={14} color="#EAF6EE" />
        </View>
      </View>

      <View style={styles.videoFrame}>
        <InlineIgpatVideo uri={selected.media_url} active={active} />
        <View pointerEvents="none" style={styles.videoShade} />
        <View pointerEvents="none" style={styles.videoBadge}>
          <MaterialCommunityIcons name="volume-off" size={14} color="#FFFFFF" />
          <Text style={styles.videoBadgeText}>Preview</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text numberOfLines={1} style={styles.author}>
          {selected.author_name || 'BUKLOD Member'}
        </Text>
        {!!selected.body?.trim() ? (
          <Text numberOfLines={2} style={styles.caption}>
            {selected.body.trim()}
          </Text>
        ) : null}
        <Text style={styles.tapHint}>Tap once to continue with this exact IGPAT.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(22, 93, 55, 0.22)',
    backgroundColor: '#07100B',
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }],
  },
  headerRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B8E986',
  },
  brand: {
    color: '#F5FBF7',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tagline: {
    marginTop: 1,
    color: 'rgba(245,251,247,0.62)',
    fontSize: 9,
    fontWeight: '700',
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(234,246,238,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  openPillText: {
    color: '#EAF6EE',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 4 / 5,
    maxHeight: 560,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: '#020504',
  },
  videoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  videoBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 13,
  },
  author: {
    color: '#F5FBF7',
    fontSize: 12,
    fontWeight: '900',
  },
  caption: {
    marginTop: 5,
    color: 'rgba(245,251,247,0.84)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  tapHint: {
    marginTop: 8,
    color: '#B8E986',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  loadingCard: {
    minHeight: 96,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#07100B',
  },
  loadingText: {
    color: 'rgba(234,246,238,0.70)',
    fontSize: 10,
    fontWeight: '700',
  },
});