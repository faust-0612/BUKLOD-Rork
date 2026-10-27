import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { AppState, Platform } from 'react-native';

export type BuklodSoundCategory =
  | 'messages'
  | 'calls'
  | 'submissions'
  | 'community'
  | 'achievements'
  | 'buttons';

export type BuklodSoundCue =
  | 'button'
  | 'message_sent'
  | 'message'
  | 'submission'
  | 'approval'
  | 'error'
  | 'community'
  | 'achievement'
  | 'alert';

export type BuklodSoundSettings = Record<BuklodSoundCategory, boolean> & {
  quietHours: boolean;
};

export const DEFAULT_BUKLOD_SOUND_SETTINGS: BuklodSoundSettings = {
  messages: true,
  calls: true,
  submissions: true,
  community: true,
  achievements: false,
  buttons: false,
  quietHours: false,
};

const SETTINGS_KEY = '@buklod_sounds_v1';
const sounds: Record<BuklodSoundCue, number> = {
  button: require('../../assets/sounds/buklod_message_sent.wav'),
  message_sent: require('../../assets/sounds/buklod_message_sent.wav'),
  message: require('../../assets/sounds/buklod_message.wav'),
  submission: require('../../assets/sounds/buklod_submission.wav'),
  approval: require('../../assets/sounds/buklod_approval.wav'),
  error: require('../../assets/sounds/buklod_error.wav'),
  community: require('../../assets/sounds/buklod_community.wav'),
  achievement: require('../../assets/sounds/buklod_achievement.wav'),
  alert: require('../../assets/sounds/buklod_alert.wav'),
};

const categories: Record<BuklodSoundCue, BuklodSoundCategory> = {
  button: 'buttons',
  message_sent: 'messages',
  message: 'messages',
  submission: 'submissions',
  approval: 'submissions',
  error: 'submissions',
  community: 'community',
  achievement: 'achievements',
  alert: 'community',
};

const cooldownMs: Record<BuklodSoundCue, number> = {
  button: 150,
  message_sent: 160,
  message: 1800,
  submission: 700,
  approval: 1100,
  error: 1000,
  community: 5000,
  achievement: 1500,
  alert: 4000,
};

let settings = { ...DEFAULT_BUKLOD_SOUND_SETTINGS };
let hydrate: Promise<void> | null = null;
let activeCall = false;
let activeMessageThread: string | null = null;
const players = new Map<BuklodSoundCue, AudioPlayer>();
const lastPlayed = new Map<BuklodSoundCue, number>();

export async function getBuklodSoundSettings(): Promise<BuklodSoundSettings> {
  if (!hydrate) {
    hydrate = AsyncStorage.getItem(SETTINGS_KEY)
      .then(raw => {
        if (!raw) return;
        const persisted = JSON.parse(raw) as Partial<BuklodSoundSettings>;
        for (const key of Object.keys(DEFAULT_BUKLOD_SOUND_SETTINGS) as (keyof BuklodSoundSettings)[]) {
          if (typeof persisted[key] === 'boolean') settings[key] = persisted[key];
        }
      })
      .catch(error => {
        console.warn('BUKLOD sound settings load:', error);
      });
  }
  await hydrate;
  return { ...settings };
}

export async function saveBuklodSoundSettings(next: BuklodSoundSettings) {
  await getBuklodSoundSettings();
  const normalized = { ...DEFAULT_BUKLOD_SOUND_SETTINGS };
  for (const key of Object.keys(normalized) as (keyof BuklodSoundSettings)[]) {
    normalized[key] = Boolean(next[key]);
  }
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  settings = normalized;
}

export function setBuklodCallSoundSuppressed(inCall: boolean) {
  activeCall = inCall;
}

export function setBuklodActiveMessageThread(threadId: string | null) {
  activeMessageThread = threadId;
}

export function isBuklodMessageThreadOpen(threadId: string | null | undefined) {
  return Boolean(threadId && activeMessageThread === threadId);
}

function isQuietHours() {
  if (!settings.quietHours) return false;
  const hour = new Date().getHours();
  return hour >= 22 || hour < 7;
}

/**
 * Foreground-only, optional UI feedback. Native call ringing and background
 * notifications remain the responsibility of Stream/Android/iOS, never this
 * player. No Supabase calls and no polling occur here.
 */
export async function playBuklodCue(cue: BuklodSoundCue) {
  if (Platform.OS === 'web' || AppState.currentState !== 'active' || activeCall) return;
  const category = categories[cue];
  await getBuklodSoundSettings();
  if (!settings[category] || (isQuietHours() && cue !== 'alert')) return;
  const now = Date.now();
  if (now - (lastPlayed.get(cue) ?? 0) < cooldownMs[cue]) return;
  lastPlayed.set(cue, now);
  try {
    let player = players.get(cue);
    const fresh = !player;
    if (!player) {
      player = createAudioPlayer(sounds[cue], { updateInterval: 1000 });
      player.volume = cue === 'alert' ? 0.45 : 0.28;
      players.set(cue, player);
    }
    // A newly constructed player may still be loading; seeking before it
    // becomes ready can reject and swallow the very first feedback sound.
    if (!fresh) await player.seekTo(0);
    player.play();
  } catch (error) {
    // A failed tone must never block a real send, submission or navigation.
    console.warn('BUKLOD sound:', cue, error);
  }
}

export function classifyBuklodNotificationSound(kind: string): BuklodSoundCue | null {
  if (['direct_message', 'connect_message', 'cluster_message', 'scope_message'].includes(kind)) return 'message';
  if (/rejected|failed|error/.test(kind)) return 'error';
  if (/approved|accepted|verified|grade_released/.test(kind)) return 'approval';
  if (/submission|submitted|review/.test(kind)) return 'submission';
  if (/points|achievement|reward|milestone/.test(kind)) return 'achievement';
  if (/community|cluster|scope|organization|mention|invite/.test(kind)) return 'community';
  return null;
}
