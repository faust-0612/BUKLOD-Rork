/** Pure bounded account-isolated draft policy; no native API or network. */
export const WALL_DRAFT_SCHEMA = 'buklod-nav2-wall-text-drafts-v1';
export const MAX_SAVED_WALL_DRAFTS = 6;
export const MAX_WALL_DRAFT_TEXT = 2000;
const TTL_MS = 12 * 60 * 60 * 1000;
const USER_ID = /^[a-f0-9-]{36}$/i;
export const WALL_DRAFT_POST_ID = /^[a-f0-9-]{36}$/i;

export type BuklodSavedWallTextDraft = { postId: string; text: string; savedAt: number };
type Envelope = { schema: string; drafts: BuklodSavedWallTextDraft[] };

export function wallDraftSecureKey(accountId: string): string {
  if (!USER_ID.test(accountId)) throw new Error('Account identity required for private comment drafts');
  return 'buklod.nav2.comment-drafts.v1.' + accountId.toLowerCase();
}

export function normalizeWallTextDrafts(value: unknown, now = Date.now()): BuklodSavedWallTextDraft[] {
  const envelope = value as Partial<Envelope> | null;
  if (envelope?.schema !== WALL_DRAFT_SCHEMA || !Array.isArray(envelope.drafts)) return [];
  const seen = new Set<string>();
  const result: BuklodSavedWallTextDraft[] = [];
  for (const draft of envelope.drafts) {
    if (!draft || !WALL_DRAFT_POST_ID.test(String(draft.postId ?? '')) ||
        typeof draft.text !== 'string' || !draft.text.trim() ||
        draft.text.length > MAX_WALL_DRAFT_TEXT ||
        typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt) ||
        draft.savedAt > now || now - draft.savedAt > TTL_MS || seen.has(draft.postId)) continue;
    seen.add(draft.postId);
    result.push({ postId: draft.postId, text: draft.text, savedAt: draft.savedAt });
    if (result.length >= MAX_SAVED_WALL_DRAFTS) break;
  }
  return result;
}

