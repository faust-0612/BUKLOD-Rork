import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { subscribeBuklodCommentVideoStop, stopBuklodCommentVideos } from '@/lib/buklodCommentVideoPlaybackSignal';

/** Player mounts only on tap; never auto-downloads or autoplays in the feed. */
function ActiveCommentVideo({ uri, onError }: { uri: string; onError: () => void }) {
  const [firstFrame, setFirstFrame] = useState(false);
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
    <View style={styles.container}>
      <VideoView player={player} style={styles.video} nativeControls
        onFirstFrameRender={() => setFirstFrame(true)}
        contentFit="contain" surfaceType="textureView" allowsPictureInPicture={false} />
      {!firstFrame && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <Text style={styles.label}>Loading video…</Text>
        </View>
      )}
    </View>
  );
}

export default function BuklodCommentVideoAttachment({ uri, onRetry }: {
  uri: string;
  onRetry: () => Promise<string | null>;
}) {
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => subscribeBuklodCommentVideoStop(() => setActive(false)), []);
  const playbackError = useCallback(() => { setFailed(true); setActive(false); }, []);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const fresh = await onRetry();
      if (fresh) { stopBuklodCommentVideos(); setFailed(false); setActive(true); }
    } catch {
      // Keep manual retry available on weak networks or expired URLs.
    } finally { setRetrying(false); }
  };
  return (
    <View style={styles.container}>
      {active && !failed && !!uri ? (
        <ActiveCommentVideo uri={uri} onError={playbackError} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={failed || !uri ? 'Retry short video comment' : 'Play short video comment'}
          onPress={failed || !uri ? () => void retry() : () => { stopBuklodCommentVideos(); setActive(true); }}
          disabled={retrying}
          style={styles.cover}
        >
          <MaterialCommunityIcons name={failed || !uri ? 'refresh' : 'play-circle-outline'} color="#FFFFFF" size={44} />
          <Text style={styles.label}>
            {retrying ? 'Refreshing video…' : failed || !uri ? 'Video unavailable · Tap to retry' : 'Play short video'}
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
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#273735' },
});
