import { supabase } from '@/lib/supabase';

export type AttendancePlatformStats = {
  total_events: number;
  active_events: number;
  events_30d: number;
  events_7d: number;
  total_records: number;
  records_30d: number;
  records_7d: number;
  cluster_checkins_30d: number;
  scopes_with_events: number;
  scope_operators: number;
  generated_at: string;
};

export type AttendanceScopeAdoptionRow = {
  scope_id: string;
  scope_name: string;
  scope_type: string;
  event_count: number;
  active_event_count: number;
  record_count_30d: number;
  operator_count: number;
  last_event_at: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePlatformStats(raw: unknown): AttendancePlatformStats | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;

  return {
    total_events: toNumber(row.total_events),
    active_events: toNumber(row.active_events),
    events_30d: toNumber(row.events_30d),
    events_7d: toNumber(row.events_7d),
    total_records: toNumber(row.total_records),
    records_30d: toNumber(row.records_30d),
    records_7d: toNumber(row.records_7d),
    cluster_checkins_30d: toNumber(row.cluster_checkins_30d),
    scopes_with_events: toNumber(row.scopes_with_events),
    scope_operators: toNumber(row.scope_operators),
    generated_at: String(row.generated_at ?? new Date().toISOString()),
  };
}

function parseScopeAdoptionRow(raw: unknown): AttendanceScopeAdoptionRow | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const scopeId = String(row.scope_id ?? '').trim();

  if (!scopeId) {
    return null;
  }

  return {
    scope_id: scopeId,
    scope_name: String(row.scope_name ?? 'Scope'),
    scope_type: String(row.scope_type ?? ''),
    event_count: toNumber(row.event_count),
    active_event_count: toNumber(row.active_event_count),
    record_count_30d: toNumber(row.record_count_30d),
    operator_count: toNumber(row.operator_count),
    last_event_at: row.last_event_at
      ? String(row.last_event_at)
      : null,
  };
}

export async function fetchAttendancePlatformStats(): Promise<AttendancePlatformStats | null> {
  const { data, error } = await supabase.rpc(
    'admin_buklod_attendance_platform_stats_v1'
  );

  if (error) {
    throw error;
  }

  return parsePlatformStats(data);
}

export async function fetchAttendanceScopeAdoption(
  limit = 50,
  offset = 0
): Promise<AttendanceScopeAdoptionRow[]> {
  const { data, error } = await supabase.rpc(
    'admin_buklod_attendance_scope_adoption_v1',
    {
      p_limit: limit,
      p_offset: offset,
    }
  );

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map(parseScopeAdoptionRow)
    .filter(Boolean) as AttendanceScopeAdoptionRow[];
}
