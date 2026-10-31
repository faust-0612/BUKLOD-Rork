import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Book = { book_no: number; book_name: string; chapter_count: number };
type Translation = { code: string; short_title: string };

type Props = {
  books: Book[];
  bookNo: number;
  chapterNo: number;
  currentBook?: Book;
  verseNumbers: number[];
  selectedVerse: number | null;
  translation: string;
  translations: Translation[];
  onSelectBook: (book: Book) => void;
  onSelectChapter: (chapter: number) => void;
  onSelectVerse: (verse: number) => void;
  onClearVerse: () => void;
  onTranslation: (code: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSearch: () => void;
  onReport: () => void;
};

/**
 * My Bible only: compact reader-first navigation. Its controls reuse the
 * existing chapter/verse selection and narration state in bible/read.tsx.
 * Daily-plan reading is deliberately untouched.
 */
export default function MyBibleQuickNavigator({
  books, bookNo, chapterNo, currentBook, verseNumbers, selectedVerse,
  translation, translations, onSelectBook, onSelectChapter, onSelectVerse,
  onClearVerse, onTranslation, onPrevious, onNext, onSearch, onReport,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'book' | 'chapter' | 'verse'>('book');
  const [testament, setTestament] = useState<'all' | 'ot' | 'nt'>('all');
  const [bookFilter, setBookFilter] = useState('');

  const filteredBooks = useMemo(() => {
    const q = bookFilter.trim().toLocaleLowerCase();
    return books.filter(book =>
      (testament === 'all' || (testament === 'ot' ? book.book_no <= 39 : book.book_no > 39)) &&
      (!q || book.book_name.toLocaleLowerCase().includes(q))
    );
  }, [books, testament, bookFilter]);

  const show = (next: 'book' | 'chapter' | 'verse') => {
    setStep(next);
    setOpen(true);
  };
  const chapterCount = Math.max(0, Number(currentBook?.chapter_count ?? 0));
  const chapterNumbers = Array.from({ length: chapterCount }, (_, i) => i + 1);
  const atStart = bookNo <= 1 && chapterNo <= 1;
  const atEnd = bookNo >= 66 && chapterNo >= 22;

  return (
    <>
      <View style={s.toolbar}>
        <Pressable onPress={() => show('book')} style={s.reference} accessibilityRole="button"
          accessibilityLabel="Pumili ng aklat sa Bibliya">
          <MaterialCommunityIcons name="book-open-variant" size={23} color="#275D45" />
          <View style={s.referenceLabels}>
            <Text numberOfLines={1} style={s.referenceText}>
              {currentBook?.book_name ?? 'My Bible'} {chapterNo}
            </Text>
            <Text style={s.referenceHint}>Pindutin para pumili ng aklat</Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={22} color="#275D45" />
        </Pressable>
        <Pressable onPress={onSearch} style={s.iconButton} accessibilityRole="button" accessibilityLabel="Hanapin sa Bibliya">
          <MaterialCommunityIcons name="magnify" size={24} color="#275D45" />
        </Pressable>
      </View>
      <View style={s.tools}>
        <Pressable onPress={onPrevious} disabled={atStart} style={s.smallButton}
          accessibilityRole="button" accessibilityLabel="Naunang kabanata">
          <MaterialCommunityIcons name="chevron-left" size={23} color={atStart ? '#B6C1BB' : '#275D45'} />
        </Pressable>
        <Pressable onPress={() => show('chapter')} style={s.chapterButton} accessibilityRole="button"
          accessibilityLabel="Pumili ng kabanata">
          <Text style={s.chapterText}>Kabanata {chapterNo} <MaterialCommunityIcons name="chevron-down" size={14} /></Text>
        </Pressable>
        <Pressable onPress={() => show('verse')} style={s.chapterButton} accessibilityRole="button"
          accessibilityLabel="Pumili ng talata">
          <Text style={s.chapterText}>Talata {selectedVerse ?? 'Lahat'} <MaterialCommunityIcons name="chevron-down" size={14} /></Text>
        </Pressable>
        <Pressable onPress={onNext} disabled={atEnd} style={s.smallButton}
          accessibilityRole="button" accessibilityLabel="Susunod na kabanata">
          <MaterialCommunityIcons name="chevron-right" size={23} color={atEnd ? '#B6C1BB' : '#275D45'} />
        </Pressable>
      </View>
      <View style={s.versionRow}>
        <View style={s.versions}>
          {translations.map(item => (
            <Pressable key={item.code} onPress={() => onTranslation(item.code)}
              accessibilityRole="button" accessibilityState={{ selected: item.code === translation }}
              style={[s.version, item.code === translation && s.versionSelected]}>
              <Text style={[s.versionText, item.code === translation && s.versionTextSelected]}>{item.code}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onReport} style={s.report} accessibilityRole="button" accessibilityLabel="Bible Reading Progress">
          <MaterialCommunityIcons name="chart-line" size={17} color="#275D45" />
          <Text style={s.reportText}>Progress</Text>
        </Pressable>
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Isara" />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Pumili ng babasahin</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Isara ang Bible picker">
                <MaterialCommunityIcons name="close" size={25} color="#33483C" />
              </Pressable>
            </View>
            <View style={s.tabs}>
              {(['book', 'chapter', 'verse'] as const).map(t => (
                <Pressable key={t} onPress={() => setStep(t)} style={[s.tab, step === t && s.tabSelected]}>
                  <Text style={[s.tabText, step === t && s.tabTextSelected]}>
                    {t === 'book' ? 'AKLAT' : t === 'chapter' ? 'KABANATA' : 'TALATA'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {step === 'book' && (
              <>
                <TextInput value={bookFilter} onChangeText={setBookFilter}
                  placeholder="Hanapin ang aklat (hal. Juan, Genesis)"
                  autoCorrect={false} style={s.input} />
                <View style={s.testament}>
                  {(['all', 'ot', 'nt'] as const).map(t => (
                    <Pressable key={t} onPress={() => setTestament(t)} style={[s.testamentButton, testament === t && s.testamentSelected]}>
                      <Text style={[s.testamentText, testament === t && s.testamentTextSelected]}>
                        {t === 'all' ? 'LAHAT' : t === 'ot' ? 'LUMANG TIPAN' : 'BAGONG TIPAN'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <ScrollView style={s.options} keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.optionGrid}>
              {step === 'book' && filteredBooks.map(book => (
                <Pressable key={book.book_no} onPress={() => {
                  onSelectBook(book);
                  setBookFilter('');
                  setStep('chapter');
                }} style={[s.bookOption, bookNo === book.book_no && s.optionSelected]}>
                  <Text style={[s.bookText, bookNo === book.book_no && s.selectedText]}>{book.book_name}</Text>
                </Pressable>
              ))}
              {step === 'chapter' && chapterNumbers.map(chapter => (
                <Pressable key={chapter} onPress={() => {
                  onSelectChapter(chapter);
                  setOpen(false);
                }} style={[s.numberOption, chapterNo === chapter && s.optionSelected]}>
                  <Text style={[s.numberText, chapterNo === chapter && s.selectedText]}>{chapter}</Text>
                </Pressable>
              ))}
              {step === 'verse' && (
                <Pressable onPress={() => { onClearVerse(); setOpen(false); }}
                  style={[s.bookOption, selectedVerse === null && s.optionSelected]}>
                  <Text style={[s.bookText, selectedVerse === null && s.selectedText]}>Buong kabanata</Text>
                </Pressable>
              )}
              {step === 'verse' && verseNumbers.map(verse => (
                <Pressable key={verse} onPress={() => { onSelectVerse(verse); setOpen(false); }}
                  style={[s.numberOption, selectedVerse === verse && s.optionSelected]}>
                  <Text style={[s.numberText, selectedVerse === verse && s.selectedText]}>{verse}</Text>
                </Pressable>
              ))}
              {step === 'book' && filteredBooks.length === 0 && (
                <Text style={s.empty}>Walang aklat na tumugma. Subukan ang ibang pangalan.</Text>
              )}
              {step === 'verse' && verseNumbers.length === 0 && (
                <Text style={s.empty}>Buksan muna ang kabanata upang makita ang mga talata.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  reference: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14,
    borderColor: '#D3DDD6', borderWidth: 1, backgroundColor: '#F3F8F5', minHeight: 57, paddingHorizontal: 12 },
  referenceLabels: { flex: 1 },
  referenceText: { fontSize: 18, fontWeight: '800', color: '#243D30' },
  referenceHint: { fontSize: 10, color: '#6A8074' },
  iconButton: { width: 52, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 13,
    backgroundColor: '#F3F8F5', borderColor: '#D3DDD6', borderWidth: 1 },
  tools: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  smallButton: { width: 32, height: 40, justifyContent: 'center', alignItems: 'center' },
  chapterButton: { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4,
    backgroundColor: '#EDF5EF', alignItems: 'center' },
  chapterText: { fontSize: 12, fontWeight: '800', color: '#275D45' },
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  versions: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  version: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#CFDDD3', borderRadius: 20 },
  versionSelected: { backgroundColor: '#275D45', borderColor: '#275D45' },
  versionText: { fontSize: 11, fontWeight: '800', color: '#275D45' },
  versionTextSelected: { color: '#FFFFFF' },
  report: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 6 },
  reportText: { fontSize: 11, fontWeight: '700', color: '#275D45' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' },
  sheet: { maxHeight: '86%', backgroundColor: '#FFFFFF', padding: 16,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  sheetTitle: { fontSize: 19, color: '#263E30', fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 13 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F2F6F3', alignItems: 'center' },
  tabSelected: { backgroundColor: '#275D45' },
  tabText: { fontSize: 10, fontWeight: '800', color: '#627B6C' },
  tabTextSelected: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: '#CCDAD0', borderRadius: 12, paddingHorizontal: 13,
    minHeight: 44, fontSize: 14, marginBottom: 10, color: '#22372C' },
  testament: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  testamentButton: { flex: 1, backgroundColor: '#F0F5F1', paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  testamentSelected: { backgroundColor: '#D9EBDD' },
  testamentText: { color: '#6F8075', fontSize: 9, fontWeight: '800' },
  testamentTextSelected: { color: '#205A3E' },
  options: { flexGrow: 0 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  bookOption: { width: '48.5%', minHeight: 52, paddingHorizontal: 9, borderWidth: 1,
    borderRadius: 10, borderColor: '#D5E0D9', justifyContent: 'center', alignItems: 'center' },
  bookText: { fontSize: 13, textAlign: 'center', fontWeight: '700', color: '#34483D' },
  numberOption: { minWidth: 44, height: 44, paddingHorizontal: 8, borderWidth: 1,
    borderRadius: 10, borderColor: '#D5E0D9', alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 13, fontWeight: '700', color: '#34483D' },
  optionSelected: { backgroundColor: '#275D45', borderColor: '#275D45' },
  selectedText: { color: '#FFFFFF' },
  empty: { color: '#667E70', fontSize: 13, marginVertical: 15 },
});
