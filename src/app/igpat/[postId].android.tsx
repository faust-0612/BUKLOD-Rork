import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';

import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

type FocusedIgpat = {
  id: string;
  user_id: string | null;
  body: string | null;
  media_path: string;
  media_url: string;
  author_name: string;
};

const IGPAT_READ_TIMEOUT_MS = 10_000;
const SIGNED_URL_TTL_SECONDS = 1200;

function FocusedVideo({ uri }: { uri: string }) {
  const [paused, setPaused] = useState(false);
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = false;
    instance.play();
  });

  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch {}
  }, [paused, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Play IGPAT video' : 'Pause IGPAT video'}
      onPress={() => setPaused(value => !value)}
      style={StyleSheet.absoluteFill}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        contentFit="contain"
      />

      {paused ? (
        <View pointerEvents="none" style={styles.pauseBadge}>
          <MaterialCommunityIcons name="play" size={22} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function FocusedIgpatScreen() {
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;

  const [row, setRow] = useState<FocusedIgpat | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) {
      setErrorMessage('IGPAT video not found.');
      setLoading(false);
      return;
    }

    let mounted = true;

    void (async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data: post, error } = await withBuklodTimeout<any>(
          supabase
            .from('community_posts')
            .select('id,user_id,body,media_path,is_reel,media_mime_type')
            .eq('id', postId)
            .eq('is_reel', true)
            .maybeSingle(),
          IGPAT_READ_TIMEOUT_MS,
          'IGPAT focused post'
        );

        if (error) throw error;
        if (!post?.id || !post.media_path) {
          throw new Error('IGPAT video not found or is no longer available.');
        }

        const { data: signed, error: signError } = await withBuklodTimeout<any>(
          supabase.storage
            .from('community-media')
            .createSignedUrl(String(post.media_path), SIGNED_URL_TTL_SECONDS),
          IGPAT_READ_TIMEOUT_MS,
          'IGPAT focused media URL'
        );

        if (signError || !signed?.signedUrl) {
          throw signError ?? new Error('IGPAT video could not be opened.');
        }

        let authorName = '';
        if (post.user_id) {
          const { data: profile } = await withBuklodTimeout<any>(
            supabase
              .from('profiles')
              .select('full_name,username,mobile')
              .eq('id', post.user_id)
              .maybeSingle(),
            IGPAT_READ_TIMEOUT_MS,
            'IGPAT focused author'
          ).catch(() => ({ data: null }));

          authorName = resolvePersonDisplayName({
            full_name: profile?.full_name ?? null,
            username: profile?.username ?? null,
            mobile: profile?.mobile ?? null,
            user_id: String(post.user_id),
          });
        }

        if (!mounted) return;

        setRow({
          id: String(post.id),
          user_id: post.user_id ? String(post.user_id) : null,
          body: post.body ? String(post.body) : null,
          media_path: String(post.media_path),
          media_url: signed.signedUrl,
          author_name: authorName || 'Unknown',
        });
      } catch (error) {
        if (mounted) {
          setErrorMessage(String((error as any)?.message ?? error));
          setRow(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [postId]);

  const frameSize = useMemo(() => {
    const frameHeight = Math.max(360, Math.min(620, height - insets.top - insets.bottom - 170));
    const frameWidth = Math.min(width, 520);
    return { frameHeight, frameWidth };
  }, [height, insets.bottom, insets.top, width]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingTitle}>BUKLOD IGPAT</Text>
        <Text style={styles.loadingTagline}>An Instant Bond.</Text>
      </View>
    );
  }

  if (!row) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.errorTitle}>IGPAT unavailable</Text>
        <Text style={styles.errorCopy}>{errorMessage ?? 'This IGPAT video is unavailable.'}</Text>
        <Pressable style={styles.continueButton} onPress={() => router.replace('/igpat' as any)}>
          <Text style={styles.continueText}>OPEN IGPAT</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </Pressable>

        <View style={styles.brandBlock}>
          <Text style={styles.brand}>BUKLOD IGPAT</Text>
          <Text style={styles.tagline}>An Instant Bond.</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full IGPAT feed"
          onPress={() => router.replace('/igpat' as any)}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="play-box-multiple-outline" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <View
          style={[
            styles.videoFrame,
            {
              width: frameSize.frameWidth,
              height: frameSize.frameHeight,
            },
          ]}
        >
          <FocusedVideo uri={row.media_url} />
        </View>
      </View>

      <View style={[styles.meta, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Text numberOfLines={1} style={styles.author}>{row.author_name}</Text>
        {!!row.body && <Text numberOfLines={2} style={styles.body}>{row.body}</Text>}
        <Text style={styles.hint}>Tap video to pause/play · swipe back or use the arrow to return</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#000000',
  },
  topBar: {
    height: 58,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBlock: {
    alignItems: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 1,
    color: '#B5BDB8',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  videoFrame: {
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
  meta: {
    minHeight: 98,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  author: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  body: {
    marginTop: 4,
    color: '#E0E4E1',
    fontSize: 12,
    lineHeight: 17,
  },
  hint: {
    marginTop: 7,
    color: '#929B95',
    fontSize: 10,
    lineHeight: 14,
  },
  pauseBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '46%',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  loadingTitle: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  loadingTagline: {
    marginTop: 3,
    color: '#AEB8B2',
    fontSize: 12,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  errorCopy: {
    marginTop: 8,
    color: '#C8CFCA',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  continueButton: {
    marginTop: 18,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  continueText: {
    color: '#0B0E0C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
