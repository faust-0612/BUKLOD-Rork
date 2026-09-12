import React, { type ReactNode } from 'react';

/**
 * Web build intentionally does not import expo-notifications.
 * Native push remains handled by BuklodReportNotificationProvider.tsx.
 * In-app Report assignments are still loaded from Supabase on web.
 */
export default function BuklodReportNotificationProviderWeb({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
