export type AttendanceLogSource =
  | 'event'
  | 'cluster_daily'
  | 'education';

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'excused';

export type AttendanceMethod =
  | 'qr'
  | 'face'
  | 'device_biometric'
  | 'manual'
  | 'cluster_self'
  | 'location'
  | 'external_fingerprint'
  | 'unknown';

export type AttendanceScopeFilter = {
  scopeId: string;
  scopeType: 'ORGANIZATION' | 'CLUSTER' | 'SUB_ORGANIZATION';
  dateFrom: string;
  dateTo: string;
  memberId?: string | null;
  status?: AttendanceStatus | 'all';
  method?: AttendanceMethod | 'all';
  verified?: 'all' | 'verified' | 'unverified';
  eventId?: string | null;
  /** When set (without eventId), include all sessions sharing this event name. */
  eventTitle?: string | null;
};

export type NormalizedAttendanceRecord = {
  id: string;
  source: AttendanceLogSource;
  scope_id: string;
  user_id: string;
  full_name: string | null;
  local_date: string;
  event_id: string | null;
  event_title: string | null;
  status: AttendanceStatus;
  method: AttendanceMethod;
  verified: boolean;
  checked_in_at: string;
};

export type AttendanceTrendPoint = {
  date: string;
  count: number;
  present: number;
  late: number;
};

export type AttendanceMetrics = {
  totalRecords: number;
  uniqueParticipants: number;
  status: Record<AttendanceStatus, number>;
  verified: number;
  unverified: number;
  methods: Record<string, number>;
  trend: AttendanceTrendPoint[];
  attendanceRate: number;
  comparison: {
    available: boolean;
    previousTotal: number;
    deltaRecords: number;
    deltaRate: number;
    label: string;
  };
};

export type AttendanceReportDataset = {
  filters: AttendanceScopeFilter;
  records: NormalizedAttendanceRecord[];
  metrics: AttendanceMetrics;
};

export type NarrativeSectionKey =
  | 'SUMMARY'
  | 'TREND'
  | 'STATUS DISTRIBUTION'
  | 'VERIFICATION'
  | 'OBSERVATIONS'
  | 'EVALUATION'
  | 'RECOMMENDATIONS';

export type NarrativeSection = {
  key: NarrativeSectionKey;
  body: string;
};
