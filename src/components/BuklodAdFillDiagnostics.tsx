import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { buklodAdsTestMode } from '@/lib/buklodAdUnits';
import type { BuklodAdDiagnosticsSummary } from '@/lib/buklodAdDiagnostics';

/**
 * Staging/development only. Never shown to production users.
 */
export default function BuklodAdFillDiagnostics({
  fill,
}: {
  fill?: BuklodAdDiagnosticsSummary | null;
}) {
  if (!buklodAdsTestMode || !fill) {
    return null;
  }

  return (
    <View style={styles.shell} accessibilityLabel="AdMob fill diagnostics">
      <Text style={styles.heading}>Match / fill (this session)</Text>
      <Row label="Requests" value={String(fill.totals.requested)} />
      <Row label="Loads" value={String(fill.totals.loaded)} />
      <Row label="Impressions" value={String(fill.totals.impression)} />
      <Row label="Failures" value={String(fill.totals.failures)} />
      <Row
        label="Load-to-impression rate"
        value={`${fill.loadToImpressionRate}%`}
      />

      {fill.placements.map((row) => (
        <Text key={row.placement} style={styles.placement}>
          {row.placement}: {row.requested} req / {row.loaded} load /{' '}
          {row.impression} imp / {row.failed_load + row.failed_show} fail
        </Text>
      ))}
    </View>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D9E2DC',
    gap: 6,
  },
  heading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#25573F',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 12,
    color: '#5F6E66',
    fontWeight: '700',
  },
  value: {
    fontSize: 12,
    color: '#173C2C',
    fontWeight: '800',
  },
  placement: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6A7870',
  },
});
