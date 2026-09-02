import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import FormationAdvancedStageCatalog from '@/components/formation/FormationAdvancedStageCatalog';
import {
  formationCopy,
  primaryActionLabel,
  STAGE_PHASES,
  STAGE_SUBTITLES,
  friendlyBlockingReason,
} from '@/lib/formationCopy';
import {
  mapStageCardStatus,
  stageProgressPercent,
  statusLabel,
} from '@/lib/formationUi';
import { colors } from '@/lib/theme';
import type { FormationJourney, FormationStageCatalog } from '@/types/buklodFormation';

type Props = {
  journey: FormationJourney;
  tracks: any[];
  loading?: boolean;
  onRefresh?: () => void;
  advancedCatalogs?: Partial<Record<106 | 107, FormationStageCatalog | null>>;
  advancedCatalogLoading?: boolean;
  isFormationStageLocked?: (stageCode: number) => boolean;
};

export default function FormationJourneySection({
  journey,
  tracks,
  loading,
  advancedCatalogs = {},
  advancedCatalogLoading = false,
  isFormationStageLocked,
}: Props) {
  const trackByStage = useMemo(() => {
    const map = new Map<number, any>();
    tracks.forEach((track) => {
      const code = Number(track.stage_code);
      if (!Number.isFinite(code) || map.has(code)) return;
      map.set(code, track);
    });
    return map;
  }, [tracks]);

  const primaryStage = useMemo(() => {
    return (
      journey.stages.find(
        (s) => s.current && s.access_allowed && !s.completed,
      ) ??
      journey.stages.find((s) => s.repeat_required) ??
      journey.stages.find((s) => s.access_allowed && !s.completed)
    );
  }, [journey.stages]);

  const openStage = (stageCode: number) => {
    if (stageCode === 106 || stageCode === 107) {
      return;
    }

    const track = trackByStage.get(stageCode);
    if (track?.id) {
      router.push(`/learn/${track.id}`);
      return;
    }
    router.push({
      pathname: '/formation/documents',
      params: { stage: String(stageCode) },
    } as any);
  };

  const handlePrimary = () => {
    if (!primaryStage) return;
    const action = journey.next_action ?? primaryStage.next_action;

    if (action === 'SUBMIT_DOCUMENTS' || action === 'DOCUMENT_PENDING') {
      router.push({
        pathname: '/formation/documents',
        params: { stage: String(primaryStage.stage_code) },
      } as any);
      return;
    }

    if (action === 'REPEAT_REQUIRED') {
      router.push({
        pathname: '/formation/repeat-review',
        params: { stage: String(primaryStage.stage_code), mode: 'member' },
      } as any);
      return;
    }

    if (
      primaryStage.stage_code === 106 &&
      (primaryStage.completion as any)?.curriculum_required_count === 0
    ) {
      return;
    }

    openStage(primaryStage.stage_code);
  };

  return (
    <>
      {primaryStage && (
        <Card style={styles.primaryCard}>
          <Text style={styles.primaryEyebrow}>YOUR NEXT STEP</Text>
          <Text style={styles.primaryTitle}>
            BUKLOD {primaryStage.stage_code} ·{' '}
            {STAGE_PHASES[primaryStage.stage_code] ??
              primaryStage.title_en}
          </Text>
          <Text style={shared.muted}>
            {primaryActionLabel(journey.next_action)}
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button
              title={primaryActionLabel(journey.next_action)}
              onPress={handlePrimary}
            />
          </View>
        </Card>
      )}

      <SectionTitle>{formationCopy.journeyTitle.toUpperCase()}</SectionTitle>

      {loading && (
        <Card>
          <Text style={shared.muted}>Loading your formation journey...</Text>
        </Card>
      )}

      {!loading &&
        journey.stages.map((stage) => {
          const cardStatus = mapStageCardStatus(stage);
          const percent = stageProgressPercent(stage);
          const locked = cardStatus === 'LOCKED';
          const pointsRequired = Number(stage.stage_points_required ?? 0);
          const bayanihanRequired = Number(
            stage.stage_bayanihan_required ?? 0,
          );
          const blocking = Array.isArray(stage.blocking_reasons)
            ? stage.blocking_reasons[0]
            : null;

          return (
            <Pressable
              key={stage.stage_code}
              onPress={() => !locked && openStage(stage.stage_code)}
              disabled={locked}
              style={styles.stageWrap}
            >
              <Card style={locked ? styles.cardLocked : undefined}>
                <View style={styles.stageTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stageCode}>
                      BUKLOD {stage.stage_code}
                    </Text>
                    <Text style={styles.stagePhase}>
                      {STAGE_PHASES[stage.stage_code] ?? stage.title_fil}
                    </Text>
                  </View>
                  {percent > 0 && (
                    <Text style={styles.percent}>{percent}%</Text>
                  )}
                </View>

                <Text style={styles.subtitle}>
                  {STAGE_SUBTITLES[stage.stage_code] ?? stage.title_en}
                </Text>

                <Text
                  style={[
                    styles.status,
                    cardStatus === 'COMPLETE' && styles.statusComplete,
                    cardStatus === 'REPEAT_REQUIRED' && styles.statusRepeat,
                    cardStatus === 'LOCKED' && styles.statusLocked,
                  ]}
                >
                  {statusLabel(cardStatus)}
                </Text>

                {locked && blocking && (
                  <Text style={shared.muted}>
                    {formationCopy.lockedPrefix} ·{' '}
                    {friendlyBlockingReason(String(blocking))}
                  </Text>
                )}

                {cardStatus === 'HISTORICALLY_LOCKED' && (
                  <Text style={shared.muted}>
                    {formationCopy.historicallyLocked}
                  </Text>
                )}

                {Number(stage.progress?.expected_lessons ?? 0) > 0 && (
                  <Text style={styles.metric}>
                    {formationCopy.lessons}{' '}
                    {Number(stage.progress?.approved_lessons ?? 0)} /{' '}
                    {Number(stage.progress?.expected_lessons ?? 0)}
                  </Text>
                )}

                {pointsRequired > 0 && (
                  <Text style={styles.metric}>
                    {formationCopy.buklodPoints}{' '}
                    {Number(stage.stage_points_current ?? 0)} / {pointsRequired}
                  </Text>
                )}

                {bayanihanRequired > 0 && (
                  <Text style={styles.metric}>
                    {stage.stage_code === 107
                      ? formationCopy.missionActions
                      : formationCopy.bayanihan}{' '}
                    {Number(stage.stage_bayanihan_current ?? 0)} /{' '}
                    {bayanihanRequired}
                  </Text>
                )}

                {stage.stage_code === 107 && pointsRequired === 0 && (
                  <Text style={styles.metric}>
                    {formationCopy.buklodPoints} ·{' '}
                    {formationCopy.noPointRequirement}
                  </Text>
                )}

                {(stage.stage_code === 106 ||
                  stage.stage_code === 107) && (
                  <View style={styles.advancedCatalogWrap}>
                    <FormationAdvancedStageCatalog
                      stageCode={stage.stage_code as 106 | 107}
                      catalog={
                        advancedCatalogs[
                          stage.stage_code as 106 | 107
                        ] ?? null
                      }
                      stageLocked={
                        isFormationStageLocked
                          ? isFormationStageLocked(stage.stage_code)
                          : locked
                      }
                      loading={advancedCatalogLoading}
                    />
                  </View>
                )}

                {!locked && cardStatus !== 'HISTORICALLY_LOCKED' && (
                  <Text style={styles.tapHint}>
                    {formationCopy.continueLearning}
                  </Text>
                )}
              </Card>
            </Pressable>
          );
        })}
    </>
  );
}

const styles = StyleSheet.create({
  primaryCard: {
    marginBottom: 8,
    borderColor: colors.green,
    borderWidth: 1,
  },
  primaryEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
  },
  primaryTitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  stageWrap: { marginBottom: 10 },
  cardLocked: { opacity: 0.72 },
  stageTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stageCode: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.6,
  },
  stagePhase: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  percent: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.greenDark,
  },
  status: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: colors.text,
  },
  statusComplete: { color: colors.greenDark },
  statusRepeat: { color: '#B45309' },
  statusLocked: { color: colors.muted },
  metric: {
    marginTop: 6,
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  tapHint: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '800',
    color: colors.greenDark,
    letterSpacing: 0.4,
  },
  advancedCatalogWrap: {
    marginTop: 10,
  },
});
