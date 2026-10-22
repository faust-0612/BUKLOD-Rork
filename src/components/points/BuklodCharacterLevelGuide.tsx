/* BUKLOD_CHARACTER_LEVEL_UP_GUIDE_R1 */
/* Presentation only: server V2 remains authoritative for Character level and earned points. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
const PROGRESSIVE_LEVEL_THRESHOLDS = [0,50,100,250,500,1000,2500,5000,10000,25000,50000,75000,100000,150000,200000,250000,300000,350000,400000,500000] as const;

type Props = {
  characterName: string;
  stages: readonly string[];
  currentLevel: number;
  pointsSinceSelection: number;
  isActive: boolean;
  onRefresh: () => Promise<void> | void;
};

const format = (points: number) => Math.floor(Math.max(0, points)).toLocaleString();

export default function BuklodCharacterLevelGuide({
  characterName,
  stages,
  currentLevel,
  pointsSinceSelection,
  isActive,
  onRefresh,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(false);
    try { await onRefresh(); } catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  };
  const level = Math.max(1, Math.min(20, Math.floor(Number(currentLevel) || 1)));
  const points = Math.max(0, Math.floor(Number(pointsSinceSelection) || 0));
  const maximum = level === 20;
  // These values are displayed as milestones only; never calculate or grant a level on the client.
  // They match the deployed private.buklod_character_level_for_delta_v2 SQL on 2026-10-13.
  const from = PROGRESSIVE_LEVEL_THRESHOLDS[level - 1];
  const target = maximum ? null : PROGRESSIVE_LEVEL_THRESHOLDS[level];
  // Avoid confidently showing outdated thresholds if the server's level and the snapshot disagree.
  const inSync = points >= from && (target === null || points < target);
  const remaining = target === null ? 0 : Math.max(0, target - points);
  const fraction = target === null ? 1 :
    Math.max(0, Math.min(1, (points - from) / Math.max(1, target - from)));

  const s = StyleSheet.create({
    panel: {
      marginHorizontal: 14,
      marginTop: 12,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
    },
    label: { color: theme.textPrimary, fontSize: 14, fontWeight: '900' },
    path: { marginTop: 6, fontSize: 12, fontWeight: '800', color: theme.accent },
    detail: { marginTop: 5, fontSize: 12, lineHeight: 18, color: theme.textSecondary },
    counter: { marginTop: 10, fontSize: 11, fontWeight: '900', color: theme.textPrimary },
    track: { marginTop: 7, height: 12, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.border },
    fill: { height: '100%', borderRadius: 10, backgroundColor: theme.accent },
    tipTitle: { marginTop: 12, fontSize: 11, fontWeight: '900', color: theme.textPrimary },
    tip: { marginTop: 5, fontSize: 11, lineHeight: 17, color: theme.textSecondary },
    footnote: { marginTop: 9, fontSize: 10, lineHeight: 15, color: theme.textMuted },
    refreshButton: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', borderRadius: 11, borderWidth: 1, borderColor: theme.accent },
    refreshText: { color: theme.accent, fontSize: 11, fontWeight: '900' },
  });

  return (
    <View style={s.panel}>
      <Text style={s.label}>PAANO MAG-LEVEL UP?</Text>
      {isActive ? (
        <>
          <Text style={s.path}>{characterName} · Level {level}</Text>
          <Text style={s.detail}>Earned since selection: {format(points)} points</Text>
          <Text style={s.footnote}>{maximum ? 'Maximum level reached' : inSync ? 'Level-up in progress' : 'Progress needs refresh'}</Text>
        </>
      ) : null}
      {!isActive ? (
        <>
          <Text style={s.detail}>Piliin muna si {characterName} at i-tap ang “Use This Character” para magsimula sa Level 1.</Text>
          <Text style={s.footnote}>Preview lamang ito; hindi maililipat ang level ng ibang character.</Text>
        </>
      ) : maximum ? (
        <>
          <Text style={s.path}>{characterName} — Level 20 · {stages[19]}</Text>
          <Text style={s.detail}>Maximum Character Level na! Nananatiling hiwalay ang lifetime points at Circle Rank.</Text>
        </>
      ) : !inSync ? (
        <>
          <Text style={s.path}>{characterName} · Level {level}</Text>
          <Text style={s.detail}>Hindi tugma ang na-load na points at level sa kasalukuyang milestone table. I-refresh ang Character; ang server level ang susundin.</Text>
        </>
      ) : (
        <>
          <Text style={s.path}>
            Level {level} · {stages[level - 1]} → Level {level + 1} · {stages[level]}
          </Text>
          <Text style={s.detail}>
            Kailangan: {format(target!)} lifetime points na na-credit mula nang piliin si {characterName}.
          </Text>
          <Text style={s.counter}>
            {format(points)} / {format(target!)} points · Kulang pa: {format(remaining)} points
          </Text>
          <View style={s.track} accessibilityLabel={`${Math.round(fraction * 100)} percent level progress`}>
            <View style={[s.fill, { width: `${Math.round(fraction * 100)}%` }]} />
          </View>
          <Text style={s.tipTitle}>Ano ang gagawin?</Text>
          <Text style={s.tip}>1. Kumpletuhin ang BUKLOD activities na may verified Points reward.</Text>
          <Text style={s.tip}>2. I-claim ang reward kung kailangan para pumasok ito sa lifetime points balance.</Text>
          <Text style={s.tip}>3. Kapag na-credit ang sapat na points, automatic na iko-compute ng server ang susunod na level.</Text>
          <Text style={s.footnote}>
            Ang items at badges ay rewards/collectibles, hindi dagdag na mandatory tasks para sa core-character Level-Up. Hindi ito Circle Rank progress.
          </Text>
        </>
      )}
      {isActive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh character level progress"
          disabled={refreshing}
          onPress={() => { void refresh(); }}
          style={s.refreshButton}
        >
          <Text style={s.refreshText}>{refreshing ? 'INA-UPDATE...' : 'REFRESH CHARACTER PROGRESS'}</Text>
        </Pressable>
      ) : null}
      {refreshError ? <Text style={s.footnote}>Hindi na-refresh ang progress. Subukan ulit kapag may connection.</Text> : null}
    </View>
  );
}
