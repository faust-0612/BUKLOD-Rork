import { supabase } from '@/lib/supabase';

export type BuklodFoundationWorkspace = {
  workspace_key: string;
  title: string;
  subtitle: string | null;
  route: string;
  icon: string;
  sort_order: number;
  scope_type_hint: string | null;
};

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
