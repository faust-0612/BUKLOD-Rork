/**
 * Canonical BUKLOD Report navigation helpers.
 * Routes to the real report workspace — never generic admin-module records.
 */

export type BuklodReportRouteParams = {
  scopeId?: string;
  reportAssignmentId?: string;
  section?: 'home' | 'definitions';
};

function firstReportRouteParam(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

export function readReportScopeId(
  params: Record<string, unknown> | null | undefined
): string {
  if (!params) return '';

  const keys = [
    'scope_id',
    'scopeId',
    'organization',
    'organizationId',
    'cluster',
    'clusterId',
  ];

  for (const key of keys) {
    const value = firstReportRouteParam(params[key]);
    if (value) return value;
  }

  return '';
}

export function readReportAssignmentId(
  params: Record<string, unknown> | null | undefined
): string {
  if (!params) return '';

  const keys = [
    'report_assignment_id',
    'reportAssignmentId',
    'assignment_id',
    'assignmentId',
  ];

  for (const key of keys) {
    const value = firstReportRouteParam(params[key]);
    if (value) return value;
  }

  return '';
}

export function buklodReportRouteParams(
  scopeId: string,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    scope_id: scopeId,
    scopeId,
    organization: scopeId,
    ...extra,
  };
}

export function buklodReportLandingPath(
  scopeId?: string,
  reportAssignmentId?: string
): string {
  const query = new URLSearchParams();

  if (scopeId?.trim()) {
    query.set('scope_id', scopeId.trim());
  }
  if (reportAssignmentId?.trim()) {
    query.set('report_assignment_id', reportAssignmentId.trim());
  }

  const suffix = query.toString();
  return suffix ? `/reports?${suffix}` : '/reports';
}

/**
 * Historical name retained for compatibility with existing callers.
 * Admins now enter the Report Library first; deadline management remains
 * available from the library as a separate action.
 */
export function buklodReportDefinitionsPath(scopeId: string): string {
  const query = new URLSearchParams({
    scope_id: scopeId.trim(),
  });

  return `/reports/library?${query.toString()}`;
}
