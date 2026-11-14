/** Encrypted at-rest, local only; account-scoped text drafts with serialized writes. */
import * as SecureStore from 'expo-secure-store';
import {
  WALL_DRAFT_SCHEMA as SCHEMA,
  MAX_SAVED_WALL_DRAFTS as MAX_DRAFTS,
  MAX_WALL_DRAFT_TEXT as MAX_TEXT,
  WALL_DRAFT_POST_ID as POST_ID,
  wallDraftSecureKey,
  normalizeWallTextDrafts,
  type BuklodSavedWallTextDraft,
} from '@/lib/buklodNavigationDraftPolicy';

const queue = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = queue.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  const settled = next.catch(() => undefined);
  queue.set(key, settled);
  void settled.finally(() => { if (queue.get(key) === settled) queue.delete(key); });
  return next;
}
async function readEnvelope(key: string): Promise<BuklodSavedWallTextDraft[]> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return [];
  try { return normalizeWallTextDrafts(JSON.parse(raw)); }
  catch { return []; }
}

export async function loadWallCommentTextDraft(accountId: string, postId: string): Promise<string> {
  if (!POST_ID.test(postId)) return '';
  const key = wallDraftSecureKey(accountId);
  return serialize(key, async () => (await readEnvelope(key)).find(x=>x.postId===postId)?.text ?? '');
}

export async function saveWallCommentTextDraft(
  accountId: string, postId: string, text: string,
): Promise<void> {
  if (!POST_ID.test(postId)) return;
  const key = wallDraftSecureKey(accountId);
  await serialize(key, async () => {
    const existing = (await readEnvelope(key)).filter(x=>x.postId!==postId);
    const value = typeof text === 'string' ? text.slice(0, MAX_TEXT) : '';
    const drafts = value.trim()
      ? [{ postId, text:value, savedAt:Date.now() }, ...existing].slice(0,MAX_DRAFTS)
      : existing;
    if (drafts.length) await SecureStore.setItemAsync(key, JSON.stringify({ schema:SCHEMA, drafts }));
    else await SecureStore.deleteItemAsync(key);
  });
}

export function clearWallCommentTextDraft(accountId: string, postId: string): Promise<void> {
  return saveWallCommentTextDraft(accountId, postId, '');
}
