import { communityUnreadTabCounts } from '@/lib/connectInboxBadgeTotals';
import fs from 'fs';
import path from 'path';

describe('Connect unread indicators', () => {
  it('shows a Cluster badge for unread cluster messages, not for empty rooms', () => {
    expect(communityUnreadTabCounts([
      { scope_type: 'CLUSTER', unread_count: 1 },
      { scope_type: 'CLUSTER', unread_count: 0 },
      { scope_type: 'ORGANIZATION', unread_count: 2 },
      { scope_type: 'LOCAL', unread_count: 5 },
    ])).toEqual({ cluster: 1, org: 2 });
  });

  it('aggregates cluster and organization unread counts independently', () => {
    expect(communityUnreadTabCounts([
      { scope_type: 'CLUSTER', unread_count: 2 },
      { scope_type: 'CLUSTER', unread_count: 3 },
      { scope_type: 'ORGANIZATION', unread_count: 4 },
      { scope_type: 'ORGANIZATION', unread_count: 1 },
    ])).toEqual({ cluster: 5, org: 5 });
  });

  it('does not create false indicators from invalid counts', () => {
    expect(communityUnreadTabCounts([
      { scope_type: 'CLUSTER', unread_count: -1 },
      { scope_type: 'CLUSTER', unread_count: NaN },
      { scope_type: 'ORGANIZATION', unread_count: 0 },
    ])).toEqual({ cluster: 0, org: 0 });
  });

  it('only renders a room marker if the message is actually unread', () => {
    const row = fs.readFileSync(path.join(process.cwd(), 'src/components/connect/ConnectCommunityRow.tsx'), 'utf8');
    expect(row).toContain('unread > 0 && <View pointerEvents="none" style={styles.threadNode} />');
    expect(row).toContain("backgroundColor: '#C62828'");
    const tabs = fs.readFileSync(path.join(process.cwd(), 'src/components/connect/ConnectInboxTabs.tsx'), 'utf8');
    expect(tabs).toContain('{unreadBadge(clusterUnread)}');
    expect(tabs).toContain('{unreadBadge(orgUnread)}');
    expect(tabs).toContain('{unreadBadge(personalUnread)}');
  });
});
