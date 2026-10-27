import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

export const BUKLOD_MESSAGE_REPLY_ACTION = 'buklod_message_reply_send';
export const BUKLOD_MESSAGE_REPLY_CATEGORY = 'buklod_message_reply';

type ReplyTarget =
  | { table: 'buklod_connect_direct_messages'; field: 'thread_id'; id: string }
  | { table: 'buklod_connect_scope_messages'; field: 'scope_id'; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Never infer a recipient from untrusted push data. Database RLS checks
 * auth.uid() and active thread/scope membership on the INSERT. */
export function resolveBuklodQuickReplyTarget(
  kind: string,
  data: Record<string, unknown> | null | undefined,
): ReplyTarget | null {
  if (!data) return null;
  const normalized = kind.trim().toLowerCase();
  if (normalized === 'direct_message') {
    const id = String(data.conversation_id ?? data.thread_id ?? '').trim();
    return UUID.test(id)
      ? { table: 'buklod_connect_direct_messages', field: 'thread_id', id }
      : null;
  }
  if (normalized === 'connect_message') {
    const id = String(data.scope_id ?? '').trim();
    return UUID.test(id)
      ? { table: 'buklod_connect_scope_messages', field: 'scope_id', id }
      : null;
  }
  return null;
}

export async function sendBuklodNotificationQuickReply(input: {
  userId: string;
  kind: string;
  data: Record<string, unknown> | null | undefined;
  notificationId: string;
  text: string;
}): Promise<void> {
  const { userId, kind, data, notificationId } = input;
  const body = input.text.trim();
  const target = resolveBuklodQuickReplyTarget(kind, data);
  if (!UUID.test(userId) || !target || !notificationId.trim()) {
    throw new Error('This notification cannot be replied to directly. Open the conversation.');
  }
  if (!body || body.length > 2000) {
    throw new Error('Reply must contain 1–2000 characters.');
  }

  // Stable message id makes repeated Android response callbacks and a
  // cold-start replay safe; a network timeout must not duplicate a reply.
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `buklod-quick-reply:v1:${userId}:${notificationId}`,
  );
  const messageId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const { error } = await (supabase as any)
    .from(target.table)
    .insert({
      id: messageId,
      [target.field]: target.id,
      sender_id: userId,
      body,
    });
  if (error && error.code !== '23505') {
    throw new Error(error.message || 'Could not confirm delivery.');
  }
}
