import { supabase } from '@/lib/supabase';
import {
  FUNCTIONAL_ROLE_TEMPLATES,
  inferScopeRoleTemplateGroup,
  type ScopeRoleTemplateGroup,
} from '@/lib/buklodScopeRoleTemplates';

export type SuborganizationRow = {
  scope_id: string;
  name: string;
  status: string;
  visibility: string;
  parent_scope_id: string;
  description: string | null;
  organization_type: string | null;
  member_count: number;
  admin_count: number;
  created_at: string | null;
};

export type CreateSuborganizationInput = {
  parentScopeId: string;
  name: string;
  description?: string | null;
  visibility?: string;
  joinPolicy?: string;
  organizationType?: string | null;
};

function rows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data == null) return [];
  return [data as T];
}

export function readParentOrganizationType(
  metadata?: Record<string, unknown> | null
): string {
  const meta = metadata ?? {};
  return String(
    meta.organization_type ?? meta.org_type ?? meta.industry ?? 'OTHER'
  ).trim();
}

export function suggestedFunctionalRolesForParent(
  metadata?: Record<string, unknown> | null
): string[] {
  const group = inferScopeRoleTemplateGroup({
    scope_type: 'ORGANIZATION',
    metadata,
  });

  return FUNCTIONAL_ROLE_TEMPLATES[group];
}

export function roleTemplateGroupLabel(group: ScopeRoleTemplateGroup) {
  switch (group) {
    case 'CHURCH':
      return 'Church / Ministry';
    case 'BUSINESS':
      return 'Business / Company';
    case 'EDUCATION':
      return 'Education';
    case 'GOVERNMENT':
      return 'Government / Civic';
    default:
      return 'General';
  }
}

export async function listSuborganizations(
  parentScopeId: string,
  limit = 50,
  offset = 0
): Promise<SuborganizationRow[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_list_suborganizations_v1',
    {
      p_parent_scope_id: parentScopeId,
      p_limit: limit,
      p_offset: offset,
    }
  );

  if (error) {
    const legacy = await (supabase as any).rpc('buklod_list_suborganizations', {
      _parent_scope_id: parentScopeId,
    });

    if (legacy.error) {
      throw error;
    }

    return rows<Record<string, unknown>>(legacy.data).map((row) => ({
      scope_id: String(row.scope_id ?? row.id ?? ''),
      name: String(row.name ?? ''),
      status: String(row.status ?? 'ACTIVE'),
      visibility: String(row.visibility ?? 'PUBLIC'),
      parent_scope_id: String(row.parent_scope_id ?? parentScopeId),
      description: row.description ? String(row.description) : null,
      organization_type: null,
      member_count: Number(row.member_count ?? 0),
      admin_count: Number(row.admin_count ?? 0),
      created_at: null,
    }));
  }

  return rows<Record<string, unknown>>(data).map((row) => ({
    scope_id: String(row.scope_id ?? ''),
    name: String(row.name ?? ''),
    status: String(row.status ?? 'ACTIVE'),
    visibility: String(row.visibility ?? 'PUBLIC'),
    parent_scope_id: String(row.parent_scope_id ?? parentScopeId),
    description: row.description ? String(row.description) : null,
    organization_type: row.organization_type
      ? String(row.organization_type)
      : null,
    member_count: Number(row.member_count ?? 0),
    admin_count: Number(row.admin_count ?? 0),
    created_at: row.created_at ? String(row.created_at) : null,
  }));
}

export async function createSuborganization(
  input: CreateSuborganizationInput
): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_create_suborganization_v1',
    {
      p_parent_scope_id: input.parentScopeId,
      p_name: input.name.trim(),
      p_description: input.description?.trim() || null,
      p_visibility: input.visibility ?? null,
      p_join_policy: input.joinPolicy ?? null,
      p_organization_type: input.organizationType?.trim() || null,
      p_profile: {},
    }
  );

  if (error) {
    throw error;
  }

  const childId = String(data ?? '').trim();

  if (!childId) {
    throw new Error('Sub-organization was not created.');
  }

  return childId;
}
