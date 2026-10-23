import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';

export const PENDING_CLUSTER_INVITE_KEY =
  'buklod_pending_cluster_invite_v1';

/** Canonical Cluster invite deep link — shared by QR, Share, and Manage. */
export function buildClusterInviteUrl(scopeId: string): string {
  const id = String(scopeId ?? '').trim();

  return `https://buklod.expo.app/clusters/${encodeURIComponent(id)}?fromInvite=1`;
}

function validScopeId(raw: string): string | null {
  try {
    const id = decodeURIComponent(raw);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Parse invite URL back to scope id (supports production + staging schemes). */
export function parseClusterInviteUrl(url: string): string | null {
  const trimmed = String(url ?? '').trim();

  if (!trimmed) {
    return null;
  }

  const schemeMatch = trimmed.match(
    /^buklod(?:-staging)?:\/\/clusters\/([^/?#]+)/i
  );

  if (schemeMatch?.[1]) {
    return validScopeId(schemeMatch[1]);
  }

  const pathMatch = trimmed.match(
    /^https:\/\/buklod\.expo\.app\/clusters\/([^/?#]+)/i
  );

  if (pathMatch?.[1]) {
    return validScopeId(pathMatch[1]);
  }

  return null;
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

  if (!validScopeId(id)) {
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
