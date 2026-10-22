import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { formationCopy } from '@/lib/formationCopy';
import { submitFormationBayanihanAction } from '@/lib/buklodFormationProgress';
import { colors } from '@/lib/theme';

export default function FormationBayanihanActionScreen() {
  const { stage, lessonId, challengeId } = useLocalSearchParams<{
    stage?: string;
    lessonId?: string;
    challengeId?: string;
  }>();
  const stageCode = Number(stage ?? 106);

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [reflection, setReflection] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [location, setLocation] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const isMission = stageCode === 107;

  const submit = async () => {
    if (category.trim().length < 2) {
      return Alert.alert('Action Type', 'Enter an action type or category.');
    }
    if (description.trim().length < 10) {
      return Alert.alert('Description', 'Describe what you did.');
    }

    setBusy(true);
    try {
      await submitFormationBayanihanAction({
        stageCode,
        actionCategory: category.trim(),
        title: isMission ? 'Mission Action' : 'Bayanihan Action',
        description: description.trim(),
        reflectionText: reflection.trim() || null,
        evidenceUrl: evidenceUrl.trim() || null,
        learningLessonId: lessonId ?? null,
        challengeId: challengeId ?? null,
        scopeMetadata: {
          action_date: actionDate.trim() || null,
          location: location.trim() || null,
        },
      });

      Alert.alert(
        'Submitted',
        'Your action was submitted for mentor verification.',
      );
      router.back();
    } catch (e: unknown) {
      Alert.alert(
        'Submission failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>
        {isMission ? formationCopy.missionActions.toUpperCase() : formationCopy.bayanihan.toUpperCase()}
      </Text>
      <Text style={shared.h1}>
        {isMission ? 'Mission Action' : 'Bayanihan Action'}
      </Text>
      <Text style={shared.muted}>
        Share what you did and what you learned. Verification is required before this counts toward stage progress.
      </Text>

      <SectionTitle>ACTION DETAILS</SectionTitle>
      <Card>
        <Text style={styles.label}>Action type / category</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Encouragement visit"
        />

        <Text style={styles.label}>What did you do?</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your action..."
        />

        <Text style={styles.label}>Reflection / what did you learn?</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={reflection}
          onChangeText={setReflection}
          placeholder="What did you learn?"
        />

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={actionDate}
          onChangeText={setActionDate}
          placeholder="YYYY-MM-DD"
        />

        <Text style={styles.label}>Scope / location (optional)</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Community, barangay, etc."
        />

        <Text style={styles.label}>Evidence URL (optional)</Text>
        <TextInput
          style={styles.input}
          value={evidenceUrl}
          onChangeText={setEvidenceUrl}
          placeholder="https://..."
          autoCapitalize="none"
        />

        <View style={{ marginTop: 12 }}>
          <Button
            title={busy ? 'SUBMITTING...' : 'SUBMIT FOR VERIFICATION'}
            onPress={submit}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 48 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  label: { marginTop: 10, fontSize: 11, fontWeight: '800', color: colors.muted },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.white,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});
