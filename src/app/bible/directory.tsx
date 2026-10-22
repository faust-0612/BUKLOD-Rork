import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import BuklodNonMediaBanner from '@/components/BuklodNonMediaBanner';

type Book = { book_no: number; book_name: string; chapter_count: number };
export default function BibleDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const [translation, setTranslation] = useState<'ASD' | 'KJV'>('ASD');
  const [selected, setSelected] = useState<number | null>(null);
  const { data, loading, error } = useBuklodOfflineCache<Book[]>({
    cacheKey: `phase1:bible-directory:${translation}`, enabled: true,
    fetcher: async () => {
      const result = await withBuklodTimeout<any>((supabase as any).rpc('get_bible_books', { p_translation_code: translation }), 7000, 'Bible directory');
      if (result.error) throw result.error;
      return (result.data ?? []) as Book[];
    },
  });
  const books = data ?? [];
  const book = books.find(item => Number(item.book_no) === selected);
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Bible Directory' }} />
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Books & Chapters</Text>
        <Text style={styles.body}>Choose a chapter to open the existing Bible reader.</Text>
        <View style={styles.row}>{(['ASD', 'KJV'] as const).map(code => (
          <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: translation === code }}
            onPress={() => { setTranslation(code); setSelected(null); }} style={[styles.chip, translation === code && styles.active]}>
            <Text style={styles.name}>{code}</Text>
          </Pressable>
        ))}</View>
        {loading && !data ? <Text style={styles.body}>Loading book directory…</Text> : null}
        {error ? <Text style={styles.body}>{data ? 'Showing saved books. Update unavailable.' : 'Directory unavailable. Try again when connected.'}</Text> : null}
        {book ? (
          <View style={styles.card}>
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)}><Text style={styles.link}>‹ All books</Text></Pressable>
            <Text style={styles.title}>{book.book_name}</Text>
            <View style={styles.row}>{Array.from({ length: Number(book.chapter_count) }, (_, index) => index + 1).map(chapter => (
              <Pressable key={chapter} accessibilityRole="button" accessibilityLabel={`${book.book_name} chapter ${chapter}`}
                style={styles.chip} onPress={() => router.push({ pathname: '/bible/read', params: { translation, book: String(book.book_no), chapter: String(chapter) } } as any)}>
                <Text style={styles.name}>{chapter}</Text>
              </Pressable>
            ))}</View>
          </View>
        ) : books.map(item => (
          <Pressable key={item.book_no} accessibilityRole="button" onPress={() => setSelected(Number(item.book_no))} style={styles.card}>
            <Text style={styles.name}>{item.book_name}</Text><Text style={styles.body}>{item.chapter_count} chapters</Text>
          </Pressable>
        ))}
      </ScrollView>
      {books.length > 0 ? <View style={[styles.footer, { paddingBottom: insets.bottom }]}><BuklodNonMediaBanner placementId="bible_directory_bottom" /></View> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' }, list: { flex: 1 }, content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#173B2F' }, name: { fontSize: 16, fontWeight: '700', color: '#173B2F' },
  body: { fontSize: 13, lineHeight: 20, color: '#53665B' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { padding: 14, minWidth: 48, minHeight: 48, borderRadius: 10, backgroundColor: '#E7EEE9' }, active: { backgroundColor: '#C8E4D3' },
  card: { padding: 16, gap: 8, borderRadius: 12, backgroundColor: '#FFFFFF' }, link: { fontSize: 15, color: '#246C45', paddingVertical: 8 },
  footer: { paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
});
