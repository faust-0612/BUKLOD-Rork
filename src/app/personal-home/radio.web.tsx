import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import DzasSignalDeck from '@/components/dzas/DzasSignalDeck';

// Prefer the stream already used by native; retain the legacy web Icecast
// source as fallback. Explicit HTTPS deployment overrides are tried first.
const DZAS_STREAM_URLS = Array.from(new Set([
  String(process.env.EXPO_PUBLIC_DZAS_STREAM_URL || '').trim(),
  'https://stream.zeno.fm/rrw3tw8yheruv',
  'https://sg-icecast.eradioportal.com:8443/febc_dzas',
].filter((url) => /^https:\/\/[^\s]+$/i.test(url))));
const START_TIMEOUT_MS = 12000;

const DZAS_FAVORITE_KEY = 'buklod.radio.favorite.702dzas';

/*
 * BUKLOD_DZAS_WEB_NATIVE_AUDIO_R2
 *
 * Web/PWA intentionally uses the browser's HTMLAudioElement for the raw
 * Icecast audio/mpeg stream. The shared radio.tsx remains the native APK/iOS
 * implementation with expo-audio.
 */
export default function BuklodRadioWebScreen() {
  const audioRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const playbackRequestRef = useRef(0);
  const cancelStartupRef = useRef<null | (() => void)>(null);

  const [favorite, setFavorite] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Ready');

  useEffect(() => {
    mountedRef.current = true;

    void AsyncStorage.getItem(DZAS_FAVORITE_KEY).then((value) => {
      if (mountedRef.current) {
        setFavorite(value === '1');
      }
    });

    const AudioCtor =
      typeof window !== 'undefined'
        ? (window as any).Audio
        : null;

    const audio =
      typeof AudioCtor === 'function'
        ? new AudioCtor()
        : null;

    if (!audio) {
      setError('Hindi available ang browser audio player sa device na ito.');
      return () => {
        mountedRef.current = false;
      };
    }

    audioRef.current = audio;
    audio.preload = 'none';
    audio.volume = 1;
    audio.muted = false;

    const onPlaying = () => {
      if (!mountedRef.current) return;
      setPlaying(true);
      setBusy(false);
      setError('');
      setStatusText('LIVE');
    };

    const onPause = () => {
      if (!mountedRef.current || cancelStartupRef.current) return;
      setPlaying(false);
      setBusy(false);
      setStatusText('Paused');
    };

    const onWaiting = () => {
      if (!mountedRef.current) return;
      setBusy(true);
      setStatusText('Buffering...');
    };

    const onCanPlay = () => {
      if (!mountedRef.current) return;
      setStatusText(current =>
        current === 'LIVE' ? current : 'Connected',
      );
    };

    const onStalled = () => {
      if (!mountedRef.current) return;
      setBusy(true);
      setStatusText('Reconnecting...');
    };

    const onError = () => {
      // Startup errors are handled by bounded source fallback instead.
      if (!mountedRef.current || cancelStartupRef.current) return;
      setPlaying(false);
      setBusy(false);
      setStatusText('Stream interrupted');
      setError('Naputol ang DZAS stream. Tap Retry o Source para sa official station.');
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('error', onError);

    return () => {
      mountedRef.current = false;
      playbackRequestRef.current += 1;
      cancelStartupRef.current?.();

      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('error', onError);

      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Best-effort browser cleanup.
      }

      audioRef.current = null;
    };
  }, []);

  const setMediaSession = () => {
    try {
      const mediaSession =
        typeof navigator !== 'undefined'
          ? (navigator as any).mediaSession
          : null;

      const MediaMetadataCtor =
        typeof window !== 'undefined'
          ? (window as any).MediaMetadata
          : null;

      if (mediaSession && MediaMetadataCtor) {
        mediaSession.metadata =
          new MediaMetadataCtor({
            title: '702 DZAS',
            artist: 'FEBC Philippines',
            album: 'BUKLOD Radio Live',
          });
      }
    } catch {
      // Media Session metadata is optional.
    }
  };

  // Per-source timeout, deterministic cleanup, and cancellation on pause/unmount.
  const startSource = (audio: any, url: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (reason?: Error) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('error', onError);
        if (cancelStartupRef.current === cancel) cancelStartupRef.current = null;
        if (reason) reject(reason);
        else resolve();
      };
      const onPlaying = () => finish();
      const onError = () =>
        finish(new Error('Source rejected (media error ' + Number(audio.error?.code || 0) + ').'));
      const cancel = () => finish(new Error('Playback cancelled.'));

      audio.addEventListener('playing', onPlaying);
      audio.addEventListener('error', onError);
      cancelStartupRef.current = cancel;
      timeout = setTimeout(() => finish(new Error('Stream startup timed out.')), START_TIMEOUT_MS);

      try {
        audio.pause();
        audio.src = url;
        audio.preload = 'none';
        audio.volume = 1;
        audio.muted = false;
        audio.load();
        // First attempt begins synchronously during the user tap.
        const started = audio.play();
        if (started && typeof started.catch === 'function') {
          void started.catch((reason: unknown) =>
            finish(reason instanceof Error ? reason : new Error(String(reason))),
          );
        }
      } catch (reason) {
        finish(reason instanceof Error ? reason : new Error(String(reason)));
      }
    });

  const play = async (forceReload = false) => {
    const audio = audioRef.current;
    if (!audio || DZAS_STREAM_URLS.length === 0) {
      setError('Walang available na DZAS browser stream. Tap Source para sa official station.');
      return;
    }
    if (!forceReload && !audio.paused && !audio.error) return;

    playbackRequestRef.current += 1;
    const requestId = playbackRequestRef.current;
    cancelStartupRef.current?.();
    setBusy(true);
    setError('');
    setStatusText('Connecting...');
    setMediaSession();

    let permissionBlocked = false;
    for (const url of DZAS_STREAM_URLS) {
      if (!mountedRef.current || requestId !== playbackRequestRef.current) return;
      try {
        await startSource(audio, url);
        if (!mountedRef.current || requestId !== playbackRequestRef.current) return;
        setPlaying(!audio.paused);
        setBusy(false);
        setStatusText(audio.paused ? 'Ready' : 'LIVE');
        return;
      } catch (reason: any) {
        if (!mountedRef.current || requestId !== playbackRequestRef.current) return;
        // Source switching cannot resolve browser gesture/permission denial.
        if (reason?.name === 'NotAllowedError') {
          permissionBlocked = true;
          break;
        }
      }
    }
    if (!mountedRef.current || requestId !== playbackRequestRef.current) return;
    audio.pause();
    setPlaying(false);
    setBusy(false);
    setStatusText('Stream unavailable');
    setError(permissionBlocked
      ? 'Kailangan ng browser ng bagong Play tap. Tap Retry para subukan muli.'
      : 'Hindi ma-play ang DZAS stream sa mga available na source. Tap Retry o Source para sa official DZAS station.');
  };

  const pause = () => {
    playbackRequestRef.current += 1;
    cancelStartupRef.current?.();
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      setPlaying(false);
      setBusy(false);
      setStatusText('Paused');
    } catch {
      // no-op
    }
  };

  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);

    void AsyncStorage.setItem(
      DZAS_FAVORITE_KEY,
      next ? '1' : '0',
    );
  };

  return (
    <DzasSignalDeck
      playing={playing}
      busy={busy}
      buffering={busy && !playing}
      error={error}
      favorite={favorite}
      onPlay={() => void play(false)}
      onPause={pause}
      onRetry={() => void play(true)}
      onFavorite={toggleFavorite}
    />
  );
}
