import React from 'react';

import {
  Redirect,
} from 'expo-router';

/*
 * PATCH_171E_DISABLE_LEGACY_CONNECT_ID
 *
 * This was the old duplicate personal-message screen.
 *
 * Personal conversations now live only at:
 *   /connect/personal/[threadId]
 *
 * Calls are handled by BuklodConnectThread +
 * the globally mounted RingingCalls component.
 *
 * Never render a second conversation here.
 */
export default function
LegacyConnectIdRedirect() {
  return (
    <Redirect
      href={
        '/messages' as any
      }
    />
  );
}