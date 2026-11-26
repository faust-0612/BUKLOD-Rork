import {
  connectInboxRevision,
  isConnectMessageNotification,
  notifyConnectInboxChanged,
  subscribeConnectInboxChanged,
} from '../src/lib/connectInboxSignal';

describe('Connect message inbox invalidation', () => {
  it('tracks missed notifications across mount/unmount with account isolation', () => {
    const mine = 'inbox-signal-account-a';
    const other = 'inbox-signal-account-b';
    const before = connectInboxRevision(mine);
    const calls: string[] = [];
    const unsubscribe = subscribeConnectInboxChanged(id => calls.push(id));
    notifyConnectInboxChanged(mine);
    expect(connectInboxRevision(mine)).toBe(before + 1);
    expect(connectInboxRevision(other)).toBe(0);
    expect(calls).toEqual([mine]);
    unsubscribe();
    notifyConnectInboxChanged(mine);
    expect(connectInboxRevision(mine)).toBe(before + 2);
    expect(calls).toEqual([mine]);
  });

  it('ignores empty identities and only accepts Connect message push types', () => {
    const before = connectInboxRevision('');
    notifyConnectInboxChanged('');
    expect(connectInboxRevision('')).toBe(before);
    for (const kind of ['direct_message', 'connect_message', 'scope_message', 'community_message', 'cluster_message']) {
      expect(isConnectMessageNotification(kind)).toBe(true);
    }
    for (const kind of ['ptt_incoming', 'ptt_sos', 'ad_approved', 'post_comment', 'unrelated', null]) {
      expect(isConnectMessageNotification(kind)).toBe(false);
    }
  });
});
