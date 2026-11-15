/**
 * LIFE progress is explicitly saved by the person, never inferred from opening
 * a Gospel page. Only the signed-in user's device can read it. We intentionally
 * do not fall back to plaintext AsyncStorage or upload spiritual choices.
 */
import * as SecureStore from 'expo-secure-store';
import type { BuklodLifeTopicKey, BuklodLifeLanguage } from '@/lib/buklodLifeContent';

export type BuklodLifePrivateProgress = {
  topic: BuklodLifeTopicKey;
  language: BuklodLifeLanguage;
  step: 'exploring' | 'questions' | 'next-steps';
  savedAt: string;
  /** Optional canonical question index, stored only in secure device storage. */
  questionIndex?: number;
};

const allowedTopics = new Set<BuklodLifeTopicKey>([
  'hope','peace','purpose','forgiveness','strength','new-start','questions','jesus','help',
]);
const allowedSteps = new Set<BuklodLifePrivateProgress['step']>([
  'exploring','questions','next-steps',
]);
const keyFor = (userId: string | null | undefined) =>
  userId && /^[0-9a-f-]{20,64}$/i.test(userId)
    ? 'buklod-life-private-v2-' + userId
    : null;

export async function saveBuklodLifePrivateProgress(
  userId: string | null | undefined,
  input: Omit<BuklodLifePrivateProgress, 'savedAt'>,
): Promise<boolean> {
  const key = keyFor(userId);
  if (!key || !allowedTopics.has(input.topic) || !allowedSteps.has(input.step)) return false;
  if (input.questionIndex !== undefined &&
      (input.topic !== 'questions' || !Number.isInteger(input.questionIndex) || input.questionIndex < 0 || input.questionIndex >= 10)) return false;
  try {
    await SecureStore.setItemAsync(key, JSON.stringify({
      ...input,
      language: input.language === 'en' ? 'en' : 'fil',
      savedAt: new Date().toISOString(),
    } satisfies BuklodLifePrivateProgress));
    return true;
  } catch {
    // Secure storage unavailable: do not quietly store sensitive data in plaintext.
    return false;
  }
}

export async function loadBuklodLifePrivateProgress(
  userId: string | null | undefined,
): Promise<BuklodLifePrivateProgress | null> {
  const key = keyFor(userId);
  if (!key) return null;
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const p = data as Partial<BuklodLifePrivateProgress>;
    if (!p.topic || !allowedTopics.has(p.topic) || !p.step || !allowedSteps.has(p.step)) return null;
    return {
      topic: p.topic,
      step: p.step,
      language: p.language === 'en' ? 'en' : 'fil',
      savedAt: typeof p.savedAt === 'string' ? p.savedAt : '',
      ...(p.topic === 'questions' && typeof p.questionIndex === 'number' &&
        Number.isInteger(p.questionIndex) && p.questionIndex >= 0 && p.questionIndex < 10
        ? { questionIndex: p.questionIndex } : {}),
    };
  } catch {
    return null;
  }
}

export async function clearBuklodLifePrivateProgress(
  userId: string | null | undefined,
): Promise<boolean> {
  const key = keyFor(userId);
  if (!key) return false;
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch {
    return false;
  }
}
