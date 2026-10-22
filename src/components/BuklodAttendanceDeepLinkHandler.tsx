import {
  useEffect,
  useRef,
} from 'react';

import { Linking } from 'react-native';

import { router } from 'expo-router';

import {
  parseAttendanceDeepLink,
} from '@/lib/buklodAttendanceLinks';
import {
  scopeAttendanceReportRoute,
  scopeAttendanceRoute,
} from '@/lib/buklodScopeManage';

import { useAuth } from '@/providers/AuthProvider';

async function openAttendanceDeepLink(
  url: string,
  hasSession: boolean
) {
  const target = parseAttendanceDeepLink(url);

  if (!target.scopeId) {
    return false;
  }

  if (!hasSession) {
    router.push('/(auth)/login' as any);
    return true;
  }

  const extra: Record<string, string> = {};

  if (target.eventId) {
    extra.eventId = target.eventId;
  }

  router.replace(
    target.report
      ? (scopeAttendanceReportRoute(
          target.scopeId,
          extra
        ) as any)
      : (scopeAttendanceRoute(
          target.scopeId,
          extra
        ) as any)
  );

  return true;
}

export default function BuklodAttendanceDeepLinkHandler() {
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

      const key = url;

      if (lastHandledRef.current === key) {
        return;
      }

      const handled = await openAttendanceDeepLink(
        url,
        Boolean(session?.user?.id)
      );

      if (handled) {
        lastHandledRef.current = key;
      }
    };

    void Linking.getInitialURL().then(handleUrl);

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
  }, [loading, session?.user?.id]);

  return null;
}
