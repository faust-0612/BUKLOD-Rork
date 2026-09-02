/**
 * Canonical BUKLOD Report navigation helpers.
 * Routes to the real report workspace — never generic admin-module records.
 */

export type BuklodReportRouteParams = {
  scopeId?: string;
  section?: 'home' | 'definitions';
};

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
    const value = params[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }
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

export function buklodReportLandingPath(scopeId?: string): string {
  if (!scopeId?.trim()) {
    return '/reports';
  }

  const query = new URLSearchParams({
    scope_id: scopeId.trim(),
  });

  return `/reports?${query.toString()}`;
}

export function buklodReportDefinitionsPath(scopeId: string): string {
  const query = new URLSearchParams({
    scope_id: scopeId.trim(),
  });

  return `/reports/definitions?${query.toString()}`;
}
