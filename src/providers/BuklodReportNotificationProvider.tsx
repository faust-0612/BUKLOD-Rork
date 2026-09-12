import React, { type ReactNode, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { registerPushToken } from '@/lib/pushNotifications';
import { buklodReportLandingPath } from '@/lib/buklodReportRoutes';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

function notificationData(response: Notifications.NotificationResponse) {
  return (response.notification.request.content.data || {}) as Record<string, any>;
}

/**
 * Push shell for the standalone Report app.
 * It intentionally handles Report destinations only; unrelated BUKLOD Main
 * notifications never pull this app into Main routes.
 */
export default function BuklodReportNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeScope, selectScope } = useBuklodScope();

  useEffect(() => {
    if (!user?.id) return;
    void registerPushToken(user.id).catch((error) => {
      console.warn('BUKLOD Report push registration:', error);
    });
  }, [user?.id]);

  useEffect(() => {
    void (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('buklod-report-v1', {
            name: 'BUKLOD Report',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            enableVibrate: true,
            showBadge: true,
          });
        }
        const permission = await Notifications.getPermissionsAsync();
        if (permission.status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch (error) {
        console.warn('BUKLOD Report notification permission:', error);
      }
    })();
  }, []);

  const openResponse = useCallback(async (response: Notifications.NotificationResponse | null | undefined) => {
    if (!response) return;
    const data = notificationData(response);
    const kind = String(data.kind ?? response.notification.request.content.data?.kind ?? '').trim();
    const scopeId = String(data.scope_id ?? '').trim();
    const assignmentId = String(data.report_assignment_id ?? data.assignment_id ?? '').trim();

    if (!kind.startsWith('report_') && !assignmentId) return;

    if (scopeId && scopeId !== activeScope?.scope_id) {
      try {
        await selectScope(scopeId);
      } catch (error) {
        console.warn('BUKLOD Report notification scope sync:', error);
      }
    }

    router.push(buklodReportLandingPath(scopeId || undefined, assignmentId || undefined) as any);
  }, [activeScope?.scope_id, selectScope]);

  useEffect(() => {
    let active = true;
    const handled = new Set<string>();
    const handle = (response: Notifications.NotificationResponse | null | undefined) => {
      if (!active || !response) return;
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.has(key)) return;
      handled.add(key);
      void openResponse(response);
    };

    const initial = Notifications.getLastNotificationResponse();
    if (initial) {
      handle(initial);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handle(response);
      Notifications.clearLastNotificationResponse();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [openResponse]);

  return <>{children}</>;
}
