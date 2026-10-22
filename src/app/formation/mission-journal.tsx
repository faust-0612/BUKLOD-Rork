import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { formationCopy } from '@/lib/formationCopy';
import { submitFormationMissionJournal } from '@/lib/buklodFormationProgress';
import { colors } from '@/lib/theme';

export default function FormationMissionJournalScreen() {
  const [missionField, setMissionField] = useState('');
  const [targetPeople, setTargetPeople] = useState('');
  const [observedNeed, setObservedNeed] = useState('');
  const [plannedAction, setPlannedAction] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [peopleReached, setPeopleReached] = useState('');
  const [whatLearned, setWhatLearned] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (plannedAction.trim().length < 5 && whatHappened.trim().length < 5) {
      return Alert.alert(
        'Mission Journal',
        'Describe your planned action or what happened.',
      );
    }

    setBusy(true);
    try {
      await submitFormationMissionJournal({
        mission_field: missionField.trim() || undefined,
        target_people_group: targetPeople.trim() || undefined,
        observed_need: observedNeed.trim() || undefined,
        planned_action: plannedAction.trim() || undefined,
        target_date: targetDate.trim() || undefined,
        what_happened: whatHappened.trim() || undefined,
        people_reached_count: peopleReached.trim()
          ? Number(peopleReached)
          : undefined,
        what_learned: whatLearned.trim() || undefined,
        next_step: nextStep.trim() || undefined,
        follow_up_date: followUpDate.trim() || undefined,
        location_note: locationNote.trim() || undefined,
        create_bayanihan_action: true,
        action_category: 'MISSION',
      });

      Alert.alert('Submitted', 'Your mission journal entry was submitted for review.');
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
      <Text style={styles.eyebrow}>BUKLOD 107</Text>
      <Text style={shared.h1}>Mission Journal</Text>
      <Text style={shared.muted}>
        Record your mission field work, reflections, and next steps. Mentor
        validation is required.
      </Text>

      <SectionTitle>MISSION FIELD</SectionTitle>
      <Card>
        <Field label="Mission Field / Community" value={missionField} onChange={setMissionField} />
        <Field
          label="Who are you trying to reach?"
          value={targetPeople}
          onChange={setTargetPeople}
        />
        <Field
          label="What need or opportunity did you observe?"
          value={observedNeed}
          onChange={setObservedNeed}
          multiline
        />
        <Field
          label="What action will you take?"
          value={plannedAction}
          onChange={setPlannedAction}
          multiline
        />
        <Field label="Target date" value={targetDate} onChange={setTargetDate} />
      </Card>

      <SectionTitle>AFTER ACTION</SectionTitle>
      <Card>
        <Field
          label="What happened?"
          value={whatHappened}
          onChange={setWhatHappened}
          multiline
        />
        <Field
          label="People reached / served (optional count)"
          value={peopleReached}
          onChange={setPeopleReached}
          keyboardType="number-pad"
        />
        <Field
          label="What did you learn?"
          value={whatLearned}
          onChange={setWhatLearned}
          multiline
        />
        <Field label="Next step" value={nextStep} onChange={setNextStep} multiline />
        <Field label="Follow-up date" value={followUpDate} onChange={setFollowUpDate} />
        <Field
          label="Location (optional, privacy-conscious)"
          value={locationNote}
          onChange={setLocationNote}
        />
      </Card>

      <Button
        title={busy ? 'SUBMITTING...' : 'SUBMIT MISSION JOURNAL'}
        onPress={submit}
      />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
      />
    </View>
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
  label: { fontSize: 11, fontWeight: '800', color: colors.muted },
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
