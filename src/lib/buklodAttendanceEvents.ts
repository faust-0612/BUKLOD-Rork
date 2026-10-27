import { supabase } from '@/lib/supabase';
import { rpcWithArgFallback } from '@/lib/buklodScope';

export type BuklodAttendanceEventRow = {
  id: string;
  scope_id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  attendance_open_at: string | null;
  attendance_close_at: string | null;
  late_after: string | null;
  allowed_methods: string[] | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
};

const EVENT_COLUMNS =
  'id,scope_id,title,location,starts_at,ends_at,attendance_open_at,attendance_close_at,late_after,allowed_methods,is_active,created_at,created_by';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_CACHE_PREFIX = '@buklod/attendance-events/v1:';

function asBoolean(value: unknown, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const text = String(value ?? '').trim().toLowerCase();

  if (text === 'true' || text === 't' || text === '1' || text === 'open') {
    return true;
  }

  if (text === 'false' || text === 'f' || text === '0' || text === 'closed') {
    return false;
  }

  return fallback;
}

export function extractAttendanceEventId(data: unknown): string | null {
  if (typeof data === 'string') {
    const value = data.trim();
    return UUID_RE.test(value) ? value : null;
  }

  if (Array.isArray(data)) {
    return extractAttendanceEventId(data[0]);
  }

  if (data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    return extractAttendanceEventId(
      row.id ??
        row.event_id ??
        row.create_buklod_attendance_event ??
        null
    );
  }

  return null;
}

export function normalizeAttendanceEventRow(
  raw: unknown,
  fallbackScopeId = ''
): BuklodAttendanceEventRow | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const id = extractAttendanceEventId(row);

  if (!id) {
    return null;
  }

  const methods = Array.isArray(row.allowed_methods)
    ? row.allowed_methods.map(item => String(item))
    : null;

  return {
    id,
    scope_id: String(row.scope_id ?? fallbackScopeId),
    title: String(row.title ?? 'Attendance'),
    location: row.location == null ? null : String(row.location),
    starts_at: String(row.starts_at ?? new Date().toISOString()),
    ends_at: row.ends_at == null ? null : String(row.ends_at),
    attendance_open_at:
      row.attendance_open_at == null
        ? null
        : String(row.attendance_open_at),
    attendance_close_at:
      row.attendance_close_at == null
        ? null
        : String(row.attendance_close_at),
    late_after: row.late_after == null ? null : String(row.late_after),
    allowed_methods: methods,
    is_active: asBoolean(row.is_active, false),
    created_at: String(row.created_at ?? new Date().toISOString()),
    created_by: String(row.created_by ?? ''),
  };
}

function mergeEventRows(
  rows: BuklodAttendanceEventRow[]
): BuklodAttendanceEventRow[] {
  const map = new Map<string, BuklodAttendanceEventRow>();

  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, row);
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  );
}

function asEventRows(
  data: unknown,
  scopeId: string
): BuklodAttendanceEventRow[] {
  let raw: unknown = data;

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const row = raw as Record<string, unknown>;
    raw =
      row.events ??
      row.rows ??
      row.data ??
      raw;
  }

  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return list
    .map(item => normalizeAttendanceEventRow(item, scopeId))
    .filter(Boolean) as BuklodAttendanceEventRow[];
}

async function readCachedEvents(
  scopeId: string
): Promise<BuklodAttendanceEventRow[]> {
  try {
    const AsyncStorage = (
      await import('@react-native-async-storage/async-storage')
    ).default;
    const raw = await AsyncStorage.getItem(
      `${EVENT_CACHE_PREFIX}${scopeId}`
    );

    if (!raw) {
      return [];
    }

    return asEventRows(JSON.parse(raw), scopeId);
  } catch {
    return [];
  }
}

async function writeCachedEvents(
  scopeId: string,
  rows: BuklodAttendanceEventRow[]
) {
  try {
    const AsyncStorage = (
      await import('@react-native-async-storage/async-storage')
    ).default;

    await AsyncStorage.setItem(
      `${EVENT_CACHE_PREFIX}${scopeId}`,
      JSON.stringify(rows)
    );
  } catch {
    // Cache is optional.
  }
}

// Production exposes one scoped attendance listing contract. Do not probe
// nonexistent legacy RPCs or incompatible attendance_events table columns.
async function listEventsFromRpc(
  scopeId: string
): Promise<{ rows: BuklodAttendanceEventRow[]; error: boolean }> {
  const { data, error } = await supabase.rpc('buklod_list_attendance_events_v1', {
    p_scope_id: scopeId,
  });

  if (error) {
    return { rows: [], error: true };
  }

  return { rows: asEventRows(data, scopeId), error: false };
}

export async function fetchAttendanceEventById(
  eventId: string,
  fallbackScopeId = ''
): Promise<BuklodAttendanceEventRow | null> {
  const id = String(eventId ?? '').trim();

  if (!id) {
    return null;
  }

  const { data, error } = await supabase
    .from('attendance_events')
    .select(EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (!error && data) {
    return normalizeAttendanceEventRow(data, fallbackScopeId);
  }

  return null;
}

export async function listBuklodAttendanceEvents(
  scopeId: string
): Promise<BuklodAttendanceEventRow[]> {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return [];
  }

  const result = await listEventsFromRpc(id);
  if (result.error) {
    // Offline fallback only: never mask a valid empty server response with stale events.
    return readCachedEvents(id);
  }

  const rows = mergeEventRows(result.rows);
  void writeCachedEvents(id, rows);
  return rows;
}

export async function createBuklodAttendanceEvent(input: {
  scopeId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  lateAfter: string;
  allowedMethods: string[];
  openNow: boolean;
}): Promise<BuklodAttendanceEventRow> {
  const result = await rpcWithArgFallback(
    'create_buklod_attendance_event',
    [
      {
        p_scope_id: input.scopeId,
        p_title: input.title,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_location: input.location,
        p_late_after: input.lateAfter,
        p_allowed_methods: input.allowedMethods,
        p_open_now: input.openNow,
      },
      {
        _scope_id: input.scopeId,
        _title: input.title,
        _starts_at: input.startsAt,
        _ends_at: input.endsAt,
        _location: input.location,
        _late_after: input.lateAfter,
        _allowed_methods: input.allowedMethods,
        _open_now: input.openNow,
      },
    ]
  );

  if (result.error) {
    throw result.error;
  }

  const createdId =
    extractAttendanceEventId(result.data) ??
    normalizeAttendanceEventRow(result.data, input.scopeId)?.id ??
    null;

  if (!createdId) {
    throw new Error(
      'The event was not saved. Try again, then open BUKLOD Attendance to confirm it appears.'
    );
  }

  let fetched =
    (await fetchAttendanceEventById(createdId, input.scopeId)) ??
    (await listBuklodAttendanceEvents(input.scopeId)).find(
      row => row.id === createdId
    ) ??
    normalizeAttendanceEventRow(result.data, input.scopeId);

  if (!fetched) {
    throw new Error(
      'The event was saved but could not be loaded yet. Open BUKLOD Attendance and pull to refresh.'
    );
  }

  if (input.openNow) {
    await rpcWithArgFallback('set_buklod_attendance_event_active', [
      { p_event_id: fetched.id, p_active: true },
      { _event_id: fetched.id, _active: true },
    ]);
    fetched = {
      ...fetched,
      is_active: true,
    };
  }

  const listed = await listBuklodAttendanceEvents(input.scopeId);
  void writeCachedEvents(
    input.scopeId,
    mergeEventRows([fetched, ...listed])
  );
  return fetched;
}
