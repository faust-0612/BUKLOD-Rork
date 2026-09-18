import { useEffect } from 'react';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { getRorkGameMedia, RORK_AUDIO, type RorkAudioKey } from './rorkMedia';

const eventAudio: Record<BuklodGameFeedbackEvent, RorkAudioKey> = {
  move: 'ui_tap',
  collect: 'pickup',
  impact: 'build_hit',
  success: 'success',
  failure: 'retry',
  unlock: 'unlock',
};

function playAsset(source: number, volume: number, loop = false) {
  try {
    const player = createAudioPlayer(source);
    player.volume = volume;
    player.loop = loop;
    void player.seekTo(0).then(() => player.play()).catch(() => player.play());
    return player;
  } catch {
    return null;
  }
}

export function tryPlayRorkGameFeedback(event: BuklodGameFeedbackEvent, volume = 0.28) {
  const key = eventAudio[event];
  const player = playAsset(RORK_AUDIO[key], volume, false);
  if (!player) return false;
  setTimeout(() => {
    try { player.remove(); } catch { /* enhancement only */ }
  }, event === 'success' || event === 'unlock' ? 2400 : 1500);
  return true;
}

export function playRorkSignatureSfx(gameId?: string | null, volume = 0.26) {
  const media = getRorkGameMedia(gameId);
  if (!media) return false;
  const player = playAsset(RORK_AUDIO[media.signature], volume, false);
  if (!player) return false;
  setTimeout(() => {
    try { player.remove(); } catch { /* enhancement only */ }
  }, 1800);
  return true;
}

export function useRorkGameAmbience(gameId?: string | null) {
  useEffect(() => {
    const media = getRorkGameMedia(gameId);
    if (!media) return;
    const player = playAsset(RORK_AUDIO[media.ambience], 0.075, true);
    return () => {
      try { player?.remove(); } catch { /* enhancement only */ }
    };
  }, [gameId]);
}
