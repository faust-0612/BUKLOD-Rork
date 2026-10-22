import React, {
  useEffect,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  usePathname,
} from 'expo-router';

import BuklodScopeRouteState
  from '@/components/BuklodScopeRouteState';

import {
  enterScopedWorkspace,
  type ScopedWorkspaceSection,
} from '@/lib/buklodScopeRoute';

import {
  useResolvedScope,
} from '@/hooks/useResolvedScope';

import {
  colors,
} from '@/lib/theme';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

function sectionFromPath(
  pathname: string
): ScopedWorkspaceSection {
  if (
    pathname.includes('/messages') ||
    pathname.includes('/connect')
  ) {
    return 'connect';
  }

  if (pathname.includes('/community')) {
    return 'community';
  }

  return 'home';
}

/**
 * Redirects legacy /mzb/* workspace routes to the canonical /scope workspace.
 */
export default function BuklodMzbLegacyRedirect() {
  const pathname =
    usePathname();

  const {
    selectScope,
  } = useBuklodScope();

  const resolution =
    useResolvedScope({
      mzbOnly: true,
      syncActiveScope: true,
    });

  const section =
    sectionFromPath(pathname);

  useEffect(() => {
    if (
      resolution.access !== 'authorized' ||
      !resolution.scope
    ) {
      return;
    }

    void enterScopedWorkspace(
      selectScope,
      resolution.scope.scope_id,
      {
        section,
        navigation: 'replace',
      }
    );
  }, [
    resolution.access,
    resolution.scope?.scope_id,
    section,
    selectScope,
  ]);

  return (
    <BuklodScopeRouteState
      access={resolution.access}
      title="Opening MZB workspace"
      message={resolution.message}
      loadingLabel="Opening MZB Ministry workspace..."
      onRetry={() => {
        void resolution.refresh();
      }}
    />
  );
}

export function BuklodMzbLegacyRedirectLoading({
  label = 'Redirecting...',
}: {
  label?: string;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor:
        colors.background,
    },

    text: {
      marginTop: 10,
      fontSize: 10,
      fontWeight: '800',
      color: colors.muted,
    },
  });
