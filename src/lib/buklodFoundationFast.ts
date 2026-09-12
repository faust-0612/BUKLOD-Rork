import {
  BUKLOD_FOCUS_APP_CATALOG,
  BUKLOD_FOCUS_APP_REGISTRY,
  buildFoundationAuthorities,
  getMyBuklodFoundationWorkspaces,
  resolveFoundationFocusApps,
  type BuklodFocusApp,
  type BuklodFocusAppAccess,
  type BuklodFoundationSnapshot,
  type BuklodFoundationWorkspace,
} from '@/lib/buklodFoundation';
import {
  canUseOrganizationFocusApp,
  resolveOrganizationIdFromScope,
} from '@/lib/buklodOrganizationFocusApps';
import type { BuklodScope } from '@/lib/buklodScope';
import { supabase } from '@/lib/supabase';

type PermissionGrant = {
  permission_key: string;
  scope_type: string;
  scope_id: string | null;
};

type PermissionSnapshotCache = {
  userId: string;
  grants: PermissionGrant[];
  cachedAt: number;
};

type PermissionSnapshotFlight = {
  userId: string;
  request: Promise<PermissionGrant[]>;
};

const PERMISSION_SNAPSHOT_FRESH_MS = 3_000;

let permissionSnapshotCache: PermissionSnapshotCache | null = null;
let permissionSnapshotFlight: PermissionSnapshotFlight | null = null;

function normalizeRoleKey(value: string) {
  return String(value ?? '').trim().toUpperCase().replaceAll('-', '_');
}

function normalizeScopeType(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

function workspaceMatchesApp(
  workspace: BuklodFoundationWorkspace,
  app: BuklodFocusApp
) {
  const key = String(workspace.workspace_key ?? '')
    .trim()
    .toUpperCase();

  return BUKLOD_FOCUS_APP_CATALOG[app].workspaceKeys.some(
    (workspaceKey) =>
      key === workspaceKey || key.startsWith(`${workspaceKey}:`)
  );
}

function roleKeysIncludeAdminRole(roleKeys: string[], adminRoles: string[]) {
  return adminRoles.some((role) =>
    roleKeys.some((key) => {
      const normalized = normalizeRoleKey(key);
      return normalized === role || normalized === `${role}_ROLE`;
    })
  );
}

function grantAllows(
  grants: PermissionGrant[],
  permissionKeys: string[],
  scopeType: string | null,
  scopeId: string | null
) {
  const normalizedType = normalizeScopeType(scopeType);

  return grants.some((grant) => {
    if (!permissionKeys.includes(String(grant.permission_key ?? ''))) {
      return false;
    }

    const grantType = normalizeScopeType(grant.scope_type);

    if (grantType === 'GLOBAL') {
      return true;
    }

    if (!normalizedType || grantType !== normalizedType) {
      return false;
    }

    return (grant.scope_id ?? null) === (scopeId ?? null);
  });
}

async function loadPermissionSnapshot(): Promise<PermissionGrant[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id ?? '';

  if (!userId) {
    permissionSnapshotCache = null;
    permissionSnapshotFlight = null;
    return [];
  }

  if (
    permissionSnapshotCache?.userId === userId &&
    Date.now() - permissionSnapshotCache.cachedAt <=
      PERMISSION_SNAPSHOT_FRESH_MS
  ) {
    return permissionSnapshotCache.grants;
  }

  if (permissionSnapshotFlight?.userId === userId) {
    return permissionSnapshotFlight.request;
  }

  const request = (async () => {
    const { data, error } = await (supabase as any).rpc(
      'buklod_my_permission_snapshot_v1'
    );

    if (error) {
      throw error;
    }

    const grants = (Array.isArray(data) ? data : [])
      .map((row: any): PermissionGrant => ({
        permission_key: String(row?.permission_key ?? ''),
        scope_type: normalizeScopeType(row?.scope_type),
        scope_id: row?.scope_id == null ? null : String(row.scope_id),
      }))
      .filter((row: PermissionGrant) => Boolean(row.permission_key));

    permissionSnapshotCache = {
      userId,
      grants,
      cachedAt: Date.now(),
    };

    return grants;
  })();

  permissionSnapshotFlight = {
    userId,
    request,
  };

  try {
    return await request;
  } finally {
    if (
      permissionSnapshotFlight?.userId === userId &&
      permissionSnapshotFlight.request === request
    ) {
      permissionSnapshotFlight = null;
    }
  }
}

function hasSnapshotPermissionForApp(
  app: BuklodFocusApp,
  grants: PermissionGrant[],
  scopes: BuklodScope[],
  activeScope: BuklodScope | null
) {
  const catalog = BUKLOD_FOCUS_APP_CATALOG[app];
  const scopeTypesToCheck = [
    activeScope?.scope_type ?? null,
    ...catalog.scopeTypes,
  ].filter(
    (value, index, array) =>
      Boolean(value) && array.indexOf(value) === index
  ) as string[];

  for (const scopeType of scopeTypesToCheck) {
    if (grantAllows(grants, catalog.permissionKeys, scopeType, null)) {
      return true;
    }
  }

  const scopesToCheck =
    scopes.length > 0
      ? scopes.filter((scope) => {
          const scopeType = normalizeScopeType(scope.scope_type);
          return (
            catalog.scopeTypes.includes(scopeType) ||
            scopeType === normalizeScopeType(activeScope?.scope_type)
          );
        })
      : activeScope
        ? [activeScope]
        : [];

  const permissionTargets =
    scopesToCheck.length > 0
      ? scopesToCheck
      : scopes.length > 0
        ? scopes
        : activeScope
          ? [activeScope]
          : [];

  return permissionTargets.some((scope) =>
    grantAllows(
      grants,
      catalog.permissionKeys,
      scope.scope_type ?? null,
      scope.scope_id ?? null
    )
  );
}

async function passesOrganizationFocusAppGate(
  app: BuklodFocusApp,
  matchingScope: BuklodScope | null | undefined,
  scopes: BuklodScope[]
) {
  const organizationId =
    resolveOrganizationIdFromScope(matchingScope) ??
    scopes
      .map((scope) => resolveOrganizationIdFromScope(scope))
      .find(Boolean) ??
    null;

  return canUseOrganizationFocusApp(organizationId, app);
}

/**
 * Fast Foundation resolver.
 *
 * The legacy resolver can issue many buklod_has_permission RPCs while it
 * explores permission x scope combinations. This resolver obtains the
 * authenticated user's effective grants once and performs the same visibility
 * matching in memory. Actual writes/reads remain protected by server RLS/RPCs.
 * If the snapshot endpoint is unavailable, we fail safely to the legacy
 * server-authoritative resolver.
 */
export async function resolveFoundationFocusAppsFast(options: {
  isSystemAdmin: boolean;
  scopes: BuklodScope[];
  activeScope?: BuklodScope | null;
  workspaces?: BuklodFoundationWorkspace[];
}): Promise<BuklodFoundationSnapshot> {
  const scopes = options.scopes ?? [];
  const activeScope =
    options.activeScope ??
    scopes.find((scope) => scope.is_active_scope) ??
    scopes[0] ??
    null;

  let workspaces = options.workspaces;
  let grants: PermissionGrant[];

  try {
    const [loadedWorkspaces, loadedGrants] = await Promise.all([
      workspaces
        ? Promise.resolve(workspaces)
        : getMyBuklodFoundationWorkspaces(),
      loadPermissionSnapshot(),
    ]);

    workspaces = loadedWorkspaces;
    grants = loadedGrants;
  } catch (error: any) {
    console.warn(
      'BUKLOD foundation permission snapshot failed; using compatibility resolver:',
      String(error?.message ?? error)
    );

    return resolveFoundationFocusApps({
      ...options,
      workspaces,
    });
  }

  const snapshotSystemAdmin = grants.some(
    (grant) =>
      grant.permission_key === '*' &&
      normalizeScopeType(grant.scope_type) === 'GLOBAL'
  );
  const isSystemAdmin = options.isSystemAdmin || snapshotSystemAdmin;
  const authorities = buildFoundationAuthorities(scopes, isSystemAdmin);
  const roleKeys = authorities.mergedRoleKeys;
  const focusApps: BuklodFocusAppAccess[] = [];

  for (const workspace of workspaces) {
    const app =
      BUKLOD_FOCUS_APP_REGISTRY.find((candidate) =>
        workspaceMatchesApp(workspace, candidate)
      ) ?? null;

    if (!app) {
      continue;
    }

    focusApps.push({
      app,
      canSee: true,
      isSystemAdmin,
      isAppAdmin: roleKeysIncludeAdminRole(
        roleKeys,
        BUKLOD_FOCUS_APP_CATALOG[app].adminRoles
      ),
      workspace,
      scopeType: workspace.scope_type_hint,
      scopeId: null,
      roleKeys,
    });
  }

  for (const app of BUKLOD_FOCUS_APP_REGISTRY) {
    if (focusApps.some((row) => row.app === app)) {
      continue;
    }

    const catalog = BUKLOD_FOCUS_APP_CATALOG[app];
    const namedAppAdmin = roleKeysIncludeAdminRole(
      roleKeys,
      catalog.adminRoles
    );
    const permitted =
      isSystemAdmin ||
      namedAppAdmin ||
      hasSnapshotPermissionForApp(app, grants, scopes, activeScope);

    if (!permitted) {
      continue;
    }

    const matchingScope =
      scopes.find((scope) =>
        catalog.scopeTypes.includes(normalizeScopeType(scope.scope_type))
      ) ?? activeScope;

    const canSee =
      isSystemAdmin ||
      (await passesOrganizationFocusAppGate(app, matchingScope, scopes));

    if (!canSee) {
      continue;
    }

    focusApps.push({
      app,
      canSee: true,
      isSystemAdmin,
      isAppAdmin: isSystemAdmin || namedAppAdmin,
      workspace: null,
      scopeType:
        matchingScope?.scope_type ??
        activeScope?.scope_type ??
        catalog.scopeTypes[0] ??
        null,
      scopeId: matchingScope?.scope_id ?? activeScope?.scope_id ?? null,
      roleKeys,
    });
  }

  focusApps.sort(
    (a, b) =>
      (a.workspace?.sort_order ?? 999) -
        (b.workspace?.sort_order ?? 999) ||
      BUKLOD_FOCUS_APP_REGISTRY.indexOf(a.app) -
        BUKLOD_FOCUS_APP_REGISTRY.indexOf(b.app)
  );

  return {
    focusApps,
    workspaces,
    authorities,
  };
}
