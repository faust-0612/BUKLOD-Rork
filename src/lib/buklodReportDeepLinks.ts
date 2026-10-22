/**
 * Deep links between Main BUKLOD and BUKLOD Report focus app.
 * Pass canonical IDs only — buklod_report_resolve_context_v1 re-validates auth.
 */

import { Linking } from 'react-native';

import type { BuklodReportCanonicalIds } from '@/lib/buklodReportContracts';

export const BUKLOD_REPORT_DEEP_LINK_SCHEME = 'buklod-report';

export type ReportDeepLinkTarget = {
  assignmentId?: string;
  submissionId?: string;
  scopeId?: string;
};

export function buildReportFocusAppDeepLink(
  target: ReportDeepLinkTarget
): string {
  if (target.submissionId) {
    return `${BUKLOD_REPORT_DEEP_LINK_SCHEME}://submission/${target.submissionId}`;
  }

  if (target.assignmentId) {
    return `${BUKLOD_REPORT_DEEP_LINK_SCHEME}://report/${target.assignmentId}`;
  }

  throw new Error('assignmentId or submissionId required for report deep link');
}

export function buildMainBuklodReportDeepLink(
  target: BuklodReportCanonicalIds
): string {
  const params = new URLSearchParams();

  if (target.report_assignment_id) {
    params.set('assignment_id', target.report_assignment_id);
  }
  if (target.submission_id) {
    params.set('submission_id', target.submission_id);
  }
  if (target.scope_id) {
    params.set('scope_id', target.scope_id);
  }

  const query = params.toString();
  return query ? `/reports/view?${query}` : '/reports';
}

export function parseReportFocusAppDeepLink(url: string): ReportDeepLinkTarget {
  const normalized = String(url ?? '').trim();

  const submissionMatch = normalized.match(
    /buklod-report:\/\/submission\/([0-9a-f-]{36})/i
  );
  if (submissionMatch) {
    return { submissionId: submissionMatch[1] };
  }

  const assignmentMatch = normalized.match(
    /buklod-report:\/\/report\/([0-9a-f-]{36})/i
  );
  if (assignmentMatch) {
    return { assignmentId: assignmentMatch[1] };
  }

  return {};
}

export async function openInBuklodReport(target: ReportDeepLinkTarget) {
  const url = buildReportFocusAppDeepLink(target);
  await Linking.openURL(url);
}

export function parseMainBuklodReportRoute(
  params: Record<string, string | string[] | undefined>
): ReportDeepLinkTarget {
  const pick = (key: string) => {
    const value = params[key];
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  };

  return {
    assignmentId: pick('assignment_id'),
    submissionId: pick('submission_id'),
    scopeId: pick('scope_id'),
  };
}

/**
 * Checkout-style message for cross-app navigation.
 * Backend must confirm authorization after navigation.
 */
export const REPORT_DEEP_LINK_AUTH_NOTE =
  'Opening report… authorization is verified by the server, not the link alone.';
