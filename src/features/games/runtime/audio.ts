import { useMemo } from 'react';
import { useAudioPlayer } from 'expo-audio';

export type BuklodGameAudioSources = {
  ambience?: number | string | null;
  music?: number | string | null;
  collect?: number | string | null;
  impact?: number | string | null;
  success?: number | string | null;
  failure?: number | string | null;
};

export function useBuklodGameAudio(sources: BuklodGameAudioSources) {
  const ambience = useAudioPlayer(sources.ambience ?? null, { downloadFirst: true });
  const music = useAudioPlayer(sources.music ?? null, { downloadFirst: true });
  const collect = useAudioPlayer(sources.collect ?? null, { downloadFirst: true });
  const impact = useAudioPlayer(sources.impact ?? null, { downloadFirst: true });
  const success = useAudioPlayer(sources.success ?? null, { downloadFirst: true });
  const failure = useAudioPlayer(sources.failure ?? null, { downloadFirst: true });

  return useMemo(
    () => ({
      startWorld() {
        ambience.loop = true;
        ambience.volume = 0.42;
        music.loop = true;
        music.volume = 0.34;
        ambience.play();
        music.play();
      },
      stopWorld() {
        ambience.pause();
        music.pause();
      },
      playCollect() {
        collect.seekTo(0).catch(() => undefined);
        collect.play();
      },
      playImpact() {
        impact.seekTo(0).catch(() => undefined);
        impact.play();
      },
      playSuccess() {
        success.seekTo(0).catch(() => undefined);
        success.play();
      },
      playFailure() {
        failure.seekTo(0).catch(() => undefined);
        failure.play();
      },
    }),
    [ambience, collect, failure, impact, music, success],
  );
}
