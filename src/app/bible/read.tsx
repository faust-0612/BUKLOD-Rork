import { repairMojibakeText } from '@/lib/repairMojibakeText';
import BuklodOccasionalAd from '@/components/BuklodOccasionalAd';
import MyBibleQuickNavigator from '@/components/bible/MyBibleQuickNavigator';
/**
 * PATCH 153H-3A
 * FULL BIBLE READER
 *
 * Features:
 * - ASD / KJV
 * - Book browser
 * - Chapter browser
 * - Full verse display
 * - Previous / Next chapter
 * - Continue recent reading
 * - Mark chapter read
 * - Reading session history
 *
 * Daily Plan completion flow integrated in PATCH 153H-4C.
 */

import {

  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,

  Modal,
  TextInput,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { colors } from '@/lib/theme';
import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import { BuklodBibleNarrationBar } from '@/components/BuklodBibleNarrationBar';
import {
  mapBibleChapterRows,
} from '@/lib/buklodBibleNarration';
import {
  useBuklodBibleNarration,
} from '@/providers/BuklodBibleNarrationProvider';


type Translation = {
  code: string;
  language_code: string;
  language_name: string;
  title: string;
  short_title: string;
  license_name: string;
  attribution_text: string;
  sort_order: number;
};


type BibleBook = {
  book_no: number;
  book_name: string;
  chapter_count: number;
  available_chapters: number | string;
};


type BibleVerse = {
  translation_code: string;
  translation_title: string;

  book_no: number;
  book_name: string;

  chapter_no: number;
  verse_no: number;

  verse_text: string;
  paragraph_start: boolean;
};


type RecentReading = {
  session_id: string;

  translation_code: string;
  translation_title: string;

  book_no: number;
  book_name: string;
  chapter_no: number;

  bible_reference: string;

  source: string;

  started_at: string;
  completed_at: string | null;

  is_completed: boolean;
};


const paramString = (
  value: string | string[] | undefined
) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};


export default function BibleReaderScreen() {
  const { user } = useAuth();
  const accountId = user?.id ?? '';
  const { online } = useNetwork();
  const initGeneration = useRef(0);
  const params = useLocalSearchParams<{
    book?: string;
    chapter?: string;
    translation?: string;
    source?: string;
    assignment_id?: string;
    verse?: string;
    assignedDate?: string;
  }>();


  const requestedBook =
    Number(paramString(params.book) ?? 0);

  const requestedChapter =
    Number(paramString(params.chapter) ?? 0);

  const requestedTranslation =
    (
      paramString(params.translation) ??
      ''
    )
      .trim()
      .toUpperCase();

  const requestedVerse =
    Number(paramString(params.verse) ?? 0);

  /* PATCH_153H_4C_ASSIGNED_DATE */
  const assignedDate =
    (
      paramString(
        params.assignedDate
      ) ??
      ''
    ).trim();


  /* PATCH_154V_DAILY_ASSIGNMENT_ID */
  const dailyAssignmentId =
    (
      paramString(
        params.assignment_id
      ) ?? ''
    ).trim();


  const source = useMemo(() => {
    const raw =
      (
        paramString(params.source) ??
        'free_reading'
      )
        .trim()
        .toLowerCase();

    if (
      raw === 'daily_plan' ||
      raw === 'search' ||
      raw === 'free_reading'
    ) {
      return raw;
    }

    return 'free_reading';
  }, [params.source]);


  const [translations, setTranslations] =
    useState<Translation[]>([]);

  const [books, setBooks] =
    useState<BibleBook[]>([]);

  const [verses, setVerses] =
    useState<BibleVerse[]>([]);


  const [translation, setTranslation] =
    useState('ASD');

  const [bookNo, setBookNo] =
    useState(
      requestedBook > 0
        ? requestedBook
        : 1
    );

  const [chapterNo, setChapterNo] =
    useState(
      requestedChapter > 0
        ? requestedChapter
        : 1
    );

  // Exact, account-bound daily assignment only. Never substitute Genesis or
  // the last personal chapter for an uncached offline daily-plan date.
  useEffect(() => {
    if (source !== 'daily_plan' || !assignedDate || !accountId) return;
    let active = true;
    void (async () => {
      const key = 'bible-daily-plan:' + assignedDate;
      const saved = await getOfflineCache<{bookNo: number;chapterNo: number}>(key, {
        userId: accountId, allowStale: true,
      });
      if (!active) return;
      if (saved?.data && saved.data.bookNo > 0 && saved.data.chapterNo > 0) {
        setBookNo(saved.data.bookNo);
        setChapterNo(saved.data.chapterNo);
        setDailyPlanStep(1);
      }
      if (!online) return;
      try {
        const { data, error } = await (supabase as any).rpc(
          'get_automatic_bible_reading', { p_reading_date: assignedDate });
        if (!active || error) return;
        const raw = Array.isArray(data) ? data[0] ?? null : data ?? null;
        const nextBook = Number(raw?.start_book_no ?? 0);
        const nextChapter = Number(raw?.start_chapter ?? 0);
        if (nextBook > 0 && nextChapter > 0) {
          setBookNo(nextBook);
          setChapterNo(nextChapter);
          setDailyPlanStep(1);
          void setOfflineCache(key, {bookNo: nextBook, chapterNo: nextChapter}, {
            userId: accountId, ttlMs: 35 * 24 * 60 * 60 * 1000,
          }).catch(() => undefined);
        }
      } catch (error) {
        console.warn('Daily Bible reader sync:', error);
      }
    })();
    return () => { active = false; };
  }, [source, assignedDate, accountId, online]);

  const [showBibleAudio, setShowBibleAudio] = useState(false);
  const [showBibleTextSettings, setShowBibleTextSettings] = useState(false);
  const [showBooks, setShowBooks] =
    useState(false);
const [showChapters, setShowChapters] =
    useState(false);


  /* MY_BIBLE_AUTO_CHAPTER_VERSE_FINAL_V2 */

  const [
    showVersePicker,
    setShowVersePicker,
  ] =
    useState(false);


  const [
    passageVerseNo,
    setPassageVerseNo,
  ] =
    useState<number | null>(
      requestedVerse > 0
        ? requestedVerse
        : null
    );


  const {
    snapshot: bibleNarration,
    play: playBibleNarration,
  } =
    useBuklodBibleNarration();

  const bibleNarrationStatusRef =
    useRef(
      bibleNarration.status
    );
  bibleNarrationStatusRef.current =
    bibleNarration.status;

  const userChapterPickRef =
    useRef(false);
  const pendingNarrationPlayRef =
    useRef(false);

  const markUserBibleChapterChange =
    () => {
      userChapterPickRef.current =
        true;

      if (
        bibleNarrationStatusRef.current ===
          'playing' ||
        bibleNarrationStatusRef.current ===
          'paused' ||
        bibleNarrationStatusRef.current ===
          'loading'
      ) {
        pendingNarrationPlayRef.current =
          true;
      }
    };


  const [initializing, setInitializing] =
    useState(true);

  const [chapterLoading, setChapterLoading] =
    useState(false);

  const [readerAvailable, setReaderAvailable] =
    useState(true);

  const [readerError, setReaderError] =
    useState<string | null>(null);


  const [sessionId, setSessionId] =
    useState<string | null>(null);

  const [completed, setCompleted] =
    useState(false);

  const [marking, setMarking] =
    useState(false);


  /* ==========================================================
     MY_BIBLE_MODE_SPLIT_V1

     daily_plan = guided devotional reader
     my_bible   = full Bible access
  ========================================================== */

  const myBibleRouteParams =
    useLocalSearchParams<{
      source?:
        string |
        string[];
    }>();


  const bibleReaderSource =
    Array.isArray(
      myBibleRouteParams.source
    )
      ? myBibleRouteParams.source[0] ?? ''
      : myBibleRouteParams.source ?? '';


  const isMyBibleMode =
    bibleReaderSource === 'my_bible' || bibleReaderSource === 'search';


  const isDailyReadingMode =
    bibleReaderSource ===
    'daily_plan';


  /* ==========================================================
     MY_BIBLE_ANNOTATIONS_V1
     Personal highlights + notes + chapter search
  ========================================================== */

  const [
    bibleAnnotations,
    setBibleAnnotations,
  ] =
    useState<
      Record<
        number,
        {
          id?: string;
          highlight_color:
            string | null;
          note_text:
            string | null;
        }
      >
    >({});


  const [
    annotationModalVisible,
    setAnnotationModalVisible,
  ] =
    useState(false);


  const [
    selectedVerseNo,
    setSelectedVerseNo,
  ] =
    useState<number | null>(
      null
    );


  const [
    selectedVerseText,
    setSelectedVerseText,
  ] =
    useState('');


  const [
    annotationColor,
    setAnnotationColor,
  ] =
    useState<string | null>(
      null
    );


  const [
    annotationNote,
    setAnnotationNote,
  ] =
    useState('');


  const [
    annotationSaving,
    setAnnotationSaving,
  ] =
    useState(false);


  const [
    chapterQuery,
    setChapterQuery,
  ] =
    useState('');


  const myBibleHighlightColors =
    [
      '#FFF3A3',
      '#CFEFD6',
      '#CFE8FF',
      '#FFD7E5',
      '#E6D7FF',
    ];


  const loadMyBibleAnnotations =
    useCallback(
      async () => {

        if (
          !translation ||
          !bookNo ||
          !chapterNo
        ) {
          setBibleAnnotations(
            {}
          );

          return;
        }


        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'get_my_bible_annotations_v1',
            {
              p_translation_code:
                translation,

              p_book_no:
                bookNo,

              p_chapter_no:
                chapterNo,
            }
          );


        if (error) {

          console.warn(
            'MY BIBLE annotations:',
            error.message
          );

          return;
        }


        const next:
          Record<
            number,
            {
              id?: string;
              highlight_color:
                string | null;
              note_text:
                string | null;
            }
          > =
          {};


        (
          Array.isArray(data)
            ? data
            : []
        ).forEach(
          (
            item: any
          ) => {

            const verseNo =
              Number(
                item.verse_no
              );


            if (
              verseNo > 0
            ) {

              next[
                verseNo
              ] = {
                id:
                  item.id,

                highlight_color:
                  item
                    .highlight_color ??
                  null,

                note_text:
                  item
                    .note_text ??
                  null,
              };

            }

          }
        );


        setBibleAnnotations(
          next
        );

      },
      [
        translation,
        bookNo,
        chapterNo,
      ]
    );


  useEffect(
    () => {

      void loadMyBibleAnnotations();

    },
    [
      loadMyBibleAnnotations,
    ]
  );


  const openBibleAnnotation =
    (
      verseNo:
        number,

      verseText:
        string
    ) => {

      const existing =
        bibleAnnotations[
          verseNo
        ];


      setSelectedVerseNo(
        verseNo
      );

      setSelectedVerseText(
        verseText
      );

      setAnnotationColor(
        existing
          ?.highlight_color ??
        null
      );

      setAnnotationNote(
        existing
          ?.note_text ??
        ''
      );

      setAnnotationModalVisible(
        true
      );

    };


  const saveBibleAnnotation =
    async () => {

      if (
        !selectedVerseNo
      ) {
        return;
      }


      setAnnotationSaving(
        true
      );


      try {

        const cleanNote =
          annotationNote
            .trim();


        const {
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'save_my_bible_annotation_v1',
            {
              p_translation_code:
                translation,

              p_book_no:
                bookNo,

              p_chapter_no:
                chapterNo,

              p_verse_no:
                selectedVerseNo,

              p_highlight_color:
                annotationColor,

              p_note_text:
                cleanNote ||
                null,
            }
          );


        if (error) {
          throw error;
        }


        if (
          !annotationColor &&
          !cleanNote
        ) {

          setBibleAnnotations(
            current => {

              const next = {
                ...current,
              };


              delete next[
                selectedVerseNo
              ];


              return next;

            }
          );

        }
        else {

          setBibleAnnotations(
            current => ({
              ...current,

              [
                selectedVerseNo
              ]: {
                highlight_color:
                  annotationColor,

                note_text:
                  cleanNote ||
                  null,
              },
            })
          );

        }


        setAnnotationModalVisible(
          false
        );

      }
      catch (
        error: any
      ) {

        Alert.alert(
          'MY BIBLE',
          error?.message ??
          'Could not save your Bible note.'
        );

      }
      finally {

        setAnnotationSaving(
          false
        );

      }

    };


  const removeBibleAnnotation =
    async () => {

      if (
        !selectedVerseNo
      ) {
        return;
      }


      setAnnotationSaving(
        true
      );


      try {

        const {
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'delete_my_bible_annotation_v1',
            {
              p_translation_code:
                translation,

              p_book_no:
                bookNo,

              p_chapter_no:
                chapterNo,

              p_verse_no:
                selectedVerseNo,
            }
          );


        if (error) {
          throw error;
        }


        setBibleAnnotations(
          current => {

            const next = {
              ...current,
            };


            delete next[
              selectedVerseNo
            ];


            return next;

          }
        );


        setAnnotationModalVisible(
          false
        );

      }
      catch (
        error: any
      ) {

        Alert.alert(
          'MY BIBLE',
          error?.message ??
          'Could not remove annotation.'
        );

      }
      finally {

        setAnnotationSaving(
          false
        );

      }

    };


  const normalizeBibleBookName =
    (
      value:
        string
    ) =>
      value
        .toLowerCase()
        .replace(
          /[.\-]/g,
          ' '
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim();


  const searchBibleChapter =
    () => {

      const raw =
        chapterQuery
          .trim();


      const match =
        raw.match(
          /^(.+?)\s+(\d+)$/
        );


      if (!match) {

        Alert.alert(
          'Chapter Search',
          'Type a book and chapter, for example: Juan 3 or John 3.'
        );

        return;
      }


      const requestedBook =
        normalizeBibleBookName(
          match[1]
        );


      const requestedChapter =
        Number(
          match[2]
        );


      const exactBook =
        books.find(
          (
            item
          ) =>
            normalizeBibleBookName(
              String(
                item.book_name
              )
            ) ===
            requestedBook
        );


      const partialBooks =
        books.filter(
          (
            item
          ) =>
            normalizeBibleBookName(
              String(
                item.book_name
              )
            ).startsWith(
              requestedBook
            )
        );


      const matchedBook =
        exactBook ??
        (
          partialBooks
            .length ===
          1
            ? partialBooks[
                0
              ]
            : null
        );


      if (
        !matchedBook
      ) {

        Alert.alert(
          'Chapter Search',
          'Book not found. Use the book name shown in the Bible book list.'
        );

        return;
      }


      const maxChapter =
        Number(
          matchedBook
            .chapter_count
        );


      if (
        !Number.isFinite(
          requestedChapter
        ) ||
        requestedChapter <
          1 ||
        requestedChapter >
          maxChapter
      ) {

        Alert.alert(
          'Chapter Search',
          `${matchedBook.book_name} has ${maxChapter} chapters.`
        );

        return;
      }


      setBookNo(
        Number(
          matchedBook.book_no
        )
      );

      setChapterNo(
        requestedChapter
      );

      setShowBooks(
        false
      );

      setShowChapters(
        false
      );

      setChapterQuery(
        ''
      );

    };


  /* PATCH_153H_4C_PLAN_STEP */

  const [dailyPlanStep, setDailyPlanStep] =
    useState(1);


  const dailyPlanChaptersToday =
    useMemo(() => {

      if (
        source !== 'daily_plan' ||
        !assignedDate
      ) {
        return 1;
      }


      const parts =
        assignedDate
          .split('-')
          .map(Number);


      if (
        parts.length !== 3 ||
        parts.some(
          value =>
            !Number.isFinite(value)
        )
      ) {
        return 1;
      }


      const [
        year,
        month,
        day,
      ] = parts;


      const readingDate =
        new Date(
          year,
          month - 1,
          day,
          12,
          0,
          0
        );


      const weekday =
        readingDate.getDay();


      return (
        weekday === 0 ||
        weekday === 6
      )
        ? 1
        : 2;

    }, [
      source,
      assignedDate,
    ]);


  useEffect(() => {

    if (
      source ===
      'daily_plan'
    ) {
      setDailyPlanStep(1);
    }

  }, [
    source,
    assignedDate,
    requestedBook,
    requestedChapter,
  ]);


  /* BIBLE_RESPONSIVE_READER_V1 */

  const {
    width:
      bibleScreenWidth,

    height:
      bibleScreenHeight,
  } =
    useWindowDimensions();


  const [
    bibleZoom,
    setBibleZoom,
  ] =
    useState(1);


  const [
    bibleAutoFit,
    setBibleAutoFit,
  ] =
    useState(true);


  const bibleLandscape =
    bibleScreenWidth >
    bibleScreenHeight;


  const getBibleFitZoom =
    useCallback(
      () => {

        /*
         * Responsive reading scale.
         * Text continues to reflow instead
         * of overflowing horizontally.
         */

        if (
          bibleScreenWidth <
          340
        ) {
          return 0.88;
        }


        if (
          bibleScreenWidth <
          390
        ) {
          return 0.94;
        }


        if (
          bibleScreenWidth <
          500
        ) {
          return 1;
        }


        if (
          bibleScreenWidth <
          750
        ) {
          return 1.05;
        }


        if (
          bibleScreenWidth <
          1000
        ) {
          return 1.1;
        }


        return 1.15;

      },
      [
        bibleScreenWidth,
      ]
    );


  useEffect(
    () => {

      if (
        !bibleAutoFit
      ) {
        return;
      }


      setBibleZoom(
        getBibleFitZoom()
      );

    },
    [
      bibleScreenWidth,
      bibleScreenHeight,
      bibleAutoFit,
      getBibleFitZoom,
    ]
  );


  const zoomBible =
    (
      direction:
        -1 | 1
    ) => {

      setBibleAutoFit(
        false
      );


      setBibleZoom(
        current => {

          const next =
            current +
            (
              direction *
              0.1
            );


          return Math.min(
            1.4,
            Math.max(
              0.8,
              Number(
                next.toFixed(
                  2
                )
              )
            )
          );

        }
      );

    };


  const fitBibleToScreen =
    () => {

      setBibleAutoFit(
        true
      );


      setBibleZoom(
        getBibleFitZoom()
      );

    };


  const currentBook = useMemo(
    () =>
      books.find(
        x => Number(x.book_no) === bookNo
      ),
    [books, bookNo]
  );


  /* PATCH_153H_5B_CURRENT_TRANSLATION */

  const currentTranslation =
    useMemo(
      () =>
        translations.find(
          item =>
            item.code ===
            translation
        ) ??
        null,
      [
        translations,
        translation,
      ]
    );


  // ==========================================================
  // INITIALIZE
  // Translation + preference + Continue Reading
  // ==========================================================

  const initialize = useCallback(async () => {
    const token = ++initGeneration.current;
    const current = () => token === initGeneration.current;
    setInitializing(true);
    setReaderAvailable(true);
    setReaderError(null);
    setTranslations([]);
    setBooks([]);
    setVerses([]);
    let hasSaved = false;
    try {
      if (!accountId) throw new Error('Sign in to open your saved Bible.');
      const cached = await getOfflineCache<{
        translations: Translation[];
        preferred: string;
        recent: RecentReading | null;
      }>('bible-bootstrap-v1', {userId: accountId, allowStale: true});
      if (!current()) return;
      hasSaved = Boolean(cached?.data?.translations?.length);
      const apply = (available: Translation[], preferred: string, recent: RecentReading | null) => {
        if (!current()) return;
        setTranslations(available);
        let resolved = requestedTranslation || recent?.translation_code || preferred || 'ASD';
        if (!available.some(t => t.code === resolved)) resolved = available[0]?.code ?? 'ASD';
        setTranslation(resolved);
        if (requestedBook > 0) setBookNo(requestedBook);
        else if (source !== 'daily_plan') setBookNo(recent?.book_no || 1);
        if (requestedChapter > 0) setChapterNo(requestedChapter);
        else if (source !== 'daily_plan') setChapterNo(recent?.chapter_no || 1);
        setInitializing(false);
      };
      if (hasSaved && cached?.data) {
        apply(cached.data.translations, cached.data.preferred, cached.data.recent);
      }
      if (!online) {
        if (source === 'daily_plan' && assignedDate && !requestedBook) {
          const plan = await getOfflineCache<{bookNo: number;chapterNo: number}>(
            'bible-daily-plan:' + assignedDate, {userId: accountId, allowStale: true});
          if (!current()) return;
          if (!plan?.data?.bookNo || !plan?.data?.chapterNo) {
            throw new Error('This date\'s Daily Reading has not been saved offline yet.');
          }
          setBookNo(plan.data.bookNo);
          setChapterNo(plan.data.chapterNo);
        }
        if (!hasSaved) throw new Error('No Bible reader data saved on this device. Connect once to download it.');
        return;
      }
      const [translationsResult, preferredResult, recentResult] = await Promise.all([
        (supabase as any).rpc('get_available_bible_translations'),
        (supabase as any).rpc('get_my_preferred_bible_version'),
        (supabase as any).rpc('get_my_recent_bible_reading', { p_limit: 1 }),
      ]);
      if (!current()) return;
      if (translationsResult.error) throw translationsResult.error;
      const available = (translationsResult.data ?? []) as Translation[];
      const preferred = String(preferredResult.data ?? 'ASD').toUpperCase();
      const recent = ((recentResult.data ?? [])[0] ?? null) as RecentReading | null;
      apply(available, preferred, recent);
      void setOfflineCache('bible-bootstrap-v1',
        {translations: available, preferred, recent},
        {userId: accountId, ttlMs: 60 * 24 * 60 * 60 * 1000})
        .catch(() => undefined);
    } catch (error: any) {
      if (!current()) return;
      if (!hasSaved || (!online && source === 'daily_plan' && assignedDate && !requestedBook)) {
        setReaderAvailable(false);
        setReaderError(error?.message ?? 'Bible content is not downloaded for offline use.');
      } else {
        console.warn('Bible bootstrap using saved data:', error);
      }
    } finally {
      if (current()) setInitializing(false);
    }
  }, [requestedBook, requestedChapter, requestedTranslation,
    source, accountId, online, assignedDate]);

  useEffect(() => {
    void initialize();
    return () => { initGeneration.current += 1; };
  }, [initialize]);


  // ==========================================================
  // LOAD BOOKS FOR TRANSLATION
  // ==========================================================
  useEffect(() => {
    if (initializing || !readerAvailable || !translation || !accountId) return;
    let cancelled = false;
    void (async () => {
      const key = 'bible-books-v1:' + translation;
      const cached = await getOfflineCache<BibleBook[]>(key, {
        userId: accountId, allowStale: true,
      });
      if (cancelled) return;
      const saved = Array.isArray(cached?.data) ? cached.data : [];
      if (saved.length) setBooks(saved);
      if (!online) {
        if (!saved.length) {
          setReaderAvailable(false);
          setReaderError('Books for this Bible translation have not been saved offline yet.');
        }
        return;
      }
      try {
        const {data, error} = await (supabase as any).rpc(
          'get_bible_books', {p_translation_code: translation});
        if (error) throw error;
        if (cancelled) return;
        const list = (data ?? []) as BibleBook[];
        if (!list.length) throw new Error('No books for the selected translation.');
        setBooks(list);
        void setOfflineCache(key, list, {
          userId: accountId, ttlMs: 60 * 24 * 60 * 60 * 1000,
        }).catch(() => undefined);
        const selected = list.find(x => Number(x.book_no) === bookNo);
        if (!selected) {
          setBookNo(Number(list[0].book_no));
          setChapterNo(1);
        } else if (chapterNo > Number(selected.chapter_count)) {
          setChapterNo(1);
        }
      } catch (error: any) {
        if (cancelled || saved.length) return;
        setReaderAvailable(false);
        setReaderError(error?.message ?? 'Unable to load Bible books.');
      }
    })();
    return () => { cancelled = true; };
  }, [initializing, readerAvailable, translation,
      accountId, online, bookNo, chapterNo]);


  // ==========================================================
  // LOAD CHAPTER + START READING SESSION
  // ==========================================================

  useEffect(() => {
    if (
      initializing ||
      !readerAvailable ||
      !translation ||
      !books.length
    ) {
      return;
    }


    let cancelled = false;


    const run = async () => {
      const keepVisible =
        bibleNarrationStatusRef.current ===
          'playing' ||
        bibleNarrationStatusRef.current ===
          'paused' ||
        bibleNarrationStatusRef.current ===
          'loading';

      setChapterLoading(!keepVisible);
      setCompleted(false);
      setSessionId(null);
      let hasCachedChapter = false;

      try {
        const cacheKey = 'bible-chapter-v1:' + translation + ':' + bookNo + ':' + chapterNo;
        const cached = await getOfflineCache<BibleVerse[]>(cacheKey, {
          userId: accountId, allowStale: true,
        });
        if (cancelled) return;
        hasCachedChapter = Boolean(cached?.data?.length);
        if (hasCachedChapter) {
          setVerses(cached!.data);
          setChapterLoading(false);
        }
        // Reading offline never creates a server reading session or awards points.
        if (!online) {
          if (!hasCachedChapter) throw new Error('This Bible chapter is not saved on this device.');
          return;
        }

        const {
          data,
          error,
        } =
          await (supabase as any).rpc(
            'get_bible_chapter',
            {
              p_translation_code:
                translation,

              p_book_no:
                bookNo,

              p_chapter_no:
                chapterNo,
            }
          );


        if (error) throw error;

        if (cancelled) return;


        const chapter =
          (
            data ??
            []
          ) as BibleVerse[];


        setVerses(chapter);
        if (chapter.length) {
          void setOfflineCache(cacheKey, chapter, {
            userId: accountId, ttlMs: 90 * 24 * 60 * 60 * 1000,
          }).catch(() => undefined);
        }

        if (cancelled) return;

        if (
          pendingNarrationPlayRef.current &&
          chapter.length
        ) {
          pendingNarrationPlayRef.current =
            false;

          const playingBook =
            books.find(
              (item) =>
                Number(item.book_no) ===
                bookNo
            );

          void playBibleNarration({
            translation,
            language:
              translation === 'ASD'
                ? 'fil-PH'
                : 'en-US',
            bookNo,
            bookName:
              String(
                playingBook?.book_name ??
                  'Bible'
              ),
            chapterNo,
            verses:
              mapBibleChapterRows(
                chapter,
                {
                  bookNo,
                  bookName:
                    playingBook?.book_name,
                  chapterNo,
                }
              ),
            startVerseNo: 1,
            books,
            continueNextBook: true,
          });
        }


        if (!chapter.length) {
          return;
        }


        const sessionResult =
          await (supabase as any).rpc(
            'start_bible_reading_session',
            {
              p_translation_code:
                translation,

              p_book_no:
                bookNo,

              p_chapter_no:
                chapterNo,

              p_source:
                source,
            }
          );


        if (
          !cancelled &&
          !sessionResult.error &&
          sessionResult.data
        ) {
          setSessionId(
            String(
              sessionResult.data
            )
          );
        }

      } catch (e: any) {
        if (cancelled) return;

        if (!hasCachedChapter) {
          setVerses([]);
          Alert.alert('Bible Reader', e?.message ?? 'Unable to load this chapter.');
        } else {
          console.warn('Bible Reader: using saved chapter after network failure');
        }

      } finally {
        if (!cancelled) {
          setChapterLoading(false);
        }
      }
    };


    run();


    return () => {
      cancelled = true;
    };

  }, [
    initializing,
    readerAvailable,
    translation,
    accountId,
    online,
    bookNo,
    chapterNo,
    source,
    books.length,
    playBibleNarration,
  ]);


  // ==========================================================
  // TRANSLATION
  // ==========================================================

  const changeTranslation =
    async (
      nextCode: string
    ) => {

      if (
        nextCode === translation
      ) {
        return;
      }


      setTranslation(nextCode);
      setCompleted(false);


      const { error } =
        await (supabase as any).rpc(
          'set_my_preferred_bible_version',
          {
            p_translation_code:
              nextCode,
          }
        );


      if (error) {
        console.warn(
          'Could not save preferred Bible version:',
          error.message
        );
      }
    };


  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const selectBook =
    (
      nextBook: BibleBook
    ) => {

      setBookNo(
        Number(
          nextBook.book_no
        )
      );

      setChapterNo(1);

      setPassageVerseNo(
        null
      );

      setShowVersePicker(
        false
      );

      setShowBooks(false);
      setShowChapters(true);
    };


  const selectChapter =
    (
      nextChapter: number
    ) => {
      markUserBibleChapterChange();

      setChapterNo(nextChapter);

      setPassageVerseNo(
        null
      );

      setShowVersePicker(
        false
      );
      setShowChapters(false);
    };




  /* ========================================================
     MY BIBLE VERSE SELECT
  ======================================================== */

  const selectPassageVerse =
    (
      verseNo: number
    ) => {

      setPassageVerseNo(
        verseNo
      );

      setShowVersePicker(
        false
      );

    };


  /* ========================================================
     FOLLOW CONTINUOUS NARRATION

     The playback engine lives above this screen so
     scrolling and chapter reloads cannot stop audio.
     The reader follows the current book/chapter/verse.
  ======================================================== */

  useEffect(
    () => {
      if (
        bibleNarration.status !==
          'playing' &&
        bibleNarration.status !==
          'loading'
      ) {
        return;
      }

      if (
        bibleNarration.translation &&
        bibleNarration.translation !==
          translation
      ) {
        return;
      }

      if (userChapterPickRef.current) {
        if (
          bibleNarration.bookNo ===
            bookNo &&
          bibleNarration.chapterNo ===
            chapterNo
        ) {
          userChapterPickRef.current =
            false;
        }
        return;
      }

      if (
        bibleNarration.bookNo > 0 &&
        bibleNarration.bookNo !==
          bookNo
      ) {
        setBookNo(
          bibleNarration.bookNo
        );
      }

      if (
        bibleNarration.chapterNo > 0 &&
        bibleNarration.chapterNo !==
          chapterNo
      ) {
        setChapterNo(
          bibleNarration.chapterNo
        );
      }

      if (
        bibleNarration.verseNo > 0
      ) {
        setPassageVerseNo(
          bibleNarration.verseNo
        );
      }
    },
    [
      bibleNarration.status,
      bibleNarration.translation,
      bibleNarration.bookNo,
      bibleNarration.chapterNo,
      bibleNarration.verseNo,
      translation,
      bookNo,
      chapterNo,
    ]
  );


  const moveChapter =
    (
      direction: -1 | 1
    ) => {

      if (!currentBook) {
        return;
      }

      markUserBibleChapterChange();


      if (direction === -1) {
        if (chapterNo > 1) {
          setChapterNo(
            chapterNo - 1
          );

          return;
        }


        const previousBook =
          books.find(
            x =>
              Number(x.book_no) ===
              bookNo - 1
          );


        if (!previousBook) {
          return;
        }


        setBookNo(
          Number(
            previousBook.book_no
          )
        );

        setChapterNo(
          Number(
            previousBook.chapter_count
          )
        );

        return;
      }


      if (
        chapterNo <
        Number(
          currentBook.chapter_count
        )
      ) {
        setChapterNo(
          chapterNo + 1
        );

        return;
      }


      const nextBook =
        books.find(
          x =>
            Number(x.book_no) ===
            bookNo + 1
        );


      if (!nextBook) {
        return;
      }


      setBookNo(
        Number(
          nextBook.book_no
        )
      );

      setChapterNo(1);
    };


  /* PATCH_153H_4C_DAILY_NAV */

  const goNextAssignedChapter =
    () => {

      if (
        source !== 'daily_plan' ||
        dailyPlanChaptersToday < 2 ||
        dailyPlanStep >=
          dailyPlanChaptersToday
      ) {
        return;
      }


      /*
       * Automatic Daily Plan chapters are
       * consecutive canonical chapters.
       *
       * moveChapter(1) already handles:
       * - next chapter in same book
       * - crossing into next Bible book
       */
      setDailyPlanStep(
        dailyPlanStep + 1
      );

      setCompleted(false);

      moveChapter(1);
    };


  const continueToReflection =
    () => {

      if (assignedDate) {

        router.replace({
          pathname:
            '/bible',

          params: {
            date:
              assignedDate,
          },
        });

        return;
      }


      router.replace('/bible');
    };


  const hasNextAssignedChapter =
    source === 'daily_plan' &&
    dailyPlanChaptersToday > 1 &&
    dailyPlanStep <
      dailyPlanChaptersToday;


  // ==========================================================
  // COMPLETE CHAPTER
  // ==========================================================

  const markRead =
    async () => {

      if (
        completed ||
        marking
      ) {
        return;
      }


      if (!sessionId) {
        Alert.alert(
          'Bible Reading',
          'Reading session is not ready yet.'
        );

        return;
      }


      
      /* DAILY_BIBLE_REFLECTION_SUBMISSION_GATE_V2 */
      if (source === 'daily_plan') {

        if (!dailyAssignmentId) {

          Alert.alert(
            'Reflection Required',
            'Return to Daily Bible Reading and submit the questions and Personal Reflection first.'
          );

          return;
        }

        const {
          data:authData,
          error:authError
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !authData?.user?.id
        ) {

          Alert.alert(
            'Daily Bible Reading',
            'Unable to verify your account.'
          );

          return;
        }

        const {
          data:dailySubmission,
          error:submissionError
        } =
          await (supabase as any)
            .from(
              'daily_bible_submissions'
            )
            .select(
              'id,status,answer_text'
            )
            .eq(
              'assignment_id',
              dailyAssignmentId
            )
            .eq(
              'user_id',
              authData.user.id
            )
            .maybeSingle();

        if(submissionError){

          Alert.alert(
            'Daily Bible Reading',
            submissionError.message ??
              'Unable to verify your Daily Bible submission.'
          );

          return;
        }

        const hasSubmittedReflection =
          !!dailySubmission?.id &&
          String(
            dailySubmission?.answer_text ??
            ''
          ).trim().length >= 20;

        if(!hasSubmittedReflection){

          Alert.alert(
            'SUBMIT REFLECTION FIRST',
            'This chapter cannot be added to your Bible Reading Report yet. Answer the Daily Bible questions and submit your Personal Reflection first.'
          );

          return;
        }
      }


setMarking(true);


      try {
        const lastVerse =
          verses.length
            ? Number(
                verses[
                  verses.length - 1
                ].verse_no
              )
            : null;


        const { error } =
          await (supabase as any).rpc(
            'complete_bible_reading_session',
            {
              p_session_id:
                sessionId,

              p_last_verse_no:
                lastVerse,
            }
          );


        if (error) throw error;


        setCompleted(true);


        Alert.alert(
          'Chapter Completed',
          `${currentBook?.book_name ?? 'Bible'} ${chapterNo} was added to your Bible Reading Report.`
        );

      } catch (e: any) {
        Alert.alert(
          'Bible Reading',
          e?.message ??
            'Unable to mark this chapter as read.'
        );

      } finally {
        setMarking(false);
      }
    };


  // ==========================================================
  // RENDER
  // ==========================================================

  if (initializing) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={[
            shared.muted,
            {
              marginTop: 12,
            },
          ]}
        >
          Loading Bible...
        </Text>
      </View>
    );
  }


  if (!readerAvailable) {
    return (
      <ScrollView
        style={shared.screen}
        contentContainerStyle={[
          shared.content,
          styles.content,
        ]}
      >
      <BuklodOccasionalAd placement="bible" />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={shared.h1}>
              Bible
            </Text>

            <Text style={shared.muted}>
              Full Bible Reader
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.back()
            }
            style={styles.outline}
          >
            <Text
              style={
                styles.outlineText
              }
            >
              BACK
            </Text>
          </Pressable>
        </View>


        <Card>
          <Text style={shared.h2}>
            Bible Reader Not Yet Deployed
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 8,
                lineHeight: 19,
              },
            ]}
          >
            {readerError ??
              'The Bible reader database functions are not available yet.'}
          </Text>
        </Card>
      </ScrollView>
    );
  }



  /* ==========================================================
     DAILY_DEVOTION_FOCUSED_READING_V1

     Daily Devotion is intentionally different from MY BIBLE.

     DAILY:
     - assigned Scripture immediately
     - no quick chapter search
     - no word search
     - no book/chapter browser
     - no annotations
     - Respond after reading

     MY BIBLE keeps the full navigation tools.
  ========================================================== */

  if (source === 'daily_plan') {

    const dailyReference =
      (
        currentBook?.book_name ??
        'Bible'
      ) +
      ' ' +
      chapterNo;


    const openRespond =
      () => {

        if (assignedDate) {

          router.replace({
            pathname:
              '/bible',

            params: {
              date:
                assignedDate,

              mode:
                'respond',
            },
          } as any);

          return;
        }


        router.replace(
          '/bible' as any
        );

      };


    return (
      <ScrollView
        style={
          shared.screen
        }
        contentContainerStyle={[
          shared.content,
          styles.content,
          {
            paddingBottom:
              48,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* ================================================
            HEADER
        ================================================= */}

        <View
          style={
            styles.header
          }
        >

          <View
            style={{
              flex:
                1,
            }}
          >

            <Text
              style={[
                shared.muted,
                {
                  fontSize:
                    9,

                  fontWeight:
                    '900',

                  letterSpacing:
                    0.8,

                  color:
                    '#275D45',
                },
              ]}
            >
              DAILY DEVOTION
            </Text>


            <Text
              style={[
                shared.h1,
                {
                  marginTop:
                    3,
                },
              ]}
            >
              Today's Reading
            </Text>


            <Text
              style={[
                shared.muted,
                {
                  marginTop:
                    3,

                  fontSize:
                    13,

                  fontWeight:
                    '800',
                },
              ]}
            >
              {dailyReference}
            </Text>

          </View>


          <Pressable
            onPress={() =>
              router.back()
            }
            style={
              styles.outline
            }
          >
            <Text
              style={{
                fontWeight:
                  '900',

                color:
                  '#275D45',
              }}
            >
              BACK
            </Text>
          </Pressable>

        </View>


        {/* ================================================
            READING STATUS
        ================================================= */}

        {dailyPlanChaptersToday > 1 && (

          <View
            style={{
              marginTop:
                10,

              marginBottom:
                4,

              paddingHorizontal:
                12,

              paddingVertical:
                9,

              borderRadius:
                12,

              backgroundColor:
                '#F2F6F3',

              borderWidth:
                1,

              borderColor:
                '#D8E2DC',
            }}
          >

            <Text
              style={{
                fontSize:
                  10,

                fontWeight:
                  '900',

                color:
                  '#275D45',
              }}
            >
              READING {dailyPlanStep} OF {dailyPlanChaptersToday}
            </Text>

          </View>

        )}


        {/* ================================================
            READING — VERSES IMMEDIATELY
        ================================================= */}

        <Text
          style={{
            marginTop:
              15,

            marginBottom:
              8,

            fontSize:
              10,

            fontWeight:
              '900',

            letterSpacing:
              0.8,

            color:
              '#275D45',
          }}
        >
          READING
        </Text>


        <Card>

          <View
            style={{
              marginBottom:
                12,

              paddingBottom:
                10,

              borderBottomWidth:
                1,

              borderBottomColor:
                '#E1E7E3',
            }}
          >

            <Text
              style={
                styles.reference
              }
            >
              {dailyReference}
            </Text>


            <Text
              style={[
                shared.muted,
                {
                  marginTop:
                    3,

                  fontSize:
                    9,
                },
              ]}
            >
              {translation}
            </Text>

          </View>


          
          {/* DAILY_DEVOTION_VOICE_READER_V1 */}

          <View
            style={{
              marginBottom: 14,
            }}
          >
            <BuklodBibleNarrationBar
            key={`${translation}:${bookNo}:${chapterNo}`}
              title="Listen to today's reading"
              subtitle="One play continues verse by verse, then to the next chapter, until you stop."
              translation={translation}
              language={
                translation === 'ASD'
                  ? 'fil-PH'
                  : 'en-US'
              }
              bookNo={bookNo}
              bookName={
                currentBook?.book_name ??
                'Bible'
              }
              chapterNo={chapterNo}
              verses={mapBibleChapterRows(
                verses,
                {
                  bookNo,
                  bookName:
                    currentBook?.book_name,
                  chapterNo,
                }
              )}
              startVerseNo={passageVerseNo}
              books={books}
              continueNextBook
              disabled={verses.length === 0}
            />
          </View>


{chapterLoading ? (

            <View
              style={{
                minHeight:
                  160,

                alignItems:
                  'center',

                justifyContent:
                  'center',
              }}
            >

              <ActivityIndicator
                size="large"
              />

              <Text
                style={[
                  shared.muted,
                  {
                    marginTop:
                      10,
                  },
                ]}
              >
                Loading today's Scripture...
              </Text>

            </View>

          ) : verses.length === 0 ? (

            <Text
              style={[
                shared.muted,
                {
                  paddingVertical:
                    25,

                  textAlign:
                    'center',
                },
              ]}
            >
              Today's Scripture is not available yet.
            </Text>

          ) : (

            <View
              style={
                styles.verseList
              }
            >

              {verses.map(
                verse => {

                  const cleanText =
                    String(
                      repairMojibakeText(verse.verse_text) ??
                      ''
                    )
                      .replace(
                        /^\u00B6\s*/,
                        ''
                      )
                      .trim();


                  const listeningVerse =
                    bibleNarration.status !==
                      'idle' &&
                    bibleNarration.translation ===
                      translation &&
                    Number(
                      bibleNarration.bookNo
                    ) ===
                      Number(bookNo) &&
                    Number(
                      bibleNarration.chapterNo
                    ) ===
                      Number(chapterNo) &&
                    Number(
                      bibleNarration.verseNo
                    ) ===
                      Number(
                        verse.verse_no
                      );


                  return (
                    <View
                      key={
                        verse.verse_no
                      }
                      style={[
                        styles.verseRow,
                        listeningVerse &&
                          styles.focusVerse,
                      ]}
                    >

                      <Text
                        style={[
                          styles.verseNumber,
                          {
                            fontSize:
                              13,
                          },
                        ]}
                      >
                        {
                          verse.verse_no
                        }
                      </Text>


                      <Text
                        selectable
                        style={[
                          styles.verseText,
                          {
                            fontSize:
                              17,

                            lineHeight:
                              27,
                          },
                        ]}
                      >
                        {cleanText}
                      </Text>

                    </View>
                  );

                }
              )}

            </View>

          )}

        </Card>


        {/* ================================================
            DAILY FLOW
        ================================================= */}

        {!chapterLoading &&
          verses.length > 0 && (

          <View
            style={{
              marginTop:
                14,
            }}
          >

            {hasNextAssignedChapter ? (

              <Pressable
                onPress={
                  goNextAssignedChapter
                }
                style={({
                  pressed,
                }) => ({
                  minHeight:
                    52,

                  borderRadius:
                    14,

                  borderWidth:
                    1,

                  borderColor:
                    '#BCD0C4',

                  backgroundColor:
                    '#F4F8F5',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  paddingHorizontal:
                    15,

                  opacity:
                    pressed
                      ? 0.75
                      : 1,
                })}
              >

                <Text
                  style={{
                    fontSize:
                      11,

                    fontWeight:
                      '900',

                    letterSpacing:
                      0.4,

                    color:
                      '#275D45',
                  }}
                >
                  NEXT READING
                </Text>

              </Pressable>

            ) : (

              <Pressable
                onPress={
                  openRespond
                }
                style={({
                  pressed,
                }) => ({
                  minHeight:
                    56,

                  borderRadius:
                    15,

                  backgroundColor:
                    '#275D45',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  paddingHorizontal:
                    16,

                  opacity:
                    pressed
                      ? 0.78
                      : 1,
                })}
              >

                <Text
                  style={{
                    fontSize:
                      13,

                    fontWeight:
                      '900',

                    letterSpacing:
                      0.6,

                    color:
                      '#FFFFFF',
                  }}
                >
                  RESPOND
                </Text>


                <Text
                  style={{
                    marginTop:
                      3,

                    fontSize:
                      8.5,

                    color:
                      '#DDEAE3',
                  }}
                >
                  Questions + Personal Reflection
                </Text>

              </Pressable>

            )}

          </View>

        )}

      </ScrollView>
    );

  }


  return (
    <ScrollView
      style={
        shared.screen
      }
      contentContainerStyle={[
        shared.content,
        styles.content,
        {
          width:
            '100%',

          alignSelf:
            'center',

          paddingHorizontal:
            bibleLandscape
              ? 22
              : 16,
        },
      ]}
    >
      {isMyBibleMode && (
        <MyBibleQuickNavigator
          books={books}
          bookNo={bookNo}
          chapterNo={chapterNo}
          currentBook={currentBook}
          verseNumbers={verses.map(verse => Number(verse.verse_no))}
          selectedVerse={passageVerseNo}
          translation={translation}
          translations={translations}
          onSelectBook={book => { markUserBibleChapterChange(); selectBook(book); }}
          onSelectChapter={selectChapter}
          onSelectVerse={selectPassageVerse}
          onClearVerse={() => setPassageVerseNo(null)}
          onTranslation={changeTranslation}
          onPrevious={() => moveChapter(-1)}
          onNext={() => moveChapter(1)}
          onSearch={() => router.push('/bible/search')}
          onReport={() => router.push('/bible/report')}
        />
      )}
      {!isMyBibleMode && (
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>
            Bible
          </Text>

          <Text style={shared.muted}>
            Read God's Word anytime.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.outline}
        >
          <Text
            style={
              styles.outlineText
            }
          >
            BACK
          </Text>
        </Pressable>
      </View>
      )}

      {/* =====================================================
          TRANSLATION
      ====================================================== */}

      {!isMyBibleMode && (
      <Card>
      {/* MY_BIBLE_MODE_HEADER_V1 */}

      <View
        style={{
          marginBottom:12,
          borderRadius:17,
          borderWidth:1,
          borderColor:colors.line,
          backgroundColor:
            isMyBibleMode
              ? '#F4FAF6'
              : isDailyReadingMode
                ? '#FFF9EE'
                : '#F7F9F8',
          paddingHorizontal:13,
          paddingVertical:12
        }}
      >

        <Text
          style={{
            fontSize:10,
            fontWeight:'900',
            letterSpacing:.8,
            color:colors.greenDark
          }}
        >
          {
            isMyBibleMode
              ? 'MY BIBLE'
              : isDailyReadingMode
                ? "TODAY'S DAILY READING"
                : 'BIBLE READER'
          }
        </Text>


        <Text
          style={{
            marginTop:4,
            fontSize:18,
            lineHeight:23,
            fontWeight:'900',
            color:colors.text
          }}
        >
          {
            isMyBibleMode
              ? 'Read. Search. Study.'
              : isDailyReadingMode
                ? (
                    (currentBook?.book_name ?? 'Bible') +
                    ' ' +
                    chapterNo
                  )
                : (
                    (currentBook?.book_name ?? 'Bible') +
                    ' ' +
                    chapterNo
                  )
          }
        </Text>


        <Text
          style={{
            marginTop:4,
            fontSize:10,
            lineHeight:15,
            color:colors.muted
          }}
        >
          {
            isMyBibleMode
              ? 'Quick access to every book, chapter, verse, highlight, and personal note.'
              : isDailyReadingMode
                ? 'Focus on today?s assigned reading. Complete the guided reading before moving forward.'
                : 'Read the selected Bible passage.'
          }
        </Text>

      </View>


        <Text style={styles.eyebrow}>
          BIBLE VERSION
        </Text>

        <View
          style={
            styles.translationRow
          }
        >
          {translations.map(
            item => {

              const active =
                item.code ===
                translation;


              return (
                <Pressable
                  key={
                    item.code
                  }
                  onPress={() =>
                    changeTranslation(
                      item.code
                    )
                  }
                  style={[
                    styles.translation,
                    active &&
                      styles.translationActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.translationCode,
                      active &&
                        styles.white,
                    ]}
                  >
                    {
                      item.code
                    }
                  </Text>

                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.translationName,
                      active &&
                        styles.translationNameActive,
                    ]}
                  >
                    {
                      item.short_title
                    }
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>


        <Text
          style={styles.license}
        >
          {
            currentTranslation?.license_name ??
            'Bible text license'
          }
        </Text>
      </Card>
      )}

      {/* =====================================================
          BOOK + CHAPTER
      ====================================================== */}

      {!isMyBibleMode && (
      <>
      {/* PATCH_153H_3C_REPORT_LINK */}
      {isMyBibleMode && (
        <>
      <Pressable
        onPress={() =>
          router.push('/bible/report')
        }
        style={styles.reportLaunch}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.reportLaunchEyebrow}>
            MY BIBLE REPORT
          </Text>

          <Text style={styles.reportLaunchTitle}>
            Reading Progress
          </Text>

          <Text style={styles.reportLaunchBody}>
            View your reading streak, completed chapters, recent history, and personal Bible activity.
          </Text>
        </View>

        <Text style={styles.reportLaunchArrow}>
          {'VIEW >'}
        </Text>
      </Pressable>
        </>
      )}


      {/* PATCH_153H_3B_SEARCH_LINK */}
      {isMyBibleMode && (
        <>
      <Pressable
        onPress={() => router.push('/bible/search')}
        style={styles.searchLaunch}
      >
        <View style={{flex:1}}>
          <Text style={styles.searchLaunchEyebrow}>
            BIBLE SEARCH
          </Text>

          <Text style={styles.searchLaunchTitle}>
            Search God's Word
          </Text>

          <Text style={styles.searchLaunchBody}>
            Search any word or phrase in ASD or KJV and open the exact Bible verse.
          </Text>
        </View>

        <Text style={styles.searchLaunchArrow}>
          {'SEARCH >'}
        </Text>
      </Pressable>
        </>
      )}

      {/* MY_BIBLE_FULL_NAVIGATION_V1 */}
      {isMyBibleMode && (
        <>
      <SectionTitle>
        SELECT PASSAGE
      </SectionTitle>


        </>
      )}


      {/* =====================================================
          MY_BIBLE_CHAPTER_SEARCH_V1
      ====================================================== */}

      <View
        style={{
          marginBottom:
            10,

          padding:
            10,

          borderWidth:
            1,

          borderColor:
            colors.line,

          borderRadius:
            14,

          backgroundColor:
            '#F7FBF8',
        }}
      >

        <Text
          style={{
            marginBottom:
              6,

            fontSize:
              9,

            fontWeight:
              '900',

            letterSpacing:
              0.7,

            color:
              colors.greenDark,
          }}
        >
          QUICK CHAPTER SEARCH
        </Text>


        <View
          style={{
            flexDirection:
              'row',

            alignItems:
              'center',

            gap:
              7,
          }}
        >

          <TextInput
            value={
              chapterQuery
            }
            onChangeText={
              setChapterQuery
            }
            onSubmitEditing={
              searchBibleChapter
            }
            returnKeyType="search"
            autoCorrect={
              false
            }
            placeholder="Juan 3 / John 3"
            placeholderTextColor="#89958F"
            style={{
              flex:
                1,

              minHeight:
                42,

              borderWidth:
                1,

              borderColor:
                '#CBD8D1',

              borderRadius:
                11,

              backgroundColor:
                '#FFFFFF',

              paddingHorizontal:
                11,

              fontSize:
                14,

              color:
                colors.text,
            }}
          />


          <Pressable
            onPress={
              searchBibleChapter
            }
            style={({
              pressed,
            }) => ({
              minWidth:
                48,

              minHeight:
                42,

              paddingHorizontal:
                10,

              borderRadius:
                11,

              backgroundColor:
                colors.greenDark,

              alignItems:
                'center',

              justifyContent:
                'center',

              opacity:
                pressed
                  ? 0.75
                  : 1,
            })}
          >
            <Text
              style={{
                fontSize:
                  10,

                fontWeight:
                  '900',

                color:
                  '#FFFFFF',
              }}
            >
              GO
            </Text>
          </Pressable>

        </View>


        <Pressable
          onPress={() =>
            router.push(
              '/bible/search'
            )
          }
          style={({
            pressed,
          }) => ({
            marginTop:
              7,

            minHeight:
              34,

            borderRadius:
              10,

            borderWidth:
              1,

            borderColor:
              '#CBD8D1',

            backgroundColor:
              '#FFFFFF',

            alignItems:
              'center',

            justifyContent:
              'center',

            opacity:
              pressed
                ? 0.7
                : 1,
          })}
        >
          <Text
            style={{
              fontSize:
                9,

              fontWeight:
                '900',

              letterSpacing:
                0.4,

              color:
                colors.greenDark,
            }}
          >
            SEARCH WORD / PHRASE
          </Text>
        </Pressable>

      </View>





      <Card>
        <View style={styles.selectorRow}>
          <Pressable
            onPress={() => {
              setShowBooks(
                v => !v
              );

              setShowChapters(
                false
              );

              setShowVersePicker(
                false
              );
            }}
            style={
              styles.selector
            }
          >
            <Text
              style={
                styles.selectorLabel
              }
            >
              BOOK
            </Text>

            <Text
              style={
                styles.selectorValue
              }
            >
              {
                currentBook?.book_name ??
                'Select Book'
              }
            </Text>
          </Pressable>


          <Pressable
            onPress={() => {
              setShowChapters(
                v => !v
              );

              setShowBooks(
                false
              );
              
              setShowVersePicker(
                false
              );
            }}
            style={
              styles.selector
            }
          >
            <Text
              style={
                styles.selectorLabel
              }
            >
              CHAPTER
            </Text>

            <Text
              style={
                styles.selectorValue
              }
            >
              {chapterNo}
            </Text>
          </Pressable>


          {/* MY_BIBLE_VERSE_SELECTOR_FINAL_V2 */}

          <Pressable
            onPress={() => {

              setShowVersePicker(
                value =>
                  !value
              );

              setShowBooks(
                false
              );

              setShowChapters(
                false
              );

            }}
            style={
              styles.selector
            }
          >

            <Text
              style={
                styles.selectorLabel
              }
            >
              VERSE
            </Text>


            <Text
              style={
                styles.selectorValue
              }
            >
              {
                passageVerseNo ??
                'ALL'
              }
            </Text>

          </Pressable>

        </View>


        {showBooks && (
          <View
            style={styles.bookGrid}
          >
            {books.map(
              book => (
                <Pressable
                  key={
                    book.book_no
                  }
                  onPress={() =>
                    selectBook(
                      book
                    )
                  }
                  style={[
                    styles.bookButton,
                    Number(
                      book.book_no
                    ) ===
                      bookNo &&
                      styles.bookButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.bookButtonText,
                      Number(
                        book.book_no
                      ) ===
                        bookNo &&
                        styles.white,
                    ]}
                  >
                    {
                      book.book_name
                    }
                  </Text>
                </Pressable>
              )
            )}
          </View>
        )}


        {showChapters &&
          currentBook && (
            <View
              style={
                styles.chapterGrid
              }
            >
              {Array.from(
                {
                  length:
                    Number(
                      currentBook.chapter_count
                    ),
                },
                (_, index) =>
                  index + 1
              ).map(
                chapter => (
                  <Pressable
                    key={
                      chapter
                    }
                    onPress={() =>
                      selectChapter(
                        chapter
                      )
                    }
                    style={[
                      styles.chapterButton,
                      chapter ===
                        chapterNo &&
                        styles.chapterButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chapterButtonText,
                        chapter ===
                          chapterNo &&
                          styles.white,
                      ]}
                    >
                      {
                        chapter
                      }
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}
      

        {/* MY_BIBLE_VERSE_GRID_FINAL_V2 */}

        {showVersePicker &&
          verses.length > 0 && (

          <View
            style={
              styles.chapterGrid
            }
          >

            {verses.map(
              verse => {

                const verseNo =
                  Number(
                    verse.verse_no
                  );


                const active =
                  passageVerseNo ===
                  verseNo;


                return (

                  <Pressable
                    key={
                      'verse-' +
                      verseNo
                    }

                    onPress={() =>
                      selectPassageVerse(
                        verseNo
                      )
                    }

                    style={[
                      styles.chapterButton,

                      active &&
                        styles.chapterButtonActive,
                    ]}
                  >

                    <Text
                      style={[
                        styles.chapterButtonText,

                        active &&
                          styles.white,
                      ]}
                    >
                      {verseNo}
                    </Text>

                  </Pressable>

                );

              }
            )}

          </View>

        )}

</Card>
      </>
      )}

      {/* =====================================================
          CHAPTER
      ====================================================== */}

      {!isMyBibleMode && <SectionTitle>READING</SectionTitle>}


      <Card>
        <View
          style={
            styles.readingHeader
          }
        >
          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.reference
              }
            >
              {
                currentBook?.book_name ??
                'Bible'
              }{' '}
              {chapterNo}
            </Text>

            <Text
              style={
                styles.versionMeta
              }
            >
              {
                translations.find(
                  x =>
                    x.code ===
                    translation
                )?.short_title ??
                translation
              }
            </Text>
          </View>

          {(isMyBibleMode ? passageVerseNo !== null : requestedVerse > 0) && (
            <View
              style={
                styles.verseBadge
              }
            >
              <Text
                style={
                  styles.verseBadgeText
                }
              >
                VERSE{' '}
                {isMyBibleMode ? passageVerseNo : requestedVerse}
              </Text>
            </View>
          )}
        </View>


        {isMyBibleMode && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => setShowBibleAudio(value => !value)}
              style={{ paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#EDF5F0' }}>
              <Text style={{ color: '#275D45', fontWeight: '800', fontSize: 12 }}>
                {showBibleAudio ? 'Itago ang audio' : '▶ Pakinggan'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowBibleTextSettings(value => !value)}
              style={{ paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#EDF5F0' }}>
              <Text style={{ color: '#275D45', fontWeight: '800', fontSize: 12 }}>Aa  Laki ng teksto</Text>
            </Pressable>
          </View>
        )}
        {(!isMyBibleMode || showBibleAudio || bibleNarration.status !== 'idle') && (
        <View
          style={{
            marginBottom: 14,
          }}
        >
          <BuklodBibleNarrationBar
            key={`${translation}:${bookNo}:${chapterNo}`}
            title="Listen to this chapter"
            subtitle="One play continues verse by verse, then to the next chapter, until you stop."
            translation={translation}
            language={
              translation === 'ASD'
                ? 'fil-PH'
                : 'en-US'
            }
            bookNo={bookNo}
            bookName={
              currentBook?.book_name ??
              'Bible'
            }
            chapterNo={chapterNo}
            verses={mapBibleChapterRows(
              verses,
              {
                bookNo,
                bookName:
                  currentBook?.book_name,
                chapterNo,
              }
            )}
            startVerseNo={passageVerseNo}
            books={books}
            continueNextBook
            disabled={verses.length === 0}
          />
        </View>
        )}

        {/* BIBLE RESPONSIVE VIEW CONTROLS */}

        {(!isMyBibleMode || showBibleTextSettings) && !chapterLoading &&
          verses.length > 0 && (

          <View
            style={
              styles.bibleViewToolbar
            }
          >

            <View
              style={{
                flex:
                  1,
              }}
            >

              <Text
                style={
                  styles.bibleViewLabel
                }
              >
                READING VIEW
              </Text>


              <Text
                style={
                  styles.bibleViewHint
                }
              >
                {
                  bibleLandscape
                    ? 'LANDSCAPE'
                    : 'PORTRAIT'
                }
                {'  ?  '}
                {
                  bibleAutoFit
                    ? 'AUTO FIT'
                    : 'MANUAL ZOOM'
                }
              </Text>

            </View>


            <View
              style={
                styles.bibleZoomControls
              }
            >

              <Pressable
                onPress={() =>
                  zoomBible(-1)
                }
                style={
                  styles.bibleZoomButton
                }
              >
                <Text
                  style={
                    styles.bibleZoomButtonText
                  }
                >
                  A?
                </Text>
              </Pressable>


              <Pressable
                onPress={
                  fitBibleToScreen
                }
                style={[
                  styles.bibleFitButton,

                  bibleAutoFit &&
                    styles.bibleFitButtonOn,
                ]}
              >

                <Text
                  style={[
                    styles.bibleFitPercent,

                    bibleAutoFit &&
                      styles.bibleFitTextOn,
                  ]}
                >
                  {
                    Math.round(
                      bibleZoom *
                      100
                    )
                  }%
                </Text>


                <Text
                  style={[
                    styles.bibleFitText,

                    bibleAutoFit &&
                      styles.bibleFitTextOn,
                  ]}
                >
                  FIT
                </Text>

              </Pressable>


              <Pressable
                onPress={() =>
                  zoomBible(1)
                }
                style={
                  styles.bibleZoomButton
                }
              >
                <Text
                  style={
                    styles.bibleZoomButtonText
                  }
                >
                  A+
                </Text>
              </Pressable>

            </View>

          </View>

        )}


        {chapterLoading ? (
          <View
            style={
              styles.chapterLoading
            }
          >
            <ActivityIndicator />

            <Text
              style={[
                shared.muted,
                {
                  marginTop: 8,
                },
              ]}
            >
              Loading chapter...
            </Text>
          </View>

        ) : !verses.length ? (
          <View
            style={
              styles.chapterLoading
            }
          >
            <Text
              style={shared.h2}
            >
              Chapter unavailable
            </Text>

            <Text
              style={[
                shared.muted,
                {
                  marginTop: 7,
                  textAlign:
                    'center',
                },
              ]}
            >
              This translation has no imported text for this chapter yet.
            </Text>
          </View>

        ) : (
          <View
            style={
              styles.verseList
            }
          >
            {verses.map(
              verse => {

                const focusVerseNo =
                  isMyBibleMode
                    ? passageVerseNo
                    : passageVerseNo ?? (requestedVerse > 0 ? requestedVerse : null);


                const focused =
                  focusVerseNo !==
                    null &&
                  Number(
                    verse.verse_no
                  ) ===
                    focusVerseNo;


                const cleanText =
                  String(
                    repairMojibakeText(verse.verse_text)
                  )
                    .replace(/^\u00B6\s*/, '').trim();



                const annotation =
                  bibleAnnotations[
                    Number(
                      verse.verse_no
                    )
                  ];


                return (
                  <Pressable
                    key={
                      verse.verse_no
                    }
                    onPress={
                      isMyBibleMode
                        ? () =>
                            openBibleAnnotation(
                              Number(
                                verse.verse_no
                              ),
                              cleanText
                            )
                        : undefined
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      'Open options for verse ' +
                      verse.verse_no
                    }
                    style={[
                      styles.verseRow,

                      focused &&
                        styles.focusVerse,

                      isMyBibleMode &&
                      annotation
                        ?.highlight_color
                        ? {
                            backgroundColor:
                              annotation
                                .highlight_color,
                          }
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.verseNumber,
                        {
                          fontSize:
                            11 *
                            bibleZoom,

                          lineHeight:
                            28 *
                            bibleZoom,
                        },
                      ]}
                    >
                      {
                        verse.verse_no
                      }
                    </Text>

                    <Text
                      style={[
                        styles.verseText,
                        {
                          fontSize:
                            17 *
                            bibleZoom,

                          lineHeight:
                            28 *
                            bibleZoom,

                          /*
                           * Explicit flex shrink
                           * keeps text inside the
                           * screen when rotated.
                           */
                          flexShrink:
                            1,
                        },
                      ]}
                    >
                      {
                        cleanText
                      }
                    </Text>


                    {isMyBibleMode && annotation?.note_text && (

                      <View
                        style={{
                          alignSelf:
                            'flex-start',

                          marginTop:
                            4,

                          paddingHorizontal:
                            5,

                          paddingVertical:
                            3,

                          borderRadius:
                            7,

                          backgroundColor:
                            '#E8F2EC',
                        }}
                      >
                        <Text
                          style={{
                            fontSize:
                              7,

                            fontWeight:
                              '900',

                            color:
                              colors.greenDark,

                            letterSpacing:
                              0.3,
                          }}
                        >
                          NOTE
                        </Text>
                      </View>

                    )}


                  </Pressable>
                );
              }
            )}
          </View>
        )}
      </Card>


      {/* =====================================================
          MY_BIBLE_ANNOTATION_MODAL_V1
      ====================================================== */}

      <Modal
        visible={
          isMyBibleMode &&
          annotationModalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAnnotationModalVisible(
            false
          )
        }
      >

        <View
          style={{
            flex:
              1,

            backgroundColor:
              'rgba(0,0,0,0.42)',

            justifyContent:
              'center',

            padding:
              18,
          }}
        >

          <View
            style={{
              maxHeight:
                '86%',

              borderRadius:
                20,

              backgroundColor:
                '#FFFFFF',

              padding:
                16,
            }}
          >

            <ScrollView
              keyboardShouldPersistTaps="handled"
            >

              <View
                style={{
                  flexDirection:
                    'row',

                  alignItems:
                    'center',

                  gap:
                    8,
                }}
              >

                <View
                  style={{
                    flex:
                      1,
                  }}
                >

                  <Text
                    style={{
                      fontSize:
                        10,

                      fontWeight:
                        '900',

                      letterSpacing:
                        0.7,

                      color:
                        colors.greenDark,
                    }}
                  >
                    MY BIBLE
                  </Text>


                  <Text
                    style={{
                      marginTop:
                        2,

                      fontSize:
                        18,

                      fontWeight:
                        '900',

                      color:
                        colors.text,
                    }}
                  >
                    {
                      currentBook
                        ?.book_name ??
                      'Bible'
                    }{' '}
                    {chapterNo}:
                    {selectedVerseNo}
                  </Text>

                </View>


                <Pressable
                  onPress={() =>
                    setAnnotationModalVisible(
                      false
                    )
                  }
                  style={{
                    width:
                      38,

                    height:
                      38,

                    borderRadius:
                      19,

                    backgroundColor:
                      '#F1F4F2',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize:
                        18,

                      fontWeight:
                        '700',

                      color:
                        colors.text,
                    }}
                  >
                    ×
                  </Text>
                </Pressable>

              </View>


              <Text
                style={{
                  marginTop:
                    13,

                  fontSize:
                    15,

                  lineHeight:
                    23,

                  color:
                    colors.text,
                }}
              >
                {
                  selectedVerseText
                }
              </Text>


              <Text
                style={{
                  marginTop:
                    18,

                  marginBottom:
                    8,

                  fontSize:
                    9,

                  fontWeight:
                    '900',

                  letterSpacing:
                    0.7,

                  color:
                    colors.greenDark,
                }}
              >
                HIGHLIGHT
              </Text>


              <View
                style={{
                  flexDirection:
                    'row',

                  flexWrap:
                    'wrap',

                  gap:
                    9,
                }}
              >

                {myBibleHighlightColors
                  .map(
                    color => {

                      const active =
                        annotationColor ===
                        color;


                      return (
                        <Pressable
                          key={
                            color
                          }
                          onPress={() =>
                            setAnnotationColor(
                              active
                                ? null
                                : color
                            )
                          }
                          style={{
                            width:
                              43,

                            height:
                              43,

                            borderRadius:
                              13,

                            backgroundColor:
                              color,

                            borderWidth:
                              active
                                ? 3
                                : 1,

                            borderColor:
                              active
                                ? colors
                                    .greenDark
                                : '#CCD5D0',
                          }}
                        />
                      );

                    }
                  )}


                <Pressable
                  onPress={() =>
                    setAnnotationColor(
                      null
                    )
                  }
                  style={{
                    minWidth:
                      54,

                    height:
                      43,

                    borderRadius:
                      13,

                    borderWidth:
                      1,

                    borderColor:
                      '#CCD5D0',

                    backgroundColor:
                      '#FFFFFF',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize:
                        8,

                      fontWeight:
                        '900',

                      color:
                        colors.muted,
                    }}
                  >
                    NONE
                  </Text>
                </Pressable>

              </View>


              <Text
                style={{
                  marginTop:
                    18,

                  marginBottom:
                    8,

                  fontSize:
                    9,

                  fontWeight:
                    '900',

                  letterSpacing:
                    0.7,

                  color:
                    colors.greenDark,
                }}
              >
                PERSONAL NOTE
              </Text>


              <TextInput
                value={
                  annotationNote
                }
                onChangeText={
                  setAnnotationNote
                }
                multiline
                maxLength={
                  4000
                }
                textAlignVertical="top"
                placeholder="Write your personal note, reflection, insight, or reminder..."
                placeholderTextColor="#89958F"
                style={{
                  minHeight:
                    130,

                  borderWidth:
                    1,

                  borderColor:
                    '#CBD8D1',

                  borderRadius:
                    14,

                  backgroundColor:
                    '#FAFCFB',

                  padding:
                    12,

                  fontSize:
                    14,

                  lineHeight:
                    21,

                  color:
                    colors.text,
                }}
              />


              <Text
                style={{
                  marginTop:
                    4,

                  textAlign:
                    'right',

                  fontSize:
                    8,

                  color:
                    colors.muted,
                }}
              >
                {
                  annotationNote
                    .length
                } / 4000
              </Text>


              <Pressable
                disabled={
                  annotationSaving
                }
                onPress={
                  saveBibleAnnotation
                }
                style={({
                  pressed,
                }) => ({
                  marginTop:
                    14,

                  minHeight:
                    48,

                  borderRadius:
                    13,

                  backgroundColor:
                    colors.greenDark,

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  opacity:
                    annotationSaving
                      ? 0.5
                      : pressed
                        ? 0.75
                        : 1,
                })}
              >
                <Text
                  style={{
                    fontSize:
                      11,

                    fontWeight:
                      '900',

                    color:
                      '#FFFFFF',

                    letterSpacing:
                      0.5,
                  }}
                >
                  {
                    annotationSaving
                      ? 'SAVING...'
                      : 'SAVE HIGHLIGHT / NOTE'
                  }
                </Text>
              </Pressable>


              {selectedVerseNo !==
                null &&
                bibleAnnotations[
                  selectedVerseNo
                ] && (

                <Pressable
                  disabled={
                    annotationSaving
                  }
                  onPress={
                    removeBibleAnnotation
                  }
                  style={({
                    pressed,
                  }) => ({
                    marginTop:
                      8,

                    minHeight:
                      42,

                    borderRadius:
                      12,

                    borderWidth:
                      1,

                    borderColor:
                      '#D9B8B8',

                    backgroundColor:
                      '#FFF8F8',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',

                    opacity:
                      pressed
                        ? 0.7
                        : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize:
                        9,

                      fontWeight:
                        '900',

                      color:
                        '#934848',
                    }}
                  >
                    REMOVE HIGHLIGHT & NOTE
                  </Text>
                </Pressable>

              )}

            </ScrollView>

          </View>

        </View>

      </Modal>



      {/* =====================================================
          CHAPTER ACTIONS
      ====================================================== */}

      {!!verses.length && (
        <>
          <View
            style={
              styles.chapterNav
            }
          >
            <Pressable
              disabled={
                bookNo === 1 &&
                chapterNo === 1
              }
              onPress={() =>
                moveChapter(-1)
              }
              style={[
                styles.navButton,
                bookNo === 1 &&
                  chapterNo ===
                    1 &&
                  styles.navButtonOff,
              ]}
            >
              <Text
                style={
                  styles.navButtonText
                }
              >
                {'< PREVIOUS'}
              </Text>
            </Pressable>


            <Pressable
              disabled={
                completed ||
                marking
              }
              onPress={
                markRead
              }
              style={[
                styles.completeButton,
                completed &&
                  styles.completeButtonDone,
              ]}
            >
              <Text
                style={
                  styles.completeText
                }
              >
                {marking
                  ? 'SAVING...'
                  : completed
                  ? 'CHAPTER READ'
                  : 'MARK CHAPTER READ'}
              </Text>
            </Pressable>


            <Pressable
              disabled={
                bookNo === 66 &&
                chapterNo === 22
              }
              onPress={() =>
                moveChapter(1)
              }
              style={[
                styles.navButton,
                bookNo === 66 &&
                  chapterNo ===
                    22 &&
                  styles.navButtonOff,
              ]}
            >
              <Text
                style={
                  styles.navButtonText
                }
              >
                {'NEXT >'}
              </Text>
            </Pressable>
          </View>


          
      {/* OLD DAILY COMPLETION UI REMOVED.
          DAILY_DEVOTION_FOCUSED_READING_V1
          now owns NEXT READING -> RESPOND. */}

{/* PATCH_153H_5B_ATTRIBUTION */}
          {currentTranslation && (
            <Card>
              <Text
                style={
                  styles.attributionEyebrow
                }
              >
                BIBLE TEXT & LICENSE
              </Text>

              <Text
                style={
                  styles.attributionTitle
                }
              >
                {
                  currentTranslation.title
                }
              </Text>

              <Text
                style={
                  styles.attributionLicense
                }
              >
                {
                  currentTranslation.license_name
                }
              </Text>

              {!!currentTranslation.attribution_text && (
                <Text
                  style={
                    styles.attributionBody
                  }
                >
                  {
                    currentTranslation.attribution_text
                  }
                </Text>
              )}

              <Text
                style={
                  styles.attributionCode
                }
              >
                Translation: {
                  currentTranslation.code
                }
              </Text>
            </Card>
          )}


          <Card>
            <Text
              style={
                styles.reportNote
              }
            >
              Reading this chapter is recorded in your personal Bible Reading Report. Personal/free reading does not automatically earn BUKLOD Points; official Daily Bible Reading rewards remain separate.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}


const styles =
  StyleSheet.create({

    reportLaunch: {
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 15,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#D9E0DC',
      backgroundColor: '#FFF',
    },

    reportLaunchEyebrow: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#728078',
      letterSpacing: 0.7,
    },

    reportLaunchTitle: {
      marginTop: 3,
      fontSize: 16,
      fontWeight: '900',
      color: '#294536',
    },

    reportLaunchBody: {
      marginTop: 4,
      fontSize: 10,
      lineHeight: 15,
      color: '#75827B',
    },

    reportLaunchArrow: {
      fontSize: 9.5,
      fontWeight: '900',
      color: '#275D45',
    },

    searchLaunch: {
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 15,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#D1E0D7',
      backgroundColor: '#F3F8F5',
    },

    searchLaunchEyebrow: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#698176',
      letterSpacing: 0.7,
    },

    searchLaunchTitle: {
      marginTop: 3,
      fontSize: 16,
      fontWeight: '900',
      color: '#244633',
    },

    searchLaunchBody: {
      marginTop: 4,
      fontSize: 10,
      lineHeight: 15,
      color: '#75827B',
    },

    searchLaunchArrow: {
      fontSize: 9.5,
      fontWeight: '900',
      color: '#275D45',
    },
    content: {
      paddingBottom: 50,
      gap: 14,
    },


    center: {
      alignItems: 'center',
      justifyContent:
        'center',
    },


    header: {
      flexDirection: 'row',
      gap: 12,
      alignItems:
        'flex-start',
    },


    outline: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor:
        '#D7DFDA',
      borderRadius: 12,
    },


    outlineText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#275D45',
    },


    eyebrow: {
      fontSize: 9.5,
      fontWeight: '900',
      color: '#718078',
      letterSpacing: 0.7,
    },


    translationRow: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
    },


    translation: {
      flex: 1,
      minHeight: 58,
      borderWidth: 1,
      borderColor:
        '#DCE3DF',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 9,
      justifyContent:
        'center',
      backgroundColor:
        '#FAFBFA',
    },


    translationActive: {
      backgroundColor:
        '#275D45',
      borderColor:
        '#275D45',
    },


    translationCode: {
      fontSize: 15,
      fontWeight: '900',
      color: '#283C32',
    },


    translationName: {
      marginTop: 2,
      fontSize: 9,
      color: '#738078',
    },


    translationNameActive: {
      color: '#DDEAE3',
    },


    white: {
      color: '#FFF',
    },


    license: {
      marginTop: 9,
      fontSize: 9.5,
      lineHeight: 14,
      color: '#7B8780',
    },


    selectorRow: {
      flexDirection: 'row',
      gap: 8,
    },


    selector: {
      flex: 1,
      minHeight: 62,
      borderWidth: 1,
      borderColor:
        '#DCE3DF',
      borderRadius: 14,
      padding: 11,
      justifyContent:
        'center',
      backgroundColor:
        '#FAFBFA',
    },


    selectorLabel: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#75837B',
      letterSpacing: 0.6,
    },


    selectorValue: {
      marginTop: 3,
      fontSize: 15,
      fontWeight: '900',
      color: '#263A30',
    },


    bookGrid: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },


    bookButton: {
      width: '48.5%',
      minHeight: 41,
      justifyContent:
        'center',
      paddingHorizontal: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        '#DEE5E1',
      backgroundColor:
        '#FFF',
    },


    bookButtonActive: {
      backgroundColor:
        '#275D45',
      borderColor:
        '#275D45',
    },


    bookButtonText: {
      fontSize: 10.5,
      fontWeight: '800',
      color: '#34483E',
    },


    chapterGrid: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },


    chapterButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        '#DDE4E0',
      backgroundColor:
        '#FFF',
    },


    chapterButtonActive: {
      backgroundColor:
        '#275D45',
      borderColor:
        '#275D45',
    },


    chapterButtonText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#34483E',
    },


    readingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingBottom: 13,
      marginBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EDF1EE',
    },


    reference: {
      fontSize: 25,
      fontWeight: '900',
      color: '#20362B',
    },


    versionMeta: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '700',
      color: '#79867F',
    },


    verseBadge: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor:
        '#EAF3EE',
    },


    verseBadgeText: {
      fontSize: 8,
      fontWeight: '900',
      color: '#275D45',
    },


    chapterLoading: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent:
        'center',
    },


    verseList: {
      paddingTop: 4,
    },


    verseRow: {
      flexDirection: 'row',
      gap: 9,
      paddingVertical: 7,
      paddingHorizontal: 5,
      borderRadius: 10,
    },


    focusVerse: {
      backgroundColor:
        '#EEF6F1',
    },


    verseNumber: {
      width: 25,
      paddingTop: 2,
      textAlign: 'right',
      fontSize: 9.5,
      fontWeight: '900',
      color: '#557064',
    },


    verseText: {
      flex: 1,
      fontSize: 16.5,
      lineHeight: 26,
      color: '#26372F',
    },


    chapterNav: {
      flexDirection: 'row',
      gap: 7,
      alignItems: 'stretch',
    },


    navButton: {
      flex: 0.8,
      minHeight: 52,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        '#CBD8D1',
      borderRadius: 14,
      backgroundColor:
        '#FFF',
    },


    navButtonOff: {
      opacity: 0.35,
    },


    navButtonText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#315B48',
      textAlign: 'center',
    },


    completeButton: {
      flex: 1.4,
      minHeight: 52,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent:
        'center',
      borderRadius: 14,
      backgroundColor:
        '#275D45',
    },


    completeButtonDone: {
      backgroundColor:
        '#3C755A',
    },


    completeText: {
      fontSize: 9.5,
      fontWeight: '900',
      color: '#FFF',
      textAlign: 'center',
    },


    attributionEyebrow: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.7,
      color: '#728078',
    },


    attributionTitle: {
      marginTop: 5,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '900',
      color: '#294536',
    },


    attributionLicense: {
      marginTop: 4,
      fontSize: 10,
      fontWeight: '800',
      color: '#53685C',
    },


    attributionBody: {
      marginTop: 8,
      fontSize: 9.5,
      lineHeight: 16,
      color: '#718078',
    },


    attributionCode: {
      marginTop: 8,
      fontSize: 8,
      fontWeight: '800',
      color: '#89958E',
    },


    reportNote: {
      fontSize: 10.5,
      lineHeight: 17,
      color: '#718078',
      textAlign: 'center',
    },
    bibleViewToolbar: {
      marginBottom:
        12,

      padding:
        10,

      borderWidth:
        1,

      borderColor:
        '#DCE3DF',

      borderRadius:
        13,

      backgroundColor:
        '#F7FAF8',

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,
    },


    bibleViewLabel: {
      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        0.8,

      color:
        '#275D45',
    },


    bibleViewHint: {
      marginTop:
        2,

      fontSize:
        8.5,

      fontWeight:
        '700',

      color:
        '#718078',
    },


    bibleZoomControls: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,
    },


    bibleZoomButton: {
      width:
        40,

      height:
        40,

      borderWidth:
        1,

      borderColor:
        '#DCE3DF',

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',
    },


    bibleZoomButtonText: {
      fontSize:
        12,

      fontWeight:
        '900',

      color:
        '#275D45',
    },


    bibleFitButton: {
      minWidth:
        55,

      height:
        40,

      paddingHorizontal:
        6,

      borderWidth:
        1,

      borderColor:
        '#DCE3DF',

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',
    },


    bibleFitButtonOn: {
      borderColor:
        '#275D45',

      backgroundColor:
        '#E6F1EA',
    },


    bibleFitPercent: {
      fontSize:
        9,

      fontWeight:
        '900',

      color:
        '#275D45',
    },


    bibleFitText: {
      marginTop:
        1,

      fontSize:
        6.5,

      fontWeight:
        '900',

      letterSpacing:
        0.5,

      color:
        '#718078',
    },


    bibleFitTextOn: {
      color:
        '#275D45',
    }
});