import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import ReportHome from '@/app/reports/index';
import { reportColors as colors } from '@/lib/buklodReportTheme';

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

export default function StandaloneReportHome() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const assignmentId = firstParam(params.assignmentId ?? params.assignment_id ?? params.reportAssignmentId ?? params.report_assignment_id);

  return (
    <View style={styles.root}>
      <ReportHome />
      {!assignmentId ? (
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
