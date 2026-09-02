import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import {
  createMyFormationMissionProject,
} from '@/lib/buklodFormationProgress';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const MILESTONE_LABELS: Record<string, string> = {
  PRAY: 'Pray',
  SURVEY: 'Survey',
  EVANGELIZE: 'Evangelize',
  FOLLOW_UP: 'Follow Up',
  DISCIPLE: 'Disciple',
  GATHER: 'Gather',
  DEVELOP_LEADERS: 'Develop Leaders',
  FORM_MISSION: 'Form Mission',
  CHURCH_PLANT: 'Church Plant',
};

type Milestone = {
  id: string;
  milestone_code: string;
  status: string;
};

export default function FormationMissionProjectScreen() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).rpc(
      'get_my_formation_mission_projects_v1',
    );
    const projects = Array.isArray(data) ? data : [];
    const active = projects[0];

    if (!active?.id) {
      setProjectId(null);
      setMilestones([]);
      setLoading(false);
      return;
    }

    setProjectId(active.id);
    const { data: detail } = await (supabase as any).rpc(
      'get_formation_mission_project_v1',
      { p_project_id: active.id },
    );
    setMilestones((detail?.milestones ?? []) as Milestone[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createProject = async () => {
    setLoading(true);
    try {
      await createMyFormationMissionProject({ projectType: 'CHURCH_PLANT' });
      await load();
    } catch (e: unknown) {
      Alert.alert(
        'Could not start project',
        e instanceof Error ? e.message : 'Please try again.',
      );
      setLoading(false);
    }
  };

  const submitMilestone = async (code: string) => {
    if (!projectId) return;
    setBusyCode(code);
    try {
      await (supabase as any).rpc('submit_formation_mission_milestone_v1', {
        p_project_id: projectId,
        p_milestone_code: code,
        p_reflection_notes: notes[code]?.trim() || null,
      });
      Alert.alert('Submitted', 'Milestone submitted for mentor validation.');
      await load();
    } catch (e: unknown) {
      Alert.alert(
        'Submission failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusyCode(null);
    }
  };

  if (loading) {
    return (
      <View style={[shared.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!projectId) {
    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>Mission Project</Text>
        <Card>
          <Text style={shared.body}>
            Start a structured church planting / mission project. Milestone
            completion requires authorized validation.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button title="START MISSION PROJECT" onPress={createProject} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>CHURCH PLANTING</Text>
      <Text style={shared.h1}>Mission Project Milestones</Text>
      <Text style={shared.muted}>
        Submit milestone reflections for verification. Church plant status is
        never automatic from member input alone.
      </Text>

      <SectionTitle>MILESTONES</SectionTitle>
      {milestones.map((m) => (
        <Card key={m.id}>
          <Text style={styles.code}>
            {MILESTONE_LABELS[m.milestone_code] ?? m.milestone_code}
          </Text>
          <Text style={styles.status}>{m.status.replace(/_/g, ' ')}</Text>
          {m.status === 'NOT_STARTED' || m.status === 'NEEDS_REVISION' ? (
            <>
              <TextInput
                style={styles.note}
                multiline
                placeholder="Reflection / notes"
                value={notes[m.milestone_code] ?? ''}
                onChangeText={(v) =>
                  setNotes((x) => ({ ...x, [m.milestone_code]: v }))
                }
              />
              <Button
                title={
                  busyCode === m.milestone_code ? 'SUBMITTING...' : 'SUBMIT MILESTONE'
                }
                onPress={() => submitMilestone(m.milestone_code)}
              />
            </>
          ) : null}
        </Card>
      ))}
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
  code: { fontSize: 15, fontWeight: '900', color: colors.text },
  status: { marginTop: 4, fontSize: 12, fontWeight: '700', color: colors.greenDark },
  note: {
    marginTop: 10,
    marginBottom: 8,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
});
