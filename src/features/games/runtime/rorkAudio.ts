import { useEffect } from 'react';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { getRorkGameMedia, type RorkAudioKey } from './rorkMedia';

type Player = ReturnType<typeof createAudioPlayer>;

const reactionSound = require('../../../../assets/sounds/buklod-reaction.wav');
const rewardSound = require('../../../../assets/sounds/buklod-points-claim.wav');

const ambienceSources: Partial<Record<RorkAudioKey, number>> = {
  amb_forest: require('../../../../assets/bible-ambience/wind.wav'),
  amb_market: require('../../../../assets/bible-ambience/crowd.wav'),
  amb_harbour: require('../../../../assets/bible-ambience/sea.wav'),
  amb_hall: require('../../../../assets/bible-ambience/night.wav'),
  amb_desert: require('../../../../assets/bible-ambience/wind.wav'),
};

const eventAudio: Record<BuklodGameFeedbackEvent, RorkAudioKey> = {
  move: 'ui_tap',
  collect: 'pickup',
  impact: 'build_hit',
  success: 'success',
  failure: 'retry',
  unlock: 'unlock',
};

const localSfx: Partial<Record<RorkAudioKey, { source: number; rate: number }>> = {
  ui_tap: { source: reactionSound, rate: 1.55 },
  ui_confirm: { source: reactionSound, rate: 1.25 },
  game_enter: { source: reactionSound, rate: 0.95 },
  unlock: { source: rewardSound, rate: 1.18 },
  success: { source: rewardSound, rate: 1.0 },
  retry: { source: reactionSound, rate: 0.55 },
  pickup: { source: reactionSound, rate: 1.85 },
  coins: { source: rewardSound, rate: 1.3 },
  beat_hit: { source: reactionSound, rate: 1.7 },
  beat_combo: { source: rewardSound, rate: 1.25 },
  mission_go: { source: rewardSound, rate: 0.9 },
  build_hit: { source: reactionSound, rate: 0.72 },
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

function createLocalPlayer(source: number, loop = false) {
  try {
    const player = createAudioPlayer(source);
    player.loop = loop;
    return player;
  } catch {
    return null;
  }
}

function poolFor(key: RorkAudioKey) {
  const existing = pools.get(key);
  if (existing) return existing;

  const spec = localSfx[key];
  if (!spec) return [];

  const voices: Player[] = [];
  const count = voiceCount[key] ?? 1;
  for (let index = 0; index < count; index += 1) {
    const player = createLocalPlayer(spec.source, false);
    if (player) voices.push(player);
  }

  if (voices.length) pools.set(key, voices);
  return voices;
}

function playKey(key: RorkAudioKey, volume: number, cooldownMs = 0) {
  const now = Date.now();
  const last = lastPlayedAt.get(key) ?? 0;
  if (cooldownMs > 0 && now - last < cooldownMs) return false;

  const spec = localSfx[key];
  const voices = poolFor(key);
  if (!spec || !voices.length) return false;

  lastPlayedAt.set(key, now);
  const cursor = cursors.get(key) ?? 0;
  cursors.set(key, (cursor + 1) % voices.length);
  const player = voices[cursor % voices.length];
  if (!player.isLoaded) return false;

  try {
    player.volume = volume;
    player.playbackRate = spec.rate;
    void player.seekTo(0).then(() => player.play()).catch(() => player.play());
    return true;
  } catch {
    return false;
  }
}

export function tryPlayRorkGameFeedback(
  event: BuklodGameFeedbackEvent,
  volume = 0.28,
) {
  const key = eventAudio[event];
  const cooldownMs =
    event === 'move'
      ? 160
      : event === 'collect'
        ? 80
        : event === 'impact'
          ? 120
          : 250;

  return playKey(key, volume, cooldownMs);
}

export function playRorkSignatureSfx(
  gameId?: string | null,
  volume = 0.26,
) {
  const media = getRorkGameMedia(gameId);
  if (!media) return false;
  return playKey(media.signature, volume, 180);
}

export function useRorkGameAmbience(gameId?: string | null) {
  useEffect(() => {
    const media = getRorkGameMedia(gameId);
    if (!media) return;

    const source = ambienceSources[media.ambience];
    if (!source) return;

    const player = createLocalPlayer(source, true);
    if (!player) return;

    player.volume = 0.05;
    try {
      player.play();
    } catch {
      // Local ambience is enhancement-only and must never block gameplay.
    }

    return () => {
      try {
        player.remove();
      } catch {
        // Safe cleanup only.
      }
    };
  }, [gameId]);
}
