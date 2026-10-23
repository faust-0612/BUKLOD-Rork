import {
  useEffect,
  useRef,
} from 'react';

import { Linking } from 'react-native';

import { router } from 'expo-router';

import {
  clusterInviteRoute,
  consumePendingClusterInvite,
  parseClusterInviteUrl,
  storePendingClusterInvite,
} from '@/lib/buklodClusterInvite';

import { useAuth } from '@/providers/AuthProvider';

async function openClusterInvite(
  scopeId: string,
  hasSession: boolean
) {
  if (!hasSession) {
    await storePendingClusterInvite(scopeId);
    router.push('/(auth)/login' as any);
    return;
  }

  router.replace(
    clusterInviteRoute(scopeId) as any
  );
}

export default function BuklodClusterInviteDeepLinkHandler() {
  const {
    session,
    loading,
  } = useAuth();

  const lastHandledRef =
    useRef('');

  useEffect(() => {
    if (loading) {
      return;
    }

    const handleUrl = async (
      url: string | null
    ) => {
      if (!url) {
        return;
      }

      const scopeId =
        parseClusterInviteUrl(url);

      if (!scopeId) {
        return;
      }

      const key =
        `${scopeId}|${url}`;

      if (
        lastHandledRef.current ===
        key
      ) {
        return;
      }

      lastHandledRef.current =
        key;

      await openClusterInvite(
        scopeId,
        Boolean(session?.user?.id)
      );
    };

    // Initial URL is processed once per mount; auth transitions use the pending invite.
    if (!lastHandledRef.current) {
      void Linking.getInitialURL().then(handleUrl).catch(() => {});
    }

    const subscription =
      Linking.addEventListener(
        'url',
        (event) => {
          void handleUrl(event.url);
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    loading,
    session?.user?.id,
  ]);

  useEffect(() => {
    if (
      loading ||
      !session?.user?.id
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const scopeId =
        await consumePendingClusterInvite();

      if (
        cancelled ||
        !scopeId
      ) {
        return;
      }

      router.replace(
        clusterInviteRoute(
          scopeId
        ) as any
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    session?.user?.id,
  ]);

  return null;
}
