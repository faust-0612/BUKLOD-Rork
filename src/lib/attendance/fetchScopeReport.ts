import { supabase } from '@/lib/supabase';
import { localDateFromIso } from './aggregate';
import type {
  AttendanceMethod,
  AttendanceStatus,
  NormalizedAttendanceRecord,
} from './types';

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
};

type EventReportRow = {
  user_id: string;
  full_name: string | null;
  status: string;
  method: string;
  checked_in_at: string;
};

type ClusterCheckinRow = {
  id: string;
  user_id: string;
  checkin_date: string;
  checked_in_at: string;
};

type ScopeLogRow = {
  id: string;
  source: string;
  scope_id: string;
  user_id: string;
  full_name: string | null;
  local_date: string;
  event_id: string | null;
  event_title: string | null;
  status: string;
  method: string;
  verified: boolean;
  checked_in_at: string;
};

function normalizeStatus(raw: string): AttendanceStatus {
  const value = raw.trim().toLowerCase();

  if (value === 'late') return 'late';
  if (value === 'absent') return 'absent';
  if (value === 'excused') return 'excused';
  return 'present';
}

function normalizeMethod(raw: string): AttendanceMethod {
  const value = raw.trim().toLowerCase() as AttendanceMethod;
  const allowed: AttendanceMethod[] = [
    'qr',
    'face',
    'device_biometric',
    'manual',
    'cluster_self',
    'location',
    'external_fingerprint',
  ];

  return allowed.includes(value) ? value : 'unknown';
}

function isVerifiedMethod(method: AttendanceMethod) {
  return ['qr', 'face', 'device_biometric', 'location'].includes(method);
}

function mapScopeLogRow(row: ScopeLogRow): NormalizedAttendanceRecord {
  const method = normalizeMethod(row.method);

  return {
    id: row.id,
    source: row.source === 'cluster_daily' ? 'cluster_daily' : 'event',
    scope_id: row.scope_id,
    user_id: row.user_id,
    full_name: row.full_name,
    local_date: row.local_date,
    event_id: row.event_id,
    event_title: row.event_title,
    status: normalizeStatus(row.status),
    method,
    verified: row.verified ?? isVerifiedMethod(method),
    checked_in_at: row.checked_in_at,
  };
}

function shouldFallbackToLegacyRpc(error: { code?: string; message?: string }) {
  const message = String(error.message ?? '').toLowerCase();

  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('admin access required') ||
    message.includes('attendance report access required')
  );
}

async function fetchViaScopeLogRpc(options: {
  scopeId: string;
  dateFrom: string;
  dateTo: string;
  eventId?: string | null;
  eventTitle?: string | null;
}): Promise<NormalizedAttendanceRecord[] | null> {
  const { scopeId, dateFrom, dateTo, eventId, eventTitle } = options;
  const records: NormalizedAttendanceRecord[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const { data, error } = await supabase.rpc(
      'get_buklod_attendance_scope_log',
      {
        p_scope_id: scopeId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_event_id: eventId || null,
        p_event_title: eventTitle?.trim() || null,
        p_limit: limit,
        p_offset: offset,
      }
    );

    if (error) {
      if (shouldFallbackToLegacyRpc(error)) {
        return null;
      }

      throw error;
    }

    const rows = (data ?? []) as ScopeLogRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      records.push(mapScopeLogRow(row));
    }

    if (rows.length < limit) {
      break;
    }

    offset += limit;
  }

  return records.sort(
    (a, b) =>
      new Date(b.checked_in_at).getTime() -
      new Date(a.checked_in_at).getTime()
  );
}

/** Client-side federation fallback when scope-log RPC is unavailable. */
async function fetchScopeAttendanceRecordsLegacy(options: {
  scopeId: string;
  scopeType: string;
  dateFrom: string;
  dateTo: string;
  isAdmin: boolean;
  eventId?: string | null;
  eventTitle?: string | null;
}): Promise<NormalizedAttendanceRecord[]> {
  const {
    scopeId,
    scopeType,
    dateFrom,
    dateTo,
    isAdmin,
    eventId,
    eventTitle,
  } = options;
  const records: NormalizedAttendanceRecord[] = [];

  const rangeStart = `${dateFrom}T00:00:00`;
  const rangeEnd = `${dateTo}T23:59:59.999`;
  const normalizedTitle = String(eventTitle ?? '').trim();

  let eventsQuery = supabase
    .from('attendance_events')
    .select('id,title,starts_at')
    .eq('scope_id', scopeId)
    .order('starts_at', { ascending: false });

  if (eventId) {
    eventsQuery = eventsQuery.eq('id', eventId);
  } else if (normalizedTitle) {
    eventsQuery = eventsQuery.eq('title', normalizedTitle);
  } else {
    eventsQuery = eventsQuery
      .gte('starts_at', rangeStart)
      .lte('starts_at', rangeEnd);
  }

  const { data: events, error: eventsError } = await eventsQuery;

  if (eventsError) {
    throw eventsError;
  }

  if (isAdmin) {
    for (const event of (events ?? []) as EventRow[]) {
      const { data, error } = await supabase.rpc(
        'get_buklod_attendance_event_report',
        { p_event_id: event.id }
      );

      if (error) {
        console.warn('Event report:', event.id, error.message);
        continue;
      }

      for (const row of (data ?? []) as EventReportRow[]) {
        const localDate = localDateFromIso(row.checked_in_at);

        if (localDate < dateFrom || localDate > dateTo) {
          continue;
        }

        const method = normalizeMethod(row.method);
        records.push({
          id: `event:${event.id}:${row.user_id}:${row.checked_in_at}`,
          source: 'event',
          scope_id: scopeId,
          user_id: row.user_id,
          full_name: row.full_name,
          local_date: localDateFromIso(row.checked_in_at),
          event_id: event.id,
          event_title: event.title,
          status: normalizeStatus(row.status),
          method,
          verified: isVerifiedMethod(method),
          checked_in_at: row.checked_in_at,
        });
      }
    }
  }

  if (scopeType === 'CLUSTER' && !eventId && !normalizedTitle) {
    const { data: clusterRows, error: clusterError } = await supabase
      .from('buklod_cluster_attendance')
      .select('id,user_id,checkin_date,checked_in_at')
      .eq('scope_id', scopeId)
      .gte('checkin_date', dateFrom)
      .lte('checkin_date', dateTo);

    if (clusterError) {
      throw clusterError;
    }

    const userIds = [
      ...new Set(
        ((clusterRows ?? []) as ClusterCheckinRow[]).map(row => row.user_id)
      ),
    ];

    let nameByUser = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', userIds);

      nameByUser = new Map(
        (profiles ?? []).map(row => [
          String(row.id),
          String(row.full_name ?? ''),
        ])
      );
    }

    for (const row of (clusterRows ?? []) as ClusterCheckinRow[]) {
      records.push({
        id: `cluster:${row.id}`,
        source: 'cluster_daily',
        scope_id: scopeId,
        user_id: row.user_id,
        full_name: nameByUser.get(row.user_id) ?? null,
        local_date: row.checkin_date,
        event_id: null,
        event_title: 'Daily cluster check-in',
        status: 'present',
        method: 'cluster_self',
        verified: false,
        checked_in_at: row.checked_in_at,
      });
    }
  }

  return records.sort(
    (a, b) =>
      new Date(b.checked_in_at).getTime() -
      new Date(a.checked_in_at).getTime()
  );
}

export async function fetchScopeAttendanceRecords(options: {
  scopeId: string;
  scopeType: string;
  dateFrom: string;
  dateTo: string;
  isAdmin: boolean;
  eventId?: string | null;
  eventTitle?: string | null;
}): Promise<NormalizedAttendanceRecord[]> {
  const rpcRows = await fetchViaScopeLogRpc({
    scopeId: options.scopeId,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    eventId: options.eventId,
    eventTitle: options.eventTitle,
  });

  if (rpcRows) {
    return rpcRows;
  }

  return fetchScopeAttendanceRecordsLegacy(options);
}
