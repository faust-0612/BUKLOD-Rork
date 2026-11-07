import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import type { BuklodGameResult } from '@/features/games/types';
import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import {
  readKingdomPreviewRecord, recordKingdomPreviewResult,
  type KingdomPreviewRecord,
} from './previewStore';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';

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
 * No economy RPC or ads are implemented here. R1/R2 centers can migrate after QA.
 */
export function KingdomInteriorCenter({
  character, subtitleEn, subtitleTl, options,
}: KingdomInteriorProps) {
  const { user } = useAuth();
  const { t } = useBuklodGameLanguage();
  const [activeId, setActiveId] = useState(options[0]?.id ?? '');
  const [record, setRecord] = useState<KingdomPreviewRecord | null>(null);
  const [notice, setNotice] = useState('');
  const ownerRef = useRef(user?.id ?? null);
  const gameRef = useRef(activeId);
  ownerRef.current = user?.id ?? null;
  gameRef.current = activeId;
  const active = options.find(option => option.id === activeId) ?? options[0];

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
        setNotice(t('Saved locally. No Character Points or cash were awarded.', 'Na-save sa device. Walang Character Points o cash na ibinigay.'));
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
        <Text style={styles.eyebrow}>{character.toUpperCase()} • KINGDOM GAME CENTER</Text>
        <Text style={styles.heading}>{t('Choose a game', 'Pumili ng laro')}</Text>
        <Text style={styles.help}>{t(subtitleEn, subtitleTl)}</Text>
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
          void recordBuklodKingdomPreviewResult(result);
        })}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 18, paddingBottom: 36 },
  shell: { width: '100%', maxWidth: 940, alignSelf: 'center', paddingHorizontal: 12, gap: 9 },
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
});
