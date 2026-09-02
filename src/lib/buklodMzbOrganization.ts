import { getMyMzb } from '@/lib/buklodMzb';

/** Stable slug for the canonical MZB Ministry Organization scope. */
export const MZB_ORGANIZATION_CANONICAL_SLUG = 'mzb-ministry-inc';

export type MzbOrganizationScopeLike = {
  scope_id?: string | null;
  id?: string | null;
  scope_type?: string | null;
  slug?: string | null;
  metadata?: Record<string, unknown> | null;
};

let cachedCanonicalScopeId: string | null = null;

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function readMetadata(
  scope: MzbOrganizationScopeLike | null | undefined
) {
  if (
    !scope?.metadata ||
    typeof scope.metadata !== 'object' ||
    Array.isArray(scope.metadata)
  ) {
    return {} as Record<string, unknown>;
  }

  return scope.metadata;
}

function readScopeId(
  scope: MzbOrganizationScopeLike | null | undefined
) {
  return String(scope?.scope_id ?? scope?.id ?? '').trim();
}

function isTruthyFlag(value: unknown) {
  return ['true', '1', 'yes', 'on'].includes(normalize(value));
}

/**
 * Canonical MZB Ministry identity uses stable slug / metadata — never display name.
 */
export function isMzbOrganizationScopeByMetadata(
  scope: MzbOrganizationScopeLike | null | undefined
): boolean {
  if (!scope || String(scope.scope_type ?? '').toUpperCase() !== 'ORGANIZATION') {
    return false;
  }

  if (normalize(scope.slug) === MZB_ORGANIZATION_CANONICAL_SLUG) {
    return true;
  }

  const metadata = readMetadata(scope);

  if (normalize(metadata.organization_code) === 'mzb') {
    return true;
  }

  if (isTruthyFlag(metadata.is_mzb)) {
    return true;
  }

  if (
    String(metadata.organization_type ?? '')
      .trim()
      .toUpperCase() === 'MZB_MINISTRY'
  ) {
    return true;
  }

  if (isTruthyFlag(metadata.is_default_organization)) {
    return true;
  }

  return false;
}

export function isMzbOrganizationScope(
  scope: MzbOrganizationScopeLike | null | undefined,
  canonicalScopeId?: string | null
): boolean {
  const scopeId = readScopeId(scope);

  if (
    canonicalScopeId &&
    scopeId &&
    scopeId === String(canonicalScopeId).trim()
  ) {
    return true;
  }

  return isMzbOrganizationScopeByMetadata(scope);
}

export async function resolveMzbOrganizationScopeId(
  forceRefresh = false
): Promise<string | null> {
  if (!forceRefresh && cachedCanonicalScopeId) {
    return cachedCanonicalScopeId;
  }

  try {
    const status = await getMyMzb();
    const scopeId = String(status?.scope_id ?? '').trim();

    if (scopeId) {
      cachedCanonicalScopeId = scopeId;
      return scopeId;
    }
  } catch {
    // buklod_my_mzb may be unavailable before migration apply.
  }

  cachedCanonicalScopeId = null;
  return null;
}

export function findMzbOrganizationScope<T extends MzbOrganizationScopeLike>(
  scopes: T[],
  canonicalScopeId?: string | null
): T | null {
  if (canonicalScopeId) {
    const byId = scopes.find(
      (scope) => readScopeId(scope) === String(canonicalScopeId).trim()
    );

    if (byId) {
      return byId;
    }
  }

  const bySlug = scopes.find(
    (scope) =>
      normalize(scope.slug) === MZB_ORGANIZATION_CANONICAL_SLUG
  );

  if (bySlug) {
    return bySlug;
  }

  return scopes.find((scope) => isMzbOrganizationScopeByMetadata(scope)) ?? null;
}

type MzbMemberScopeLike = MzbOrganizationScopeLike & {
  membership_status?: string | null;
  is_mzb_organization?: boolean;
};

export function findActiveMzbMemberScope<T extends MzbMemberScopeLike>(
  scopes: T[],
  canonicalScopeId?: string | null
): T | null {
  const canonicalId = String(
    canonicalScopeId ?? cachedCanonicalScopeId ?? ''
  ).trim();

  const activeOrganizationScopes = scopes.filter((scope) => {
    if (String(scope.scope_type ?? '').toUpperCase() !== 'ORGANIZATION') {
      return false;
    }

    const membership = String(scope.membership_status ?? '')
      .trim()
      .toUpperCase();

    if (membership && membership !== 'ACTIVE') {
      return false;
    }

    const scopeId = readScopeId(scope);

    if (canonicalId && scopeId === canonicalId) {
      return true;
    }

    return (
      Boolean(scope.is_mzb_organization) ||
      isMzbOrganizationScopeByMetadata(scope)
    );
  });

  return (
    findMzbOrganizationScope(
      activeOrganizationScopes,
      canonicalId || null
    ) ?? null
  );
}
