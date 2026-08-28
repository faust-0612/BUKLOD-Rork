import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import {
  CONTENT_REPORT_REASONS,
  submitContentReport,
} from '@/lib/buklodContentReports';

export default function ReportContent() {
  const p = useLocalSearchParams<{ entityType: string; entityId: string }>();
  const [reason, setReason] = useState('inappropriate');
  const [details, setDetails] = useState('');

  const submit = async () => {
    try {
      await submitContentReport({
        entityType: String(p.entityType || 'post'),
        entityId: String(p.entityId || ''),
        reason,
        details,
      });
      Alert.alert(
        'Report sent',
        'A System Admin can review this and take action if needed.'
      );
      router.back();
    } catch (error: any) {
      Alert.alert('Report', error?.message || 'Could not send this report.');
    }
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Report</Text>
      <Text style={shared.muted}>
        Choose why this should be reviewed. A System Admin will see it.
      </Text>
      <View style={styles.wrap}>
        {CONTENT_REPORT_REASONS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setReason(item.id)}
            style={[styles.chip, reason === item.id && styles.chipOn]}
          >
            <Text style={{ fontWeight: '800' }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <TextInput
          multiline
          value={details}
          onChangeText={setDetails}
          placeholder="Optional notes for the System Admin"
          style={styles.area}
        />
        <Button title="SEND REPORT" onPress={submit} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  area: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 9,
  },
});
