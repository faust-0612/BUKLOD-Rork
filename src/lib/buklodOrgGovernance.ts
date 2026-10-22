import { supabase } from '@/lib/supabase';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export type OrgAccessGrant = {
  id: string;
  requesting_org_id: string;
  target_org_id: string;
  requesting_org_name?: string;
  target_org_name?: string;
  requested_by: string;
  approved_by: string | null;
  permission_scope: string[];
  status: string;
  requested_at: string;
  approved_at: string | null;
  revoked_at: string | null;
  reason: string | null;
};

export type ClusterProgressMember = {
  user_id: string;
  member_name: string;
  role_keys: string[];
  membership_status: string;
  pending_approvals: number;
  approved_items: number;
  reading_approved: number;
  devotion_approved: number;
  latest_lesson_item: string | null;
  latest_activity: string | null;
};

export type ClusterProgressReport = {
  cluster_id: string;
  cluster_name: string;
  organization_id: string | null;
  member_count: number;
  members: ClusterProgressMember[];
};

export type OrgClusterOversightRow = {
  cluster_id: string;
  cluster_name: string;
  cluster_status: string;
  member_count: number;
  cluster_premium: boolean;
  pending_approvals: number;
  leadership: Array<{ user_id: string; role_key: string; full_name: string }>;
};

function parseGrant(raw: unknown): OrgAccessGrant | null {
  const row = asRecord(raw);
  if (!row?.id) return null;
  return {
    id: String(row.id),
    requesting_org_id: String(row.requesting_org_id ?? ''),
    target_org_id: String(row.target_org_id ?? ''),
    requesting_org_name: row.requesting_org_name
      ? String(row.requesting_org_name)
      : undefined,
    target_org_name: row.target_org_name
      ? String(row.target_org_name)
      : undefined,
    requested_by: String(row.requested_by ?? ''),
    approved_by: row.approved_by ? String(row.approved_by) : null,
    permission_scope: Array.isArray(row.permission_scope)
      ? row.permission_scope.map((item) => String(item))
      : [],
    status: String(row.status ?? ''),
    requested_at: String(row.requested_at ?? ''),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    reason: row.reason ? String(row.reason) : null,
  };
}

export async function listOrgAccess(organizationId: string) {
  const data = await rpc<unknown>('buklod_list_org_access_v1', {
    p_organization_id: organizationId,
  });
  const row = asRecord(data);
  return {
    outgoing: Array.isArray(row?.outgoing)
      ? row.outgoing.map(parseGrant).filter(Boolean) as OrgAccessGrant[]
      : [],
    incoming: Array.isArray(row?.incoming)
      ? row.incoming.map(parseGrant).filter(Boolean) as OrgAccessGrant[]
      : [],
  };
}

export async function requestOrgAccess(
  requestingOrgId: string,
  targetOrgId: string,
) {
  return rpc('buklod_request_org_access_v1', {
    p_requesting_org_id: requestingOrgId,
    p_target_org_id: targetOrgId,
  });
}

export async function reviewOrgAccess(
  grantId: string,
  approve: boolean,
  reason?: string,
) {
  return rpc('buklod_review_org_access_v1', {
    p_grant_id: grantId,
    p_approve: approve,
    p_reason: reason ?? null,
  });
}

export async function revokeOrgAccess(grantId: string, reason?: string) {
  return rpc('buklod_revoke_org_access_v1', {
    p_grant_id: grantId,
    p_reason: reason ?? null,
  });
}

export async function fetchClusterGeneralProgress(clusterId: string) {
  const data = await rpc<unknown>('buklod_cluster_general_progress_v1', {
    p_cluster_id: clusterId,
  });
  const row = asRecord(data);
  if (!row) {
    return null;
  }
  const members = Array.isArray(row.members)
    ? row.members
        .map((item) => {
          const member = asRecord(item);
          if (!member?.user_id) return null;
          return {
            user_id: String(member.user_id),
            member_name: String(member.member_name ?? 'Member'),
            role_keys: Array.isArray(member.role_keys)
              ? member.role_keys.map((key) => String(key))
              : [],
            membership_status: String(member.membership_status ?? 'ACTIVE'),
            pending_approvals: Number(member.pending_approvals ?? 0),
            approved_items: Number(member.approved_items ?? 0),
            reading_approved: Number(member.reading_approved ?? 0),
            devotion_approved: Number(member.devotion_approved ?? 0),
            latest_lesson_item: member.latest_lesson_item
              ? String(member.latest_lesson_item)
              : null,
            latest_activity: member.latest_activity
              ? String(member.latest_activity)
              : null,
          } satisfies ClusterProgressMember;
        })
        .filter(Boolean) as ClusterProgressMember[]
    : [];

  return {
    cluster_id: String(row.cluster_id ?? clusterId),
    cluster_name: String(row.cluster_name ?? 'Cluster'),
    organization_id: row.organization_id ? String(row.organization_id) : null,
    member_count: Number(row.member_count ?? members.length),
    members,
  } satisfies ClusterProgressReport;
}

export async function fetchClusterMemberProgress(
  clusterId: string,
  memberId: string,
) {
  return rpc<unknown>('buklod_cluster_member_progress_v1', {
    p_cluster_id: clusterId,
    p_member_id: memberId,
  });
}

export async function fetchOrganizationClustersOversight(
  organizationId: string,
) {
  const data = await rpc<unknown>('buklod_organization_clusters_oversight_v1', {
    p_organization_id: organizationId,
  });
  const row = asRecord(data);
  const clusters = Array.isArray(row?.clusters)
    ? row.clusters
        .map((item) => {
          const cluster = asRecord(item);
          if (!cluster?.cluster_id) return null;
          return {
            cluster_id: String(cluster.cluster_id),
            cluster_name: String(cluster.cluster_name ?? 'Cluster'),
            cluster_status: String(cluster.cluster_status ?? 'ACTIVE'),
            member_count: Number(cluster.member_count ?? 0),
            cluster_premium: cluster.cluster_premium === true,
            pending_approvals: Number(cluster.pending_approvals ?? 0),
            leadership: Array.isArray(cluster.leadership)
              ? cluster.leadership
                  .map((lead) => {
                    const person = asRecord(lead);
                    if (!person?.user_id) return null;
                    return {
                      user_id: String(person.user_id),
                      role_key: String(person.role_key ?? ''),
                      full_name: String(person.full_name ?? 'Member'),
                    };
                  })
                  .filter(Boolean) as OrgClusterOversightRow['leadership']
              : [],
          } satisfies OrgClusterOversightRow;
        })
        .filter(Boolean) as OrgClusterOversightRow[]
    : [];

  return {
    organization_id: String(row?.organization_id ?? organizationId),
    organization_name: String(row?.organization_name ?? 'Organization'),
    lifecycle_status: String(row?.lifecycle_status ?? 'ACTIVE'),
    clusters,
  };
}

export async function fetchSystemAdminOrgClusterCenter(input?: {
  organizationId?: string | null;
  clusterId?: string | null;
}) {
  return rpc<unknown>('buklod_system_admin_org_cluster_center_v1', {
    p_organization_id: input?.organizationId ?? null,
    p_cluster_id: input?.clusterId ?? null,
  });
}

export async function runAdminLifecycleAction(input: {
  action: string;
  targetKind: 'ORGANIZATION' | 'CLUSTER' | 'USER' | 'ROLE';
  targetId: string;
  reason?: string;
  roleKey?: string;
}) {
  return rpc('buklod_admin_lifecycle_action_v1', {
    p_action: input.action,
    p_target_kind: input.targetKind,
    p_target_id: input.targetId,
    p_reason: input.reason ?? null,
    p_role_key: input.roleKey ?? null,
  });
}

export async function canViewClusterProgress(clusterId: string) {
  try {
    const data = await rpc<boolean>('buklod_can_view_cluster_progress_v1', {
      p_cluster_id: clusterId,
    });
    return data === true;
  } catch {
    return false;
  }
}
