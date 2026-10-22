import {
  respondClusterInvite,
  reviewClusterRequest,
} from '@/lib/buklodClusters';
import {
  clusterJoinNotificationAction,
} from '@/lib/clusterJoinNotification';

export async function runClusterJoinNotificationAction(input: {
  kind: string;
  data: Record<string, unknown> | null | undefined;
  approve: boolean;
}) {
  const action = clusterJoinNotificationAction(
    input.kind,
    input.data,
  );

  if (!action) {
    throw new Error('This Cluster notification is already finished.');
  }

  if (action.mode === 'review') {
    if (!action.requesterUserId) {
      throw new Error('This request is missing the member.');
    }

    await reviewClusterRequest(
      action.scopeId,
      action.requesterUserId,
      input.approve,
    );
    return;
  }

  await respondClusterInvite(
    action.scopeId,
    input.approve,
  );
}
