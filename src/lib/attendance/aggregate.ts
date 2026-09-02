import type {
  AttendanceMetrics,
  AttendanceScopeFilter,
  AttendanceStatus,
  AttendanceTrendPoint,
  NormalizedAttendanceRecord,
} from './types';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function localDateFromIso(iso: string, date = new Date(iso)) {
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysBetweenInclusive(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const out: string[] = [];

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return out;
  }

  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    out.push(localDateFromIso('', cursor));
  }

  return out;
}

export function previousPeriod(
  dateFrom: string,
  dateTo: string
): { from: string; to: string } | null {
  const days = daysBetweenInclusive(dateFrom, dateTo);

  if (days.length === 0) {
    return null;
  }

  const span = days.length;
  const start = new Date(`${dateFrom}T00:00:00`);
  start.setDate(start.getDate() - span);
  const end = new Date(`${dateFrom}T00:00:00`);
  end.setDate(end.getDate() - 1);

  return {
    from: localDateFromIso('', start),
    to: localDateFromIso('', end),
  };
}

export function filterRecords(
  records: NormalizedAttendanceRecord[],
  filters: AttendanceScopeFilter
) {
  return records.filter(row => {
    if (row.scope_id !== filters.scopeId) {
      return false;
    }

    if (row.local_date < filters.dateFrom || row.local_date > filters.dateTo) {
      return false;
    }

    if (filters.memberId && row.user_id !== filters.memberId) {
      return false;
    }

    if (filters.status && filters.status !== 'all' && row.status !== filters.status) {
      return false;
    }

    if (filters.method && filters.method !== 'all' && row.method !== filters.method) {
      return false;
    }

    if (filters.verified === 'verified' && !row.verified) {
      return false;
    }

    if (filters.verified === 'unverified' && row.verified) {
      return false;
    }

    if (filters.eventId && row.event_id !== filters.eventId) {
      return false;
    }

    if (
      filters.eventTitle &&
      !filters.eventId &&
      String(row.event_title ?? '').trim().toLowerCase() !==
        filters.eventTitle.trim().toLowerCase()
    ) {
      return false;
    }

    return true;
  });
}

function buildTrend(
  records: NormalizedAttendanceRecord[],
  dateFrom: string,
  dateTo: string
): AttendanceTrendPoint[] {
  const bucket = new Map<string, AttendanceTrendPoint>();

  for (const day of daysBetweenInclusive(dateFrom, dateTo)) {
    bucket.set(day, {
      date: day,
      count: 0,
      present: 0,
      late: 0,
    });
  }

  for (const row of records) {
    const point = bucket.get(row.local_date);

    if (!point) {
      continue;
    }

    point.count += 1;

    if (row.status === 'present') {
      point.present += 1;
    }

    if (row.status === 'late') {
      point.late += 1;
    }
  }

  return [...bucket.values()];
}

export function computeMetrics(
  records: NormalizedAttendanceRecord[],
  filters: AttendanceScopeFilter,
  comparisonRecords: NormalizedAttendanceRecord[] = []
): AttendanceMetrics {
  const status: Record<AttendanceStatus, number> = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
  };

  const methods: Record<string, number> = {};
  const participants = new Set<string>();
  let verified = 0;

  for (const row of records) {
    participants.add(row.user_id);
    status[row.status] += 1;
    methods[row.method] = (methods[row.method] ?? 0) + 1;

    if (row.verified) {
      verified += 1;
    }
  }

  const attended = status.present + status.late;
  const attendanceRate =
    records.length > 0
      ? Math.round((attended / records.length) * 1000) / 10
      : 0;

  const comparisonAvailable = comparisonRecords.length > 0;
  const previousAttended =
    comparisonRecords.filter(
      row => row.status === 'present' || row.status === 'late'
    ).length;
  const previousRate =
    comparisonRecords.length > 0
      ? Math.round((previousAttended / comparisonRecords.length) * 1000) / 10
      : 0;

  return {
    totalRecords: records.length,
    uniqueParticipants: participants.size,
    status,
    verified,
    unverified: records.length - verified,
    methods,
    trend: buildTrend(records, filters.dateFrom, filters.dateTo),
    attendanceRate,
    comparison: {
      available: comparisonAvailable,
      previousTotal: comparisonRecords.length,
      deltaRecords: records.length - comparisonRecords.length,
      deltaRate: Math.round((attendanceRate - previousRate) * 10) / 10,
      label: comparisonAvailable
        ? `${filters.dateFrom} to ${filters.dateTo} vs prior equal-length period`
        : 'Insufficient comparison data',
    },
  };
}

export function buildReportDataset(
  allRecords: NormalizedAttendanceRecord[],
  filters: AttendanceScopeFilter
) {
  const records = filterRecords(allRecords, filters);
  const prior = previousPeriod(filters.dateFrom, filters.dateTo);
  const comparisonRecords = prior
    ? filterRecords(allRecords, {
        ...filters,
        dateFrom: prior.from,
        dateTo: prior.to,
      })
    : [];

  return {
    filters,
    records,
    metrics: computeMetrics(records, filters, comparisonRecords),
  };
}
