import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getBuklodSoundSettings, isBuklodGameSoundEnabled, getBuklodGameSoundVolume } from '@/lib/buklodSounds';
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

// The Rork live-preview audio host is not a production asset origin and was
// observed to reject/fail requests in Web. Keep the proven local/synthesized
// BUKLOD feedback path authoritative until the 17 generated clips are vendored
// into this repository as local assets.
const REMOTE_RORK_AUDIO_ENABLED = false;

function createPlayer(source: string, loop = false) {
  if (!REMOTE_RORK_AUDIO_ENABLED) return null;
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

const LOCAL_KINGDOM_AMBIENCE = require('../../../../assets/sounds/buklod-kingdom-ambient-original.wav');

/**
 * The previous preview-host MP3s are unreliable. The original BUKLOD-owned
 * local ambient loop is bundled with the app, works without network and
 * follows the existing game sound/quiet-hours settings. This is decorative:
 * audio loading/playback must never block real gameplay.
 */
export function useRorkGameAmbience(gameId?: string | null) {
  const [musicEnabled, setMusicEnabled] = useState(true);
  useEffect(() => {
    if (!gameId || !musicEnabled) return;
    const media = getRorkGameMedia(gameId);
    let player: Player | null = null;
    try {
      player = media && REMOTE_RORK_AUDIO_ENABLED
        ? createPlayer(RORK_AUDIO[media.ambience], true)
        : createAudioPlayer(LOCAL_KINGDOM_AMBIENCE, { updateInterval: 1000 });
    } catch { return; }
    if (!player) return;
    const audio = player;
    let active = true;
    audio.loop = true;
    const sync = async () => {
      try {
        await getBuklodSoundSettings();
        if (!active) return;
        if (AppState.currentState !== 'active' || !isBuklodGameSoundEnabled()) {
          audio.pause();
          return;
        }
        audio.volume = Math.min(0.14, getBuklodGameSoundVolume() * 0.16);
        if (audio.isLoaded) audio.play();
      } catch {
        // No impact to gameplay if sound assets, platform or autoplay fail.
      }
    };
    // Initial local asset loading is asynchronous. Listen for a ready player
    // instead of losing the first playback attempt.
    let loadedOnce = audio.isLoaded;
    const readyListener = audio.addListener('playbackStatusUpdate', status => {
      if (active && status.isLoaded && !loadedOnce) {
        loadedOnce = true;
        void sync();
      }
    });
    const stateListener = AppState.addEventListener('change', () => { void sync(); });
    void sync();
    return () => {
      active = false;
      readyListener.remove();
      stateListener.remove();
      try { audio.remove(); } catch { /* enhancement only */ }
    };
  }, [gameId, musicEnabled]);
  return { musicEnabled, toggleMusic: () => setMusicEnabled(value => !value) };
}
