import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import {
  loadAdminFormationConfig,
  setAdminFormationConfig,
} from '@/lib/buklodFormationProgress';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type StageReq = {
  stage_code: number;
  is_enabled: boolean;
  require_curriculum: boolean;
  min_qualifying_points: number;
  min_verified_bayanihan_actions: number;
  require_all_required_lessons: boolean;
  require_all_required_documents: boolean;
  require_required_validations: boolean;
};

export default function AdminFormationConfigScreen() {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [stages, setStages] = useState<StageReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, { data: stageRows, error }] = await Promise.all([
        loadAdminFormationConfig(),
        supabase
          .from('buklod_formation_stage_completion_requirements')
          .select('*')
          .order('stage_code'),
      ]);

      if (error) throw error;
      setConfig(cfg);
      setStages((stageRows ?? []) as StageReq[]);
    } catch (e: unknown) {
      Alert.alert(
        'Formation Config',
        e instanceof Error ? e.message : 'Could not load configuration.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async (key: string, value: unknown) => {
    setBusyKey(key);
    try {
      await setAdminFormationConfig(key, value);
      setConfig((prev) => ({ ...prev, [key]: value }));
      Alert.alert('Saved', `${key} updated.`);
    } catch (e: unknown) {
      Alert.alert(
        'Save failed',
        e instanceof Error ? e.message : 'Could not save.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  const updateStage = async (
    stageCode: number,
    patch: Partial<StageReq>,
  ) => {
    setBusyKey(`stage-${stageCode}`);
    try {
      const { error } = await supabase
        .from('buklod_formation_stage_completion_requirements')
        .update(patch)
        .eq('stage_code', stageCode);

      if (error) throw error;
      setStages((rows) =>
        rows.map((row) =>
          row.stage_code === stageCode ? { ...row, ...patch } : row,
        ),
      );
    } catch (e: unknown) {
      Alert.alert(
        'Update failed',
        e instanceof Error ? e.message : 'Could not update stage.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SYSTEM ADMIN</Text>
        <Text style={shared.h1}>Formation Engine Config</Text>
        <Text style={shared.muted}>
          Configure stage gates, curriculum rules, pacing, and completion requirements.
          FORMATION_ENGINE_V2_ENABLED is managed in Feature Flags — not here.
        </Text>

        {loading && <ActivityIndicator color={colors.green} />}

        {!loading && (
          <>
            <SectionTitle>GLOBAL CONFIG KEYS</SectionTitle>
            {Object.keys(config).length === 0 && (
              <Card>
                <Text style={shared.muted}>No custom formation config keys yet.</Text>
              </Card>
            )}
            {Object.entries(config).map(([key, value]) => (
              <Card key={key}>
                <Text style={styles.key}>{key}</Text>
                <Text style={shared.muted}>{JSON.stringify(value)}</Text>
              </Card>
            ))}

            <SectionTitle>STAGE REQUIREMENTS (101–107)</SectionTitle>
            {stages.map((stage) => (
              <Card key={stage.stage_code}>
                <Text style={styles.stageTitle}>BUKLOD {stage.stage_code}</Text>

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Stage enabled</Text>
                  <Switch
                    value={stage.is_enabled}
                    onValueChange={(v) =>
                      updateStage(stage.stage_code, { is_enabled: v })
                    }
                  />
                </View>

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Require curriculum</Text>
                  <Switch
                    value={stage.require_curriculum}
                    onValueChange={(v) =>
                      updateStage(stage.stage_code, { require_curriculum: v })
                    }
                  />
                </View>

                <Text style={styles.field}>Required stage Points</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="number-pad"
                  defaultValue={String(stage.min_qualifying_points)}
                  onEndEditing={(e) =>
                    updateStage(stage.stage_code, {
                      min_qualifying_points: Number(e.nativeEvent.text) || 0,
                    })
                  }
                />

                <Text style={styles.field}>Verified Bayanihan / Mission actions</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="number-pad"
                  defaultValue={String(stage.min_verified_bayanihan_actions)}
                  onEndEditing={(e) =>
                    updateStage(stage.stage_code, {
                      min_verified_bayanihan_actions: Number(e.nativeEvent.text) || 0,
                    })
                  }
                />

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Require all lessons</Text>
                  <Switch
                    value={stage.require_all_required_lessons}
                    onValueChange={(v) =>
                      updateStage(stage.stage_code, {
                        require_all_required_lessons: v,
                      })
                    }
                  />
                </View>

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Require documents</Text>
                  <Switch
                    value={stage.require_all_required_documents}
                    onValueChange={(v) =>
                      updateStage(stage.stage_code, {
                        require_all_required_documents: v,
                      })
                    }
                  />
                </View>

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Require validations</Text>
                  <Switch
                    value={stage.require_required_validations}
                    onValueChange={(v) =>
                      updateStage(stage.stage_code, {
                        require_required_validations: v,
                      })
                    }
                  />
                </View>

                {busyKey === `stage-${stage.stage_code}` && (
                  <Text style={shared.muted}>Saving...</Text>
                )}
              </Card>
            ))}

            <SectionTitle>GLOBAL DELIVERY</SectionTitle>
            <Card>
              <Text style={shared.muted}>
                Default lessons per week for new 106/107 curriculum delivery (1–3).
              </Text>
              <Button
                title="SET default_lessons_per_week = 2"
                onPress={() => saveConfig('default_lessons_per_week', 2)}
              />
              <View style={{ marginTop: 8 }}>
                <Button
                  title="OPEN LESSON BUILDER (005)"
                  onPress={() => router.push('/admin/formation/lesson-builder' as any)}
                />
              </View>
              <View style={{ marginTop: 8 }}>
                <Button
                  title="OPEN CURRICULUM PREVIEW"
                  onPress={() => router.push('/admin/formation/curriculum-preview' as any)}
                />
              </View>
            </Card>

            <SectionTitle>EXAMPLE GLOBAL KEY</SectionTitle>
            <Card>
              <Text style={shared.muted}>
                Use config keys for repeat reward eligibility and 107 mission categories.
              </Text>
              <Button
                title={
                  busyKey === 'repeat_reward_eligible'
                    ? 'SAVING...'
                    : 'SET repeat_reward_eligible = true'
                }
                onPress={() => saveConfig('repeat_reward_eligible', true)}
              />
            </Card>
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
  key: { fontSize: 13, fontWeight: '900' },
  stageTitle: { fontSize: 15, fontWeight: '900', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rowLabel: { fontSize: 12, fontWeight: '700', flex: 1, paddingRight: 8 },
  field: { marginTop: 10, fontSize: 11, fontWeight: '800', color: colors.muted },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  numInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 8,
    backgroundColor: colors.white,
  },
});
