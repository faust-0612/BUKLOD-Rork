/**
 * Canonical runtime scope route contract for BUKLOD navigation.
 *
 * Resolution priority:
 * 1. explicit route params (scopeId / scope_id / organization aliases)
 * 2. current in-memory activeScope when it matches the route context
 * 3. persisted / provider scopes list only as lookup source — never override valid route params
 */

import { router } from 'expo-router';

import type { BuklodScope } from '@/lib/buklodScope';
import { isSubOrganizationScope } from '@/lib/buklodScope';
import {
  isBuklodProfileRoute,
  isBuklodScopedWorkspacePath,
  normalizeBuklodPathname,
} from '@/lib/buklodSafeArea';
import {
  isActiveMembershipStatus,
  readOrganizationScopeId,
} from '@/lib/buklodOrganization';
import {
  findActiveMzbMemberScope,
  isMzbOrganizationScope,
  resolveMzbOrganizationScopeId,
} from '@/lib/buklodMzbOrganization';

export type CanonicalScopeKind =
  | 'PUBLIC'
  | 'ORGANIZATION'
  | 'SUB_ORGANIZATION'
  | 'CLUSTER';

export type ResolvedScopeAccess =
  | 'loading'
  | 'authorized'
  | 'unauthorized'
  | 'not_found'
  | 'error';

export type ScopeResolution = {
  access: ResolvedScopeAccess;
  scope: BuklodScope | null;
  kind: CanonicalScopeKind | null;
  scopeId: string | null;
  message?: string;
};

export type BuklodNotificationPayload = {
  post_id?: string;
  conversation_id?: string;
  scope_id?: string;
  sender_id?: string;
  message_id?: string;
  scope_type?: string;
  is_mzb?: boolean | string;
};

export type BuklodNotificationTarget = {
  path: string;
  scopeId?: string | null;
};

const ROUTE_SCOPE_PARAM_KEYS = [
  'scopeId',
  'scope_id',
  'organization',
  'organizationId',
  'organization_id',
  'id',
] as const;

export function firstRouteParam(
  value?: string | string[] | null
): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return String(value ?? '').trim();
}

export function readRouteScopeId(
  params:
    | Record<string, string | string[] | undefined>
    | null
    | undefined
): string {
  if (!params) {
    return '';
  }

  for (const key of ROUTE_SCOPE_PARAM_KEYS) {
    const value = firstRouteParam(params[key]);

    if (value) {
      return value;
    }
  }

  return readOrganizationScopeId(params);
}

export function canonicalScopeKind(
  scope: BuklodScope | null | undefined
): CanonicalScopeKind | null {
  if (!scope) {
    return null;
  }

  const type = String(scope.scope_type ?? '')
    .trim()
    .toUpperCase();

  if (type === 'PUBLIC') {
    return 'PUBLIC';
  }

  if (type === 'CLUSTER') {
    return 'CLUSTER';
  }

  if (type === 'ORGANIZATION') {
    if (isSubOrganizationScope(scope)) {
      return 'SUB_ORGANIZATION';
    }

    return 'ORGANIZATION';
  }

  return null;
}

export function scopeHasActiveMembership(
  scope: BuklodScope | null | undefined
): boolean {
  if (!scope) {
    return false;
  }

  const type = String(scope.scope_type ?? '')
    .trim()
    .toUpperCase();

  if (type === 'PUBLIC' || type === 'LOCAL') {
    return true;
  }

  return isActiveMembershipStatus(scope.membership_status) ||
    !String(scope.membership_status ?? '').trim();
}

export function findScopeById(
  scopes: BuklodScope[],
  scopeId: string | null | undefined
): BuklodScope | null {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return null;
  }

  return scopes.find((scope) => scope.scope_id === id) ?? null;
}

export function buildScopedWorkspacePath(
  section: 'home' | 'community' | 'connect',
  scopeId: string
) {
  return `/scope?section=${section}&scopeId=${encodeURIComponent(scopeId)}`;
}

/** Organization, Sub-organization, and Cluster use `/scope` — not the global tab dashboard. */
export function isManagedCommunityScopeType(
  scopeType: string | null | undefined,
): boolean {
  const type = String(scopeType ?? '')
    .trim()
    .toUpperCase();

  return (
    type === 'ORGANIZATION' ||
    type === 'CLUSTER'
  );
}

export function isManagedCommunityScope(
  scope: BuklodScope | null | undefined,
): boolean {
  return isManagedCommunityScopeType(
    scope?.scope_type,
  );
}

/** Admin/directory flows under Organization or Cluster portals. */
export function isScopePortalRoute(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  return (
    normalized.startsWith('/organizations') ||
    normalized.startsWith('/clusters')
  );
}

/** Personal Circle area — never rewritten by active org/cluster scope. */
export function isBuklodCirclePersonalRoute(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  return (
    normalized === '/points' ||
    normalized.startsWith('/points/')
  );
}

/**
 * Personal faith flows (Bible, Word, Prayer, Bayanihan) — usable from any scope
 * without rewriting navigation back to scoped home.
 */
export function isBuklodFaithPersonalRoute(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  const roots = [
    '/bible',
    '/word',
    '/prayer',
    '/bayanihan',
    '/faith',
    '/devotional',
    '/inspire',
  ];

  return roots.some(
    (root) =>
      normalized === root ||
      normalized.startsWith(`${root}/`),
  );
}

/** Formation lesson reader + track detail — must not bounce to scoped home. */
export function isFormationLearningRoute(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  if (
    normalized === '/learn/lesson' ||
    normalized.startsWith('/learn/lesson/')
  ) {
    return true;
  }

  if (
    normalized.startsWith('/learn/') &&
    normalized !== '/learn'
  ) {
    return true;
  }

  return false;
}

/**
 * Global personal BUKLOD tabs. Managed community scopes must not stay here
 * (they belong in `/scope` opened from Profile or an explicit portal action).
 */
export function isBuklodPersonalGlobalRoute(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  if (
    isBuklodProfileRoute(normalized) ||
    isBuklodScopedWorkspacePath(normalized) ||
    isScopePortalRoute(normalized)
  ) {
    return false;
  }

  const roots = [
    '/home',
    '/buklod',
    '/connect',
    '/messages',
    '/learn',
    '/prayer',
    '/notifications',
    '/word',
  ];

  return roots.some(
    (root) =>
      normalized === root ||
      normalized.startsWith(`${root}/`),
  );
}

export function scopedWorkspacePathForGlobalRoute(
  pathname: string,
  scopeId: string,
): string | null {
  const normalized =
    normalizeBuklodPathname(pathname);

  if (normalized === '/home' || normalized.startsWith('/home/')) {
    return buildScopedWorkspacePath('home', scopeId);
  }

  if (
    normalized === '/buklod' ||
    normalized.startsWith('/buklod/')
  ) {
    return buildScopedWorkspacePath('community', scopeId);
  }

  if (
    normalized === '/connect' ||
    normalized.startsWith('/connect/') ||
    normalized === '/messages' ||
    normalized.startsWith('/messages/')
  ) {
    return buildScopedWorkspacePath('connect', scopeId);
  }

  if (isBuklodCirclePersonalRoute(normalized)) {
    return null;
  }

  if (isBuklodPersonalGlobalRoute(normalized)) {
    return buildScopedWorkspacePath('home', scopeId);
  }

  return null;
}

export type ScopedWorkspaceSection =
  | 'home'
  | 'community'
  | 'connect';

export type EnterScopedWorkspaceOptions = {
  section?: ScopedWorkspaceSection;
  /** Collapse portal/admin stacks before opening workspace. */
  fromPortal?: boolean;
  navigation?: 'push' | 'replace';
};

export function parseScopedWorkspaceSection(
  route: string
): ScopedWorkspaceSection {
  const queryIndex = route.indexOf('?');

  if (queryIndex < 0) {
    return 'home';
  }

  const params = new URLSearchParams(
    route.slice(queryIndex + 1)
  );
  const section = params.get('section');

  if (
    section === 'community' ||
    section === 'connect'
  ) {
    return section;
  }

  return 'home';
}

export async function enterScopedWorkspace(
  selectScope: (scopeId: string) => Promise<void>,
  scopeId: string,
  options: EnterScopedWorkspaceOptions = {}
) {
  const {
    section = 'home',
    fromPortal = false,
    navigation = fromPortal
      ? 'replace'
      : 'push',
  } = options;

  const id = String(scopeId ?? '').trim();

  if (!id) {
    throw new Error(
      'Workspace scope is missing.'
    );
  }

  await selectScope(id);

  const path =
    buildScopedWorkspacePath(
      section,
      id
    );

  if (fromPortal) {
    ((router as any).canDismiss?.() ? router.dismissAll() : undefined);
  }

  if (navigation === 'replace') {
    router.replace(path as any);
    return;
  }

  router.push(path as any);
}

export async function exitScopedWorkspace(
  selectScope: (scopeId: string) => Promise<void>,
  scopes: BuklodScope[],
  destination:
    | '/home'
    | '/clusters'
    | '/(tabs)/me' = '/home'
) {
  const publicScope = scopes.find(
    (scope) =>
      scope.scope_type === 'PUBLIC'
  );

  if (publicScope) {
    try {
      await selectScope(
        publicScope.scope_id
      );
    } catch (error) {
      console.warn(
        'BUKLOD scoped workspace exit:',
        error
      );
    }
  }

  ((router as any).canDismiss?.() ? router.dismissAll() : undefined);
  router.replace(destination as any);
}

export function buildScopedConnectThreadPath(input: {
  scopeId: string;
  scopeName?: string;
  scopeType?: string;
  conversationId?: string;
}) {
  const base = '/connect';

  if (input.conversationId) {
    return `${base}/community/${encodeURIComponent(input.scopeId)}?conversationId=${encodeURIComponent(input.conversationId)}`;
  }

  const query = new URLSearchParams();

  if (input.scopeName) {
    query.set('scopeName', input.scopeName);
  }

  if (input.scopeType) {
    query.set('scopeType', input.scopeType);
  }

  const suffix = query.toString();

  return `${base}/community/${encodeURIComponent(input.scopeId)}${suffix ? `?${suffix}` : ''}`;
}

export function resolveScopeContextSync(input: {
  routeScopeId?: string | null;
  activeScope?: BuklodScope | null;
  scopes: BuklodScope[];
  scopesLoading?: boolean;
  scopesError?: string | null;
  mzbOnly?: boolean;
  requireMembership?: boolean;
  mzbCanonicalScopeId?: string | null;
}): ScopeResolution {
  const {
    routeScopeId,
    activeScope,
    scopes,
    scopesLoading = false,
    scopesError = null,
    mzbOnly = false,
    requireMembership = true,
    mzbCanonicalScopeId = null,
  } = input;

  if (scopesLoading) {
    const explicitId = String(routeScopeId ?? '').trim();
    let fallbackScope: BuklodScope | null = null;

    if (explicitId) {
      fallbackScope =
        findScopeById(scopes, explicitId) ??
        (activeScope?.scope_id === explicitId ? activeScope : null);
    } else if (
      activeScope &&
      activeScope.scope_type !== 'PUBLIC' &&
      activeScope.scope_type !== 'LOCAL' &&
      activeScope.scope_type !== 'SYSTEM'
    ) {
      fallbackScope = activeScope;
    }

    if (fallbackScope) {
      return {
        access: 'authorized',
        scope: fallbackScope,
        kind: canonicalScopeKind(fallbackScope),
        scopeId: fallbackScope.scope_id,
      };
    }

    return {
      access: 'loading',
      scope: null,
      kind: null,
      scopeId: routeScopeId ?? activeScope?.scope_id ?? null,
    };
  }

  if (scopesError && scopes.length === 0) {
    return {
      access: 'error',
      scope: null,
      kind: null,
      scopeId: routeScopeId ?? null,
      message: scopesError,
    };
  }

  const explicitId = String(routeScopeId ?? '').trim();

  let resolved: BuklodScope | null = null;

  if (explicitId) {
    resolved = findScopeById(scopes, explicitId);

    if (!resolved) {
      return {
        access: 'not_found',
        scope: null,
        kind: null,
        scopeId: explicitId,
        message: 'This workspace is not available to your account.',
      };
    }
  } else if (mzbOnly) {
    resolved =
      findActiveMzbMemberScope(
        scopes,
        mzbCanonicalScopeId
      );
  } else if (
    activeScope &&
    activeScope.scope_type !== 'PUBLIC' &&
    activeScope.scope_type !== 'LOCAL' &&
    activeScope.scope_type !== 'SYSTEM'
  ) {
    resolved = activeScope;
  }

  if (!resolved) {
    if (mzbOnly) {
      return {
        access: 'unauthorized',
        scope: null,
        kind: null,
        scopeId: null,
        message:
          'MZB Ministry access requires an active MZB membership.',
      };
    }

    return {
      access: 'unauthorized',
      scope: null,
      kind: null,
      scopeId: explicitId || null,
      message: 'No scoped workspace is available.',
    };
  }

  if (mzbOnly) {
    const isMzb =
      isMzbOrganizationScope(
        resolved,
        mzbCanonicalScopeId
      );

    if (!isMzb) {
      return {
        access: 'unauthorized',
        scope: null,
        kind: 'ORGANIZATION',
        scopeId: resolved.scope_id,
        message: 'This route is reserved for the MZB Ministry Organization.',
      };
    }
  }

  if (
    requireMembership &&
    !scopeHasActiveMembership(resolved)
  ) {
    return {
      access: 'unauthorized',
      scope: resolved,
      kind: canonicalScopeKind(resolved),
      scopeId: resolved.scope_id,
      message:
        'Your membership for this workspace is not active.',
    };
  }

  return {
    access: 'authorized',
    scope: resolved,
    kind: canonicalScopeKind(resolved),
    scopeId: resolved.scope_id,
  };
}

export async function syncScopeSelection(
  selectScope: (scopeId: string) => Promise<void>,
  targetScopeId: string,
  currentScopeId?: string | null
) {
  const nextId = String(targetScopeId ?? '').trim();
  const currentId = String(currentScopeId ?? '').trim();

  if (!nextId || nextId === currentId) {
    return;
  }

  try {
    await selectScope(nextId);
  } catch (error) {
    console.warn('BUKLOD scope route sync:', error);
  }
}

export function buklodNotificationTarget(
  kind: string,
  data: BuklodNotificationPayload | null | undefined,
  options?: {
    scopes?: BuklodScope[];
    mzbCanonicalScopeId?: string | null;
  }
): BuklodNotificationTarget | null {
  if (!data) {
    return null;
  }

  if (
    data.post_id &&
    [
      'community_comment',
      'community_reaction',
      'community_mention',
      'post_share_request',
      'post_share_approved',
      'post_share_declined',
    ].includes(kind)
  ) {
    const scopeId = String(data.scope_id ?? '').trim();

    if (scopeId) {
      return {
        path: buildScopedWorkspacePath(
          'community',
          scopeId
        ),
        scopeId,
      };
    }

    return {
      path: `/post/${data.post_id}`,
    };
  }

  if (kind === 'direct_message' && data.conversation_id) {
    return {
      path: `/connect/personal/${data.conversation_id}`,
    };
  }

  if (
    kind === 'connect_message' &&
    data.scope_id &&
    data.conversation_id
  ) {
    const scopeId = String(data.scope_id).trim();

    const scope = findScopeById(
      options?.scopes ?? [],
      scopeId
    );

    return {
      path: buildScopedConnectThreadPath({
        scopeId,
        scopeName: scope?.name,
        scopeType: scope?.scope_type,
        conversationId: String(data.conversation_id),
      }),
      scopeId,
    };
  }

  const scopeId = String(data.scope_id ?? '').trim();

  if (!scopeId) {
    return null;
  }

  const scope = findScopeById(
    options?.scopes ?? [],
    scopeId
  );

  if (data.conversation_id) {
    return {
      path: buildScopedConnectThreadPath({
        scopeId,
        scopeName: scope?.name,
        scopeType: scope?.scope_type,
        conversationId: data.conversation_id,
      }),
      scopeId,
    };
  }

  return {
    path: buildScopedWorkspacePath(
      'connect',
      scopeId
    ),
    scopeId,
  };
}

/** @deprecated Use buklodNotificationTarget().path */
export function buklodNotificationPath(
  kind: string,
  data: BuklodNotificationPayload | null | undefined
): string | null {
  return buklodNotificationTarget(kind, data)?.path ?? null;
}

let cachedMzbCanonicalId: string | null = null;

export async function warmMzbCanonicalScopeId() {
  cachedMzbCanonicalId =
    await resolveMzbOrganizationScopeId();
  return cachedMzbCanonicalId;
}

export function getCachedMzbCanonicalScopeId() {
  return cachedMzbCanonicalId;
}
