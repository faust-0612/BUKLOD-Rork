import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { useFocusEffect } from 'expo-router';

import { otherAudioPlaying } from '@/lib/kabihasnang-ligaw/externalAudioState';
import { closeKlAudioPlayer, runKlAudioCommand } from '@/lib/kabihasnang-ligaw/audioPlayerLifecycle';
import { klEditorRenderSignature } from '@/lib/kabihasnang-ligaw/editorCrashDiagnostics';
import { reportBuklodMainHealthIssue } from '@/lib/buklodMainHealth';

type Props = { music?: string; ambient?: string; showWhenEmpty?: boolean; autoPlay?: boolean };
type NativePlayer = ReturnType<typeof createAudioPlayer>;

class ChapterAudioBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error) {
    // Log a stable, privacy-safe signature; never send private signed media URLs.
    void reportBuklodMainHealthIssue({
      category: 'ROUTE', severity: 'ERROR', safeErrorCode: 'SYS-500',
      errorSignature: klEditorRenderSignature(error),
      correlationKey: 'BUKLOD_KL_AUDIO_RENDER_EXCEPTION',
      routeModule: 'kabihasnang-ligaw/audio',
      knownIncidentHint: 'KL_CHAPTER_AUDIO',
      localSelfHealAttempted: false, localSelfHealResult: 'NOT_ATTEMPTED',
      privacyClassification: 'OPERATIONAL',
    }).catch(() => undefined);
  }

  render() {
    return this.state.failed ? (
      <Text accessibilityRole="alert" style={{ color: '#c9d9e2' }}>
        Chapter audio is unavailable. You can continue reading without audio.
      </Text>
    ) : this.props.children;
  }
}

function ChapterAudioControls({ music, ambient, autoPlay = false }: Pick<Props, 'music' | 'ambient' | 'autoPlay'>) {
  const playerRef = useRef<NativePlayer | null>(null);
  const [routeFocused, setRouteFocused] = useState(true);
  const lastSourcesRef = useRef([music, ambient]);
  const autoAttemptedRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [track, setTrack] = useState<'music' | 'ambient'>('music');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    setRouteFocused(true);
    return () => {
      const player = playerRef.current;
      if (player) runKlAudioCommand(() => player.pause());
      setRouteFocused(false);
      setEnabled(false);
    };
  }, []));

  useEffect(() => {
    // Own the player explicitly: expo-audio's hook may release native state before
    // later cleanup effects execute in SDK 57. Pause BEFORE calling release.
    let player: NativePlayer;
    try {
      player = createAudioPlayer(null);
      playerRef.current = player;
    } catch {
      setError('Audio is temporarily unavailable. Reading is still available.');
      return;
    }
    return () => {
      if (playerRef.current === player) playerRef.current = null;
      closeKlAudioPlayer(player);
    };
  }, []);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      const player = playerRef.current;
      if (player) runKlAudioCommand(() => player.pause());
      setEnabled(false);
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!routeFocused || !autoPlay || autoAttemptedRef.current || (!music && !ambient)) return;
    const player = playerRef.current;
    if (!player || AppState.currentState !== 'active') return;
    autoAttemptedRef.current = true;
    if (otherAudioPlaying()) {
      setError('May ibang audio na tumutugtog. Pindutin ang Patugtugin kung gusto mong makinig dito.');
      return;
    }
    const uri = music ?? ambient;
    const started = runKlAudioCommand(() => {
      player.replace({ uri: uri as string });
      player.loop = true;
      player.volume = muted ? 0 : 0.35;
      player.play();
    });
    setEnabled(started);
    setError(started ? '' : 'Hindi awtomatikong tumugtog. Pindutin ang Patugtugin upang subukan muli.');
  }, [routeFocused, autoPlay, music, ambient]);

  useEffect(() => {
    const [oldMusic, oldAmbient] = lastSourcesRef.current;
    if (oldMusic === music && oldAmbient === ambient) return;
    lastSourcesRef.current = [music, ambient];
    const player = playerRef.current;
    if (player) runKlAudioCommand(() => player.pause());
    setEnabled(false);
  }, [music, ambient]);

  useEffect(() => {
    if (routeFocused) return;
    const player = playerRef.current;
    if (player) runKlAudioCommand(() => player.pause());
    setEnabled(false);
  }, [routeFocused]);

  const toggle = () => {
    const player = playerRef.current;
    if (!routeFocused) return;
    if (!player) { setError('Audio is temporarily unavailable. Reading is still available.'); return; }
    if (enabled) {
      if (!runKlAudioCommand(() => player.pause())) setError('Audio could not pause.');
      setEnabled(false);
      return;
    }
    if (otherAudioPlaying()) {
      setError('Another audio is playing. Pause it before starting chapter audio.');
      return;
    }
    const uri = track === 'music' ? (music ?? ambient) : (ambient ?? music);
    if (!uri) return;
    if (!runKlAudioCommand(() => {
      player.replace({ uri });
      player.loop = true;
      player.volume = muted ? 0 : 0.35;
      player.play();
    })) {
      setError('Unable to play chapter audio. You can continue reading.');
      setEnabled(false);
      return;
    }
    setError('');
    setEnabled(true);
  };

  const switchTrack = () => {
    const player = playerRef.current;
    if (player) runKlAudioCommand(() => player.pause());
    setEnabled(false);
    setTrack((current) => current === 'music' ? 'ambient' : 'music');
  };

  const toggleMute = () => {
    const next = !muted;
    const player = playerRef.current;
    if (player && !runKlAudioCommand(() => { player.volume = next ? 0 : 0.35; })) {
      setError('Audio volume control is unavailable.');
    }
    setMuted(next);
  };

  return (
    <View style={{ gap: 8, paddingVertical: 8 }}>
      <Text style={{ color: '#c9d9e2' }}>
        {music ? 'Music ready' : 'No music uploaded'} · {ambient ? 'Ambience ready' : 'No ambience uploaded'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={(event) => { event.stopPropagation(); toggle(); }}
          style={{ padding: 10, borderRadius: 8, backgroundColor: '#355b4f' }}>
          <Text style={{ color: '#fff' }}>{enabled ? 'Pause scene audio' : 'Play scene audio'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!music || !ambient}
          onPress={(event) => { event.stopPropagation(); switchTrack(); }}
          style={{ padding: 10, borderRadius: 8, backgroundColor: '#334a59' }}>
          <Text style={{ color: '#fff' }}>{track === 'music' ? 'Music' : 'Ambience'} (switch)</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={(event) => { event.stopPropagation(); toggleMute(); }}
          style={{ padding: 10, borderRadius: 8, backgroundColor: '#334a59' }}>
          <Text style={{ color: '#fff' }}>{muted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: '#ffd6aa' }}>{error}</Text> : null}
    </View>
  );
}

export default function KlChapterAudio({ music, ambient, showWhenEmpty = false, autoPlay = false }: Props) {
  // Avoid allocating a native player for every empty chapter preview/editor widget.
  if (!music && !ambient) {
    return showWhenEmpty ? (
      <Text style={{ color: '#c9d9e2' }}>No music or ambience uploaded.</Text>
    ) : null;
  }
  return (
    <ChapterAudioBoundary>
      <ChapterAudioControls music={music} ambient={ambient} autoPlay={autoPlay} />
    </ChapterAudioBoundary>
  );
}
