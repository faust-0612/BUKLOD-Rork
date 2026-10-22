import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import type { NarrativeSection } from '@/lib/attendance/types';

export function BuklodAttendanceReportNarrative({
  sections,
}: {
  sections: NarrativeSection[];
}) {
  return (
    <View style={styles.wrap}>
      {sections.map(section => (
        <View key={section.key} style={styles.block}>
          <Text style={styles.key}>{section.key}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  block: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.white,
    gap: 6,
  },
  key: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
});
