/** Focus-owned Kingdom Adventure soundboard.
 * Uses the existing vetted/offline CC0 audio assets. No notification chirps,
 * synthesized tones or streaming URLs; muted when app/calls/settings demand.
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { getBuklodSoundSettings, getBuklodGameSoundVolume, isBuklodGameSoundEnabled } from '@/lib/buklodSounds';
import { ADVENTURE_CUE_SOUND, ADVENTURE_MOTION, type AdventureCue, type PremiumSfxKey } from '@/lib/kingdomAdventurePresentation';

type Player = ReturnType<typeof createAudioPlayer>;
const SOURCES: Readonly<Record<PremiumSfxKey, number>> = {
  enter: require('../../../../assets/sounds/kingdom-premium/enter.wav'),
  'collect-crystal': require('../../../../assets/sounds/kingdom-premium/collect-crystal.wav'),
  coins: require('../../../../assets/sounds/kingdom-premium/coins.wav'),
  unlock: require('../../../../assets/sounds/kingdom-premium/unlock.wav'),
  victory: require('../../../../assets/sounds/kingdom-premium/victory.wav'),
  'victory-alt': require('../../../../assets/sounds/kingdom-premium/victory-alt.wav'),
  'ui-soft': require('../../../../assets/sounds/kingdom-premium/ui-soft.wav'),
  failure: require('../../../../assets/sounds/kingdom-premium/failure.wav'),
};

export function useKingdomAdventureAudio() {
  const focused = useRef(false);
  const generation = useRef(0);
  const pool = useRef(new Map<PremiumSfxKey, Player>());
  const last = useRef(0);
  const activeSounds = useRef(0);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    ++generation.current;
    // Settings hydrate independently and never block a story action.
    void getBuklodSoundSettings().catch(() => undefined);
    const players = pool.current;
    // Prepare the short local clips after focus; never load them on Wall/Connect.
    for (const sound of Object.keys(SOURCES) as PremiumSfxKey[]) {
      if (!players.has(sound)) {
        try { players.set(sound, createAudioPlayer(SOURCES[sound], {updateInterval:500})); }
        catch { /* optional SFX never blocks the screen */ }
      }
    }
    const pause = () => {
      for (const p of players.values()) {
        try { p.pause(); } catch { /* optional sound */ }
      }
    };
    const appSubscription = AppState.addEventListener('change', state => {
      if (state !== 'active') pause();
    });
    return () => {
      focused.current = false;
      ++generation.current;
      appSubscription.remove();
      pause();
      for (const p of players.values()) {
        try { p.remove(); } catch { /* already disposed */ }
      }
      players.clear();
      activeSounds.current = 0;
      last.current = 0;
    };
  }, []));
  return useCallback((cue: AdventureCue) => {
    if (!focused.current || AppState.currentState !== 'active' || !isBuklodGameSoundEnabled()) return;
    const now = Date.now();
    if (now - last.current < ADVENTURE_MOTION.minimumSoundIntervalMs) return;
    if (activeSounds.current >= ADVENTURE_MOTION.maximumActiveSounds) return;
    const sound = ADVENTURE_CUE_SOUND[cue];
    if (!sound) return;
    const token = generation.current;
    let player = pool.current.get(sound);
    try {
      if (!player) {
        player = createAudioPlayer(SOURCES[sound], { updateInterval: 500 });
        pool.current.set(sound, player);
      }
      if (!player.isLoaded) return; // never substitute harsh legacy beep
      last.current = now;
      player.volume = Math.min(0.34, getBuklodGameSoundVolume() * (cue === 'invalid' ? 0.32 : 0.62));
      activeSounds.current += 1;
      const current = player;
      // Rewind an already playing clip. On blur dispose old generation.
      void current.seekTo(0).then(() => {
        if (focused.current && token === generation.current && AppState.currentState === 'active' && isBuklodGameSoundEnabled()) {
          current.play();
        }
      }).catch(() => undefined).finally(() => {
        if (generation.current === token) activeSounds.current = Math.max(0, activeSounds.current - 1);
      });
    } catch { /* sound never prevents action or progress saving */ }
  }, []);
}
