import { supabase } from '@/lib/supabase';
import type { ChurchVisibility } from '@/lib/buklodChurches';

export type ChurchLeaderKind = 'pastor' | 'mentor';

export type ExistingChurchMatch = {
  scope_id: string;
  scope_name: string;
  visibility: string;
  scope_status: string;
  can_setup: boolean;
  already_registered: boolean;
  has_worship_pin: boolean;
  has_pastor_or_mentor: boolean;
  safe_location_label: string | null;
};

export type ChurchSetupSnapshot = {
  scope_id: string;
  name: string;
  has_name: boolean;
  safe_location_label: string | null;
  has_safe_location_label: boolean;
  has_worship_pin: boolean;
  visibility: string;
  scope_status: string | null;
  has_pastor_or_mentor: boolean;
  verification_status: string | null;
  nearby_discoverable: boolean;
};

export type ChurchRegistrationResult = ChurchSetupSnapshot & {
  reused: boolean;
  already_registered: boolean;
  can_setup: boolean;
};

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  return data as Record<string, unknown>;
}

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data == null) return [];
  return [data as T];
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message,
  );
}

function mapMatch(row: Record<string, unknown>): ExistingChurchMatch | null {
  const scopeId = String(row.scope_id ?? row.id ?? '').trim();
  const scopeName = String(row.scope_name ?? row.name ?? '').trim();
  if (!scopeId || !scopeName) return null;

  return {
    scope_id: scopeId,
    scope_name: scopeName,
    visibility: String(row.visibility ?? 'PUBLIC'),
    scope_status: String(row.scope_status ?? ''),
    can_setup: Boolean(row.can_setup),
    already_registered: row.already_registered == null
      ? true
      : Boolean(row.already_registered),
    has_worship_pin: Boolean(row.has_worship_pin),
    has_pastor_or_mentor: Boolean(row.has_pastor_or_mentor),
    safe_location_label: row.safe_location_label
      ? String(row.safe_location_label)
      : null,
  };
}

function mapSnapshot(row: Record<string, unknown>): ChurchSetupSnapshot | null {
  const scopeId = String(row.scope_id ?? '').trim();
  if (!scopeId) return null;

  return {
    scope_id: scopeId,
    name: String(row.name ?? ''),
    has_name: Boolean(row.has_name ?? row.name),
    safe_location_label: row.safe_location_label
      ? String(row.safe_location_label)
      : null,
    has_safe_location_label: Boolean(row.has_safe_location_label),
    has_worship_pin: Boolean(row.has_worship_pin),
    visibility: String(row.visibility ?? 'PUBLIC'),
    scope_status: row.scope_status ? String(row.scope_status) : null,
    has_pastor_or_mentor: Boolean(row.has_pastor_or_mentor),
    verification_status: row.verification_status
      ? String(row.verification_status)
      : null,
    nearby_discoverable: Boolean(row.nearby_discoverable),
  };
}

export function churchNameKey(name: string) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bsanta\b/g, 'sta')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findExistingChurchScope(name: string) {
  const trimmed = name.trim();
  if (churchNameKey(trimmed).length < 6) {
    return null;
  }

  const { data, error } = await (supabase as any).rpc(
    'buklod_find_existing_church_scope_v1',
    { p_name: trimmed },
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      return null;
    }
    throw error;
  }

  const rows = asRows<Record<string, unknown>>(data);
  for (const row of rows) {
    const match = mapMatch(row);
    if (match) return match;
  }
  return mapMatch(asRecord(data) ?? {});
}

export async function fetchChurchSetupSnapshot(scopeId: string) {
  const { data, error } = await (supabase as any).rpc(
    'buklod_church_setup_snapshot_v1',
    { p_scope_id: scopeId },
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      return null;
    }
    throw error;
  }

  return mapSnapshot(asRecord(data) ?? {});
}

export async function registerChurchSetup(input: {
  name: string;
  safeLocationLabel: string;
  latitude: number;
  longitude: number;
  visibility: ChurchVisibility;
  leaderKind: ChurchLeaderKind;
  authorityConfirmed: boolean;
  description?: string;
  existingScopeId?: string | null;
}): Promise<ChurchRegistrationResult> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_register_church_setup_v1',
    {
      p_name: input.name.trim(),
      p_safe_location_label: input.safeLocationLabel.trim(),
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_visibility: input.visibility,
      p_leader_kind: input.leaderKind,
      p_authority_confirmed: input.authorityConfirmed,
      p_description: input.description?.trim() || null,
      p_existing_scope_id: input.existingScopeId?.trim() || null,
    },
  );

  if (error) throw error;

  const row = asRecord(data) ?? {};
  const snapshot = mapSnapshot(row);
  if (!snapshot) {
    throw new Error('Church setup did not return a church.');
  }

  return {
    ...snapshot,
    reused: Boolean(row.reused),
    already_registered: Boolean(row.already_registered),
    can_setup: row.can_setup == null ? true : Boolean(row.can_setup),
  };
}
