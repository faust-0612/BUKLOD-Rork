import { supabase } from '@/lib/supabase';

export type MzbStatus = {
  scope_id: string;
  organization_name: string;
  description: string | null;
  scope_status: string;

  membership_status:
    | 'ACTIVE'
    | 'INVITED'
    | 'LEFT'
    | 'REMOVED'
    | 'SUSPENDED'
    | null;

  membership_source: string | null;

  is_admin: boolean;

  role_keys: string[];

  faith_content_mandatory: boolean;
};

export type MzbEntitlement = {
  feature_key: string;
  enabled: boolean;
};

export type MzbRole = {
  role_key: string;
  display_name: string;
  description: string | null;
};

export type MzbMember = {
  user_id: string;
  full_name: string;

  membership_status: string;

  role_keys: string[];

  joined_at: string | null;
};

export type MzbCandidate = {
  user_id: string;
  full_name: string;
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
  const { data, error } =
    await (supabase as any).rpc(
      name,
      args
    );

  if (error) {
    throw error;
  }

  return data as T;
}

export async function getMyMzb() {
  const data =
    await rpc<unknown>(
      'buklod_my_mzb'
    );

  return rows<MzbStatus>(data)[0] ?? null;
}

export async function getMyMzbEntitlements() {
  const data =
    await rpc<unknown>(
      'buklod_my_mzb_entitlements'
    );

  return rows<MzbEntitlement>(data);
}

export async function getMzbRoleCatalog() {
  const data =
    await rpc<unknown>(
      'buklod_mzb_role_catalog'
    );

  return rows<MzbRole>(data);
}

export async function getMzbMembers() {
  const data =
    await rpc<unknown>(
      'buklod_mzb_members'
    );

  return rows<MzbMember>(data);
}

export async function searchMzbCandidates(
  query = ''
) {
  const data =
    await rpc<unknown>(
      'buklod_search_mzb_invite_candidates',
      {
        _query:
          query.trim() || null,

        _limit:
          30,
      }
    );

  return rows<MzbCandidate>(data);
}

export async function inviteMzbMember(
  userId: string
) {
  await rpc(
    'buklod_invite_mzb_member',
    {
      _user_id:
        userId,
    }
  );
}

export async function respondMzbInvite(
  accept: boolean
) {
  await rpc(
    'buklod_respond_mzb_invite',
    {
      _accept:
        accept,
    }
  );
}

export async function setMzbRole(
  userId: string,
  roleKey: string,
  enabled: boolean
) {
  await rpc(
    'buklod_set_mzb_role',
    {
      _user_id:
        userId,

      _role_key:
        roleKey,

      _enabled:
        enabled,
    }
  );
}

export async function removeMzbMember(
  userId: string
) {
  await rpc(
    'buklod_remove_mzb_member',
    {
      _user_id:
        userId,
    }
  );
}

export async function leaveMzb() {
  await rpc(
    'buklod_leave_mzb'
  );
}
