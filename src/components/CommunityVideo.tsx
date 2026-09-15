import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';
import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';
import { supabase } from '@/lib/supabase';
import { parseIgpatQuickEdit } from '@/lib/igpat/quickEdit';

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
  const params = useLocalSearchParams<{ id?: string }>();
  const [igpatEditMeta, setIgpatEditMeta] = useState<unknown>(null);
  const isPostDetail = pathname.startsWith('/post/');

  useEffect(() => {
    let cancelled = false;
    const postId = typeof params.id === 'string' ? params.id : '';

    if (!isPostDetail || !postId) {
      setIgpatEditMeta(null);
      return () => {
        cancelled = true;
      };
    }

    void (supabase as any)
      .rpc('get_buklod_igpat_edit_v1', { p_post_id: postId })
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error) {
          setIgpatEditMeta(null);
          return;
        }
        setIgpatEditMeta(data && typeof data === 'object' ? data : null);
      })
      .catch(() => {
        if (!cancelled) setIgpatEditMeta(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isPostDetail, params.id]);

  const hasEditMeta = Boolean(igpatEditMeta && typeof igpatEditMeta === 'object');
  const metadataDuration = useMemo(() => {
    if (!hasEditMeta) return 60;
    const row = igpatEditMeta as Record<string, unknown>;
    const trimEnd = Number(row.trim_end_seconds ?? 60);
    return Number.isFinite(trimEnd) && trimEnd > 0 ? Math.max(1, trimEnd) : 60;
  }, [hasEditMeta, igpatEditMeta]);
  const edit = useMemo(
    () => parseIgpatQuickEdit(igpatEditMeta, metadataDuration),
    [igpatEditMeta, metadataDuration]
  );
  const trimStart = hasEditMeta ? edit.trimStartSeconds : 0;
  const trimEnd = hasEditMeta ? Number(edit.trimEndSeconds ?? metadataDuration) : metadataDuration;

  const player = useVideoPlayer(
    uri,
    (instance) => {
      instance.loop = false;
      if (hasEditMeta) {
        instance.muted = edit.muted;
        instance.playbackRate = edit.speed;
      }
    }
  );

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

      if (autoPlay) {
        player.play();
      } else {
        player.pause();
      }
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
    <View
      style={[
        styles.wrap,
        { height },
      ]}
    >
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
  );
}

const styles = StyleSheet.create({
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
