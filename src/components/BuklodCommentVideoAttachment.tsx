import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

/** Player mounts only on tap; never auto-downloads or autoplays in the feed. */
function ActiveCommentVideo({ uri, onError }: { uri: string; onError: () => void }) {
  const player = useVideoPlayer({ uri }, instance => {
    instance.loop = false;
    instance.audioMixingMode = 'mixWithOthers';
  });
  useEffect(() => {
    const status = player.addListener('statusChange', event => {
      if (event.status === 'error') onError();
    });
    const app = AppState.addEventListener('change', state => {
      if (state !== 'active') player.pause();
    });
    try { player.play(); } catch { onError(); }
    return () => { status.remove(); app.remove(); player.pause(); };
  }, [player, onError]);
  return (
    <VideoView player={player} style={styles.video} nativeControls
      contentFit="contain" surfaceType="textureView" allowsPictureInPicture={false} />
  );
}

export default function BuklodCommentVideoAttachment({ uri, onRetry }: {
  uri: string;
  onRetry: () => Promise<string | null>;
}) {
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const playbackError = useCallback(() => { setFailed(true); setActive(false); }, []);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const fresh = await onRetry();
      if (fresh) { setFailed(false); setActive(true); }
    } catch {
      // Keep manual retry available on weak networks or expired URLs.
    } finally { setRetrying(false); }
  };
  return (
    <View style={styles.container}>
      {active && !failed ? (
        <ActiveCommentVideo uri={uri} onError={playbackError} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={failed ? 'Retry short video comment' : 'Play short video comment'}
          onPress={failed ? () => void retry() : () => setActive(true)}
          disabled={retrying}
          style={styles.cover}
        >
          <MaterialCommunityIcons name={failed ? 'refresh' : 'play-circle-outline'} color="#FFFFFF" size={44} />
          <Text style={styles.label}>
            {retrying ? 'Refreshing video…' : failed ? 'Video unavailable · Tap to retry' : 'Play short video'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { width: '100%', height: 180, backgroundColor: '#141B1A' },
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  video: { width: '100%', height: '100%' },
});
