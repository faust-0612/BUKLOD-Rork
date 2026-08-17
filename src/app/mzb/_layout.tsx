import React from 'react';
import {
  Stack,
} from 'expo-router';

import MzbEnvironmentShell
  from '@/components/MzbEnvironmentShell';

/*
 * PATCH_173B_R11_PERSISTENT_MZB_SHELL
 *
 * The MZB shell must live above individual pages.
 * Home / Community / Messages / Prayer now replace only
 * the route content while this shell remains mounted.
 */
export default function MzbLayout() {
  return (
    <MzbEnvironmentShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          gestureEnabled: false,
          contentStyle: {
            backgroundColor:
              'transparent',
          },
        }}
      />
    </MzbEnvironmentShell>
  );
}