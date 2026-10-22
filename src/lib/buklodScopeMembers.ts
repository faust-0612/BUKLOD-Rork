import { supabase } from '@/lib/supabase';
import {
  loadPersonDisplayNameMap,
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';

export type ScopeFunctionalRoleRef = {
  id: string;
  name: string;
};

export type ScopeMemberRow = {
  user_id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  membership_status: string;
  is_admin: boolean;
  joined_at: string | null;
  functional_roles: ScopeFunctionalRoleRef[];
};

export type ScopeHomeSummary = {
  total_members: number;
  active_members: number;
  admin_count: number;
  functional_role_count: number;
  pending_join_requests: number;
  my_functional_roles: ScopeFunctionalRoleRef[];
  my_is_admin: boolean;
};

export type ScopeFunctionalRoleRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
};

const ADMIN_ROLE_KEYS = [
  'ADMIN',
  'ORG_ADMIN',
  'CLUSTER_ADMIN',
  'CLUSTER_HEAD',
] as const;

function rows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data == null) return [];
  return [data as T];
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

function isMissingRelationError(message: string) {
  return /relation.*does not exist|table.*does not exist/i.test(
    message
  );
}

function parseFunctionalRoles(value: unknown): ScopeFunctionalRoleRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      const name = String(row.name ?? '').trim();
      if (!id || !name) return null;
      return { id, name };
    })
    .filter(Boolean) as ScopeFunctionalRoleRef[];
}

async function loadProfileMap(userIds: string[]) {
  const profiles = await loadPersonDisplayNameMap(userIds);
  const map: Record<
    string,
    {
      full_name: string;
      username: string | null;
      avatar_url: string | null;
    }
  > = {};

  for (const [userId, profile] of Object.entries(profiles)) {
    map[userId] = {
      full_name: profile.full_name,
      username: profile.username,
      avatar_url: profile.avatar_url,
    };
  }

  return map;
}

async function loadAdminUserIds(scopeId: string) {
  const result = await supabase
    .from('buklod_scope_role_assignments')
    .select('user_id, role_key, status')
    .eq('scope_id', scopeId)
    .eq('status', 'ACTIVE');

  if (result.error) {
    if (
      isMissingRelationError(
        String(result.error.message ?? '')
      )
    ) {
      return new Set<string>();
    }

    throw result.error;
  }

  return new Set(
    (result.data ?? [])
      .filter(row =>
        ADMIN_ROLE_KEYS.includes(
          String(row.role_key ?? '').toUpperCase() as
            (typeof ADMIN_ROLE_KEYS)[number]
        )
      )
      .map(row => String(row.user_id ?? ''))
      .filter(Boolean)
  );
}

async function loadFunctionalRolesByUser(
  scopeId: string,
  userIds: string[]
) {
  const map: Record<string, ScopeFunctionalRoleRef[]> = {};

  for (const userId of userIds) {
    map[userId] = [];
  }

  const assignmentResult = await supabase
    .from('buklod_scope_member_functional_roles')
    .select('user_id, role_id')
    .eq('scope_id', scopeId)
    .in('user_id', userIds);

  if (assignmentResult.error) {
    if (
      isMissingRelationError(
        String(assignmentResult.error.message ?? '')
      )
    ) {
      return map;
    }

    return map;
  }

  const roleIds = Array.from(
    new Set(
      (assignmentResult.data ?? [])
        .map(row => String(row.role_id ?? ''))
        .filter(Boolean)
    )
  );

  if (!roleIds.length) {
    return map;
  }

  const roleResult = await supabase
    .from('buklod_scope_functional_roles')
    .select('id, name, is_active')
    .eq('scope_id', scopeId)
    .in('id', roleIds);

  if (roleResult.error) {
    return map;
  }

  const roleMap = new Map(
    (roleResult.data ?? []).map(row => [
      String(row.id),
      {
        id: String(row.id),
        name: String(row.name ?? ''),
        is_active: Boolean(row.is_active),
      },
    ])
  );

  for (const row of assignmentResult.data ?? []) {
    const userId = String(row.user_id ?? '');
    const role = roleMap.get(String(row.role_id ?? ''));

    if (!userId || !role || !role.is_active || !role.name) {
      continue;
    }

    map[userId] = [...(map[userId] ?? []), { id: role.id, name: role.name }];
  }

  return map;
}

async function fetchScopeMembersDirect(
  input: {
    scopeId: string;
    status?: string;
    limit?: number;
    offset?: number;
    query?: string;
  }
): Promise<ScopeMemberRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const status = input.status ?? 'ACTIVE';
  const query = input.query?.trim().toLowerCase() ?? '';

  let membershipQuery = supabase
    .from('buklod_scope_memberships')
    .select('user_id, membership_status, joined_at, created_at')
    .eq('scope_id', input.scopeId);

  if (status) {
    membershipQuery = membershipQuery.eq(
      'membership_status',
      status
    );
  }

  const membershipResult = await membershipQuery
    .order('joined_at', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  const membershipRows = membershipResult.data ?? [];
  const userIds = membershipRows.map(row => String(row.user_id ?? '')).filter(Boolean);

  const [profiles, adminIds, roleMap] = await Promise.all([
    loadProfileMap(userIds),
    loadAdminUserIds(input.scopeId),
    loadFunctionalRolesByUser(input.scopeId, userIds),
  ]);

  const mapped = membershipRows.map(row => {
    const userId = String(row.user_id ?? '');
    const profile = profiles[userId];

    return {
      user_id: userId,
      full_name: resolvePersonDisplayName(profile, userId),
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
      membership_status: String(row.membership_status ?? 'ACTIVE'),
      is_admin: adminIds.has(userId),
      joined_at: row.joined_at
        ? String(row.joined_at)
        : row.created_at
          ? String(row.created_at)
          : null,
      functional_roles: roleMap[userId] ?? [],
    } satisfies ScopeMemberRow;
  });

  if (!query) {
    return mapped.sort((a, b) => {
      if (a.is_admin !== b.is_admin) {
        return a.is_admin ? -1 : 1;
      }

      return a.full_name.localeCompare(b.full_name);
    });
  }

  return mapped
    .filter(member => {
      const haystack = [
        member.full_name,
        member.username ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (a.is_admin !== b.is_admin) {
        return a.is_admin ? -1 : 1;
      }

      return a.full_name.localeCompare(b.full_name);
    });
}

async function fetchScopeHomeSummaryDirect(
  scopeId: string
): Promise<ScopeHomeSummary> {
  const [
    totalResult,
    activeResult,
    adminIds,
    roleCountResult,
    myRolesResult,
    myAdminResult,
  ] = await Promise.all([
    supabase
      .from('buklod_scope_memberships')
      .select('user_id', { count: 'exact', head: true })
      .eq('scope_id', scopeId),
    supabase
      .from('buklod_scope_memberships')
      .select('user_id', { count: 'exact', head: true })
      .eq('scope_id', scopeId)
      .eq('membership_status', 'ACTIVE'),
    loadAdminUserIds(scopeId),
    supabase
      .from('buklod_scope_functional_roles')
      .select('id', { count: 'exact', head: true })
      .eq('scope_id', scopeId)
      .eq('is_active', true),
    supabase.auth.getUser(),
    (supabase as any).rpc('buklod_is_exact_scope_admin_v1', {
      p_scope_id: scopeId,
    }),
  ]);

  if (totalResult.error) {
    throw totalResult.error;
  }

  if (activeResult.error) {
    throw activeResult.error;
  }

  let myFunctionalRoles: ScopeFunctionalRoleRef[] = [];

  const userId = myRolesResult.data.user?.id;

  if (userId) {
    const roleMap = await loadFunctionalRolesByUser(scopeId, [userId]);
    myFunctionalRoles = roleMap[userId] ?? [];
  }

  return {
    total_members: totalResult.count ?? 0,
    active_members: activeResult.count ?? 0,
    admin_count: adminIds.size,
    functional_role_count: roleCountResult.error
      ? 0
      : roleCountResult.count ?? 0,
    pending_join_requests: 0,
    my_functional_roles: myFunctionalRoles,
    my_is_admin:
      !myAdminResult.error && myAdminResult.data === true,
  };
}

export async function fetchScopeHomeSummary(
  scopeId: string
): Promise<ScopeHomeSummary> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_home_summary_v1',
    { p_scope_id: scopeId }
  );

  if (!error) {
    const raw = (data ?? {}) as Record<string, unknown>;

    return {
      total_members: Number(raw.total_members ?? 0),
      active_members: Number(raw.active_members ?? 0),
      admin_count: Number(raw.admin_count ?? 0),
      functional_role_count: Number(raw.functional_role_count ?? 0),
      pending_join_requests: Number(raw.pending_join_requests ?? 0),
      my_functional_roles: parseFunctionalRoles(raw.my_functional_roles),
      my_is_admin: Boolean(raw.my_is_admin),
    };
  }

  const message = String(error?.message ?? '');

  if (!isMissingRpcError(message)) {
    try {
      return await fetchScopeHomeSummaryDirect(scopeId);
    } catch {
      throw error;
    }
  }

  return fetchScopeHomeSummaryDirect(scopeId);
}

export async function fetchScopeMembers(input: {
  scopeId: string;
  status?: string;
  limit?: number;
  offset?: number;
  query?: string;
}): Promise<ScopeMemberRow[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_list_members_v1',
    {
      p_scope_id: input.scopeId,
      p_status: input.status ?? 'ACTIVE',
      p_limit: input.limit ?? 40,
      p_offset: input.offset ?? 0,
      p_query: input.query?.trim() || null,
    }
  );

  if (!error) {
    return rows<Record<string, unknown>>(data).map(row => ({
      user_id: String(row.user_id ?? ''),
      full_name: String(row.full_name ?? ''),
      username: row.username ? String(row.username) : null,
      avatar_url: row.avatar_url ? String(row.avatar_url) : null,
      membership_status: String(row.membership_status ?? 'ACTIVE'),
      is_admin: Boolean(row.is_admin),
      joined_at: row.joined_at ? String(row.joined_at) : null,
      functional_roles: parseFunctionalRoles(row.functional_roles),
    }));
  }

  const message = String(error?.message ?? '');

  if (!isMissingRpcError(message)) {
    try {
      return await fetchScopeMembersDirect(input);
    } catch (directError: unknown) {
      throw directError instanceof Error ? directError : error;
    }
  }

  return fetchScopeMembersDirect(input);
}

export async function fetchClusterHomeMembers(
  scopeId: string
) {
  const rpcResult = await (supabase as any).rpc(
    'buklod_cluster_home_members_v1',
    { p_scope_id: scopeId }
  );

  if (!rpcResult.error) {
    return rows<{
      user_id: string;
      full_name: string;
      avatar_url: string | null;
      is_admin: boolean;
    }>(rpcResult.data);
  }

  const members = await fetchScopeMembers({
    scopeId,
    status: 'ACTIVE',
    limit: 100,
    offset: 0,
  });

  return members.map(member => ({
    user_id: member.user_id,
    full_name: member.full_name,
    avatar_url: member.avatar_url,
    is_admin: member.is_admin,
  }));
}

function mapFunctionalRoleRow(
  row: Record<string, unknown>,
  memberCount = 0
): ScopeFunctionalRoleRow {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    description: row.description ? String(row.description) : null,
    sort_order: Number(row.sort_order ?? 0),
    is_active: Boolean(row.is_active),
    member_count: memberCount,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

async function fetchScopeFunctionalRolesDirect(
  scopeId: string,
  includeArchived = false
): Promise<ScopeFunctionalRoleRow[]> {
  let query = supabase
    .from('buklod_scope_functional_roles')
    .select(
      'id, name, description, sort_order, is_active, created_at, updated_at'
    )
    .eq('scope_id', scopeId)
    .order('sort_order', { ascending: true });

  if (!includeArchived) {
    query = query.eq('is_active', true);
  }

  const result = await query;

  if (result.error) {
    if (isMissingRelationError(String(result.error.message ?? ''))) {
      return [];
    }

    throw result.error;
  }

  const roleRows = result.data ?? [];
  const roleIds = roleRows
    .map(row => String(row.id ?? ''))
    .filter(Boolean);
  const memberCounts: Record<string, number> = {};

  if (roleIds.length) {
    const assignmentResult = await supabase
      .from('buklod_scope_member_functional_roles')
      .select('role_id')
      .eq('scope_id', scopeId)
      .in('role_id', roleIds);

    if (!assignmentResult.error) {
      for (const row of assignmentResult.data ?? []) {
        const roleId = String(row.role_id ?? '');
        if (!roleId) continue;
        memberCounts[roleId] = (memberCounts[roleId] ?? 0) + 1;
      }
    }
  }

  return roleRows.map(row =>
    mapFunctionalRoleRow(
      row as Record<string, unknown>,
      memberCounts[String(row.id ?? '')] ?? 0
    )
  );
}

export async function fetchScopeFunctionalRoles(
  scopeId: string,
  includeArchived = false
): Promise<ScopeFunctionalRoleRow[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_functional_roles_list_v1',
    {
      p_scope_id: scopeId,
      p_include_archived: includeArchived,
    }
  );

  if (!error) {
    return rows<Record<string, unknown>>(data).map(row =>
      mapFunctionalRoleRow(row, Number(row.member_count ?? 0))
    );
  }

  console.warn(
    '[buklod] functional roles RPC unavailable, using direct read:',
    error.message
  );

  return fetchScopeFunctionalRolesDirect(scopeId, includeArchived);
}

async function upsertScopeFunctionalRoleDirect(input: {
  scopeId: string;
  roleId?: string | null;
  name: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<string> {
  const { data: authData } = await supabase.auth.getUser();
  const createdBy = authData.user?.id ?? null;
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (input.roleId) {
    const { data, error } = await supabase
      .from('buklod_scope_functional_roles')
      .update(payload)
      .eq('id', input.roleId)
      .eq('scope_id', input.scopeId)
      .select('id')
      .single();

    if (error) throw error;

    return String(data.id);
  }

  const { data, error } = await supabase
    .from('buklod_scope_functional_roles')
    .insert({
      scope_id: input.scopeId,
      ...payload,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (error) throw error;

  return String(data.id);
}

export async function upsertScopeFunctionalRole(input: {
  scopeId: string;
  roleId?: string | null;
  name: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_functional_role_upsert_v1',
    {
      p_scope_id: input.scopeId,
      p_role_id: input.roleId ?? null,
      p_name: input.name.trim(),
      p_description: input.description?.trim() || null,
      p_sort_order: input.sortOrder ?? 0,
    }
  );

  if (!error) {
    return String(data ?? '');
  }

  const message = String(error?.message ?? '');

  if (!isMissingRpcError(message)) {
    throw error;
  }

  return upsertScopeFunctionalRoleDirect(input);
}

async function archiveScopeFunctionalRoleDirect(
  scopeId: string,
  roleId: string,
  archive = true
) {
  const { error } = await supabase
    .from('buklod_scope_functional_roles')
    .update({
      is_active: !archive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roleId)
    .eq('scope_id', scopeId);

  if (error) throw error;
}

export async function archiveScopeFunctionalRole(
  scopeId: string,
  roleId: string,
  archive = true
) {
  const { error } = await (supabase as any).rpc(
    'buklod_scope_functional_role_archive_v1',
    {
      p_scope_id: scopeId,
      p_role_id: roleId,
      p_archive: archive,
    }
  );

  if (!error) {
    return;
  }

  const message = String(error?.message ?? '');

  if (!isMissingRpcError(message)) {
    throw error;
  }

  await archiveScopeFunctionalRoleDirect(scopeId, roleId, archive);
}

async function setMemberFunctionalRolesDirect(
  scopeId: string,
  userId: string,
  roleIds: string[]
) {
  const { data: authData } = await supabase.auth.getUser();
  const assignedBy = authData.user?.id ?? null;

  const { error: deleteError } = await supabase
    .from('buklod_scope_member_functional_roles')
    .delete()
    .eq('scope_id', scopeId)
    .eq('user_id', userId);

  if (deleteError) {
    throw deleteError;
  }

  if (!roleIds.length) {
    return;
  }

  const { error: insertError } = await supabase
    .from('buklod_scope_member_functional_roles')
    .insert(
      roleIds.map(roleId => ({
        scope_id: scopeId,
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
      }))
    );

  if (insertError) {
    throw insertError;
  }
}

export async function setMemberFunctionalRoles(
  scopeId: string,
  userId: string,
  roleIds: string[]
) {
  const { error } = await (supabase as any).rpc(
    'buklod_scope_member_functional_roles_set_v1',
    {
      p_scope_id: scopeId,
      p_user_id: userId,
      p_role_ids: roleIds,
    }
  );

  if (!error) {
    return;
  }

  const message = String(error?.message ?? '');

  if (!isMissingRpcError(message)) {
    throw error;
  }

  await setMemberFunctionalRolesDirect(scopeId, userId, roleIds);
}

export async function setScopeAdmin(
  scopeId: string,
  userId: string,
  enabled: boolean
) {
  const { error } = await (supabase as any).rpc('buklod_scope_set_admin_v1', {
    p_scope_id: scopeId,
    p_user_id: userId,
    p_enabled: enabled,
  });

  if (error) throw error;
}
