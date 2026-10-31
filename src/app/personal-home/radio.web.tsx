import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import DzasSignalDeck from '@/components/dzas/DzasSignalDeck';

const DZAS_STREAM_URL = String(
  process.env.EXPO_PUBLIC_DZAS_STREAM_URL ||
    'https://sg-icecast.eradioportal.com:8443/febc_dzas',
).trim();

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
      if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;

      const mediaError = audio.error;
      const code = Number(mediaError?.code || 0);

      setPlaying(false);
      setBusy(false);
      setStatusText('Stream error');

      setError(
        code
          ? `Hindi ma-play ng browser ang DZAS stream ngayon (media error ${code}). Tap Retry.`
          : 'Hindi ma-play ng browser ang DZAS stream ngayon. Tap Retry.',
      );
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('error', onError);

    return () => {
      mountedRef.current = false;

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

  const play = async (forceReload = false) => {
    const audio = audioRef.current;

    if (!audio || !DZAS_STREAM_URL) {
      setError('Walang available DZAS browser stream.');
      return;
    }

    setBusy(true);
    setError('');
    setStatusText('Connecting...');

    try {
      /*
       * Keep play() directly inside the user-triggered action so Android/iOS
       * browser/PWA autoplay policies recognize this as an intentional start.
       */
      const needsSource =
        forceReload ||
        audio.getAttribute('src') !==
          DZAS_STREAM_URL;

      if (needsSource) {
        try {
          audio.pause();
        } catch {
          // no-op
        }

        audio.src = DZAS_STREAM_URL;
        audio.preload = 'none';
        audio.volume = 1;
        audio.muted = false;
        audio.load();
      } else {
        audio.volume = 1;
        audio.muted = false;
      }

      setMediaSession();

      const promise = audio.play();

      if (
        promise &&
        typeof promise.then === 'function'
      ) {
        await promise;
      }

      if (mountedRef.current) {
        setPlaying(!audio.paused);
        setBusy(false);
        setStatusText(audio.paused ? 'Ready' : 'LIVE');
      }
    } catch (playError: any) {
      if (!mountedRef.current) return;

      const message = String(playError?.message || '').trim();

      setPlaying(false);
      setBusy(false);
      setStatusText('Could not play');
      setError(
        message ||
          'Hindi mabuksan ang DZAS audio stream. Tap Retry o buksan ang official DZAS site.',
      );
    }
  };

  const pause = () => {
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
