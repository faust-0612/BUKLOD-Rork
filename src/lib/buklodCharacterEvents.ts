import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import {
  CELEBRATE_MS,
  NOD_MS,
  NOD_SLOW_MS,
  POINT_MS,
  POINT_SLOW_MS,
  WAVE_MS,
  WAVE_SLOW_MS,
} from '@/lib/buklodCharacterRig';
import { REACTIONS } from '@/lib/character-lab-core/motion';
import type { ReactionId } from '@/lib/character-lab-core/types';
import { normalizeBuklodSpeechText } from '@/lib/buklodSpeech';

/** Pass 1 + legacy character events — single source of truth for reactions. */
export enum CharacterEventType {
  IDLE = 'IDLE',
  CHARACTER_ENTER = 'CHARACTER_ENTER',
  GREETING = 'GREETING',
  WAVE = 'WAVE',
  WAVE_SLOW = 'WAVE_SLOW',
  NOD = 'NOD',
  NOD_SLOW = 'NOD_SLOW',
  HAPPY = 'HAPPY',
  PROUD = 'PROUD',
  CELEBRATE = 'CELEBRATE',
  POINT = 'POINT',
  POINT_SLOW = 'POINT_SLOW',
  ITEM_REVEAL = 'ITEM_REVEAL',
  /** Legacy aliases kept for existing emit sites. */
  SESSION_START = 'SESSION_START',
  CHARACTER_SCREEN_OPEN = 'CHARACTER_SCREEN_OPEN',
  PROFILE_CHARACTER_VISIBLE = 'PROFILE_CHARACTER_VISIBLE',
  POINTS_EARNED = 'POINTS_EARNED',
  POINTS_CLAIMED = 'POINTS_CLAIMED',
  POINTS_UNLOCK_THRESHOLD = 'POINTS_UNLOCK_THRESHOLD',
  ITEM_UNLOCKED = 'ITEM_UNLOCKED',
  ITEM_EQUIPPED = 'ITEM_EQUIPPED',
  ATTENDANCE_RECORDED = 'ATTENDANCE_RECORDED',
  ACHIEVEMENT_REACHED = 'ACHIEVEMENT_REACHED',
  REFERRAL_QUALIFIED = 'REFERRAL_QUALIFIED',
  MILESTONE_REACHED = 'MILESTONE_REACHED',
}

/** @deprecated Use CharacterEventType */
export type BuklodCharacterEventType = `${CharacterEventType}`;

/** Character pose states mapped to motion transforms (no new bitmaps). */
export type CharacterPoseState =
  | 'IDLE'
  | 'WELCOME'
  | 'WAVE'
  | 'WAVE_SLOW'
  | 'NOD'
  | 'NOD_SLOW'
  | 'HAPPY'
  | 'PROUD'
  | 'THANKFUL'
  | 'CELEBRATE'
  | 'POINT_PRESENT'
  | 'POINT_SLOW'
  | 'ITEM_REVEAL'
  | 'THINKING';

export type CharacterReactionsMode = 'full' | 'reduced' | 'off';

export type CharacterEventPayload = {
  type: CharacterEventType;
  /** When false, reaction and dialogue are suppressed. */
  success?: boolean;
  dialogue?: string;
  spokenText?: string;
  points?: number;
  itemName?: string;
  itemId?: string;
  milestoneLabel?: string;
};

/** @deprecated Use CharacterEventPayload */
export type BuklodCharacterEventPayload = CharacterEventPayload;

export type ActiveCharacterPresentation = {
  pose: CharacterPoseState;
  reactionId: ReactionId;
  reactionKey: number;
  dialogue: string | null;
  celebrating: boolean;
  pointPresent: boolean;
  /** True while dialogue bubble is visible — drives talk motion. */
  talking: boolean;
};

export const CHARACTER_VOICE_KEY = 'buklod_character_voice_v1';
export const CHARACTER_REACTIONS_KEY = 'buklod_character_reactions_v1';
export const CHARACTER_GREETING_SESSION_KEY =
  'buklod_character_greeting_session_v1';

/** Pass 1 priority high → low (larger number wins the queue). */
export const PASS1_EVENT_PRIORITY: Partial<Record<CharacterEventType, number>> =
  {
    [CharacterEventType.ITEM_REVEAL]: 100,
    [CharacterEventType.ITEM_UNLOCKED]: 100,
    [CharacterEventType.POINTS_UNLOCK_THRESHOLD]: 95,
    [CharacterEventType.CELEBRATE]: 90,
    [CharacterEventType.POINTS_CLAIMED]: 90,
    [CharacterEventType.MILESTONE_REACHED]: 88,
    [CharacterEventType.PROUD]: 80,
    [CharacterEventType.ACHIEVEMENT_REACHED]: 78,
    [CharacterEventType.REFERRAL_QUALIFIED]: 76,
    [CharacterEventType.GREETING]: 70,
    [CharacterEventType.SESSION_START]: 70,
    [CharacterEventType.CHARACTER_SCREEN_OPEN]: 68,
    [CharacterEventType.PROFILE_CHARACTER_VISIBLE]: 66,
    [CharacterEventType.WAVE]: 60,
    [CharacterEventType.WAVE_SLOW]: 59,
    [CharacterEventType.NOD]: 58,
    [CharacterEventType.NOD_SLOW]: 57,
    [CharacterEventType.POINT]: 56,
    [CharacterEventType.POINT_SLOW]: 55,
    [CharacterEventType.HAPPY]: 56,
    [CharacterEventType.POINTS_EARNED]: 55,
    [CharacterEventType.ATTENDANCE_RECORDED]: 50,
    [CharacterEventType.ITEM_EQUIPPED]: 45,
    [CharacterEventType.CHARACTER_ENTER]: 50,
    [CharacterEventType.IDLE]: 0,
  };

/** @deprecated Use PASS1_EVENT_PRIORITY */
export const EVENT_PRIORITY: Record<CharacterEventType, number> =
  Object.values(CharacterEventType).reduce(
    (acc, type) => {
      acc[type] = PASS1_EVENT_PRIORITY[type] ?? 10;
      return acc;
    },
    {} as Record<CharacterEventType, number>
  );

const GREETING_EVENT_TYPES: ReadonlySet<CharacterEventType> = new Set([
  CharacterEventType.GREETING,
  CharacterEventType.SESSION_START,
  CharacterEventType.CHARACTER_SCREEN_OPEN,
  CharacterEventType.PROFILE_CHARACTER_VISIBLE,
]);

const DIALOGUE_COOLDOWN_MS = 2800;
const EQUIP_VOICE_DEBOUNCE_MS = 4200;
const WAVE_REACTION_MS = WAVE_MS;

let greetingShownThisSession = false;
let lastDialogueAt = 0;
let lastEquipVoiceAt = 0;
let speechBusy = false;

/*
 * BUKLOD_CHARACTER_WEB_SPEECH_GUARD_R1
 *
 * expo-speech uses the browser Web Speech API on web. Facebook/Messenger IAB
 * may not provide a complete implementation, so character voice becomes a
 * graceful no-op there instead of an unhandled browser exception.
 */
function characterSpeechAvailable() {
  if (Platform.OS !== 'web') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const runtime = window as any;

  return (
    !!runtime.speechSynthesis &&
    typeof runtime.speechSynthesis.speak === 'function' &&
    typeof runtime.speechSynthesis.cancel === 'function' &&
    typeof runtime.SpeechSynthesisUtterance === 'function'
  );
}

export function stopCharacterSpeech() {
  if (!characterSpeechAvailable()) {
    speechBusy = false;
    return;
  }

  try {
    const result = Speech.stop();
    void Promise.resolve(result)
      .catch(() => undefined);
  }
  catch {
    /* optional speech feature */
  }

  speechBusy = false;
}

export function resetCharacterSessionFlags() {
  greetingShownThisSession = false;
}

export function safeDisplayName(
  raw?: string | null
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  const safe = first.replace(/[^\p{L}\p{N}\-'.]/gu, '');
  if (!safe || safe.length > 24) return null;
  return safe;
}

export function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Local-time greeting with optional display name. */
export function getGreetingText(displayName?: string | null): string {
  return buildGreetingDialogue(displayName);
}

export function buildGreetingDialogue(displayName?: string | null): string {
  const prefix = timeGreeting();
  const name = safeDisplayName(displayName);
  return name ? `${prefix}, ${name}!` : `${prefix}!`;
}

export function poseToReaction(pose: CharacterPoseState): ReactionId {
  switch (pose) {
    case 'WELCOME':
    case 'WAVE':
    case 'WAVE_SLOW':
      return 'welcome';
    case 'NOD':
    case 'NOD_SLOW':
      return 'thankful';
    case 'HAPPY':
      return 'happy';
    case 'PROUD':
    case 'POINT_PRESENT':
    case 'POINT_SLOW':
      return 'proud';
    case 'THANKFUL':
      return 'thankful';
    case 'CELEBRATE':
      return 'celebrate';
    case 'ITEM_REVEAL':
      return 'new_item';
    case 'THINKING':
      return 'neutral';
    case 'IDLE':
    default:
      return 'neutral';
  }
}

export function reactionDurationMs(
  pose: CharacterPoseState,
  reactionId: ReactionId
): number {
  if (pose === 'WAVE' || pose === 'WELCOME') return WAVE_MS;
  if (pose === 'WAVE_SLOW') return WAVE_SLOW_MS;
  if (pose === 'NOD') return NOD_MS;
  if (pose === 'NOD_SLOW') return NOD_SLOW_MS;
  if (pose === 'POINT_PRESENT') return POINT_MS;
  if (pose === 'POINT_SLOW') return POINT_SLOW_MS;
  if (pose === 'CELEBRATE') return CELEBRATE_MS;
  return REACTIONS[reactionId]?.durationMs ?? 900;
}

export function eventToPose(type: CharacterEventType): CharacterPoseState {
  switch (type) {
    case CharacterEventType.CHARACTER_ENTER:
      return 'IDLE';
    case CharacterEventType.HAPPY:
      return 'HAPPY';
    case CharacterEventType.GREETING:
    case CharacterEventType.SESSION_START:
    case CharacterEventType.CHARACTER_SCREEN_OPEN:
    case CharacterEventType.PROFILE_CHARACTER_VISIBLE:
      return 'WAVE';
    case CharacterEventType.WAVE:
      return 'WAVE';
    case CharacterEventType.WAVE_SLOW:
      return 'WAVE_SLOW';
    case CharacterEventType.NOD:
      return 'NOD';
    case CharacterEventType.NOD_SLOW:
      return 'NOD_SLOW';
    case CharacterEventType.POINT:
      return 'POINT_PRESENT';
    case CharacterEventType.POINT_SLOW:
      return 'POINT_SLOW';
    case CharacterEventType.POINTS_EARNED:
    case CharacterEventType.ITEM_EQUIPPED:
      return 'HAPPY';
    case CharacterEventType.POINTS_CLAIMED:
    case CharacterEventType.CELEBRATE:
    case CharacterEventType.MILESTONE_REACHED:
      return 'CELEBRATE';
    case CharacterEventType.POINTS_UNLOCK_THRESHOLD:
    case CharacterEventType.ITEM_UNLOCKED:
    case CharacterEventType.ITEM_REVEAL:
      return 'ITEM_REVEAL';
    case CharacterEventType.ATTENDANCE_RECORDED:
      return 'THANKFUL';
    case CharacterEventType.ACHIEVEMENT_REACHED:
    case CharacterEventType.REFERRAL_QUALIFIED:
    case CharacterEventType.PROUD:
      return 'PROUD';
    case CharacterEventType.IDLE:
    default:
      return 'IDLE';
  }
}

export function defaultDialogueForEvent(
  event: CharacterEventPayload,
  displayName?: string | null
): string | null {
  if (event.dialogue) return event.dialogue;

  switch (event.type) {
    case CharacterEventType.GREETING:
    case CharacterEventType.SESSION_START:
    case CharacterEventType.CHARACTER_SCREEN_OPEN:
    case CharacterEventType.PROFILE_CHARACTER_VISIBLE:
      return getGreetingText(displayName);
    case CharacterEventType.CHARACTER_ENTER:
      return null;
    case CharacterEventType.WAVE:
      return 'Hey there!';
    case CharacterEventType.NOD:
      return null;
    case CharacterEventType.POINT:
      return null;
    case CharacterEventType.HAPPY:
      return 'That makes me happy!';
    case CharacterEventType.PROUD:
      return 'Well done — keep going!';
    case CharacterEventType.CELEBRATE:
      return 'Amazing work!';
    case CharacterEventType.ITEM_REVEAL:
      return event.itemName
        ? `Behold — ${event.itemName}!`
        : 'Something new awaits!';
    case CharacterEventType.POINTS_EARNED:
      return event.points
        ? `+${event.points.toLocaleString()} points recorded!`
        : 'Points recorded!';
    case CharacterEventType.POINTS_CLAIMED:
      return event.points
        ? `Claimed ${event.points.toLocaleString()} points!`
        : 'Reward claimed!';
    case CharacterEventType.POINTS_UNLOCK_THRESHOLD:
      return 'You unlocked something new!';
    case CharacterEventType.ITEM_UNLOCKED:
      return event.itemName
        ? `${event.itemName} is yours now!`
        : 'New item unlocked!';
    case CharacterEventType.ITEM_EQUIPPED:
      return event.itemName
        ? `Looking good in ${event.itemName}!`
        : 'Nice choice!';
    case CharacterEventType.ATTENDANCE_RECORDED:
      return 'Attendance recorded. Thank you!';
    case CharacterEventType.ACHIEVEMENT_REACHED:
      return event.milestoneLabel
        ? `${event.milestoneLabel} achieved!`
        : 'Achievement reached!';
    case CharacterEventType.REFERRAL_QUALIFIED:
      return 'Referral qualified. Bayanihan!';
    case CharacterEventType.MILESTONE_REACHED:
      return event.milestoneLabel
        ? `${event.milestoneLabel}!`
        : 'Milestone reached!';
    default:
      return null;
  }
}

export function shouldCelebrate(type: CharacterEventType): boolean {
  return (
    type === CharacterEventType.POINTS_CLAIMED ||
    type === CharacterEventType.CELEBRATE ||
    type === CharacterEventType.MILESTONE_REACHED ||
    type === CharacterEventType.ITEM_UNLOCKED ||
    type === CharacterEventType.ITEM_REVEAL ||
    type === CharacterEventType.POINTS_UNLOCK_THRESHOLD
  );
}

export function isGreetingEvent(type: CharacterEventType): boolean {
  return GREETING_EVENT_TYPES.has(type);
}

export async function loadCharacterVoiceEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CHARACTER_VOICE_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

export async function saveCharacterVoiceEnabled(enabled: boolean) {
  await AsyncStorage.setItem(CHARACTER_VOICE_KEY, enabled ? '1' : '0');
}

export async function loadCharacterReactionsMode(): Promise<CharacterReactionsMode> {
  try {
    const raw = await AsyncStorage.getItem(CHARACTER_REACTIONS_KEY);
    if (raw === 'reduced' || raw === 'off') return raw;
    return 'full';
  } catch {
    return 'full';
  }
}

export async function saveCharacterReactionsMode(
  mode: CharacterReactionsMode
) {
  await AsyncStorage.setItem(CHARACTER_REACTIONS_KEY, mode);
}

export async function loadGreetingSessionMarker(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHARACTER_GREETING_SESSION_KEY);
  } catch {
    return null;
  }
}

export async function markGreetingSession(sessionId: string) {
  greetingShownThisSession = true;
  await AsyncStorage.setItem(CHARACTER_GREETING_SESSION_KEY, sessionId);
}

export function greetingShownInMemory(): boolean {
  return greetingShownThisSession;
}

export function canShowDialogue(now = Date.now()): boolean {
  return now - lastDialogueAt >= DIALOGUE_COOLDOWN_MS;
}

export function markDialogueShown(now = Date.now()) {
  lastDialogueAt = now;
}

export function canSpeakEquip(now = Date.now()): boolean {
  return now - lastEquipVoiceAt >= EQUIP_VOICE_DEBOUNCE_MS;
}

export function markEquipSpoken(now = Date.now()) {
  lastEquipVoiceAt = now;
}

/** Non-blocking TTS — expo-speech (MIT). Never blocks navigation. */
export function speakCharacterLine(
  text: string,
  enabled: boolean
) {
  if (
    !enabled ||
    !text.trim() ||
    speechBusy ||
    !characterSpeechAvailable()
  ) {
    return;
  }

  speechBusy = true;
  try {
    const stopResult = Speech.stop();
    void Promise.resolve(stopResult)
      .catch(() => undefined);

    Speech.speak(normalizeBuklodSpeechText(text), {
      language: 'en-PH',
      rate: 0.92,
      pitch: 1.02,
      onDone: () => {
        speechBusy = false;
      },
      onStopped: () => {
        speechBusy = false;
      },
      onError: () => {
        speechBusy = false;
      },
    });
  } catch {
    speechBusy = false;
  }
}

export function resolvePresentation(
  event: CharacterEventPayload,
  displayName?: string | null,
  reactionsMode: CharacterReactionsMode = 'full'
): ActiveCharacterPresentation | null {
  if (event.success === false) return null;
  if (reactionsMode === 'off') {
    if (!isGreetingEvent(event.type)) return null;
  }
  if (event.type === CharacterEventType.IDLE) return null;

  const pose = eventToPose(event.type);
  const reactionId = poseToReaction(pose);
  const celebrating =
    reactionsMode === 'full' && shouldCelebrate(event.type);
  const dialogue =
    reactionsMode === 'reduced' && !isGreetingEvent(event.type)
      ? null
      : defaultDialogueForEvent(event, displayName);

  return {
    pose,
    reactionId,
    reactionKey: Date.now(),
    dialogue,
    celebrating,
    pointPresent: false,
    talking: !!dialogue,
  };
}

export function compareEventPriority(
  a: CharacterEventPayload,
  b: CharacterEventPayload
): number {
  const pa = PASS1_EVENT_PRIORITY[a.type] ?? EVENT_PRIORITY[a.type] ?? 0;
  const pb = PASS1_EVENT_PRIORITY[b.type] ?? EVENT_PRIORITY[b.type] ?? 0;
  return pb - pa;
}

export { WAVE_REACTION_MS };
