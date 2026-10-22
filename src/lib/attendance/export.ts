import type { NormalizedAttendanceRecord } from './types';

export function attendanceRecordsToCsvRows(
  records: NormalizedAttendanceRecord[]
) {
  return records.map(record => ({
    Date: record.local_date,
    Event: record.event_title ?? '',
    Name: record.full_name ?? '',
    Status: record.status,
    Method: record.method,
    Verified: record.verified ? 'Yes' : 'No',
    'Checked in': record.checked_in_at,
    Source: record.source,
  }));
}
