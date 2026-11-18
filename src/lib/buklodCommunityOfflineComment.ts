/**
 * An offline Wall comment is a durable, account-scoped mutation, not a
 * server-confirmed comment. The stable queue item ID becomes the RPC v5
 * idempotency key; never generate a new key for a retry.
 */
import { parseBuklodCommentMediaBody } from '@/lib/buklodCommentMediaBody';
import {
  enqueueOfflineAction,
  type OfflineQueueItem,
} from '@/lib/offlineSyncQueue';

export const WALL_COMMENT_QUEUE_KIND = 'community_wall_comment_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PendingWallComment = {
  postId: string;
  body: string;
  parentId: string | null;
  mentionIds: string[];
};

export function parsePendingWallComment(value: unknown): PendingWallComment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const postId = String(row.postId ?? '').trim();
  const body = String(row.body ?? '').trim();
  const parentId = row.parentId == null ? null : String(row.parentId).trim();
  if (!UUID.test(postId) || !body || body.length > 2000 ||
      (parentId !== null && !UUID.test(parentId))) return null;

  // Files in a phone's temporary media picker directory cannot be replayed
  // after process death. Upload such files while online BEFORE queueing.
  const media = parseBuklodCommentMediaBody(body).media;
  if (media && /^(file:|content:|ph:|assets-library:|blob:)/i.test(media.ref)) {
    return null;
  }

  const mentionIds = Array.isArray(row.mentionIds)
    ? [...new Set(row.mentionIds.map(id => String(id ?? '').trim()).filter(id => UUID.test(id)))].slice(0, 20)
    : [];

  return { postId, body, parentId, mentionIds };
}

export function isPendingWallCommentFor(
  item: OfflineQueueItem,
  userId: string,
  postId: string,
): boolean {
  const payload = parsePendingWallComment(item.payload);
  return item.kind === WALL_COMMENT_QUEUE_KIND &&
    item.userId === userId && payload?.postId === postId;
}

export async function queueWallComment(
  userId: string,
  input: PendingWallComment,
): Promise<OfflineQueueItem> {
  if (!UUID.test(userId)) throw new Error('Sign in before saving your comment.');
  const payload = parsePendingWallComment(input);
  if (!payload) {
    throw new Error('This comment cannot be saved offline. Keep the draft and retry.');
  }
  return enqueueOfflineAction({
    kind: WALL_COMMENT_QUEUE_KIND,
    payload,
    userId,
    maxAttempts: 12,
  });
}
