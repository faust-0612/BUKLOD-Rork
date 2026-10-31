import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';
import Constants from 'expo-constants';

import {
  buildClusterInviteUrlForScheme,
  parseClusterInviteLink,
} from '@/lib/buklodClusterInviteUrl';

export const PENDING_CLUSTER_INVITE_KEY =
  'buklod_pending_cluster_invite_v1';

/** Public HTTPS link shared by Cluster Share, Copy and QR. */
export function buildClusterInviteUrl(scopeId: string): string {
  const scheme = Constants.expoConfig?.scheme;
  return buildClusterInviteUrlForScheme(
    scopeId,
    typeof scheme === 'string' ? scheme : 'buklod'
  );
}

/** Preserve legacy custom-scheme links in previously shared messages. */
export function parseClusterInviteUrl(url: string): string | null {
  return parseClusterInviteLink(url);
}

/** Expo Router path for the same destination as the deep link. */
export function clusterInviteRoute(scopeId: string) {
  return {
    pathname: '/clusters/[id]' as const,
    params: {
      id: scopeId,
      fromInvite: '1',
    },
  };
}

export async function storePendingClusterInvite(
  scopeId: string
) {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return;
  }

  await AsyncStorage.setItem(
    PENDING_CLUSTER_INVITE_KEY,
    id
  );
}

export async function consumePendingClusterInvite(): Promise<
  string | null
> {
  const scopeId = await AsyncStorage.getItem(
    PENDING_CLUSTER_INVITE_KEY
  );

  if (!scopeId?.trim()) {
    return null;
  }

  await AsyncStorage.removeItem(
    PENDING_CLUSTER_INVITE_KEY
  );

  return scopeId.trim();
}

export function navigateToClusterInvite(
  scopeId: string
) {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return;
  }

  router.push(clusterInviteRoute(id) as any);
}
