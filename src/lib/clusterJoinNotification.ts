export const CLUSTER_JOIN_APPROVE_ACTION = 'CLUSTER_JOIN_APPROVE';
export const CLUSTER_JOIN_DECLINE_ACTION = 'CLUSTER_JOIN_DECLINE';

export type ClusterJoinNotificationMode = 'review' | 'invite';

export type ClusterJoinNotificationAction = {
  mode: ClusterJoinNotificationMode;
  scopeId: string;
  requesterUserId: string | null;
  approveLabel: string;
  declineLabel: string;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function clusterJoinNotificationAction(
  kind: string,
  data: Record<string, unknown> | null | undefined,
): ClusterJoinNotificationAction | null {
  const normalizedKind = clean(kind).toLowerCase();
  const payload = data ?? {};

  if (clean(payload.resolved)) {
    return null;
  }

  const scopeId = clean(payload.scope_id);
  if (!scopeId) {
    return null;
  }

  if (normalizedKind === 'cluster_join_request') {
    const requesterUserId = clean(payload.requester_user_id);
    if (!requesterUserId) {
      return null;
    }

    return {
      mode: 'review',
      scopeId,
      requesterUserId,
      approveLabel: 'APPROVE',
      declineLabel: 'DECLINE',
    };
  }

  if (normalizedKind === 'cluster_invite') {
    return {
      mode: 'invite',
      scopeId,
      requesterUserId: null,
      approveLabel: 'ACCEPT',
      declineLabel: 'DECLINE',
    };
  }

  return null;
}
