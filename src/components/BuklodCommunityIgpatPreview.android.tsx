import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useBuklodCommunityInlineVisibility } from '@/hooks/useBuklodCommunityAdViewability';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type IgpatPreviewRow = {
  id: string;
  user_id?: string | null;
  author_name?: string | null;
  body?: string | null;
  media_path: string;
  media_url: string;
};

type Props = {
  slotId?: string;
  active?: boolean;
};

const PREVIEW_LIMIT = 12;
const IGPAT_PREVIEW_TIMEOUT_MS = 8_000;
const SIGNED_URL_TTL_SECONDS = 1200;
const CACHE_TTL_MS = 8 * 60 * 1000;

let cachedRows: IgpatPreviewRow[] = [];
let cachedAt = 0;
let pendingRows: Promise<IgpatPreviewRow[]> | null = null;

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

async function loadPreviewRows() {
  if (cachedRows.length && Date.now() - cachedAt < CACHE_TTL_MS) return cachedRows;
  if (pendingRows) return pendingRows;

  pendingRows = (async () => {
    const result = await withBuklodTimeout<any>(
      (supabase as any).rpc('get_buklod_igpat_feed_v2', {
        p_mode: 'for-you',
        p_limit: PREVIEW_LIMIT,
      }),
      IGPAT_PREVIEW_TIMEOUT_MS,
      'Community IGPAT preview feed'
    );

    if (result?.error) throw result.error;

    const source = ((result?.data ?? []) as Array<Partial<IgpatPreviewRow>>)
      .filter(row => Boolean(row.id && row.media_path))
      .slice(0, PREVIEW_LIMIT);

    const signed = await Promise.all(
      source.map(async row => {
        const mediaPath = String(row.media_path ?? '');
        const { data, error } = await withBuklodTimeout<any>(
          supabase.storage
            .from('community-media')
            .createSignedUrl(mediaPath, SIGNED_URL_TTL_SECONDS),
          IGPAT_PREVIEW_TIMEOUT_MS,
          'Community IGPAT preview media'
        ).catch((timeoutError) => ({
          data: null,
          error: timeoutError,
        }));

        if (error || !data?.signedUrl) return null;

        return {
          id: String(row.id),
          user_id: row.user_id ? String(row.user_id) : null,
          author_name: row.author_name ? String(row.author_name) : null,
          body: row.body ? String(row.body) : null,
          media_path: mediaPath,
          media_url: data.signedUrl,
        } satisfies IgpatPreviewRow;
      }),
    );

    cachedRows = signed.filter(Boolean) as IgpatPreviewRow[];
    cachedAt = Date.now();
    return cachedRows;
  })().finally(() => {
    pendingRows = null;
  });

  return pendingRows;
}

function InlineIgpatVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  useEffect(() => {
    try {
      player.muted = true;
      player.play();
    } catch {}

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
      contentFit="contain"
    />
  );
}

export default function BuklodCommunityIgpatPreview({ slotId, active = true }: Props) {
  const { width } = useWindowDimensions();
  const { activeScope } = useBuklodScope();
  const isCurrentlyVisible = useBuklodCommunityInlineVisibility(slotId);
  const isPublicScope = activeScope?.scope_type === 'PUBLIC';
  const [rows, setRows] = useState<IgpatPreviewRow[]>(cachedRows);
  const [loading, setLoading] = useState(!cachedRows.length);

  useEffect(() => {
    if (!active || !isPublicScope) return;

    let mounted = true;
    setLoading(!cachedRows.length);

    void loadPreviewRows()
      .then(nextRows => {
        if (mounted) setRows(nextRows);
      })
      .catch(error => {
        console.warn(
          'BUKLOD Community IGPAT preview:',
          String((error as any)?.message ?? error),
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [active, isPublicScope]);

  const row = useMemo(() => {
    if (!rows.length) return null;
    const seed = String(slotId ?? 'community-igpat');
    return rows[stableHash(seed) % rows.length] ?? rows[0] ?? null;
  }, [rows, slotId]);

  if (!active || !isPublicScope) return null;

  if (loading && !row) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!row) return null;

  const frameHeight = Math.round(
    Math.min(460, Math.max(320, width <= 520 ? width * 1.12 : 460)),
  );

  const author = resolvePersonDisplayName({
    full_name: row.author_name ?? null,
    user_id: row.user_id ?? null,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open this BUKLOD IGPAT video"
      onPress={() => router.push(`/igpat/${encodeURIComponent(row.id)}` as any)}
      style={({ pressed }) => [styles.shell, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>BUKLOD IGPAT</Text>
          <Text style={styles.tagline}>An Instant Bond.</Text>
        </View>
        <Text style={styles.tapLabel}>Tap to open IGPAT</Text>
      </View>

      <View style={[styles.videoFrame, { height: frameHeight }]}>
        {isCurrentlyVisible ? (
          <InlineIgpatVideo uri={row.media_url} />
        ) : (
          <View style={styles.videoPlaceholder} />
        )}
      </View>

      <View style={styles.footer}>
        <Text numberOfLines={1} style={styles.author}>{author}</Text>
        {!!row.body && <Text numberOfLines={2} style={styles.body}>{row.body}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginTop: 10,
    marginBottom: 14,
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#27312B',
    backgroundColor: '#0A0D0B',
  },
  pressed: { opacity: 0.96 },
  loadingShell: {
    width: '100%',
    minHeight: 84,
    marginTop: 10,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tagline: {
    marginTop: 1,
    color: '#AEB8B2',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  tapLabel: {
    color: '#D5DDD8',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  videoFrame: {
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 11,
  },
  author: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  body: {
    marginTop: 3,
    color: '#D4DBD7',
    fontSize: 11,
    lineHeight: 16,
  },
});