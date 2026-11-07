/**
 * Foreground emergency push bridge. Does not send notifications or authorize
 * incident data. The verified global host handles all database checks.
 */
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { emitBuklodEmergencySignal, isBuklodEmergencyId } from '@/lib/buklodEmergencySignal';

export default function BuklodEmergencyPushBridge() {
  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(notification => {
      const payload = notification.request.content.data;
      if (String(payload?.kind ?? '') !== 'community_emergency') return;
      const id = payload?.help_request_id;
      if (!isBuklodEmergencyId(id)) return;
      emitBuklodEmergencySignal({ incidentId: id, origin: 'recipient' });
    });
    return () => { received.remove(); };
  }, []);
  return null;
}
