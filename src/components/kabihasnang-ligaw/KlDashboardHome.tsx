import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { KL_AUTHOR, KL_SEASON_ONE_TITLE } from '@/lib/kabihasnang-ligaw/catalog';

type ReleasedChapter = {
  id: string; season_number: number; episode_number: number; title: string;
};
type SeriesCatalog = {
  season_number: number; title: string; description: string;
  available_chapters: number; has_panimula: boolean;
};
type Progress = {
  completed_numbers: number[]; next_chapter_number: number;
  enabled: boolean;
};
type SeriesCard = SeriesCatalog & { knownReleased: number };

function chapterRows(data: unknown): ReleasedChapter[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is ReleasedChapter => Boolean(
    row && typeof row.id === 'string' && typeof row.title === 'string' &&
    Number.isInteger(row.season_number) && row.season_number >= 1 &&
    row.season_number <= 12 && Number.isInteger(row.episode_number) &&
    row.episode_number >= 0 && row.episode_number <= 30,
  ));
}

function catalogRows(data: unknown): SeriesCatalog[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is SeriesCatalog => Boolean(
    row && Number.isInteger(row.season_number) && row.season_number >= 1 &&
    row.season_number <= 12 && typeof row.title === 'string' &&
    row.title.trim().length > 0 && typeof row.description === 'string' &&
    Number.isInteger(Number(row.available_chapters)),
  )).map((row) => ({
    season_number: row.season_number, title: row.title,
    description: row.description, available_chapters: Math.max(0, Number(row.available_chapters)),
    has_panimula: row.has_panimula === true,
  }));
}

export function buildKlDashboardSeries(
  released: ReleasedChapter[], catalog: SeriesCatalog[],
): SeriesCard[] {
  const bySeason = new Map<number, SeriesCard>();
  for (const c of catalog) {
    bySeason.set(c.season_number, { ...c, knownReleased: 0 });
  }
  for (const chapter of released) {
    const s = bySeason.get(chapter.season_number) ?? {
      season_number: chapter.season_number,
      title: chapter.season_number === 1 ? KL_SEASON_ONE_TITLE : `Serye ${chapter.season_number}`,
      description: '',
      available_chapters: 0, has_panimula: false, knownReleased: 0,
    };
    if (chapter.episode_number === 0) s.has_panimula = true;
    else s.knownReleased += 1;
    bySeason.set(chapter.season_number, s);
  }
  if (!bySeason.has(1)) {
    bySeason.set(1, {
      season_number: 1, title: KL_SEASON_ONE_TITLE, description: '',
      available_chapters: 0, has_panimula: true, knownReleased: 0,
    });
  }
  return [...bySeason.values()].map((s) => ({
    ...s, available_chapters: Math.max(s.available_chapters, s.knownReleased),
  })).sort((a, b) => a.season_number - b.season_number);
}

export default function KlDashboardHome({ onOpenSeries }: {
  onOpenSeries: (seasonNumber: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sequence = useRef(0);
  const [series, setSeries] = useState<SeriesCard[]>([]);
  const [progress, setProgress] = useState<Record<number, Progress>>({});
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      // Both catalogs are released-only; neither request can reveal drafts.
      const [library, metadata] = await Promise.all([
        supabase.rpc('kl_list_library_v1'),
        supabase.rpc('kl_s2_reader_series_catalog_v1'),
      ]);
      if (request !== sequence.current) return;
      const chapters = library.error ? [] : chapterRows(library.data);
      const cards = buildKlDashboardSeries(
        chapters, metadata.error ? [] : catalogRows(metadata.data),
      );
      setSeries(cards);
      setWarning(library.error && metadata.error
        ? 'Hindi ma-refresh ang online library. Maaari mong subukan ang unang serye.'
        : '');
      // Never trust a locally cached unlocked state across users or failed reads.
      if (!user?.id) {
        setProgress({});
      } else {
        const results = await Promise.all(cards.map(async (card) => {
          try {
            const response = await supabase.rpc('kl_s2_reader_progress_v1', {
              p_season_number: card.season_number,
            });
            const value = response.data as {
              ok?: boolean; enabled?: boolean; next_chapter_number?: number;
              completed_numbers?: number[];
            } | null;
            if (response.error || value?.ok !== true ||
                !Number.isInteger(value.next_chapter_number) ||
                !Array.isArray(value.completed_numbers)) return null;
            return {
              number: card.season_number,
              value: {
                enabled: value.enabled === true,
                next_chapter_number: Number(value.next_chapter_number),
                completed_numbers: value.completed_numbers.filter(
                  n => Number.isInteger(n) && n >= 1 && n <= 30,
                ),
              } satisfies Progress,
            };
          } catch { return null; }
        }));
        if (request !== sequence.current) return;
        setProgress(Object.fromEntries(results.filter(
          (item): item is NonNullable<typeof item> => item !== null,
        ).map(item => [item.number, item.value])));
      }
      if (request === sequence.current) setLoaded(true);
    } catch {
      if (request === sequence.current) {
        setSeries(buildKlDashboardSeries([], []));
        setProgress({});
        setWarning('Hindi ma-refresh ang library. Subukan muli kapag may koneksyon.');
        setLoaded(true);
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { sequence.current += 1; };
  }, [refresh]));

  const visible = series.length ? series : buildKlDashboardSeries([], []);
  const reading = visible.find((item) => {
    const p = progress[item.season_number];
    return item.available_chapters > 0 && p?.completed_numbers.length !== 30;
  }) ?? visible.find(item => item.available_chapters > 0) ?? visible[0];
  const totalRead = Object.values(progress).reduce(
    (count, value) => count + value.completed_numbers.length, 0,
  );
  const hasProgress = Object.keys(progress).length > 0;

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, {
      paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 16),
    }]}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>KL · AKLATAN</Text>
        <Text style={styles.heading}>Kabihasnang Ligaw</Text>
        <Text style={styles.lead}>Mga kuwento ng paglalakbay, pagpili, at pananagutan.</Text>
        <Text style={styles.author}>{KL_AUTHOR}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Ipagpatuloy ang pagbabasa</Text>
        <Text style={styles.secondary}>Bumalik sa seryeng binabasa mo, o magsimula sa una.</Text>
        <Pressable accessibilityRole="button"
          accessibilityLabel={`Buksan ang ${reading.title}`}
          style={styles.continueButton} onPress={() => onOpenSeries(reading.season_number)}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.continueLabel}>SERYE {reading.season_number}</Text>
            <Text style={styles.continueTitle} numberOfLines={2}>{reading.title}</Text>
            <Text style={styles.continueSub}>
              {progress[reading.season_number]?.enabled
                ? `Susunod: Kabanata ${Math.min(30, progress[reading.season_number].next_chapter_number)}`
                : 'Buksan ang mga kabanata'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionHeading}>Ang iyong paglalakbay</Text>
          <Text style={styles.secondary}>
            {!user ? 'Mag-sign in upang makita ang iyong progreso.'
              : hasProgress ? `${totalRead} verified na kabanata sa mga available na serye`
              : loading ? 'Kinukuha ang progreso…' : 'Hindi pa makuha ang verified na progreso.'}
          </Text>
        </View>
        <Text style={styles.stat}>{hasProgress ? String(totalRead) : '—'}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>Mga Serye</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} disabled={loading}>
            <Text style={styles.refresh}>{loading ? 'Ina-update…' : 'I-refresh'}</Text>
          </Pressable>
        </View>
        {warning ? <Text accessibilityRole="alert" style={styles.warning}>{warning}</Text> : null}
        {visible.map((item) => {
          const p = progress[item.season_number];
          const count = p?.completed_numbers.length;
          const hasPublished = item.available_chapters > 0 || item.has_panimula;
          const ratio = count === undefined ? 0 : Math.min(count / 30, 1);
          return (
            <Pressable key={item.season_number} accessibilityRole="button"
              accessibilityLabel={`Buksan ang Serye ${item.season_number}: ${item.title}`}
              onPress={() => onOpenSeries(item.season_number)} style={styles.seriesCard}>
              <View style={styles.seriesTop}>
                <Text style={styles.seriesNumber}>SERYE {item.season_number}</Text>
                <Text style={styles.availability}>
                  {item.available_chapters > 0
                    ? `${item.available_chapters} kabanatang inilabas`
                    : hasPublished ? 'May panimula' : 'Panimulang aklatan'}
                </Text>
              </View>
              <Text style={styles.seriesTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.description} numberOfLines={3}>{item.description}</Text> : null}
              {count !== undefined ? <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` as `${number}%` }]} />
                </View>
                <Text style={styles.secondary}>{count} / 30 verified na kabanata</Text>
              </> : null}
              <Text style={styles.openLink}>Tingnan ang mga kabanata  ›</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.help}>
        <Text style={styles.sectionHeading}>Paano gumagana?</Text>
        <Text style={styles.secondary}>Basahin ang kabanata at sagutan ang reading questions. Sa Season 2, kailangang 3/3 ang tama upang ma-verify at mabuksan ang susunod na kabanata. Ang mga hindi pa inilalabas ng admin ay nananatiling pribado.</Text>
      </View>
      {!loaded && loading ? <Text style={styles.secondary}>Binubuksan ang KL library…</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#121e26' },
  content: { paddingHorizontal: 16, gap: 16 },
  hero: { backgroundColor: '#1e4135', borderRadius: 14, padding: 18, gap: 7 },
  kicker: { color: '#d2e7c1', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '800' },
  lead: { color: '#ecf5e7', fontSize: 15, lineHeight: 21 },
  author: { color: '#ccdacb', fontSize: 12 },
  section: { gap: 8 },
  sectionHeading: { color: '#fff', fontSize: 17, fontWeight: '800' },
  secondary: { color: '#b8c8c4', fontSize: 13, lineHeight: 19 },
  continueButton: { borderRadius: 12, backgroundColor: '#285846',
    paddingHorizontal: 15, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  continueLabel: { color: '#d4e5ca', fontSize: 11, fontWeight: '800' },
  continueTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  continueSub: { color: '#d3e4d9', fontSize: 12 },
  chevron: { color: '#fff', fontSize: 28 },
  progressRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    padding: 14, backgroundColor: '#22343a', gap: 10 },
  stat: { color: '#e8cf77', fontSize: 29, fontWeight: '800' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refresh: { color: '#d8e9b9', fontSize: 13, fontWeight: '700', padding: 6 },
  warning: { color: '#ffdcaa', fontSize: 13 },
  seriesCard: { borderRadius: 12, padding: 14, gap: 9, backgroundColor: '#1e3038',
    borderWidth: 1, borderColor: '#36534a' },
  seriesTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  seriesNumber: { color: '#d1e8b0', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  availability: { color: '#b7c7c5', fontSize: 11 },
  seriesTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  description: { color: '#c5d3d1', fontSize: 13, lineHeight: 19 },
  progressTrack: { height: 5, borderRadius: 9, backgroundColor: '#45565a', overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: '#b4dc83', borderRadius: 9 },
  openLink: { color: '#d9e9be', fontWeight: '700', fontSize: 13 },
  help: { padding: 14, gap: 6, borderTopWidth: 1, borderColor: '#3c504f' },
});
