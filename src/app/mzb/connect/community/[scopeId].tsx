import React from 'react';

import {
  Redirect,
  useLocalSearchParams,
} from 'expo-router';

import {
  firstRouteParam,
} from '@/lib/buklodScopeRoute';

export default function MzbCommunityThreadRedirect() {
  const params =
    useLocalSearchParams<{
      scopeId?: string | string[];
      conversationId?: string | string[];
      scopeName?: string | string[];
      scopeType?: string | string[];
    }>();

  const scopeId = firstRouteParam(params.scopeId);

  return (
    <Redirect
      href={{
        pathname: '/connect/community/[scopeId]',
        params: {
          scopeId,
          conversationId: firstRouteParam(params.conversationId),
          scopeName: firstRouteParam(params.scopeName),
          scopeType: firstRouteParam(params.scopeType),
        },
      } as any}
    />
  );
}
