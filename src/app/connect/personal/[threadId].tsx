import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import BuklodConnectThread from '@/components/BuklodConnectThread';
import ConnectRenderBoundary from '@/components/connect/ConnectRenderBoundary';
import BuklodScopeRouteState from '@/components/BuklodScopeRouteState';
import { firstRouteParam } from '@/lib/buklodScopeRoute';

export default function PersonalConnectThreadRoute() {
  const params = useLocalSearchParams<{
    threadId?: string | string[];
    targetUserId?: string | string[];
    otherUserId?: string | string[];
    otherUserName?: string | string[];
  }>();

  const threadId = firstRouteParam(params.threadId);
  const targetUserId = firstRouteParam(params.targetUserId);
  const otherUserId = firstRouteParam(params.otherUserId);
  const otherUserName = firstRouteParam(params.otherUserName);

  if (!threadId && !targetUserId) {
    return (
      <BuklodScopeRouteState
        access="not_found"
        title="Message thread unavailable"
        message="This conversation link is missing a thread or recipient."
        onBack={() => {
          router.back();
        }}
      />
    );
  }

  const pendingNewThread =
    threadId === 'new' && !!targetUserId;

  return (
    <ConnectRenderBoundary surface="personal_thread">
      <BuklodConnectThread
      mode="direct"
      containerId={
        pendingNewThread
          ? ''
          : (threadId ?? '')
      }
      pendingTargetUserId={
        pendingNewThread
          ? targetUserId
          : undefined
      }
      initialTitle={
        otherUserName || undefined
      }
      initialOtherUserId={
        otherUserId || targetUserId || undefined
      }
      />
    </ConnectRenderBoundary>
  );
}
