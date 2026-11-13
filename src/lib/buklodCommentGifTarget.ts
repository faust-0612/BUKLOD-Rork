/** Android keyboard shares may recreate the screen. Keep only a brief
 * account-scoped post destination; never store GIF bytes, captions or an
 * authorization decision. A server-checked post load still gates reopening. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'buklod:comment-gif-target:v2';
const MAX_AGE_MS = 5 * 60 * 1000;
export type CommentGifTarget = {
  ownerId: string; postId: string; scopeId: string | null; savedAt: number;
};
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  const next = queue.catch(() => undefined).then(task);
  queue = next.catch(() => undefined);
  return next;
}
function parse(raw: string | null): CommentGifTarget | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const age = Date.now() - Number(v?.savedAt);
    if (typeof v?.ownerId !== 'string' || !v.ownerId ||
        typeof v?.postId !== 'string' || !v.postId ||
        !(v?.scopeId === null || typeof v?.scopeId === 'string') ||
        !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
    return v as CommentGifTarget;
  } catch { return null; }
}
export function rememberActiveCommentGifTarget(
  ownerId: string, postId: string, scopeId: string | null = null,
): Promise<void> {
  if (!ownerId?.trim() || !postId?.trim()) return Promise.resolve();
  return enqueue(() => AsyncStorage.setItem(KEY, JSON.stringify({
    ownerId:ownerId.trim(), postId:postId.trim(),
    scopeId:scopeId?.trim() || null, savedAt:Date.now(),
  } satisfies CommentGifTarget)));
}
export async function getActiveCommentGifContext(
  ownerId: string,
): Promise<CommentGifTarget | null> {
  if (!ownerId?.trim()) return null;
  try {
    await queue;
    const target = parse(await AsyncStorage.getItem(KEY));
    return target?.ownerId === ownerId.trim() ? target : null;
  } catch { return null; }
}
export async function getActiveCommentGifTarget(ownerId: string): Promise<string|null> {
  const target = await getActiveCommentGifContext(ownerId);
  // A scoped comment can never be redirected into a Public Wall comment.
  return target && !target.scopeId ? target.postId : null;
}
export function forgetActiveCommentGifTarget(
  ownerId: string, postId: string, scopeId: string | null = null,
): Promise<void> {
  if (!ownerId?.trim() || !postId?.trim()) return Promise.resolve();
  return enqueue(async () => {
    const target = parse(await AsyncStorage.getItem(KEY));
    if (target?.ownerId === ownerId.trim() &&
        target.postId === postId.trim() &&
        target.scopeId === (scopeId?.trim() || null)) {
      await AsyncStorage.removeItem(KEY);
    }
  });
}
