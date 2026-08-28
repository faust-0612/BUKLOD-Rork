import React from 'react';

import {
  Redirect,
  useLocalSearchParams,
} from 'expo-router';

import {
  firstRouteParam,
} from '@/lib/buklodScopeRoute';

export default function MzbPersonalThreadRedirect() {
  const params =
    useLocalSearchParams<{
      threadId?: string | string[];
      targetUserId?: string | string[];
      otherUserId?: string | string[];
      otherUserName?: string | string[];
    }>();

  const threadId = firstRouteParam(params.threadId);

  return (
    <Redirect
      href={{
        pathname: '/connect/personal/[threadId]',
        params: {
          threadId,
          targetUserId: firstRouteParam(params.targetUserId),
          otherUserId: firstRouteParam(params.otherUserId),
          otherUserName: firstRouteParam(params.otherUserName),
        },
      } as any}
    />
  );
}
