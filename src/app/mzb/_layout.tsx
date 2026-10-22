import React from 'react';

import {
  Stack,
} from 'expo-router';

/*
 * MZB routes are legacy aliases. Workspace UI lives in /scope.
 * Individual screens redirect via BuklodMzbLegacyRedirect or tab wrappers.
 */
export default function MzbLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    />
  );
}
