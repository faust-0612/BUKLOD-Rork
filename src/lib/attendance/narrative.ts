import type {
  AttendanceMetrics,
  AttendanceReportDataset,
  NarrativeSection,
} from './types';

function pct(part: number, whole: number) {
  if (whole <= 0) {
    return '0%';
  }

  return `${Math.round((part / whole) * 1000) / 10}%`;
}

function topMethod(metrics: AttendanceMetrics) {
  const entries = Object.entries(metrics.methods).sort((a, b) => b[1] - a[1]);
  return entries[0] ?? ['none', 0];
}

function trendDirection(metrics: AttendanceMetrics) {
  if (!metrics.comparison.available) {
    return 'Insufficient comparison data';
  }

  if (metrics.comparison.deltaRecords > 0) {
    return `Check-ins increased by ${metrics.comparison.deltaRecords} versus the prior period.`;
  }

  if (metrics.comparison.deltaRecords < 0) {
    return `Check-ins decreased by ${Math.abs(metrics.comparison.deltaRecords)} versus the prior period.`;
  }

  return 'Check-in volume matched the prior period.';
}

export function generateAttendanceNarrative(
  dataset: AttendanceReportDataset
): NarrativeSection[] {
  const { metrics, filters, records } = dataset;
  const [methodName, methodCount] = topMethod(metrics);
  const attended = metrics.status.present + metrics.status.late;

  const summary =
    metrics.totalRecords === 0
      ? `No attendance records matched ${filters.dateFrom} through ${filters.dateTo} for this scope.`
      : `${metrics.totalRecords} attendance records from ${metrics.uniqueParticipants} unique participants. Attendance rate (present + late) is ${metrics.attendanceRate}%.`;

  const trend = metrics.comparison.available
    ? `${trendDirection(metrics)} Attendance rate moved ${metrics.comparison.deltaRate >= 0 ? '+' : ''}${metrics.comparison.deltaRate} points (${metrics.comparison.label}).`
    : 'Insufficient comparison data for period-over-period trend analysis.';

  const statusDistribution =
    metrics.totalRecords === 0
      ? 'No status distribution available for the selected filters.'
      : `Present ${metrics.status.present} (${pct(metrics.status.present, metrics.totalRecords)}), Late ${metrics.status.late} (${pct(metrics.status.late, metrics.totalRecords)}), Absent ${metrics.status.absent} (${pct(metrics.status.absent, metrics.totalRecords)}), Excused ${metrics.status.excused} (${pct(metrics.status.excused, metrics.totalRecords)}).`;

  const verification =
    metrics.totalRecords === 0
      ? 'No verification breakdown available.'
      : `Verified ${metrics.verified} (${pct(metrics.verified, metrics.totalRecords)}), Unverified ${metrics.unverified} (${pct(metrics.unverified, metrics.totalRecords)}). Top verification channel: ${methodName.replaceAll('_', ' ')} (${methodCount}).`;

  const peakDay = [...metrics.trend].sort((a, b) => b.count - a.count)[0];
  const observations =
    metrics.totalRecords === 0
      ? 'No daily pattern detected in the selected range.'
      : peakDay && peakDay.count > 0
        ? `Peak activity on ${peakDay.date} with ${peakDay.count} records (${peakDay.present} present, ${peakDay.late} late). QR check-ins: ${metrics.methods.qr ?? 0}; location/self cluster check-ins: ${(metrics.methods.cluster_self ?? 0) + (metrics.methods.location ?? 0)}.`
        : 'Activity was spread evenly across the selected dates.';

  const evaluation =
    metrics.totalRecords === 0
      ? 'Evaluation deferred until attendance data is recorded for this scope and date range.'
      : metrics.attendanceRate >= 85
        ? `Strong participation with ${attended} attended records and ${metrics.status.late} late arrivals.`
        : metrics.attendanceRate >= 60
          ? `Moderate participation at ${metrics.attendanceRate}%. Review late (${metrics.status.late}) and absent (${metrics.status.absent}) counts.`
          : `Participation below target at ${metrics.attendanceRate}%. ${metrics.status.absent} absent records need follow-up.`;

  const recommendations: string[] = [];

  if (metrics.totalRecords === 0) {
    recommendations.push(
      'Create or open an attendance event, or enable cluster daily check-in to begin collecting records.'
    );
  } else {
    if ((metrics.methods.qr ?? 0) < metrics.totalRecords * 0.25) {
      recommendations.push(
        'Promote QR check-in at event entry to improve verified capture rates.'
      );
    }

    if (metrics.status.late > metrics.status.present * 0.15) {
      recommendations.push(
        'Communicate start times earlier; late arrivals exceed 15% of present volume.'
      );
    }

    if (metrics.unverified > metrics.verified) {
      recommendations.push(
        'Shift manual entries to QR or biometric methods to reduce unverified records.'
      );
    }

    if (!metrics.comparison.available) {
      recommendations.push(
        'Extend the reporting window to include a prior period for trend comparison.'
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Maintain current attendance methods; metrics are within expected ranges for this period.'
    );
  }

  return [
    { key: 'SUMMARY', body: summary },
    { key: 'TREND', body: trend },
    { key: 'STATUS DISTRIBUTION', body: statusDistribution },
    { key: 'VERIFICATION', body: verification },
    { key: 'OBSERVATIONS', body: observations },
    { key: 'EVALUATION', body: evaluation },
    {
      key: 'RECOMMENDATIONS',
      body: recommendations.map(item => `• ${item}`).join('\n'),
    },
  ];
}
