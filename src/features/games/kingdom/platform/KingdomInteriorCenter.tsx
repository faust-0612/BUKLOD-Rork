import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { showBuklodAdOpportunity, warmBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';
import type { BuklodGameResult } from '@/features/games/types';
import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import {
  readKingdomPreviewRecord, recordKingdomPreviewResult,
  type KingdomPreviewRecord,
} from './previewStore';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { KingdomMasteryCheck } from './KingdomMasteryCheck';

type MiniGameFinish = (result: BuklodGameResult, sessionId: string) => void;
export type KingdomInteriorOption = {
  id: string;
  title: string;
  descriptionEn: string;
  descriptionTl: string;
  kind: 'existing' | 'pilot';
  // Original games retain their own legacy preview-map completion behavior.
  render: (onMiniFinish: MiniGameFinish, onOriginalFinish: (result: BuklodGameResult) => void) => React.ReactNode;
};
export type KingdomInteriorProps = {
  character: string;
  subtitleEn: string;
  subtitleTl: string;
  options: readonly KingdomInteriorOption[];
};

/**
 * Reusable, map-preserving Game Center for new stations.
 * Game scores remain local previews. Only separate server-scored mastery may grant BP.
 */
export function KingdomInteriorCenter({
  character, subtitleEn, subtitleTl, options,
}: KingdomInteriorProps) {
  const { user } = useAuth();
  const { t } = useBuklodGameLanguage();
  const [activeId, setActiveId] = useState(options[0]?.id ?? '');
  const [record, setRecord] = useState<KingdomPreviewRecord | null>(null);
  const [notice, setNotice] = useState('');
  const [masteries, setMasteries] = useState<number | null>(null);
  const [masteryRefresh, setMasteryRefresh] = useState(0);
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null);
  const offeredAds = useRef(new Set<string>());
  const [masteryEligibility, setMasteryEligibility] = useState<{ owner: string; gameId: string } | null>(null);
  const ownerRef = useRef(user?.id ?? null);
  const gameRef = useRef(activeId);
  ownerRef.current = user?.id ?? null;
  gameRef.current = activeId;
  const active = options.find(option => option.id === activeId) ?? options[0];
  const nextOption = options[options.findIndex(option => option.id === active?.id) + 1];

  useEffect(() => {
    let mounted = true;
    setMasteries(null);
    if (user?.id) {
      void supabase.rpc('get_my_buklod_kingdom_mastery_progress_v1')
        .then(({ data, error }) => {
          if (!error && mounted) {
            const count = Number((data as { mastered_games?: number } | null)?.mastered_games);
            if (Number.isFinite(count)) setMasteries(Math.max(0, Math.min(39, count)));
          }
        }).catch(() => undefined);
    }
    return () => { mounted = false; };
  }, [user?.id, masteryRefresh]);

  useEffect(() => { warmBuklodAdOpportunity('kingdom_game_completed'); }, []);

  useEffect(() => {
    let mounted = true;
    setRecord(null);
    setNotice('');
    if (active?.kind === 'pilot' && user?.id) {
      void readKingdomPreviewRecord(user.id, active.id)
        .then(value => { if (mounted) setRecord(value); })
        .catch(() => { if (mounted) setNotice(t('Local preview unavailable.', 'Hindi mabasa ang local preview.')); });
    }
    return () => { mounted = false; };
  }, [user?.id, active?.id, active?.kind, t]);

  function save(result: BuklodGameResult, sessionId: string) {
    if (!active || result.gameId !== active.id) return;
    const owner = user?.id;
    if (!owner) {
      setNotice(t('Sign in to save your game record.', 'Mag-sign in para ma-save ang game record.'));
      return;
    }
    setNotice(t('Saving game record...', 'Sine-save ang game record...'));
    void recordKingdomPreviewResult(owner, sessionId, result)
      .then(value => {
        if (ownerRef.current !== owner || gameRef.current !== result.gameId) return;
        setRecord(value);
        setNotice(t('Game saved locally. You may verify a separate Mastery Check below for real Points.', 'Na-save ang laro sa device. Puwedeng mag-Mastery Check sa ibaba para sa totoong Points.'));
        if (result.status === 'won') {
          setMasteryEligibility({ owner, gameId: result.gameId });
          setLastCompletedId(result.gameId);
          const receiptKey = owner + ':' + result.gameId + ':' + sessionId;
          if (!offeredAds.current.has(receiptKey)) {
            offeredAds.current.add(receiptKey);
            void showBuklodAdOpportunity('kingdom_game_completed');
          }
        }
      })
      .catch(() => {
        if (ownerRef.current === owner && gameRef.current === result.gameId) {
          setNotice(t('Local save failed; gameplay remains available.', 'Hindi na-save sa device. Maaari pa ring maglaro.'));
        }
      });
  }

  if (!active) return null;
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.shell}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Back to Kingdom map', 'Bumalik sa mapa ng Kingdom')}
          onPress={() => router.replace('/games' as any)} style={styles.mapBack}>
          <Text style={styles.mapBackText}>{t('← BACK TO KINGDOM MAP', '← BALIK SA MAPA NG KINGDOM')}</Text>
        </Pressable>
        <Text style={styles.eyebrow}>{character.toUpperCase()} • KINGDOM GAME CENTER</Text>
        <Text style={styles.heading}>{t('Choose a game', 'Pumili ng laro')}</Text>
        <Text style={styles.help}>{t(subtitleEn, subtitleTl)}</Text>
        <Text style={styles.masterySummary}>
          {t('Verified Kingdom mastery', 'Verified Kingdom mastery')}: {masteries ?? '—'}/39
          {'  •  '}{t('2 BP per first server-verified game mastery; replays do not multiply BP.',
            '2 BP sa unang server-verified mastery bawat laro; walang dagdag na BP sa replay.')}
        </Text>
        <View style={styles.chooser}>
          {options.map(option => <Pressable
            key={option.id} accessibilityRole="button"
            accessibilityState={{ selected: option.id === active.id }}
            style={[styles.option, option.id === active.id && styles.optionSelected]}
            onPress={() => setActiveId(option.id)}
          >
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionDescription}>{t(option.descriptionEn, option.descriptionTl)}</Text>
          </Pressable>)}
        </View>
        {active.kind === 'pilot' ? (
          <>
            <Text style={styles.record}>{t('Local best', 'Pinakamataas na local score')}: {record?.bestScore.toLocaleString() ?? '—'}
              {'   •   '}{t('Clears', 'Panalo')}: {record?.clears ?? 0}</Text>
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
          </>
        ) : null}
        <View key={(user?.id ?? 'guest') + ':' + active.id} style={styles.game}>{active.render(save, (result) => {
          // Original games must use the authenticated account, just like pilots.
          // Never fall back to an unscoped local progress record.
          const owner = user?.id;
          if (!owner) return;
          void recordBuklodKingdomPreviewResult(result, owner)
            .then(() => {
              if (ownerRef.current === owner && gameRef.current === result.gameId && result.status === 'won') {
                setMasteryEligibility({ owner, gameId: result.gameId });
                setLastCompletedId(result.gameId);
              }
            }).catch(() => undefined);
        })}</View>
        {masteryEligibility?.owner === user?.id && masteryEligibility?.gameId === active.id ? (
          <KingdomMasteryCheck key={user?.id + ':' + active.id} gameId={active.id}
            onVerified={() => setMasteryRefresh(value => value + 1)} />
        ) : null}
        {lastCompletedId === active.id && nextOption ? (
          <Pressable accessibilityRole="button" style={styles.nextChallenge}
            onPress={() => { setActiveId(nextOption.id); setLastCompletedId(null); }}>
            <Text style={styles.nextChallengeText}>
              {t('NEXT CHALLENGE', 'SUNOD NA CHALLENGE')}: {nextOption.title} →
            </Text>
          </Pressable>
        ) : null}
        <BuklodAdMobBanner placement="content" compact
          placementId={'kingdom-game-center-' + character.toLowerCase()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 18, paddingBottom: 36 },
  shell: { width: '100%', maxWidth: 940, alignSelf: 'center', paddingHorizontal: 12, gap: 9 },
  mapBack: { alignSelf: 'flex-start', borderColor: '#c6b68f', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#233c55' },
  mapBackText: { color: '#ffebbd', fontSize: 11, fontWeight: '900' },
  eyebrow: { color: '#efcf99', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heading: { color: '#fff4dd', fontSize: 27, fontWeight: '900' },
  help: { color: '#cfdcf2', fontSize: 12, lineHeight: 19 },
  chooser: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' },
  option: { minWidth: 142, flex: 1, borderWidth: 1, borderColor: '#5c708e', borderRadius: 13, backgroundColor: '#243b59', padding: 13 },
  optionSelected: { borderWidth: 2, borderColor: '#eac884', backgroundColor: '#394f71' },
  optionTitle: { color: '#fff6df', fontSize: 14, fontWeight: '900' },
  optionDescription: { color: '#ced9e9', fontSize: 11, lineHeight: 16, marginTop: 5 },
  record: { color: '#ffdfa6', fontSize: 12, fontWeight: '800' },
  notice: { color: '#dce8fd', fontSize: 11, lineHeight: 17 },
  game: { flexGrow: 1 },
  masterySummary: { color: '#f4dba5', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  nextChallenge: { padding: 13, borderWidth: 1, borderRadius: 12,
    borderColor: '#d6b879', backgroundColor: '#295769', alignItems: 'center' },
  nextChallengeText: { color: '#fff2c8', fontSize: 13, fontWeight: '900' },
});
