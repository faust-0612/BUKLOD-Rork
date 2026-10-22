import { supabase } from '@/lib/supabase';
import { fetchScopeMembers } from '@/lib/buklodScopeMembers';

export type ClusterVisibility =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'INVITE_ONLY';

export type ClusterMembershipStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'INVITED'
  | 'LEFT'
  | 'REMOVED'
  | 'SUSPENDED'
  | null;

export type ClusterSummary = {
  scope_id: string;
  name: string;
  description: string | null;
  category: string | null;
  visibility: ClusterVisibility;
  scope_status: string;
  membership_status: ClusterMembershipStatus;
  membership_source?: string | null;
  is_admin: boolean;
  member_count: number;
  created_at?: string;
};

export type ClusterDetails = ClusterSummary & {
  logo_url: string | null;
  cover_url: string | null;
  last_activity_at: string | null;
};

export type ClusterPerson = {
  user_id: string;
  full_name: string;
};

export type ClusterMember = ClusterPerson & {
  is_admin: boolean;
  joined_at: string | null;
};

export type ClusterRequest = ClusterPerson & {
  requested_at: string | null;
};

function rows<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data == null) {
    return [];
  }

  return [data as T];
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await (supabase as any).rpc(
    name,
    args
  );

  if (error) {
    throw error;
  }

  return data as T;
}

export async function getMyClusters() {
  const data = await rpc<unknown>(
    'buklod_my_clusters'
  );

  return rows<ClusterSummary>(data);
}

export async function discoverClusters(
  query = ''
) {
  const data = await rpc<unknown>(
    'buklod_discover_clusters',
    {
      _query: query.trim() || null,
      _limit: 60,
    }
  );

  return rows<ClusterSummary>(data);
}

export async function getClusterDetails(
  scopeId: string
) {
  const data = await rpc<unknown>(
    'buklod_cluster_details',
    {
      _scope_id: scopeId,
    }
  );

  return rows<ClusterDetails>(data)[0] ?? null;
}

export async function createCluster(input: {
  name: string;
  description?: string;
  category?: string;
  visibility: ClusterVisibility;
  organizationId?: string | null;
}) {
  const data = await rpc<string>(
    'buklod_create_cluster_v2',
    {
      _name: input.name.trim(),
      _description:
        input.description?.trim() || null,
      _category:
        input.category?.trim() || null,
      _visibility: input.visibility,
      _organization_id: input.organizationId || null,
    }
  );

  return String(data);
}

export async function joinCluster(
  scopeId: string
) {
  return rpc<string>(
    'buklod_join_cluster',
    {
      _scope_id: scopeId,
    }
  );
}

export async function respondClusterInvite(
  scopeId: string,
  accept: boolean
) {
  await rpc(
    'buklod_respond_cluster_invite',
    {
      _scope_id: scopeId,
      _accept: accept,
    }
  );
}

export async function leaveCluster(
  scopeId: string
) {
  await rpc(
    'buklod_leave_cluster',
    {
      _scope_id: scopeId,
    }
  );
}

export async function getClusterRequests(
  scopeId: string
) {
  const data = await rpc<unknown>(
    'buklod_cluster_pending_requests',
    {
      _scope_id: scopeId,
    }
  );

  return rows<ClusterRequest>(data);
}

export async function reviewClusterRequest(
  scopeId: string,
  userId: string,
  approve: boolean
) {
  await rpc(
    'buklod_review_cluster_request',
    {
      _scope_id: scopeId,
      _user_id: userId,
      _approve: approve,
    }
  );
}

export async function getClusterMembers(
  scopeId: string
) {
  try {
    const data = await rpc<unknown>(
      'buklod_cluster_members',
      {
        _scope_id: scopeId,
      }
    );

    return rows<ClusterMember>(data);
  } catch (error: any) {
    const message = String(error?.message ?? '');

    if (
      !/could not find the function|function.*does not exist|schema cache/i.test(
        message
      )
    ) {
      try {
        const members = await fetchScopeMembers({
          scopeId,
          status: 'ACTIVE',
          limit: 200,
          offset: 0,
        });

        return members.map(member => ({
          user_id: member.user_id,
          full_name: member.full_name,
          is_admin: member.is_admin,
          joined_at: member.joined_at,
        }));
      } catch {
        throw error;
      }
    }

    const members = await fetchScopeMembers({
      scopeId,
      status: 'ACTIVE',
      limit: 200,
      offset: 0,
    });

    return members.map(member => ({
      user_id: member.user_id,
      full_name: member.full_name,
      is_admin: member.is_admin,
      joined_at: member.joined_at,
    }));
  }
}

export async function searchClusterInviteCandidates(
  scopeId: string,
  query: string
) {
  const data = await rpc<unknown>(
    'buklod_search_cluster_invite_candidates',
    {
      _scope_id: scopeId,
      _query: query.trim() || null,
      _limit: 30,
    }
  );

  return rows<ClusterPerson>(data);
}

export async function inviteClusterMember(
  scopeId: string,
  userId: string
) {
  await rpc(
    'buklod_invite_cluster_member',
    {
      _scope_id: scopeId,
      _user_id: userId,
    }
  );
}

export async function updateCluster(
  scopeId: string,
  input: {
    name: string;
    description?: string;
    category?: string;
    visibility: ClusterVisibility;
  }
) {
  await rpc(
    'buklod_update_cluster',
    {
      _scope_id: scopeId,
      _name: input.name.trim(),
      _description:
        input.description?.trim() || null,
      _category:
        input.category?.trim() || null,
      _visibility: input.visibility,
    }
  );
}

export async function removeClusterMember(
  scopeId: string,
  userId: string
) {
  await rpc(
    'buklod_remove_cluster_member',
    {
      _scope_id: scopeId,
      _user_id: userId,
    }
  );
}

export async function transferClusterAdmin(
  scopeId: string,
  userId: string
) {
  await rpc(
    'buklod_transfer_cluster_admin',
    {
      _scope_id: scopeId,
      _new_admin_user_id: userId,
    }
  );
}

export async function archiveCluster(
  scopeId: string
) {
  await rpc(
    'buklod_archive_cluster',
    {
      _scope_id: scopeId,
    }
  );
}

export async function restoreCluster(
  scopeId: string
) {
  await rpc(
    'buklod_restore_cluster',
    {
      _scope_id: scopeId,
    }
  );
}
