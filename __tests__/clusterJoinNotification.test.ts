import {
  clusterJoinNotificationAction,
} from '@/lib/clusterJoinNotification';
import { resolveBuklodNotificationTarget } from '@/lib/buklodNotificationNavigation';

describe('Cluster join notifications', () => {
  it('opens the join-request screen for an admin approval notification', () => {
    const target = resolveBuklodNotificationTarget(
      'cluster_join_request',
      {
        scope_id: 'cluster-1',
        requester_user_id: 'member-1',
      },
    );

    expect(target?.path).toBe(
      '/clusters/join-requests?cluster=cluster-1',
    );
    expect(target?.scopeId).toBe('cluster-1');
  });

  it('offers approve and decline until the request is finished', () => {
    expect(
      clusterJoinNotificationAction('cluster_join_request', {
        scope_id: 'cluster-1',
        requester_user_id: 'member-1',
      }),
    ).toMatchObject({
      mode: 'review',
      approveLabel: 'APPROVE',
      declineLabel: 'DECLINE',
    });

    expect(
      clusterJoinNotificationAction('cluster_join_request', {
        scope_id: 'cluster-1',
        requester_user_id: 'member-1',
        resolved: 'APPROVED',
      }),
    ).toBeNull();
  });

  it('offers accept and decline on a Cluster invitation', () => {
    const target = resolveBuklodNotificationTarget(
      'cluster_invite',
      { scope_id: 'cluster-9' },
    );

    expect(target?.path).toBe('/clusters/cluster-9');
    expect(
      clusterJoinNotificationAction('cluster_invite', {
        scope_id: 'cluster-9',
      })?.approveLabel,
    ).toBe('ACCEPT');
  });
});
