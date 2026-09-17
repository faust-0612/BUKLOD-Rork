import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

type Props = { uri: string; height?: number; autoPlay?: boolean };

export function CommunityVideo({ uri, height = 380, autoPlay = false }: Props) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri, instance => { instance.loop = false; });

  useEffect(() => {
    setReady(false);
    const subscription = player.addListener('statusChange', event => {
      if (event.status === 'readyToPlay') setReady(true);
    });
    try {
      if (autoPlay) player.play();
      else player.pause();
    } catch {}
    return () => {
      subscription.remove();
      try { player.pause(); } catch {}
    };
  }, [autoPlay, player, uri]);

  return (
    <View style={[styles.wrap, { height }]}>
      {!ready && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="rgba(255,255,255,0.78)" /></View>}
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#050807', marginTop: 12, position: 'relative' },
  video: { width: '100%', height: '100%' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050807', zIndex: 1 },
});
