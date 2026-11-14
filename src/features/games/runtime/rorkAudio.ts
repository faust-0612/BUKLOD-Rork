import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getBuklodSoundSettings, isBuklodGameSoundEnabled, getBuklodGameSoundVolume } from '@/lib/buklodSounds';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { getRorkGameMedia, RORK_AUDIO, type RorkAudioKey } from './rorkMedia';
import { getPremiumKingdomMusic, getPremiumKingdomSfx } from './kingdomPremiumAudioAssets';

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
const startedVoices = new WeakSet<Player>();
let focusedKingdomViews = 0;

function releaseKingdomSfx() {
  for (const voices of pools.values()) {
    for (const player of voices) {
      try { player.pause(); } catch { /* already stopped */ }
      try { player.remove(); } catch { /* optional cue */ }
    }
  }
  pools.clear();
  cursors.clear();
  lastPlayedAt.clear();
}

function prewarmKingdomSfx() {
  for (const key of ['ui_tap', 'pickup', 'build_hit', 'success', 'retry', 'unlock'] as const) poolFor(key);
}

// The Rork live-preview audio host is not a production asset origin and was
// observed to reject/fail requests in Web. Keep the proven local/synthesized
// BUKLOD feedback path authoritative until the 17 generated clips are vendored
// into this repository as local assets.
const REMOTE_RORK_AUDIO_ENABLED = false; // Strictly forbid deprecated preview-host music.

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
  const source = getPremiumKingdomSfx(key);
  if (source == null) return voices;
  const count = Math.min(voiceCount[key] ?? 1, 3);
  for (let index = 0; index < count; index += 1) {
    try {
      voices.push(createAudioPlayer(source, { updateInterval: 200 }));
    } catch {
      // Gameplay remains functional if optional audio initialization fails.
    }
  }
  if (voices.length) pools.set(key, voices);
  return voices;
}

function playKey(key: RorkAudioKey, volume: number, cooldownMs = 0) {
  if (focusedKingdomViews === 0 || AppState.currentState !== 'active') return false;
  const now = Date.now();
  const last = lastPlayedAt.get(key) ?? 0;
  if (cooldownMs > 0 && now - last < cooldownMs) return false;

  const voices = poolFor(key);
  if (!voices.length) return false;

  lastPlayedAt.set(key, now);
  const cursor = cursors.get(key) ?? 0;
  cursors.set(key, (cursor + 1) % voices.length);
  const player = voices[cursor % voices.length];
  // Prewarming happens on focused Kingdom screens. If the first cue is still
  // decoding, prefer haptics over the old notification/ringtone fallback.
  if (!player.isLoaded) return true;

  try {
    player.volume = Math.min(0.48, Math.max(0, volume) * 0.75);
    player.playbackRate = 1;
    // New player: start synchronously; reused pool voice: reset position.
    if (!startedVoices.has(player)) {
      startedVoices.add(player);
      player.play();
    } else {
      void player.seekTo(0).then(() => {
        if (focusedKingdomViews > 0 && AppState.currentState === 'active') player.play();
      }).catch(() => undefined);
    }
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

// Original, seamlessly looping warm cinematic pad (no remote host, no paid AI).
const LOCAL_KINGDOM_AMBIENCE = require('../../../../assets/sounds/buklod-kingdom-cinematic-ambient.wav');
const KINGDOM_AMBIENCE_SETTING_KEY = '@buklod_kingdom_cinematic_ambience_v1';

/**
 * The previous preview-host MP3s are unreliable. The original BUKLOD-owned
 * local ambient loop is bundled with the app, works without network and
 * follows the existing game sound/quiet-hours settings. This is decorative:
 * audio loading/playback must never block real gameplay.
 */
export function useRorkGameAmbience(gameId?: string | null) {
  // Opt-in avoids surprising playback and the previously reported harsh intro.
  // Keep legacy interior-game audio behavior unchanged; only the main map is opt-in.
  const isKingdomMap = gameId === 'kingdom-map';
  const [musicEnabled, setMusicEnabled] = useState(!isKingdomMap);
  useEffect(() => {
    if (!isKingdomMap) return;
    let live = true;
    void AsyncStorage.getItem(KINGDOM_AMBIENCE_SETTING_KEY)
      .then(value => { if (live) setMusicEnabled(value === 'on'); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [isKingdomMap]);
  // Keep native SFX players warm while a Kingdom route is actually focused.
  // Never let late feedback leak into Wall videos, calls or other app screens.
  useFocusEffect(useCallback(() => {
    if (!gameId) return;
    focusedKingdomViews += 1;
    prewarmKingdomSfx();
    return () => {
      focusedKingdomViews = Math.max(0, focusedKingdomViews - 1);
      if (focusedKingdomViews === 0) releaseKingdomSfx();
    };
  }, [gameId]));
  // Expo Router can keep inactive game screens mounted in its stack. This
  // effect is owned by *navigation focus*, not just React mount lifetime.
  // On every blur (Home, Wall, Connect, another game) the Kingdom-only
  // player is immediately paused and disposed; other app audio is untouched.
  useFocusEffect(useCallback(() => {
    if (!gameId || !musicEnabled) return;
    const media = getRorkGameMedia(gameId);
    let player: Player | null = null;
    try {
      // Composer-made, source-verified local music; original BUKLOD WAV kept
      // as a compatibility reference, never used as the primary soundtrack.
      const source = getPremiumKingdomMusic(gameId, media?.ambience);
      player = createAudioPlayer(source ?? LOCAL_KINGDOM_AMBIENCE, { updateInterval: 500 });
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
        audio.volume = Math.min(0.16, getBuklodGameSoundVolume() * 0.55);
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
      // Invalidate pending hydration/status callbacks before release to avoid
      // late replay of the loop after a rapid back/forward navigation.
      active = false;
      readyListener.remove();
      stateListener.remove();
      try { audio.pause(); } catch { /* already disposed or unavailable */ }
      try { audio.remove(); } catch { /* enhancement only */ }
    };
  }, [gameId, musicEnabled]));
  return { musicEnabled, toggleMusic: () => setMusicEnabled(value => {
    const next = !value;
    if (isKingdomMap) {
      void AsyncStorage.setItem(KINGDOM_AMBIENCE_SETTING_KEY, next ? 'on' : 'off').catch(() => undefined);
    }
    return next;
  }) };
}
