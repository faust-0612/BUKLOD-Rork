import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { BibleCrownGameV1 } from '@/features/games/christian/BibleCrownGameV1';
import { CivicLeadershipGameV1 } from '@/features/games/christian/CivicLeadershipGameV1';
import gameCatalog from '@/features/games/kingdom/platform/game-catalog.json';
import {
  readKingdomPreviewRecord,
  recordKingdomPreviewResult,
  type KingdomPreviewRecord,
} from '@/features/games/kingdom/platform/previewStore';
import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';

const GAME_ID = 'christian-civic-leadership';
const CROWN_ID = 'christian-bible-crown';
const CHRISTIAN_CENTER = gameCatalog.characters.find((center) => center.characterId === 'christian');

function ChristianGameCenterContent() {
  const { user } = useAuth();
  const { t } = useBuklodGameLanguage();
  const [selectedGame, setSelectedGame] = useState<'crown' | 'council'>('crown');
  const [preview, setPreview] = useState<KingdomPreviewRecord | null>(null);
  const [saveNotice, setSaveNotice] = useState('');
  const liveUserId = useRef<string | null>(null);
  liveUserId.current = user?.id ?? null;

  useEffect(() => {
    let active = true;
    setPreview(null);
    setSaveNotice('');
    if (user?.id) {
      void readKingdomPreviewRecord(user.id, CROWN_ID)
        .then((record) => { if (active) setPreview(record); })
        .catch(() => { if (active) setSaveNotice('Local preview is unavailable.'); });
    }
    return () => { active = false; };
  }, [user?.id]);

  const saveCrownResult = (result: Parameters<typeof recordKingdomPreviewResult>[2], sessionId: string) => {
    const owner = user?.id;
    if (!owner) {
      setSaveNotice(t('Sign in to store this preview score.', 'Mag-sign in upang ma-save ang preview score.'));
      return;
    }
    setSaveNotice(t('Saving game preview...', 'Sine-save ang game preview...'));
    void recordKingdomPreviewResult(owner, sessionId, result).then((record) => {
      if (liveUserId.current !== owner) return;
      setPreview(record);
      setSaveNotice(t('Preview saved on this device. No Character Points were awarded.', 'Na-save ang preview sa device. Walang naibigay na Character Points.'));
    }).catch(() => {
      if (liveUserId.current === owner) {
        setSaveNotice(t('Could not save locally. Your game can still be replayed.', 'Hindi na-save sa device. Maaari pa ring ulitin ang laro.'));
      }
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.center}>
        <Text style={styles.kicker}>CHRISTIAN • CHARACTER GAME CENTER</Text>
        <Text style={styles.heading}>{t('Choose a game', 'Pumili ng laro')}</Text>
        <Text style={styles.helper}>{t(
          'Original Kingdom map and route stay unchanged. Both games use Christian’s academy.',
          'Walang pagbabago sa mapa at route. Parehong nasa akademya ni Christian ang mga laro.',
        )}</Text>
        <View style={styles.chooser}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedGame === 'crown' }}
            style={[styles.option, selectedGame === 'crown' && styles.selected]}
            onPress={() => setSelectedGame('crown')}
          >
            <Text style={styles.optionText}>{CHRISTIAN_CENTER?.games.find((game) => game.id === CROWN_ID)?.title ?? 'Bible Crown'}</Text>
            <Text style={styles.optionSub}>{t('15-question Bible game', '15-tanong na Bible game')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedGame === 'council' }}
            style={[styles.option, selectedGame === 'council' && styles.selected]}
            onPress={() => setSelectedGame('council')}
          >
            <Text style={styles.optionText}>Leadership Council</Text>
            <Text style={styles.optionSub}>{t('Original strategy game', 'Orihinal na strategy game')}</Text>
          </Pressable>
        </View>
        {selectedGame === 'crown' ? (
          <>
            <Text style={styles.record}>
              {t('Local best', 'Pinakamataas na local score')}: {preview?.bestScore.toLocaleString() ?? '—'}
              {'  •  '}{t('Clears', 'Panalo')}: {preview?.clears ?? 0}
            </Text>
            {!!saveNotice && <Text style={styles.saveNotice}>{saveNotice}</Text>}
            <BibleCrownGameV1 onFinish={saveCrownResult} />
          </>
        ) : (
          // Preserve original Leadership Council and its existing preview-map behavior.
          <CivicLeadershipGameV1 onFinish={(result) => { void recordBuklodKingdomPreviewResult(result); }} />
        )}
      </View>
    </ScrollView>
  );
}

export default function ChristianCivicLeadershipScreen() {
  return (
    <BuklodGameStage biome="academy" gameId={GAME_ID}>
      <ChristianGameCenterContent />
    </BuklodGameStage>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 18, paddingBottom: 32 },
  center: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 12, gap: 7 },
  kicker: { color: '#d7b97a', fontSize: 10, fontWeight: '900', letterSpacing: .9 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 2 },
  helper: { color: '#c6d5e9', fontSize: 12, lineHeight: 19 },
  chooser: { flexDirection: 'row', gap: 9, flexWrap: 'wrap', marginTop: 6 },
  option: { flex: 1, minWidth: 145, backgroundColor: '#20334f', borderWidth: 1, borderColor: '#536989', borderRadius: 14, padding: 12 },
  selected: { borderColor: '#e7c781', backgroundColor: '#36486a' },
  optionText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  optionSub: { color: '#c5d0e6', fontSize: 11, marginTop: 4 },
  record: { color: '#f0da9c', fontSize: 12, fontWeight: '800', marginTop: 5 },
  saveNotice: { color: '#d4e6f5', fontSize: 11, lineHeight: 16 },
});
