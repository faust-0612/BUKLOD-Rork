import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ReportIndexScreen from '@/app/reports/index';
import BuklodReportWebAdBanner from '@/components/BuklodReportWebAdBanner';
import { reportColors as colors } from '@/lib/buklodReportTheme';

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
 *
 * My Actions remains available on web and native whenever a report assignment
 * form is not currently open.
 */
export default function BuklodReportWebIndexRoute() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const assignmentId = firstParam(params.assignmentId ?? params.assignment_id ?? params.reportAssignmentId ?? params.report_assignment_id);
  const showDashboardBanner = !scopeId && !assignmentId;
  const showMyActions = !assignmentId;

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <ReportIndexScreen />
      </View>
      {showDashboardBanner ? <BuklodReportWebAdBanner /> : null}
      {showMyActions ? (
        <Pressable
          onPress={() => router.push({ pathname: '/reports/actions', params: { scopeId } } as any)}
          style={({ pressed }) => [styles.actionsButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open my report actions"
        >
          <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={colors.white} />
          <Text style={styles.actionsText}>My actions</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, minHeight: 0 },
  actionsButton: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    minHeight: 42,
    borderRadius: 22,
    backgroundColor: colors.greenDark,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  actionsText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
