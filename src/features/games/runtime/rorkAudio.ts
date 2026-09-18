import { useEffect } from 'react';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { getRorkGameMedia, RORK_AUDIO, type RorkAudioKey } from './rorkMedia';

type Player = ReturnType<typeof createAudioPlayer>;

const eventAudio: Record<BuklodGameFeedbackEvent, RorkAudioKey> = {
  move: 'ui_tap',
  collect: 'pickup',
  impact: 'build_hit',
  success: 'success',
  failure: 'retry',
  unlock: 'unlock',
};

const voiceCount: Partial<Record<RorkAudioKey, number>> = {
  ui_tap: 2,
  ui_confirm: 2,
  pickup: 3,
  coins: 2,
  beat_hit: 4,
  beat_combo: 2,
  mission_go: 2,
  build_hit: 3,
};

const pools = new Map<RorkAudioKey, Player[]>();
const cursors = new Map<RorkAudioKey, number>();
const lastPlayedAt = new Map<RorkAudioKey, number>();

function createPlayer(source: string, loop = false) {
  try {
    const player = createAudioPlayer(source, { downloadFirst: true, updateInterval: 1000 });
    player.loop = loop;
    return player;
  } catch {
    return null;
  }
}

function poolFor(key: RorkAudioKey) {
  const existing = pools.get(key);
  if (existing) return existing;

  const voices: Player[] = [];
  const count = voiceCount[key] ?? 1;
  for (let index = 0; index < count; index += 1) {
    const player = createPlayer(RORK_AUDIO[key], false);
    if (player) voices.push(player);
  }
  if (voices.length) pools.set(key, voices);
  return voices;
}

function playKey(key: RorkAudioKey, volume: number, cooldownMs = 0) {
  const now = Date.now();
  const last = lastPlayedAt.get(key) ?? 0;
  if (cooldownMs > 0 && now - last < cooldownMs) return false;

  const voices = poolFor(key);
  if (!voices.length) return false;

  lastPlayedAt.set(key, now);
  const cursor = cursors.get(key) ?? 0;
  cursors.set(key, (cursor + 1) % voices.length);
  const player = voices[cursor % voices.length];
  if (!player.isLoaded) return false;

  try {
    player.volume = volume;
    player.playbackRate = 1;
    void player.seekTo(0).then(() => player.play()).catch(() => player.play());
    return true;
  } catch {
    return false;
  }
}

export function tryPlayRorkGameFeedback(event: BuklodGameFeedbackEvent, volume = 0.28) {
  const key = eventAudio[event];
  const cooldownMs =
    event === 'move' ? 160 :
    event === 'collect' ? 80 :
    event === 'impact' ? 120 :
    250;
  return playKey(key, volume, cooldownMs);
}

export function playRorkSignatureSfx(gameId?: string | null, volume = 0.26) {
  const media = getRorkGameMedia(gameId);
  if (!media) return false;
  return playKey(media.signature, volume, 180);
}

export function useRorkGameAmbience(gameId?: string | null) {
  useEffect(() => {
    const media = getRorkGameMedia(gameId);
    if (!media) return;

    const player = createPlayer(RORK_AUDIO[media.ambience], true);
    if (!player) return;

    player.volume = 0.075;
    try {
      player.play();
    } catch {
      // Ambience is decorative and must fail closed when autoplay/network fails.
    }

    return () => {
      try { player.remove(); } catch { /* enhancement only */ }
    };
  }, [gameId]);
}
