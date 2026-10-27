import {
  resolveBuklodNotificationTarget,
} from '@/lib/buklodNotificationNavigation';

describe(
  'Daily Reading notification navigation',
  () => {
    it(
      'opens the canonical Daily Reading doorway and does not pass assignment_id',
      () => {
        const target =
          resolveBuklodNotificationTarget(
            'formation_daily_reading_reminder',
            {
              assignment_id:
                'assignment-old-route',
              date:
                '2026-10-06',
            }
          );

        expect(target?.path).toBe(
          '/bible/read?source=daily_plan&assignedDate=2026-10-06'
        );

        expect(
          target?.path.includes(
            'assignment_id'
          )
        ).toBe(false);
      }
    );

    it(
      'still opens the canonical Daily Reading doorway when assignment id is absent',
      () => {
        const target =
          resolveBuklodNotificationTarget(
            'formation_daily_reading_reminder',
            {
              date:
                '2026-10-06',
            }
          );

        expect(target?.path).toBe(
          '/bible/read?source=daily_plan&assignedDate=2026-10-06'
        );
      }
    );
  }
);


describe('Exact notification destinations', () => {
  it('opens a scoped new post at its exact record, not the Connect workspace', () => {
    expect(resolveBuklodNotificationTarget('community_post', {
      post_id: 'post-123', scope_id: 'scope-123',
    })?.path).toBe('/post/post-123');
  });

  it('opens a comment notification at the actual post', () => {
    expect(resolveBuklodNotificationTarget('community_comment', {
      post_id: 'post-456', scope_id: 'scope-123',
    })?.path).toBe('/post/post-456');
  });

  it('opens approved membership notifications at the exact Cluster Home', () => {
    expect(resolveBuklodNotificationTarget('cluster_join_result', {
      scope_id: 'cluster-123', resolved: 'APPROVED',
      route: '/clusters/cluster-123',
    })).toEqual({
      path: '/scope?section=home&scopeId=cluster-123',
      scopeId: 'cluster-123',
    });
  });

  it('keeps declined memberships on the Cluster detail and invitations on acceptance', () => {
    expect(resolveBuklodNotificationTarget('cluster_join_result', {
      scope_id: 'cluster-123', resolved: 'DECLINED',
    })?.path).toBe('/clusters/cluster-123');
    expect(resolveBuklodNotificationTarget('cluster_invite', {
      scope_id: 'cluster-123',
    })?.path).toBe('/clusters/cluster-123?fromInvite=1');
    expect(resolveBuklodNotificationTarget('cluster_join_request', {
      scope_id: 'cluster-123',
    })?.path).toBe('/clusters/join-requests?cluster=cluster-123');
  });

  it('keeps personal messages routed to the exact thread', () => {
    expect(resolveBuklodNotificationTarget('direct_message', {
      conversation_id: 'thread-789',
    })?.path).toBe('/connect/personal/thread-789');
  });

  it('does not invent a post destination when the post id is missing', () => {
    expect(resolveBuklodNotificationTarget('community_post', {
      scope_id: 'scope-123',
    })?.path).toBe('/scope?section=community&scopeId=scope-123');
  });
});
