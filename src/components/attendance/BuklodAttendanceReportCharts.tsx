import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import type { AttendanceMetrics } from '@/lib/attendance/types';

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const widthPct = max > 0 ? Math.max(4, (value / max) * 100) : 0;

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${widthPct}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

export function BuklodAttendanceReportCharts({
  metrics,
}: {
  metrics: AttendanceMetrics;
}) {
  const statusMax = Math.max(
    metrics.status.present,
    metrics.status.late,
    metrics.status.absent,
    metrics.status.excused,
    1
  );
  const trendMax = Math.max(...metrics.trend.map(point => point.count), 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>STATUS DISTRIBUTION</Text>
      <Bar
        label="Present"
        value={metrics.status.present}
        max={statusMax}
        color={colors.green}
      />
      <Bar
        label="Late"
        value={metrics.status.late}
        max={statusMax}
        color="#C49A2E"
      />
      <Bar
        label="Absent"
        value={metrics.status.absent}
        max={statusMax}
        color="#B44A4A"
      />
      <Bar
        label="Excused"
        value={metrics.status.excused}
        max={statusMax}
        color={colors.muted}
      />

      <Text style={[styles.title, { marginTop: 14 }]}>DAILY TREND</Text>
      {metrics.trend.length === 0 ? (
        <Text style={styles.empty}>No trend data.</Text>
      ) : (
        metrics.trend.map(point => (
          <Bar
            key={point.date}
            label={point.date.slice(5)}
            value={point.count}
            max={trendMax}
            color={colors.greenDark}
          />
        ))
      )}

      <Text style={[styles.title, { marginTop: 14 }]}>VERIFICATION</Text>
      <View style={styles.verifyRow}>
        <View style={styles.verifyStat}>
          <Text style={styles.verifyValue}>{metrics.verified}</Text>
          <Text style={styles.verifyLabel}>VERIFIED</Text>
        </View>
        <View style={styles.verifyStat}>
          <Text style={styles.verifyValue}>{metrics.unverified}</Text>
          <Text style={styles.verifyLabel}>UNVERIFIED</Text>
        </View>
        <View style={styles.verifyStat}>
          <Text style={styles.verifyValue}>{metrics.attendanceRate}%</Text>
          <Text style={styles.verifyLabel}>RATE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 52,
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  barValue: {
    width: 28,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
  },
  empty: {
    color: colors.muted,
    fontSize: 11,
  },
  verifyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifyStat: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  verifyValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.greenDark,
  },
  verifyLabel: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '900',
    color: colors.muted,
  },
});
