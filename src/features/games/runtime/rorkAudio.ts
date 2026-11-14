import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getBuklodSoundSettings, isBuklodGameSoundEnabled, getBuklodGameSoundVolume } from '@/lib/buklodSounds';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { getRorkGameMedia, type RorkAudioKey } from './rorkMedia';

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
const perVoiceGeneration = new WeakMap<Player, number>();

// All cues are CC0, pinned, and bundled offline. The remote preview host is not used.
const LOCAL_CUES: Record<RorkAudioKey, number> = {
  ui_tap: require('../../../../assets/sounds/kingdom-premium/click.mp3'),
  ui_confirm: require('../../../../assets/sounds/kingdom-premium/tick.mp3'),
  game_enter: require('../../../../assets/sounds/kingdom-premium/riser.mp3'),
  unlock: require('../../../../assets/sounds/kingdom-premium/riser.mp3'),
  success: require('../../../../assets/sounds/kingdom-premium/riser.mp3'),
  retry: require('../../../../assets/sounds/kingdom-premium/whoosh.mp3'),
  pickup: require('../../../../assets/sounds/kingdom-premium/pop.mp3'),
  coins: require('../../../../assets/sounds/kingdom-premium/pop.mp3'),
  beat_hit: require('../../../../assets/sounds/kingdom-premium/tick.mp3'),
  beat_combo: require('../../../../assets/sounds/kingdom-premium/pop.mp3'),
  mission_go: require('../../../../assets/sounds/kingdom-premium/whoosh.mp3'),
  build_hit: require('../../../../assets/sounds/kingdom-premium/impact.mp3'),
  amb_forest: require('../../../../assets/sounds/kingdom-premium/kingdom-score.mp3'),
  amb_market: require('../../../../assets/sounds/kingdom-premium/kingdom-score.mp3'),
  amb_harbour: require('../../../../assets/sounds/kingdom-premium/kingdom-score.mp3'),
  amb_hall: require('../../../../assets/sounds/kingdom-premium/kingdom-score.mp3'),
  amb_desert: require('../../../../assets/sounds/kingdom-premium/kingdom-score.mp3'),
};
let soundSession = 0;
function preloadCues() {
  for (const key of ['ui_tap','pickup','build_hit','success','retry','unlock'] as const) poolFor(key);
}
function silenceCues() {
  soundSession++;
  for (const voices of pools.values()) for (const p of voices) {
    perVoiceGeneration.set(p, (perVoiceGeneration.get(p) ?? 0) + 1);
    try { p.pause(); p.remove(); } catch { /* optional game sound */ }
  }
  pools.clear();
  cursors.clear();
}

function createPlayer(source: number, loop = false) {
  try {
    const player = createAudioPlayer(source, { updateInterval: 1000 });
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
    const player = createPlayer(LOCAL_CUES[key], false);
    if (player) voices.push(player);
  }
  if (voices.length) pools.set(key, voices);
  return voices;
}

function playKey(key: RorkAudioKey, volume: number, cooldownMs = 0) {
  if (AppState.currentState !== 'active' || !isBuklodGameSoundEnabled()) return false;
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
    player.volume = Math.min(0.38, Math.max(0, volume * (key === 'ui_tap' ? 0.6 : 0.86)));
    player.playbackRate = 1;
    const session = soundSession;
    const generation = (perVoiceGeneration.get(player) ?? 0) + 1;
    perVoiceGeneration.set(player, generation);
    player.pause();
    void player.seekTo(0).then(() => {
      if (session === soundSession && perVoiceGeneration.get(player) === generation &&
          AppState.currentState === 'active' && isBuklodGameSoundEnabled()) player.play();
    }).catch(() => undefined);
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

// Real CC0 orchestral recording, circular-crossfaded and bundled offline.
const LOCAL_KINGDOM_AMBIENCE = require('../../../../assets/sounds/kingdom-premium/kingdom-score.mp3');
const KINGDOM_AMBIENCE_SETTING_KEY = '@buklod_kingdom_cinematic_ambience_v1';

/**
 * No preview-host audio: this licensed CC0 orchestral loop is bundled
 * with the app, works without network and
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
  // Preload event SFX even when the map music preference remains opt-in.
  useFocusEffect(useCallback(() => {
    if (!gameId) return;
    preloadCues();
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') silenceCues();
    });
    return () => { listener.remove(); silenceCues(); };
  }, [gameId]));
  // Expo Router can keep inactive game screens mounted in its stack. This
  // effect is owned by *navigation focus*, not just React mount lifetime.
  // On every blur (Home, Wall, Connect, another game) the Kingdom-only
  // player is immediately paused and disposed; other app audio is untouched.
  useFocusEffect(useCallback(() => {
    if (!gameId || !musicEnabled) return;
    let player: Player | null = null;
    try { player = createAudioPlayer(LOCAL_KINGDOM_AMBIENCE, { updateInterval: 500 }); }
    catch { return; }
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
        audio.volume = Math.min(0.16, getBuklodGameSoundVolume() * 0.33);
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
