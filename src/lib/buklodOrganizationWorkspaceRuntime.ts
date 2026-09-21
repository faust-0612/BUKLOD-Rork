import { getBuklodClassroomLauncherAccess } from '@/lib/classroomLauncherAccess';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import {
  institutionModuleEnabled,
  readInstitutionWorkspaceConfig,
  type BuklodInstitutionWorkspaceConfig,
  type BuklodOrganizationModuleId,
} from '@/lib/buklodOrganizationWorkspace';
import { supabase } from '@/lib/supabase';

export type BuklodOrganizationWorkspaceScope = {
  id: string;
  name: string;
  description: string | null;
  scope_type: string;
  parent_scope_id: string | null;
  status: string;
  visibility: string;
  logo_url: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown>;
  last_activity_at: string | null;
};

export type BuklodOrganizationWorkspaceSummary = {
  total_members: number;
  active_members: number;
  admin_count: number;
  functional_role_count: number;
  pending_join_requests: number;
  my_functional_roles: Array<{ id?: string; name?: string }>;
  my_is_admin: boolean;
};

export type BuklodOrganizationWorkspaceRuntime = {
  scope: BuklodOrganizationWorkspaceScope;
  config: BuklodInstitutionWorkspaceConfig;
  summary: BuklodOrganizationWorkspaceSummary;
  isAdmin: boolean;
  reportEntitled: boolean;
  classroom: {
    canOpen: boolean;
    isFaculty: boolean;
    isStudent: boolean;
    reason: string | null;
  };
  filesAccessible: boolean;
};

const EMPTY_SUMMARY: BuklodOrganizationWorkspaceSummary = {
  total_members: 0,
  active_members: 0,
  admin_count: 0,
  functional_role_count: 0,
  pending_join_requests: 0,
  my_functional_roles: [],
  my_is_admin: false,
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSummary(value: unknown): BuklodOrganizationWorkspaceSummary {
  const raw = asObject(value);
  return {
    total_members: Number(raw.total_members ?? 0),
    active_members: Number(raw.active_members ?? 0),
    admin_count: Number(raw.admin_count ?? 0),
    functional_role_count: Number(raw.functional_role_count ?? 0),
    pending_join_requests: Number(raw.pending_join_requests ?? 0),
    my_functional_roles: Array.isArray(raw.my_functional_roles)
      ? (raw.my_functional_roles as Array<{ id?: string; name?: string }>)
      : [],
    my_is_admin: raw.my_is_admin === true,
  };
}

export async function loadBuklodOrganizationWorkspaceRuntime(
  scopeId: string,
): Promise<BuklodOrganizationWorkspaceRuntime> {
  const id = String(scopeId ?? '').trim();
  if (!id) {
    throw new Error('Organization context is missing.');
  }

  const scopeResult = await withBuklodTimeout(
    (supabase as any)
      .from('buklod_scopes')
      .select(
        'id,name,description,scope_type,parent_scope_id,status,visibility,logo_url,cover_url,metadata,last_activity_at',
      )
      .eq('id', id)
      .maybeSingle(),
    8_000,
    'Organization workspace identity',
  );

  if (scopeResult.error) throw scopeResult.error;
  if (!scopeResult.data) {
    throw new Error(
      'This Organization is unavailable or this account no longer has access.',
    );
  }

  const scope = {
    ...scopeResult.data,
    metadata: asObject(scopeResult.data.metadata),
  } as BuklodOrganizationWorkspaceScope;

  if (String(scope.scope_type).toUpperCase() !== 'ORGANIZATION') {
    throw new Error('This institutional workspace requires an Organization.');
  }

  const [
    summaryResult,
    manageResult,
    reportResult,
    classroomResult,
    officeResult,
  ] = await Promise.allSettled([
    withBuklodTimeout(
      (supabase as any).rpc('buklod_scope_home_summary_v1', {
        p_scope_id: id,
      }),
      8_000,
      'Organization summary',
    ),
    verifyOrganizationManageAccess(id),
    withBuklodTimeout(
      (supabase as any).rpc('buklod_report_scope_entitled_v1', {
        p_scope_id: id,
      }),
      8_000,
      'Organization Report entitlement',
    ),
    withBuklodTimeout(
      getBuklodClassroomLauncherAccess(),
      8_000,
      'Organization Classroom authority',
    ),
    withBuklodTimeout(
      (supabase as any).rpc('buklod_office_scope_info', {
        _scope_id: id,
      }),
      8_000,
      'Organization Files authority',
    ),
  ]);

  const summary =
    summaryResult.status === 'fulfilled' &&
    !summaryResult.value?.error
      ? normalizeSummary(summaryResult.value?.data)
      : EMPTY_SUMMARY;

  const isAdmin =
    (manageResult.status === 'fulfilled' &&
      manageResult.value.allowed) ||
    summary.my_is_admin;

  const reportEntitled =
    reportResult.status === 'fulfilled' &&
    !reportResult.value?.error &&
    reportResult.value?.data === true;

  const classroom =
    classroomResult.status === 'fulfilled'
      ? {
          canOpen: classroomResult.value.can_open,
          isFaculty: classroomResult.value.is_faculty,
          isStudent: classroomResult.value.is_student,
          reason: classroomResult.value.reason ?? null,
        }
      : {
          canOpen: false,
          isFaculty: false,
          isStudent: false,
          reason: 'CLASSROOM_AUTHORITY_UNAVAILABLE',
        };

  const filesAccessible =
    officeResult.status === 'fulfilled' &&
    !officeResult.value?.error &&
    Boolean(
      Array.isArray(officeResult.value?.data)
        ? officeResult.value.data[0]?.access_level &&
            officeResult.value.data[0]?.access_level !== 'NONE'
        : officeResult.value?.data?.access_level &&
            officeResult.value.data.access_level !== 'NONE',
    );

  return {
    scope,
    config: readInstitutionWorkspaceConfig(scope.metadata),
    summary,
    isAdmin,
    reportEntitled,
    classroom,
    filesAccessible,
  };
}

export async function verifyBuklodOrganizationModuleAccess(input: {
  scopeId: string;
  moduleId: BuklodOrganizationModuleId;
}) {
  const runtime = await loadBuklodOrganizationWorkspaceRuntime(input.scopeId);
  const enabled = institutionModuleEnabled(runtime.config, input.moduleId);

  if (!enabled) {
    return {
      allowed: false as const,
      reason:
        'This feature is not currently enabled for this Organization.',
      runtime,
    };
  }

  if (
    ['members', 'units', 'manage'].includes(input.moduleId) &&
    !runtime.isAdmin
  ) {
    return {
      allowed: false as const,
      reason:
        "You don't have permission to manage this Organization feature.",
      runtime,
    };
  }

  if (input.moduleId === 'reports' && !runtime.reportEntitled) {
    return {
      allowed: false as const,
      reason:
        'BUKLOD Report is not currently available for this Organization.',
      runtime,
    };
  }

  if (input.moduleId === 'classroom' && !runtime.classroom.canOpen) {
    return {
      allowed: false as const,
      reason:
        'No Classroom is available for your BUKLOD account yet.',
      runtime,
    };
  }

  if (input.moduleId === 'files' && !runtime.filesAccessible) {
    return {
      allowed: false as const,
      reason:
        'Files are not available for your role in this Organization.',
      runtime,
    };
  }

  // Quiz receives the Organization membership/module check here, then its
  // existing one-time Main -> Quiz bridge remains the final admission authority.
  return {
    allowed: true as const,
    reason: null,
    runtime,
  };
}
