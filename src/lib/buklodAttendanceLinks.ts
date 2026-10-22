import Constants from 'expo-constants';

import { scopeRouteParams } from '@/lib/buklodScopeManage';

function inviteScheme(): string {
  const scheme = Constants.expoConfig?.scheme;

  if (typeof scheme === 'string' && scheme.trim()) {
    return scheme.trim();
  }

  return 'buklod';
}

export const ATTENDANCE_CHECKER_SCHEME =
  'buklod-attendance';

export const ATTENDANCE_WORKSPACE_INSTRUCTIONS = [
  '1. Open BUKLOD and sign in with your account.',
  '2. You must be an active member of this Organization or Cluster.',
  '3. Tap the shared Events & Attendance link, or open your scope home and tap Events & Attendance.',
  '4. Select the event, then use Open Attendance Checker or Manual Check-in.',
  '5. For QR check-in, members show their Attendance QR from Profile → Attendance QR.',
].join('\n');

export const ATTENDANCE_CHECKER_INSTRUCTIONS = [
  '1. Install and open the BUKLOD Attendance Checker app.',
  '2. Sign in with the same BUKLOD account used in this Organization or Cluster.',
  '3. Open the event link below, or pick the event inside the Attendance Checker.',
  '4. Use QR scan, face, biometric, or manual check-in as allowed for the event.',
].join('\n');

export function buildAttendanceWorkspaceUrl(
  scopeId: string,
  extra: {
    eventId?: string;
    eventTitle?: string;
  } = {}
): string {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return '';
  }

  const params = new URLSearchParams(
    scopeRouteParams(id, {
      ...(extra.eventId
        ? { eventId: extra.eventId }
        : {}),
      ...(extra.eventTitle
        ? { eventTitle: extra.eventTitle }
        : {}),
    })
  );

  return `${inviteScheme()}://scope/attendance?${params.toString()}`;
}

export function buildAttendanceReportUrl(
  scopeId: string,
  extra: {
    eventId?: string;
    eventTitle?: string;
  } = {}
): string {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return '';
  }

  const params = new URLSearchParams(
    scopeRouteParams(id, {
      ...(extra.eventId
        ? { eventId: extra.eventId }
        : {}),
      ...(extra.eventTitle
        ? { eventTitle: extra.eventTitle }
        : {}),
    })
  );

  return `${inviteScheme()}://scope/attendance/report?${params.toString()}`;
}

export function buildAttendanceCheckerUrl(eventId: string): string {
  const id = String(eventId ?? '').trim();

  return `${ATTENDANCE_CHECKER_SCHEME}://event/${encodeURIComponent(id)}`;
}

export function parseAttendanceDeepLink(url: string): {
  scopeId: string | null;
  eventId: string | null;
  report: boolean;
} {
  const trimmed = String(url ?? '').trim();

  if (!trimmed) {
    return {
      scopeId: null,
      eventId: null,
      report: false,
    };
  }

  const report =
    /\/scope\/attendance\/report/i.test(trimmed) ||
    /scope\/attendance\/report/i.test(trimmed);

  const scopeKeys = [
    'scopeId',
    'scope_id',
    'organization',
    'organizationId',
    'cluster',
    'clusterId',
    'id',
  ];

  let scopeId: string | null = null;
  let eventId: string | null = null;

  try {
    const normalized = trimmed.includes('://')
      ? new URL(trimmed)
      : new URL(`https://placeholder.local${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`);

    for (const key of scopeKeys) {
      const value = normalized.searchParams.get(key)?.trim();

      if (value) {
        scopeId = value;
        break;
      }
    }

    eventId =
      normalized.searchParams.get('eventId')?.trim() ||
      normalized.searchParams.get('event_id')?.trim() ||
      null;
  } catch {
    for (const key of scopeKeys) {
      const match = trimmed.match(
        new RegExp(`[?&]${key}=([^&#]+)`, 'i')
      );

      if (match?.[1]) {
        scopeId = decodeURIComponent(match[1]);
        break;
      }
    }

    const eventMatch = trimmed.match(
      /[?&]eventId=([^&#]+)/i
    );

    if (eventMatch?.[1]) {
      eventId = decodeURIComponent(eventMatch[1]);
    }
  }

  return {
    scopeId,
    eventId,
    report,
  };
}
