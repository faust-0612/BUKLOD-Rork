import React from 'react';

import {
  Redirect,
  useLocalSearchParams,
} from 'expo-router';

function firstParam(
  value?: string | string[]
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

/*
 * Legacy deep links:
 *   /connect/{conversation_id}  -> personal thread
 *   /connect/{user_id}            -> new personal thread (legacy people search)
 *
 * Modern routes use /connect/personal/[threadId] directly.
 */
export default function LegacyConnectIdRedirect() {
  const params =
    useLocalSearchParams<{
      id?: string | string[];
      mode?: string | string[];
    }>();

  const id = firstParam(params.id);
  const mode = firstParam(params.mode);

  if (!id) {
    return (
      <Redirect
        href={
          '/messages' as any
        }
      />
    );
  }

  if (mode === 'user') {
    return (
      <Redirect
        href={{
          pathname:
            '/connect/personal/[threadId]',
          params: {
            threadId: 'new',
            targetUserId: id,
          },
        } as any}
      />
    );
  }

  return (
    <Redirect
      href={{
        pathname:
          '/connect/personal/[threadId]',
        params: {
          threadId: id,
        },
      } as any}
    />
  );
}
