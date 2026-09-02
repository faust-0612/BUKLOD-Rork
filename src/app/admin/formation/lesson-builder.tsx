import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import {
  AUTHORITATIVE_SOURCE_READY_COUNTS,
  createFormationGenerationJob,
  getAuthoritativeLessonCountExpectations,
  loadAdminFormationLessonBuilder,
  syncAuthoritativeFormationCurriculum,
  type FormationLessonBuilderSnapshot,
} from '@/lib/buklodFormationProgress';
import { colors } from '@/lib/theme';

export default function AdminFormationLessonBuilderScreen() {
  const [snapshot, setSnapshot] = useState<FormationLessonBuilderSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAdminFormationLessonBuilder({});
      setSnapshot(data);
    } catch (e: unknown) {
      Alert.alert(
        'Lesson Builder',
        e instanceof Error ? e.message : 'Could not load builder.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const authoritativeSummary = useMemo(
    () => getAuthoritativeLessonCountExpectations(),
    [],
  );

  const totalSourceReady = useMemo(
    () => Object.values(AUTHORITATIVE_SOURCE_READY_COUNTS).reduce((a, b) => a + b, 0),
    [],
  );

  const runSync = async () => {
    setBusy('sync');
    try {
      const result = await syncAuthoritativeFormationCurriculum({});
      Alert.alert(
        'Curriculum Sync',
        `Linked ${result.linked_track_lessons ?? 0} track lessons · ` +
          `${result.published_versions ?? 0} published versions.`,
      );
      await load();
    } catch (e: unknown) {
      Alert.alert(
        'Sync failed',
        e instanceof Error ? e.message : 'Could not sync curriculum.',
      );
    } finally {
      setBusy(null);
    }
  };

  const runGenerateDraft = async (unitId: string) => {
    setBusy(unitId);
    try {
      const jobId = await createFormationGenerationJob({
        blueprintUnitId: unitId,
        requestedLessonCount: 1,
        generationMode: 'PROMPT_ONLY',
      });
      Alert.alert(
        'Generation Job',
        snapshot?.providerConfigured
          ? `Job ${jobId} created.`
          : `Job ${jobId} created (prompt package only). AI provider not configured.`,
      );
      await load();
    } catch (e: unknown) {
      Alert.alert(
        'Generate failed',
        e instanceof Error ? e.message : 'Could not create generation job.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>IMPLEMENTATION 005</Text>
        <Text style={shared.h1}>Formation Lesson Builder</Text>
        <Text style={shared.muted}>
          Controlled blueprint engine for BUKLOD 106/107. Authoritative 101–105
          curriculum links existing source lessons — no mass generation.
        </Text>

        {loading && <ActivityIndicator color={colors.green} />}

        {!loading && snapshot && (
          <>
            <Card>
              <Text style={styles.banner}>
                {snapshot.providerConfigured
                  ? 'AI provider connected'
                  : snapshot.providerMessage}
              </Text>
              <View style={styles.actions}>
                <Button
                  title={busy === 'sync' ? 'SYNCING...' : 'SYNC 101–105 SOURCE'}
                  onPress={() => void runSync()}
                />
                <Button
                  title="CURRICULUM PREVIEW"
                  onPress={() =>
                    router.push('/admin/formation/curriculum-preview' as any)
                  }
                />
              </View>
            </Card>

            <SectionTitle>AUTHORITATIVE 101–105 ({totalSourceReady} source-ready)</SectionTitle>
            {authoritativeSummary.map((stage) => (
              <Card key={stage.stageCode}>
                <Text style={styles.title}>BUKLOD {stage.stageCode}</Text>
                {stage.components.map((component) => {
                  const ready =
                    component.sourceReadyLessonCount ??
                    AUTHORITATIVE_SOURCE_READY_COUNTS[component.trackSlug] ??
                    0;
                  const mismatch = ready !== component.expectedLessonCount;

                  return (
                    <Text key={component.code} style={shared.body}>
                      {component.code}: {ready}/{component.expectedLessonCount}
                      {mismatch ? ' · REVIEW REQUIRED' : ''}
                    </Text>
                  );
                })}
              </Card>
            ))}

            <SectionTitle>106 / 107 BLUEPRINTS</SectionTitle>
            {snapshot.blueprints.map((bp) => (
              <Card key={String(bp.id)}>
                <Text style={styles.title}>
                  BUKLOD {String(bp.stage_code)} · {String(bp.blueprint_code)}
                </Text>
                <Text style={shared.body}>{String(bp.title_en ?? '')}</Text>
                <Text style={shared.muted}>
                  Target capacity: {String(bp.target_lesson_count)} · Published:{' '}
                  {String(bp.published_lessons ?? 0)} · Draft:{' '}
                  {String(bp.draft_lessons ?? 0)} · Units:{' '}
                  {String(bp.unit_count ?? 0)}
                </Text>
              </Card>
            ))}

            <SectionTitle>BLUEPRINT UNITS</SectionTitle>
            {snapshot.units.slice(0, 12).map((unit) => (
              <Card key={String(unit.id)}>
                <Text style={styles.title}>
                  {String(unit.blueprint_code)} · Unit {String(unit.unit_number)}
                </Text>
                <Text style={shared.body}>{String(unit.unit_title ?? '')}</Text>
                <Text style={shared.muted}>
                  Target lessons: {String(unit.target_lessons)}
                </Text>
                <View style={{ marginTop: 8 }}>
                  <Button
                    title={
                      busy === String(unit.id)
                        ? 'WORKING...'
                        : 'GENERATE DRAFT (PROMPT PACKAGE)'
                    }
                    onPress={() => void runGenerateDraft(String(unit.id))}
                  />
                </View>
              </Card>
            ))}

            {snapshot.units.length > 12 && (
              <Text style={shared.muted}>
                Showing first 12 of {snapshot.units.length} blueprint units.
              </Text>
            )}

            <SectionTitle>RECENT GENERATION JOBS</SectionTitle>
            {snapshot.generationJobs.length === 0 && (
              <Card>
                <Text style={shared.muted}>No generation jobs yet.</Text>
              </Card>
            )}
            {snapshot.generationJobs.map((job) => (
              <Card key={String(job.id)}>
                <Text style={styles.title}>{String(job.status)}</Text>
                <Text style={shared.muted}>
                  Mode: {String(job.generation_mode)} · Count:{' '}
                  {String(job.requested_lesson_count)} · Prompt:{' '}
                  {String(job.prompt_version)}
                </Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </AdminGate>
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
  title: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  banner: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.greenDark,
    marginBottom: 10,
  },
  actions: { gap: 8 },
});
