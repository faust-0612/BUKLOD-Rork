import { useEffect, useRef } from 'react';
import { createAudioPlayer, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import { requestBuklodAudioFocus, subscribeBuklodAudioFocus } from '@/lib/buklodAudioFocus';
import { resolveBuklodPostMusicUrl, type BuklodPostMusicTrack } from '@/lib/buklodPostCreatives';

export type MaritesMusicPlaybackState = { playing: boolean; duration: number; error: string };

type Props = {
  track: BuklodPostMusicTrack | null;
  startSeconds: number;
  active: boolean;
  onPlaybackChange?: (status: MaritesMusicPlaybackState) => void;
  onInterrupted?: () => void;
};

/**
 * Lazy, foreground-only 30-second story soundtrack. Never mount a decoder
 * for a Marites feed preview; the parent enables this only for Full View or
 * an explicit composer preview. A stale signed-URL request cannot play.
 */
export default function BuklodMaritesStoryAudio({
  track, startSeconds, active, onPlaybackChange, onInterrupted,
}: Props) {
  const onPlaybackRef = useRef(onPlaybackChange);
  const onInterruptedRef = useRef(onInterrupted);
  onPlaybackRef.current = onPlaybackChange;
  onInterruptedRef.current = onInterrupted;

  useEffect(() => {
    let disposed = false;
    let player: AudioPlayer | null = null;
    let listener: { remove: () => void } | null = null;
    let seeking = false;
    const clipStart = Math.max(0, Math.min(21600, Number(startSeconds) || 0));
    const emit = (playing: boolean, duration = 0, error = '') =>
      onPlaybackRef.current?.({ playing, duration, error });
    const cleanup = () => {
      disposed = true;
      try { listener?.remove(); } catch { /* already detached */ }
      listener = null;
      if (player) {
        try { player.pause(); } catch { /* player already released */ }
        try { player.release(); } catch { /* player already released */ }
        player = null;
      }
    };
    if (!active || !track) {
      emit(false);
      return cleanup;
    }

    const unsubscribe = subscribeBuklodAudioFocus(owner => {
      if (owner !== 'marites-story' && !disposed) {
        cleanup();
        emit(false);
        onInterruptedRef.current?.();
      }
    });

    void (async () => {
      // Keep the system's existing audio mode (PTT, video, radio) unchanged.
      await setIsAudioActiveAsync(true);
      const url = await resolveBuklodPostMusicUrl(track);
      if (disposed) return;
      const instance = createAudioPlayer(url);
      player = instance;
      instance.loop = false;
      instance.volume = 1;
      listener = instance.addListener('playbackStatusUpdate', status => {
        if (disposed) return;
        if (status.isLoaded && (status.didJustFinish ||
          status.currentTime >= Math.min(
            status.duration > 0 ? status.duration : clipStart + 30,
            clipStart + 30,
          ) - 0.12) && !seeking) {
          seeking = true;
          void instance.seekTo(clipStart).then(() => {
            if (!disposed) instance.play();
          }).catch(() => {
            if (!disposed) {
              cleanup();
              emit(false, status.duration, 'Music playback stopped.');
            }
          }).finally(() => { seeking = false; });
        }
      });
      const begin = Date.now();
      while (!disposed && !instance.isLoaded && Date.now() - begin < 6500) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
      }
      if (disposed) return;
      if (!instance.isLoaded) throw new Error('Music could not load. Tap to retry.');
      if (instance.duration > 0 && clipStart >= instance.duration) {
        throw new Error('The selected music clip is outside the song.');
      }
      await instance.seekTo(clipStart);
      if (disposed) return;
      requestBuklodAudioFocus('marites-story');
      instance.play();
      emit(true, instance.duration);
    })().catch(error => {
      if (!disposed) {
        cleanup();
        emit(false, 0, String((error as Error)?.message ?? 'Music unavailable.'));
      }
    });

    return () => { unsubscribe(); cleanup(); };
  }, [active, track?.id, track?.audio_path, startSeconds]);

  return null;
}
