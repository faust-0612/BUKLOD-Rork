import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { evaluateReportFeedback, type ReportFeedbackField } from '@/lib/buklodReportAutoFeedback';

type Props = {
  content: Record<string, unknown>;
  fields?: ReportFeedbackField[];
  deadlineAt?: string | null;
  submitted?: boolean;
};

export default function BuklodReportAutoFeedbackCard({ content, fields, deadlineAt, submitted }: Props) {
  const feedback = useMemo(
    () => evaluateReportFeedback({ content, fields, deadlineAt, submitted }),
    [content, fields, deadlineAt, submitted]
  );
  const attention = feedback.level === 'needs_attention';
  const color = attention ? '#92400E' : '#166534';

  return (
    <View style={styles.card} accessibilityLabel="Automatic report feedback and suggestions">
      <View style={styles.header}>
        <MaterialCommunityIcons name="clipboard-check-outline" size={19} color={color} />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>AUTO FEEDBACK · CONTENT & COMPLIANCE GUIDANCE</Text>
          <Text style={[styles.title, { color }]}>{feedback.title}</Text>
        </View>
      </View>
      {feedback.notes.map((note, index) => (
        <View key={index} style={styles.noteRow}>
          <MaterialCommunityIcons name={attention && index === 0 ? 'alert-circle-outline' : 'check-circle-outline'} size={15} color={color} />
          <Text style={styles.note}>{note}</Text>
        </View>
      ))}
      {feedback.deadlineNote ? <Text style={styles.deadline}>{feedback.deadlineNote}</Text> : null}
      <Text style={styles.disclaimer}>
        Automatic guidance lamang, hindi final approval o disciplinary decision.
        Optional fields at photos ay hindi kailangang punan maliban kung malinaw na required.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#CEE5D6', backgroundColor: '#F6FAF7', padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  copy: { flex: 1, gap: 3 },
  eyebrow: { color: '#607569', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  title: { fontSize: 12, fontWeight: '900', lineHeight: 16 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  note: { color: '#365348', fontSize: 11, lineHeight: 16, flex: 1 },
  disclaimer: { color: '#6B8076', fontSize: 9, lineHeight: 13, marginTop: 2 },
  deadline: { color: '#92400E', fontSize: 10, lineHeight: 14, fontWeight: '700' },
});
