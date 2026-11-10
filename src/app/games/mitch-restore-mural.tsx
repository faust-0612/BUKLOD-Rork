import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { MergeGameV1 } from '@/features/games/kingdom/platform/MergeGameV1';
import { BlockForgeGameV1 } from '@/features/games/mitch/BlockForgeGameV1';
import { RestoreMuralGameV1 } from '@/features/games/mitch/RestoreMuralGameV1';
import {
  readKingdomPreviewRecord, recordKingdomPreviewResult,
  type KingdomPreviewRecord,
} from '@/features/games/kingdom/platform/previewStore';
import type { BuklodGameResult } from '@/features/games/types';
import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';

const GAME_ID = 'mitch-restore-mural';
const FORGE_ID = 'mitch-block-forge';
const MERGE_ID = 'mitch-color-merge';

function MitchInterior() {
  const { user } = useAuth();
  const { t } = useBuklodGameLanguage();
  const [selected, setSelected] = useState<'mural' | 'forge' | 'merge'>('forge');
  const [record, setRecord] = useState<KingdomPreviewRecord | null>(null);
  const [notice, setNotice] = useState('');
  const liveOwner = useRef(user?.id ?? null);
  const liveSelected = useRef(selected);
  liveOwner.current = user?.id ?? null;
  liveSelected.current = selected;

  useEffect(() => {
    let active = true;
    setRecord(null);
    setNotice('');
    if (user?.id && selected !== 'mural') {
      void readKingdomPreviewRecord(user.id, selected === 'merge' ? MERGE_ID : FORGE_ID)
        .then(r => { if (active) setRecord(r); })
        .catch(() => { if (active) setNotice(t('Preview save unavailable.', 'Hindi available ang pag-save ng preview.')); });
    }
    return () => { active = false; };
  }, [selected, user?.id, t]);

  function handleForgeFinish(result: BuklodGameResult, sessionId: string) {
    const owner = user?.id;
    if (!owner) {
      setNotice(t('Sign in to save the game preview.', 'Mag-sign in upang i-save ang game preview.'));
      return;
    }
    setNotice(t('Saving local result...', 'Sine-save ang local result...'));
    void recordKingdomPreviewResult(owner, sessionId, result)
      .then(r => {
        if (liveOwner.current !== owner || liveSelected.current !== (result.gameId === MERGE_ID ? 'merge' : 'forge')) return;
        setRecord(r);
        setNotice(t('Saved on this device. No Character Points were awarded.', 'Na-save sa device. Walang Character Points na naibigay.'));
      })
      .catch(() => {
        if (liveOwner.current === owner && liveSelected.current === (result.gameId === MERGE_ID ? 'merge' : 'forge')) setNotice(t('Could not save locally.', 'Hindi na-save sa device.'));
      });
  }

  return (
    <View style={styles.page}>
      <View style={styles.centerTop}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Back to Kingdom map', 'Bumalik sa mapa ng Kingdom')}
          onPress={() => router.replace('/games' as any)} style={styles.mapBack}>
          <Text style={styles.mapBackText}>{t('← BACK TO KINGDOM MAP', '← BALIK SA MAPA NG KINGDOM')}</Text>
        </Pressable>
        <Text style={styles.kicker}>MITCH • CHARACTER GAME CENTER</Text>
        <View style={styles.chooser}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === 'forge' }}
            style={[styles.option, selected === 'forge' && styles.active]} onPress={() => setSelected('forge')}>
            <Text style={styles.optionText}>Block Forge</Text>
            <Text style={styles.optionSub}>{t('Block puzzle', 'Block puzzle')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === 'merge' }}
            style={[styles.option, selected === 'merge' && styles.active]} onPress={() => setSelected('merge')}>
            <Text style={styles.optionText}>Color Merge</Text>
            <Text style={styles.optionSub}>{t('Blend paint tiles','Pagsamahin ang mga kulay')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === 'mural' }}
            style={[styles.option, selected === 'mural' && styles.active]} onPress={() => setSelected('mural')}>
            <Text style={styles.optionText}>Restore the Mural</Text>
            <Text style={styles.optionSub}>{t('Original art game', 'Orihinal na art game')}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Play next Kingdom level offline"
          onPress={() => router.push({pathname:'/games/practice',params:{gameId:(selected === 'mural' ? GAME_ID : selected === 'merge' ? MERGE_ID : FORGE_ID)}} as any)}
          style={styles.practiceLink}>
          <Text style={styles.practiceText}>NEXT ADVENTURE LEVEL • OFFLINE PRACTICE</Text>
        </Pressable>
      </View>
      {selected === 'mural' ? (
        <View style={styles.originalGame}>
          <RestoreMuralGameV1 key={user?.id ?? 'guest'} onFinish={(result) => { void recordBuklodKingdomPreviewResult(result, user?.id ?? null).catch(() => undefined); }} />
        </View>
      ) : (
        <ScrollView style={styles.forgeScroll} contentContainerStyle={styles.forgeContent}>
          <Text style={styles.record}>{t('Local best', 'Pinakamataas na local score')}: {record?.bestScore.toLocaleString() ?? '—'}
            {'  •  '}{t('Clears', 'Panalo')}: {record?.clears ?? 0}</Text>
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          {selected === 'merge' ? (
            <MergeGameV1 key={user?.id ?? 'guest'} gameId={MERGE_ID} onFinish={handleForgeFinish} />
          ) : (
            <BlockForgeGameV1 key={user?.id ?? 'guest'} onFinish={handleForgeFinish} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default function MitchRestoreMuralScreen() {
  return <BuklodGameStage biome="art" gameId={GAME_ID}><MitchInterior /></BuklodGameStage>;
}

const styles = StyleSheet.create({
  practiceLink: { minHeight:44, padding:12, borderRadius:12, borderWidth:1, borderColor:'#e9ca88', backgroundColor:'#254a53', alignItems:'center', justifyContent:'center', marginVertical:7 },
  practiceText: { color:'#ffebbb', fontSize:12, fontWeight:'900', textAlign:'center' },

  page: { flex: 1, paddingTop: 12 },
  centerTop: { paddingHorizontal: 13, gap: 7 },
  mapBack: { alignSelf: 'flex-start', backgroundColor: '#493440', borderRadius: 10,
    borderColor: '#d4b997', borderWidth: 1, paddingVertical: 9, paddingHorizontal: 12 },
  mapBackText: { color: '#ffead2', fontWeight: '900', fontSize: 11 },
  kicker: { color: '#f0d0a4', fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  chooser: { flexDirection: 'row', gap: 9, paddingBottom: 8 },
  option: { flex: 1, backgroundColor: '#392d3b', borderWidth: 1, borderColor: '#765e6b', borderRadius: 12, padding: 10 },
  active: { borderColor: '#e8c59a', backgroundColor: '#5d3d47' },
  optionText: { color: '#fff1df', fontSize: 13, fontWeight: '900' },
  optionSub: { color: '#e0cbbf', fontSize: 10, marginTop: 3 },
  originalGame: { flex: 1, paddingTop: 8, paddingBottom: 28 },
  forgeScroll: { flex: 1 },
  forgeContent: { paddingHorizontal: 9, paddingBottom: 32 },
  record: { color: '#f7dfc6', fontSize: 12, fontWeight: '900', paddingTop: 6 },
  notice: { color: '#f1dbcd', fontSize: 11, lineHeight: 18, paddingTop: 5 },
});
