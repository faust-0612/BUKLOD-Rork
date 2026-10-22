/** Client-side validation for KL discussions. Server remains authoritative.
 * Never award points based on this file, and never fake a successful write.
 */
export const KL_COMMENT_MIN_LENGTH = 12;
export const KL_COMMENT_MAX_LENGTH = 1500;
export const KL_REACTIONS = ['like', 'love', 'wow', 'sad'] as const;
export type KlReaction = (typeof KL_REACTIONS)[number];

export function validateKlComment(raw: string): { ok: true; text: string } | { ok: false; reason: string } {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length < KL_COMMENT_MIN_LENGTH) return { ok: false, reason: 'Maglagay ng mas makabuluhang komento.' };
  if (text.length > KL_COMMENT_MAX_LENGTH) return { ok: false, reason: 'Masyadong mahaba ang komento.' };
  if (!/[\p{L}\p{N}]/u.test(text)) return { ok: false, reason: 'Kailangan ng tekstong komento.' };
  return { ok: true, text };
}

export function isKlReaction(value: string): value is KlReaction {
  return (KL_REACTIONS as readonly string[]).includes(value);
}

export function klCommentIdempotencyKey(chapterId: string, clientNonce: string): string {
  if (!/^[a-zA-Z0-9-]{12,100}$/.test(clientNonce)) throw new Error('Invalid comment nonce');
  if (!/^[a-f\d-]{36}$/i.test(chapterId)) throw new Error('Invalid chapter ID');
  return `kl-comment:${chapterId}:${clientNonce}`;
}
