import { supabase } from '@/lib/supabase';
import type { BuklodScope } from '@/lib/buklodScope';
import {
  canUseOrganizationFocusApp,
  resolveOrganizationIdFromScope,
} from '@/lib/buklodOrganizationFocusApps';

/** Canonical focus-app registry — single source for resolver + Profile. */
export const BUKLOD_FOCUS_APP_REGISTRY: BuklodFocusApp[] = [
  'faculty',
  'attendance',
  'giving',
  'business',
  'government',
  'family',
  'health',
  'market',
];

export type BuklodFoundationAuthorities = {
  isSystemAdmin: boolean;
  isScopedAdmin: boolean;
  mergedRoleKeys: string[];
};

export type BuklodFoundationSnapshot = {
  focusApps: BuklodFocusAppAccess[];
  workspaces: BuklodFoundationWorkspace[];
  authorities: BuklodFoundationAuthorities;
};

export type BuklodFoundationWorkspace = {
  workspace_key: string;
  title: string;
  subtitle: string | null;
  route: string;
  icon: string;
  sort_order: number;
  scope_type_hint: string | null;
};

/**
 * Reusable focus-app entitlement.
 * Faculty, Attendance, Giving, Business, Government
 * (and future apps) consume this same catalog.
 * Backend RPCs remain the security authority.
 */
export type BuklodFocusApp =
  | 'faculty'
  | 'attendance'
  | 'giving'
  | 'business'
  | 'government'
  | 'family'
  | 'health'
  | 'market'
  | 'organization';

export type BuklodFocusAppAccess = {
  app: BuklodFocusApp;
  canSee: boolean;
  isSystemAdmin: boolean;
  isAppAdmin: boolean;
  workspace: BuklodFoundationWorkspace | null;
  scopeType: string | null;
  scopeId: string | null;
  roleKeys: string[];
};

type FocusAppCatalogEntry = {
  workspaceKeys: string[];
  permissionKeys: string[];
  adminRoles: string[];
  scopeTypes: string[];
  routes: string[];
};

export const BUKLOD_FOCUS_APP_CATALOG: Record<
  BuklodFocusApp,
  FocusAppCatalogEntry
> = {
  faculty: {
    workspaceKeys: ['FACULTY'],
    permissionKeys: [
      'education.faculty.open',
      'education.classroom.manage',
      'FACULTY',
      'education',
      'education.access',
    ],
    adminRoles: ['SCHOOL_ADMIN', 'FACULTY_ADMIN'],
    scopeTypes: ['EDUCATION', 'SCHOOL'],
    routes: ['/profile/buklod-faculty'],
  },
  attendance: {
    workspaceKeys: ['ATTENDANCE', 'ATTENDANCE_ADMIN'],
    permissionKeys: ['attendance.admin', 'ATTENDANCE_ADMIN', 'attendance'],
    adminRoles: ['ATTENDANCE_ADMIN'],
    scopeTypes: ['ORGANIZATION', 'CLUSTER', 'ATTENDANCE'],
    routes: ['/scope/attendance', '/profile/attendance-qr'],
  },
  giving: {
    workspaceKeys: ['GIVING', 'GIVING_ADMIN'],
    permissionKeys: ['giving.admin', 'GIVING_ADMIN', 'giving'],
    adminRoles: ['GIVING_ADMIN'],
    scopeTypes: ['GIVING', 'ORGANIZATION', 'CLUSTER'],
    routes: ['/giving', '/scope-giving-settings'],
  },
  business: {
    workspaceKeys: ['BUSINESS', 'COMMERCIAL', 'BUSINESS_ADMIN'],
    permissionKeys: ['business.admin', 'BUSINESS_ADMIN', 'business'],
    adminRoles: ['BUSINESS_ADMIN'],
    scopeTypes: ['BUSINESS', 'COMMERCIAL', 'ORGANIZATION'],
    routes: ['/profile/buklod-business'],
  },
  government: {
    workspaceKeys: ['GOVERNMENT', 'BARANGAY', 'LOCAL'],
    permissionKeys: [
      'government.barangay.admin',
      'BARANGAY_ADMIN',
      'GOVERNMENT_ADMIN',
      'government',
      'government.admin',
    ],
    adminRoles: ['BARANGAY_ADMIN', 'GOVERNMENT_ADMIN'],
    scopeTypes: ['BARANGAY', 'GOVERNMENT', 'LOCAL'],
    routes: ['/profile/buklod-local'],
  },
  family: {
    workspaceKeys: ['FAMILY'],
    permissionKeys: ['family', 'family.access'],
    adminRoles: [],
    scopeTypes: ['FAMILY'],
    routes: ['/profile/buklod-family'],
  },
  health: {
    workspaceKeys: ['HEALTH'],
    permissionKeys: ['health', 'health.access'],
    adminRoles: [],
    scopeTypes: ['HEALTH'],
    routes: ['/profile/buklod-health'],
  },
  market: {
    workspaceKeys: ['MARKET', 'PALENGKE'],
    permissionKeys: ['market', 'palengke', 'market.access'],
    adminRoles: [],
    scopeTypes: ['MARKET', 'PALENGKE'],
    routes: ['/profile/buklod-market'],
  },
  organization: {
    workspaceKeys: ['ORGANIZATION_ADMIN'],
    permissionKeys: [
      'organization.admin',
      'ORGANIZATION_ADMIN',
      'organization.manage',
    ],
    adminRoles: [
      'ORGANIZATION_ADMIN',
      'ORG_ADMIN',
      'ADMIN',
      'SUB_ORG_ADMIN',
    ],
    scopeTypes: ['ORGANIZATION', 'CLUSTER'],
    routes: ['/organizations/manage', '/organizations'],
  },
};

export const BUKLOD_FOCUS_APP_LABELS: Record<BuklodFocusApp, string> = {
  faculty: 'Faculty',
  attendance: 'Attendance',
  giving: 'Giving',
  business: 'Business',
  government: 'Government',
  family: 'Family',
  health: 'Health',
  market: 'Market',
  organization: 'Organization',
};

export const BUKLOD_FOCUS_APP_ICONS: Record<BuklodFocusApp, string> = {
  faculty: 'school-outline',
  attendance: 'clipboard-check-outline',
  giving: 'hand-heart-outline',
  business: 'briefcase-outline',
  government: 'bank-outline',
  family: 'home-heart',
  health: 'heart-pulse',
  market: 'store-search-outline',
  organization: 'account-group-outline',
};

export function focusAppForPathname(
  pathname: string
): BuklodFocusApp | null {
  const path = String(pathname ?? '');

  if (
    path === '/profile/buklod-faculty' ||
    path.startsWith('/profile/buklod-faculty-')
  ) {
    return 'faculty';
  }

  if (path === '/profile/buklod-business') {
    return 'business';
  }

  if (path === '/profile/buklod-local') {
    return 'government';
  }

  if (path === '/profile/buklod-family') {
    return 'family';
  }

  if (path === '/profile/buklod-health') {
    return 'health';
  }

  if (path === '/profile/buklod-market') {
    return 'market';
  }

  if (
    path === '/organizations/manage' ||
    path.startsWith('/organizations/manage?')
  ) {
    return 'organization';
  }

  return null;
}

async function passesOrganizationFocusAppGate(
  app: BuklodFocusApp,
  matchingScope: BuklodScope | null | undefined,
  scopes: BuklodScope[],
) {
  const organizationId =
    resolveOrganizationIdFromScope(matchingScope) ??
    scopes
      .map((scope) => resolveOrganizationIdFromScope(scope))
      .find(Boolean) ??
    null;

  return canUseOrganizationFocusApp(organizationId, app);
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
      key === workspaceKey ||
      key.startsWith(`${workspaceKey}:`)
  );
}

function normalizeRoleKey(value: string) {
  return String(value).trim().toUpperCase().replaceAll('-', '_');
}

export function mergeScopeRoleKeys(scopes: BuklodScope[]) {
  const keys = new Set<string>();

  for (const scope of scopes) {
    for (const role of scope.role_keys ?? []) {
      const normalized = normalizeRoleKey(role);

      if (normalized) {
        keys.add(normalized);
      }
    }
  }

  return Array.from(keys);
}

export function buildFoundationAuthorities(
  scopes: BuklodScope[],
  isSystemAdmin: boolean
): BuklodFoundationAuthorities {
  const mergedRoleKeys = mergeScopeRoleKeys(scopes);

  const isScopedAdmin =
    scopes.some((scope) => scope.is_admin) ||
    mergedRoleKeys.some((role) =>
      [
        'ADMIN',
        'CLUSTER_ADMIN',
        'ORG_ADMIN',
        'ORGANIZATION_ADMIN',
        'SUB_ORG_ADMIN',
        'SCHOOL_ADMIN',
        'ATTENDANCE_ADMIN',
        'GIVING_ADMIN',
        'BUSINESS_ADMIN',
        'GOVERNMENT_ADMIN',
        'BARANGAY_ADMIN',
        'FACULTY_ADMIN',
      ].includes(role)
    );

  return {
    isSystemAdmin,
    isScopedAdmin,
    mergedRoleKeys,
  };
}

function roleKeysIncludeAdminRole(
  roleKeys: string[],
  adminRoles: string[]
) {
  return adminRoles.some((role) =>
    roleKeys.some((key) => {
      const normalized = normalizeRoleKey(key);
      return normalized === role || normalized === `${role}_ROLE`;
    })
  );
}

export const BUKLOD_WORKSPACE_ORDER = {
  LOCAL: 10,
  FAMILY: 20,
  MARKET: 30,
  BUSINESS: 40,
  FACULTY: 50,
  HEALTH: 60,
} as const;

function asWorkspace(row: any): BuklodFoundationWorkspace {
  return {
    workspace_key: String(row?.workspace_key ?? ''),
    title: String(row?.title ?? ''),
    subtitle:
      row?.subtitle == null
        ? null
        : String(row.subtitle),
    route: String(row?.route ?? ''),
    icon: String(row?.icon ?? 'apps'),
    sort_order: Number(row?.sort_order ?? 999),
    scope_type_hint:
      row?.scope_type_hint == null
        ? null
        : String(row.scope_type_hint),
  };
}

export async function getMyBuklodFoundationWorkspaces():
Promise<BuklodFoundationWorkspace[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_my_foundation_workspaces_v1'
  );

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(asWorkspace)
    .filter(
      (row) =>
        !!row.workspace_key &&
        !!row.title &&
        !!row.route
    )
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.title.localeCompare(b.title)
    );
}

export async function verifyBuklodFoundationPermission(
  permissionKey: string,
  scopeType: string | null = null,
  scopeId: string | null = null
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_has_permission',
    {
      p_permission_key: permissionKey,
      p_scope_type: scopeType,
      p_scope_id: scopeId,
      p_user_id: null,
    }
  );

  if (error) {
    console.warn(
      'BUKLOD Foundation permission check failed:',
      error.message
    );
    return false;
  }

  return data === true;
}

type FocusAppEvaluationContext = {
  isSystemAdmin: boolean;
  scopes: BuklodScope[];
  activeScope: BuklodScope | null;
  mergedRoleKeys: string[];
  workspaces: BuklodFoundationWorkspace[];
};

async function evaluateFocusAppAccessWithContext(
  app: BuklodFocusApp,
  context: FocusAppEvaluationContext
): Promise<BuklodFocusAppAccess> {
  const catalog = BUKLOD_FOCUS_APP_CATALOG[app];
  const {
    isSystemAdmin,
    scopes,
    activeScope,
    mergedRoleKeys,
    workspaces,
  } = context;

  const scopeId = activeScope?.scope_id ?? null;
  const roleKeys = mergedRoleKeys;

  const denied: BuklodFocusAppAccess = {
    app,
    canSee: false,
    isSystemAdmin,
    isAppAdmin: false,
    workspace: null,
    scopeType: activeScope?.scope_type ?? catalog.scopeTypes[0] ?? null,
    scopeId,
    roleKeys,
  };

  const workspace =
    workspaces.find((row) => workspaceMatchesApp(row, app)) ?? null;

  const namedAppAdmin = roleKeysIncludeAdminRole(
    mergedRoleKeys,
    catalog.adminRoles
  );

  let permitted = Boolean(workspace) || namedAppAdmin;

  if (!permitted && !isSystemAdmin) {
    const scopeTypesToCheck = [
      activeScope?.scope_type ?? null,
      ...catalog.scopeTypes,
    ].filter(
      (value, index, array) =>
        !!value && array.indexOf(value) === index
    ) as string[];

    outer: for (const scopeType of scopeTypesToCheck) {
      for (const permissionKey of catalog.permissionKeys) {
        const allowed = await verifyBuklodFoundationPermission(
          permissionKey,
          scopeType,
          null
        );

        if (allowed) {
          permitted = true;
          break outer;
        }
      }
    }

    if (!permitted) {
      const scopesToCheck =
        scopes.length > 0
          ? scopes.filter((scope) => {
              const scopeType = String(scope.scope_type ?? '').toUpperCase();
              return (
                catalog.scopeTypes.includes(scopeType) ||
                scopeType ===
                  String(activeScope?.scope_type ?? '').toUpperCase()
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

      outerScope: for (const scope of permissionTargets) {
        const scopeType = scope.scope_type ?? null;
        const targetScopeId = scope.scope_id ?? null;

        for (const permissionKey of catalog.permissionKeys) {
          const allowed = await verifyBuklodFoundationPermission(
            permissionKey,
            scopeType,
            targetScopeId
          );

          if (allowed) {
            permitted = true;
            break outerScope;
          }
        }
      }
    }
  }

  const isAppAdmin = isSystemAdmin || namedAppAdmin;

  const matchingScope =
    scopes.find((scope) => {
      const scopeType = String(scope.scope_type ?? '').toUpperCase();
      return catalog.scopeTypes.includes(scopeType);
    }) ?? activeScope;

  const canSee =
    isSystemAdmin ||
    (permitted &&
      (await passesOrganizationFocusAppGate(app, matchingScope, scopes)));

  if (!canSee) {
    return denied;
  }

  return {
    app,
    canSee: true,
    isSystemAdmin,
    isAppAdmin,
    workspace,
    scopeType:
      workspace?.scope_type_hint ??
      matchingScope?.scope_type ??
      activeScope?.scope_type ??
      catalog.scopeTypes[0] ??
      null,
    scopeId: matchingScope?.scope_id ?? scopeId,
    roleKeys,
  };
}

/**
 * Single foundation resolver: one workspace fetch, all scopes/roles merged.
 * RPC workspaces are trusted (backend authority). Permission evaluation
 * fills in apps entitled by role but absent from the workspace registry.
 */
export async function resolveFoundationFocusApps(
  options: {
    isSystemAdmin: boolean;
    scopes: BuklodScope[];
    activeScope?: BuklodScope | null;
    workspaces?: BuklodFoundationWorkspace[];
  }
): Promise<BuklodFoundationSnapshot> {
  const scopes = options.scopes ?? [];
  const activeScope =
    options.activeScope ??
    scopes.find((scope) => scope.is_active_scope) ??
    scopes[0] ??
    null;

  const authorities = buildFoundationAuthorities(
    scopes,
    options.isSystemAdmin
  );

  let workspaces = options.workspaces;

  if (!workspaces) {
    try {
      workspaces = await getMyBuklodFoundationWorkspaces();
    } catch (error: any) {
      console.warn(
        'BUKLOD foundation workspace load failed:',
        String(error?.message ?? error)
      );
      workspaces = [];
    }
  }

  const context: FocusAppEvaluationContext = {
    isSystemAdmin: options.isSystemAdmin,
    scopes,
    activeScope,
    mergedRoleKeys: authorities.mergedRoleKeys,
    workspaces,
  };

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
      isSystemAdmin: options.isSystemAdmin,
      isAppAdmin: roleKeysIncludeAdminRole(
        authorities.mergedRoleKeys,
        BUKLOD_FOCUS_APP_CATALOG[app].adminRoles
      ),
      workspace,
      scopeType: workspace.scope_type_hint,
      scopeId: null,
      roleKeys: authorities.mergedRoleKeys,
    });
  }

  for (const app of BUKLOD_FOCUS_APP_REGISTRY) {
    if (focusApps.some((row) => row.app === app)) {
      continue;
    }

    const row = await evaluateFocusAppAccessWithContext(app, context);

    if (row.canSee) {
      focusApps.push(row);
    }
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

export async function evaluateFocusAppAccess(
  app: BuklodFocusApp,
  options?: {
    isSystemAdmin?: boolean;
    activeScope?: BuklodScope | null;
    scopes?: BuklodScope[];
    workspaces?: BuklodFoundationWorkspace[];
  }
): Promise<BuklodFocusAppAccess> {
  const scopes =
    options?.scopes ??
    (options?.activeScope ? [options.activeScope] : []);

  const activeScope = options?.activeScope ?? scopes[0] ?? null;
  const mergedRoleKeys = mergeScopeRoleKeys(scopes);

  let workspaces = options?.workspaces;

  if (!workspaces) {
    try {
      workspaces = await getMyBuklodFoundationWorkspaces();
    } catch (error: any) {
      console.warn(
        'BUKLOD focus-app workspace load failed:',
        String(error?.message ?? error)
      );
      workspaces = [];
    }
  }

  return evaluateFocusAppAccessWithContext(app, {
    isSystemAdmin: Boolean(options?.isSystemAdmin),
    scopes,
    activeScope,
    mergedRoleKeys,
    workspaces,
  });
}
