/** Android keyboard ACTION_SEND can remount the Wall.
 * Persist a brief account-scoped target ID, never GIF bytes or captions. */
import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = 'buklod:comment-gif-target:v1';
const MAX_AGE_MS = 5 * 60 * 1000;
type Target = { ownerId: string; postId: string; savedAt: number };
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
 const next = queue.catch(() => undefined).then(task);
 queue = next.catch(() => undefined);
 return next;
}
function parse(raw: string | null): Target | null {
 if (!raw) return null;
 try {
  const v = JSON.parse(raw);
  const age = Date.now() - Number(v?.savedAt);
  if (typeof v?.ownerId !== 'string' || !v.ownerId ||
      typeof v?.postId !== 'string' || !v.postId ||
      !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
  return v as Target;
 } catch { return null; }
}
export function rememberActiveCommentGifTarget(ownerId: string, postId: string): Promise<void> {
 if (!ownerId?.trim() || !postId?.trim()) return Promise.resolve();
 return enqueue(() => AsyncStorage.setItem(KEY, JSON.stringify({
  ownerId:ownerId.trim(), postId:postId.trim(), savedAt:Date.now(),
 } satisfies Target)));
}
export async function getActiveCommentGifTarget(ownerId: string): Promise<string|null> {
 if (!ownerId?.trim()) return null;
 try {
  await queue;
  const target = parse(await AsyncStorage.getItem(KEY));
  return target?.ownerId === ownerId.trim() ? target.postId : null;
 } catch { return null; }
}
export function forgetActiveCommentGifTarget(ownerId: string, postId: string): Promise<void> {
 if (!ownerId?.trim() || !postId?.trim()) return Promise.resolve();
 return enqueue(async () => {
  const target = parse(await AsyncStorage.getItem(KEY));
  if (target?.ownerId === ownerId.trim() && target.postId === postId.trim()) {
   await AsyncStorage.removeItem(KEY);
  }
 });
}
