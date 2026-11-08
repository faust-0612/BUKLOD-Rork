import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import BuklodConnectThread from '@/components/BuklodConnectThread';
import ConnectRenderBoundary from '@/components/connect/ConnectRenderBoundary';
import BuklodScopeRouteState from '@/components/BuklodScopeRouteState';
import { firstRouteParam } from '@/lib/buklodScopeRoute';

export default function CommunityConnectThreadRoute() {
  const params = useLocalSearchParams<{
    scopeId?: string | string[];
    scopeName?: string | string[];
    scopeType?: string | string[];
    focusMessageId?: string | string[];
  }>();

  const scopeId = firstRouteParam(params.scopeId);
  const focusMessageId = firstRouteParam(params.focusMessageId);
  const scopeName = firstRouteParam(params.scopeName);
  const scopeType = firstRouteParam(params.scopeType);

  if (!scopeId) {
    return (
      <BuklodScopeRouteState
        access="not_found"
        title="Connect room unavailable"
        message="This scoped conversation link is missing a workspace identity."
        onBack={() => {
          router.back();
        }}
      />
    );
  }

  const initialSubtitle = scopeType
    ? scopeType === 'LOCAL'
      ? 'BARANGAY • AUTOMATIC ROOM'
      : `${scopeType} • AUTOMATIC ROOM`
    : undefined;

  return (
    <ConnectRenderBoundary surface="community_thread">
      <BuklodConnectThread
      mode="scope"
      focusMessageId={focusMessageId}
      containerId={scopeId}
      initialTitle={scopeName || undefined}
      initialSubtitle={initialSubtitle}
      />
    </ConnectRenderBoundary>
  );
}
