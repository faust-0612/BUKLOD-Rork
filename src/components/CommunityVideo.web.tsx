import { useLocalSearchParams, usePathname } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { IgpatCommunityWebActions } from '@/components/IgpatCommunityWebActions';
import { parseIgpatQuickEdit } from '@/lib/igpat/quickEdit';
import { supabase } from '@/lib/supabase';

type Props = {
  uri: string;
  height?: number;
  autoPlay?: boolean;
};

export function CommunityVideo({
  uri,
  height = 380,
  autoPlay = false,
}: Props) {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = Array.isArray(params.id) ? String(params.id[0] ?? '') : String(params.id ?? '');
  const [igpatEditMeta, setIgpatEditMeta] = useState<unknown>(null);
  const [isIgpat, setIsIgpat] = useState(false);
  const isPostDetail = pathname.startsWith('/post/');

  useEffect(() => {
    let cancelled = false;

    if (!isPostDetail || !postId) {
      setIgpatEditMeta(null);
      setIsIgpat(false);
      return () => {
        cancelled = true;
      };
    }

    void Promise.all([
      (supabase as any).rpc('get_buklod_igpat_edit_v1', { p_post_id: postId }),
      supabase
        .from('community_posts')
        .select('id,is_reel,is_hidden,deleted_at,media_mime_type')
        .eq('id', postId)
        .maybeSingle(),
    ])
      .then(([editResult, postResult]) => {
        if (cancelled) return;
        if (!editResult?.error) {
          setIgpatEditMeta(
            editResult?.data && typeof editResult.data === 'object' ? editResult.data : null,
          );
        } else {
          setIgpatEditMeta(null);
        }

        const row = postResult?.data as any;
        setIsIgpat(Boolean(
          row?.id &&
          row?.is_reel &&
          !row?.is_hidden &&
          !row?.deleted_at &&
          String(row?.media_mime_type ?? '').startsWith('video/')
        ));
      })
      .catch(() => {
        if (!cancelled) {
          setIgpatEditMeta(null);
          setIsIgpat(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPostDetail, postId]);

  const hasEditMeta = Boolean(igpatEditMeta && typeof igpatEditMeta === 'object');
  const metadataDuration = useMemo(() => {
    if (!hasEditMeta) return 60;
    const row = igpatEditMeta as Record<string, unknown>;
    const trimEnd = Number(row.trim_end_seconds ?? 60);
    return Number.isFinite(trimEnd) && trimEnd > 0 ? Math.max(1, trimEnd) : 60;
  }, [hasEditMeta, igpatEditMeta]);
  const edit = useMemo(
    () => parseIgpatQuickEdit(igpatEditMeta, metadataDuration),
    [igpatEditMeta, metadataDuration],
  );
  const trimStart = hasEditMeta ? edit.trimStartSeconds : 0;
  const trimEnd = hasEditMeta ? Number(edit.trimEndSeconds ?? metadataDuration) : metadataDuration;

  const player = useVideoPlayer(uri, instance => {
    instance.loop = false;
    if (hasEditMeta) {
      instance.muted = edit.muted;
      instance.playbackRate = edit.speed;
    }
  });

  useEffect(() => {
    try {
      player.loop = false;
      if (hasEditMeta) {
        player.muted = edit.muted;
        player.playbackRate = edit.speed;
        if (player.currentTime < trimStart || player.currentTime >= trimEnd) {
          player.currentTime = trimStart;
        }
      }

      if (autoPlay) player.play();
      else player.pause();
    } catch {}
  }, [autoPlay, edit.muted, edit.speed, hasEditMeta, player, trimEnd, trimStart, uri]);

  useEffect(() => {
    if (!hasEditMeta) return undefined;

    const timer = setInterval(() => {
      try {
        const current = Number(player.currentTime ?? 0);
        if (current >= trimEnd - 0.04 || current < trimStart - 0.04) {
          player.currentTime = trimStart;
          player.pause();
        }
      } catch {}
    }, 120);

    return () => clearInterval(timer);
  }, [hasEditMeta, player, trimEnd, trimStart]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <View style={styles.root}>
      <View style={[styles.wrap, { height }]}>
        <VideoView
          player={player}
          style={[
            styles.video,
            hasEditMeta && edit.rotation !== 0
              ? { transform: [{ rotate: `${edit.rotation}deg` }] }
              : null,
          ]}
          nativeControls
          contentFit={hasEditMeta ? edit.contentFit : 'cover'}
        />
        {hasEditMeta && !!edit.textOverlay.trim() ? (
          <View pointerEvents="none" style={styles.editTextWrap}>
            <Text style={styles.editText}>{edit.textOverlay.trim()}</Text>
          </View>
        ) : null}
      </View>

      {isPostDetail && isIgpat && postId ? (
        <IgpatCommunityWebActions postId={postId} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    marginTop: 12,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  editTextWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 34,
    alignItems: 'center',
  },
  editText: {
    maxWidth: '100%',
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.86)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
