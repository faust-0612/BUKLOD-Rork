import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { henryLanguageForBible, henryMappingNote, henrySource, henryText, loadHenrySections, translateHenrySection,
  type HenryEdition, type HenryLanguage, type HenrySection } from '@/lib/buklodHenryCommentary';

export default function BuklodHenryCommentaryPanel({ book, chapter, start, end, languageCode, translationCode }: {
  book: number; chapter: number; start: number; end: number; languageCode?: string; translationCode: string;
}) {
  const { user } = useAuth();
  const { isConnected, isInternetReachable } = useNetwork();
  const online = Boolean(isConnected && isInternetReachable !== false);
  const accountId = user?.id || '';
  const defaultLanguage = henryLanguageForBible(languageCode, translationCode);
  const [expanded, setExpanded] = useState(false);
  const [edition, setEdition] = useState<HenryEdition>('concise');
  const [override, setOverride] = useState<{ base: HenryLanguage; language: HenryLanguage } | null>(null);
  const language = override?.base === defaultLanguage ? override.language : defaultLanguage;
  useEffect(() => { setOverride(null); }, [defaultLanguage]);
  const [automatic, setAutomatic] = useState(false);
  const [translation, setTranslation] = useState<{ key: string; sectionId: string; progress: string; error?: string } | null>(null);
  const translationBusy = useRef(false);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: { section: HenrySection; text: string | null }[]; error?: string } | null>(null);
  const key = `${accountId}:${edition}:${book}:${chapter}:${start}:${end}:${language}`;
  const identity = useRef(key); identity.current = key;
  const canContinue = useRef(false); canContinue.current = expanded && language === 'fil' && online;
  async function generate(section: HenrySection) {
    if (translationBusy.current || !online) return;
    translationBusy.current = true; const context = key;
    setTranslation({ key: context, sectionId: section.id, progress: 'Translating…' });
    try {
      await translateHenrySection(section, accountId, () => identity.current === context && canContinue.current, (done, total) => { if (identity.current === context) setTranslation({ key: context, sectionId: section.id, progress: `${done}/${total} saved chunks` }); });
      if (identity.current === context) { setTranslation(null); setRetry(v => v + 1); }
    } catch (error) { if (identity.current === context) setTranslation({ key: context, sectionId: section.id, progress: '', error: error instanceof Error ? error.message : 'Translation unavailable.' }); }
    finally { translationBusy.current = false; }
  }
  useEffect(() => {
    if (!expanded) return;
    let active = true;
    void loadHenrySections({ accountId, edition, book, chapter, start, end, online }).then(async sections => {
      const rows = await Promise.all(sections.map(async section => ({ section, text: await henryText(section, language, accountId) })));
      if (active) setResult({ key, rows });
    }).catch(error => {
      if (active) setResult({ key, rows: [], error: error instanceof Error ? error.message : 'Commentary unavailable. Connect and retry.' });
    });
    return () => { active = false; };
  }, [expanded, accountId, edition, book, chapter, start, end, online, language, key, retry]);
  const current = result?.key === key ? result : null;
  useEffect(() => {
    if (!automatic || !expanded || language !== 'fil' || !online || !current || translationBusy.current || translation?.key === key && translation.error) return;
    const missing = current.rows.find(row => !row.text); if (missing) void generate(missing.section);
  }, [automatic, expanded, language, online, current, key]);
  useEffect(() => () => { canContinue.current = false; }, []);
  const source = henrySource(edition);
  const note = henryMappingNote(edition, book, chapter);
  return <View style={styles.panel}>
    <Pressable onPress={() => setExpanded(value => !value)} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.toggle}>
      <Text style={styles.title}>Matthew Henry Commentary</Text><Text>{expanded ? 'Hide' : 'Open'}</Text>
    </Pressable>
    {expanded && <View style={styles.content}>
      <View style={styles.buttons}>{(['concise', 'complete'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: edition === value }} onPress={() => setEdition(value)} style={[styles.button, edition === value && styles.selected]}><Text>{value === 'concise' ? 'Concise' : 'Complete'}</Text></Pressable>)}</View>
      <View style={styles.buttons}>{(['fil', 'en'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: language === value }} onPress={() => setOverride({ base: defaultLanguage, language: value })} style={[styles.button, language === value && styles.selected]}><Text>{value === 'fil' ? 'Filipino (draft)' : 'English original'}</Text></Pressable>)}</View>
      <Text style={styles.caption}>{language === 'fil' ? 'Salin sa Filipino — AI/Codex draft para sa pagsusuri. Hindi orihinal na Filipino na sulat ni Matthew Henry.' : edition === 'concise' ? 'English Concise edition — an abridgment of Matthew Henry’s Commentary.' : 'Original English Complete edition.'}</Text>
      {language === 'fil' && <Pressable accessibilityRole="switch" accessibilityState={{ checked: automatic }} onPress={() => { setAutomatic(v => !v); setTranslation(null); }} style={styles.button}><Text>Auto-translate missing sections: {automatic ? 'On' : 'Off'}</Text></Pressable>}
      {language === 'fil' && <Text style={styles.caption}>New translations use Gemini and count toward daily AI usage. Saved complete translations remain available offline.</Text>}
      {!current ? <ActivityIndicator accessibilityLabel="Loading commentary" /> : current.error ? <View><Text>{current.error}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={styles.button}><Text>Retry</Text></Pressable></View> : current.rows.length === 0 ? <Text>No mapped commentary section is available for this passage. No unrelated passage has been substituted.</Text> : current.rows.map(({ section, text }) => <View key={section.id} style={styles.section}>
        <Text style={styles.heading}>{section.heading}</Text>
        {language === 'fil' && !text && <Pressable accessibilityRole="button" disabled={!online || translationBusy.current} onPress={() => void generate(section)} style={styles.button}><Text>Translate to Filipino</Text></Pressable>}
        {translation?.key === key && translation.sectionId === section.id && <Text accessibilityRole={translation.error ? 'alert' : undefined}>{translation.error || translation.progress}</Text>}
        <Text selectable style={styles.body}>{text ?? 'Wala pang salin sa Filipino para sa seksiyong ito. Piliin ang English original kung nais mong basahin ito.'}</Text>
      </View>)}
      {note && <Text style={styles.caption}>{note}</Text>}
      <Text style={styles.caption}>Matthew Henry · {source.license} · {edition === 'concise' ? 'MHCC' : 'MHC'} {source.version}. Offline reading requires a saved package on this account. Local storage limit: 16 MB.</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(source.url)} style={styles.button}><Text>Source and attribution</Text></Pressable>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { marginVertical: 12, borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, backgroundColor: '#F5F8F6' },
  toggle: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 48 },
  title: { flex: 1, fontWeight: '700', color: '#173B2F' }, content: { padding: 16, paddingTop: 0, gap: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#CBD9D0', borderRadius: 10, minHeight: 44, alignSelf: 'flex-start' },
  selected: { backgroundColor: '#DDEEE3', borderColor: '#2D6A4F' }, caption: { fontSize: 12, lineHeight: 18, color: '#52665A' },
  section: { gap: 8 }, heading: { fontWeight: '700', color: '#173B2F' }, body: { fontSize: 16, lineHeight: 25, color: '#21372B' },
});
