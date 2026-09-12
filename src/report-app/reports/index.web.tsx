import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import ReportIndexScreen from '@/app/reports/index';
import BuklodReportWebAdBanner from '@/components/BuklodReportWebAdBanner';

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

/**
 * Web route wrapper for /reports.
 *
 * Ads are deliberately limited to the top-level dashboard. Scoped workspaces,
 * assignment forms, submission flows and review/management surfaces stay
 * ad-free so reporting actions are never displaced or confused with ads.
 */
export default function BuklodReportWebIndexRoute() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const assignmentId = firstParam(params.assignmentId ?? params.assignment_id);
  const showDashboardBanner = !scopeId && !assignmentId;

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <ReportIndexScreen />
      </View>
      {showDashboardBanner ? <BuklodReportWebAdBanner /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, minHeight: 0 },
});
