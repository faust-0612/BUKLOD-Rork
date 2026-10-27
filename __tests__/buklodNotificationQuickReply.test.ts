import {
  resolveBuklodQuickReplyTarget,
  sendBuklodNotificationQuickReply,
} from '@/lib/buklodNotificationQuickReply';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'a'.repeat(64)),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const userId = '11111111-1111-4111-8111-111111111111';
const threadId = '22222222-2222-4222-8222-222222222222';
const scopeId = '33333333-3333-4333-8333-333333333333';

describe('Android notification quick reply', () => {
  const insert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });
  });

  it('only accepts known conversation types and UUID targets', () => {
    expect(resolveBuklodQuickReplyTarget('direct_message', {
      conversation_id: threadId,
    })?.table).toBe('buklod_connect_direct_messages');
    expect(resolveBuklodQuickReplyTarget('connect_message', {
      scope_id: scopeId,
    })?.table).toBe('buklod_connect_scope_messages');
    expect(resolveBuklodQuickReplyTarget('community_post', {
      post_id: threadId,
    })).toBeNull();
    expect(resolveBuklodQuickReplyTarget('direct_message', {
      conversation_id: '../../admin',
    })).toBeNull();
  });

  it('sends a validated reply through the RLS-protected thread with stable id', async () => {
    const input = {
      userId, kind: 'direct_message', data: {
        conversation_id: threadId, sender_id: 'untrusted-sender',
      }, notificationId: 'notification-1', text: '  Hello!  ',
    };
    await sendBuklodNotificationQuickReply(input);
    await sendBuklodNotificationQuickReply(input);
    expect(Crypto.digestStringAsync).toHaveBeenCalledTimes(2);
    const first = insert.mock.calls[0][0];
    expect(first).toEqual(expect.objectContaining({
      thread_id: threadId, sender_id: userId, body: 'Hello!',
    }));
    expect(first.id).toBe(insert.mock.calls[1][0].id);
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('treats a repeated insert of the same notification as already sent', async () => {
    insert.mockResolvedValue({ error: { code: '23505' } });
    await expect(sendBuklodNotificationQuickReply({
      userId, kind: 'connect_message', data: { scope_id: scopeId },
      notificationId: 'notification-2', text: 'Thanks',
    })).resolves.toBeUndefined();
  });

  it('rejects missing and oversized replies without network writes', async () => {
    await expect(sendBuklodNotificationQuickReply({
      userId, kind: 'direct_message', data: { conversation_id: threadId },
      notificationId: 'n', text: ' '.repeat(3),
    })).rejects.toThrow();
    await expect(sendBuklodNotificationQuickReply({
      userId, kind: 'direct_message', data: { conversation_id: threadId },
      notificationId: 'n', text: 'x'.repeat(2001),
    })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });
});
