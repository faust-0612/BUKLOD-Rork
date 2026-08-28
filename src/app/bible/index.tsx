import { repairMojibakeText } from '@/lib/repairMojibakeText';
import BuklodOccasionalAd from '@/components/BuklodOccasionalAd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { BuklodBibleNarrationBar } from '@/components/BuklodBibleNarrationBar';
import {
  mapBibleChapterRows,
  type BibleNarrationVerse,
} from '@/lib/buklodBibleNarration';
import { Card, SectionTitle, shared } from '@/components/UI';
import BuklodClusterMembershipGate from '@/components/BuklodClusterMembershipGate';

type Assignment = {
  id: string;
  reading_date: string;
  bible_reference: string;
  instruction_fil: string | null;
  reflection_question_fil: string;
  reflection_question_en: string;
  chapter_questions_fil?: string[] | null;
  chapter_questions_en?: string[] | null;
};

type Submission = {
  id: string;
  assignment_id: string;
  bible_text: string | null;
  bible_photo_path: string | null;
  answer_text: string | null;
  reflection_photo_path: string | null;
  answer_language: 'fil' | 'en';
  status: 'pending_admin' | 'approved' | 'rejected';
  submitted_at: string;
  submitted_on_time: boolean;
  admin_note: string | null;
};

type PhotoDraft = {
  uri: string;
  base64: string;
  sizeBytes: number;
};

const EVIDENCE_BUCKET = 'daily-bible-evidence';

/* PATCH_153H_4A_BOOK_PARSER */

const BIBLE_BOOK_NUMBERS = ([
  /* PATCH_154V_BIBLE_REFERENCE_ALIASES */
  ['gen',1],['ge',1],
  ['exo',2],['exod',2],['ex',2],
  ['lev',3],
  ['num',4],['nu',4],
  ['deut',5],['dt',5],
  ['josh',6],
  ['judg',7],['jdg',7],
  ['ru',8],

  ['1 sam',9],['1sam',9],['1 sa',9],
  ['2 sam',10],['2sam',10],['2 sa',10],
  ['1 kgs',11],['1kgs',11],['1 ki',11],
  ['2 kgs',12],['2kgs',12],['2 ki',12],
  ['1 chr',13],['1chr',13],['1 chron',13],
  ['2 chr',14],['2chr',14],['2 chron',14],

  ['neh',16],
  ['esth',17],['est',17],
  ['ps',19],['psa',19],['psalm',19],
  ['prov',20],['pr',20],
  ['eccl',21],['ecc',21],
  ['song',22],['sos',22],

  ['isa',23],
  ['jer',24],
  ['lam',25],
  ['ezek',26],['eze',26],
  ['dan',27],
  ['hos',28],
  ['obad',31],['ob',31],
  ['jon',32],
  ['mic',33],
  ['nah',34],
  ['hab',35],
  ['zeph',36],
  ['hag',37],
  ['zech',38],
  ['mal',39],

  ['matt',40],['mt',40],
  ['mk',41],['mrk',41],
  ['lk',42],
  ['jn',43],['jhn',43],
  ['act',44],
  ['rom',45],

  ['1 cor',46],['1cor',46],
  ['2 cor',47],['2cor',47],
  ['gal',48],
  ['eph',49],
  ['phil',50],
  ['col',51],

  ['1 thess',52],['1thess',52],['1 thes',52],
  ['2 thess',53],['2thess',53],['2 thes',53],
  ['1 tim',54],['1tim',54],
  ['2 tim',55],['2tim',55],
  ['tit',56],
  ['phlm',57],['phm',57],
  ['heb',58],
  ['jas',59],

  ['1 pet',60],['1pet',60],['1 pe',60],
  ['2 pet',61],['2pet',61],['2 pe',61],
  ['1 jn',62],['1jn',62],
  ['2 jn',63],['2jn',63],
  ['3 jn',64],['3jn',64],

  ['rev',66],['re',66],

  ['genesis',1],
  ['exodus',2],
  ['leviticus',3],
  ['numbers',4],
  ['deuteronomy',5],
  ['joshua',6],
  ['judges',7],
  ['ruth',8],
  ['1 samuel',9],
  ['2 samuel',10],
  ['1 kings',11],
  ['2 kings',12],
  ['1 chronicles',13],
  ['2 chronicles',14],
  ['ezra',15],
  ['nehemiah',16],
  ['esther',17],
  ['job',18],
  ['psalms',19],
  ['psalm',19],
  ['proverbs',20],
  ['ecclesiastes',21],
  ['song of solomon',22],
  ['song of songs',22],
  ['isaiah',23],
  ['jeremiah',24],
  ['lamentations',25],
  ['ezekiel',26],
  ['daniel',27],
  ['hosea',28],
  ['joel',29],
  ['amos',30],
  ['obadiah',31],
  ['jonah',32],
  ['micah',33],
  ['nahum',34],
  ['habakkuk',35],
  ['zephaniah',36],
  ['haggai',37],
  ['zechariah',38],
  ['malachi',39],
  ['matthew',40],
  ['mark',41],
  ['luke',42],
  ['john',43],
  ['acts',44],
  ['romans',45],
  ['1 corinthians',46],
  ['2 corinthians',47],
  ['galatians',48],
  ['ephesians',49],
  ['philippians',50],
  ['colossians',51],
  ['1 thessalonians',52],
  ['2 thessalonians',53],
  ['1 timothy',54],
  ['2 timothy',55],
  ['titus',56],
  ['philemon',57],
  ['hebrews',58],
  ['james',59],
  ['1 peter',60],
  ['2 peter',61],
  ['1 john',62],
  ['2 john',63],
  ['3 john',64],
  ['jude',65],
  ['revelation',66],
] as Array<[string,number]>)
  .sort((a,b)=>b[0].length-a[0].length);


function getBibleReaderTarget(reference:string) {
  const clean = reference
    .trim()
    .replace(/\s+/g,' ');

  const lower = clean.toLowerCase();

  const match = BIBLE_BOOK_NUMBERS.find(
    ([name]) =>
      lower === name ||
      lower.startsWith(`${name} `)
  );

  if (!match) return null;

  const [bookName,bookNo] = match;

  const remainder = clean
    .slice(bookName.length)
    .trim();

  const chapterMatch = remainder.match(/\d+/);

  if (!chapterMatch) return null;

  const chapterNo = Number(chapterMatch[0]);

  if (!Number.isFinite(chapterNo) || chapterNo < 1) {
    return null;
  }

  return {
    bookNo,
    chapterNo,
  };
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fromIso = (s: string) => {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y,m-1,d);
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate()+n);
  return x;
};

const monday = () => {
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return d;
};

function base64ToArrayBuffer(base64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  let length = clean.length * 0.75;
  if (clean.endsWith('==')) length -= 2;
  else if (clean.endsWith('=')) length -= 1;

  const bytes = new Uint8Array(Math.max(0, Math.floor(length)));
  let byteIndex = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const e3 = clean[i + 2] === '=' ? 0 : chars.indexOf(clean[i + 2]);
    const e4 = clean[i + 3] === '=' ? 0 : chars.indexOf(clean[i + 3]);
    const triple = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;

    if (byteIndex < bytes.length) bytes[byteIndex++] = (triple >> 16) & 255;
    if (byteIndex < bytes.length) bytes[byteIndex++] = (triple >> 8) & 255;
    if (byteIndex < bytes.length) bytes[byteIndex++] = triple & 255;
  }

  return bytes.buffer;
}

async function chooseEvidencePhoto(): Promise<PhotoDraft | null> {
  const ImagePicker = await import('expo-image-picker');
  const ImageManipulator = await import('expo-image-manipulator');

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Photo Permission',
      'Please allow BUKLOD to access your photos so you can attach handwritten Bible Reading evidence.'
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);

  if ((asset.width ?? 0) > 1280) {
    context.resize({ width: 1280 });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.72,
    base64: true,
  });

  if (!saved.base64) {
    throw new Error('Could not prepare this photo.');
  }

  const sizeBytes = Math.floor((saved.base64.length * 3) / 4);
  if (sizeBytes > 5 * 1024 * 1024) {
    throw new Error('The compressed photo is still above 5 MB. Please choose another photo.');
  }

  return { uri: saved.uri, base64: saved.base64, sizeBytes };
}


/* ============================================================
   DAILY_READING_AUDIO_PREVIEW_V1

   Audio for the assigned Scripture appears BEFORE READ.
   Listening here does NOT submit or complete the devotion.
============================================================ */

function DailyReadingAudioPreview({
  readingDate,
  reference,
}: {
  readingDate: string;
  reference: string;
}) {

  const [
    loadingAudio,
    setLoadingAudio,
  ] =
    useState(true);


  const [
    audioSession,
    setAudioSession,
  ] =
    useState<{
      translation: string;
      bookNo: number;
      bookName: string;
      chapterNo: number;
      verses: BibleNarrationVerse[];
    } | null>(
      null
    );


  const [
    audioTranslation,
    setAudioTranslation,
  ] =
    useState('ASD');


  const [
    audioError,
    setAudioError,
  ] =
    useState<string | null>(
      null
    );


  useEffect(
    () => {

      let cancelled =
        false;


      const loadAudio =
        async () => {

          setLoadingAudio(
            true
          );

          setAudioError(
            null
          );

          setAudioSession(
            null
          );


          try {

            /* --------------------------------------------
               Preferred Bible version
            --------------------------------------------- */

            const preferredResult =
              await (supabase as any)
                .rpc(
                  'get_my_preferred_bible_version'
                );


            let translation =
              String(
                preferredResult?.data ??
                'ASD'
              )
                .trim()
                .toUpperCase();


            if (
              translation !== 'ASD' &&
              translation !== 'KJV'
            ) {
              translation =
                'ASD';
            }


            if (cancelled) {
              return;
            }


            setAudioTranslation(
              translation
            );


            /* --------------------------------------------
               Exact automatic plan for selected date.

               Current plan has 1 or 2 chapters per day,
               including cross-book boundaries.
            --------------------------------------------- */

            const planResult =
              await (supabase as any)
                .rpc(
                  'get_automatic_bible_reading',
                  {
                    p_reading_date:
                      readingDate,
                  }
                );


            const planRaw =
              Array.isArray(
                planResult?.data
              )
                ? planResult.data[0]
                : planResult?.data;


            const targets:
              Array<{
                bookNo: number;
                chapterNo: number;
              }> = [];


            if (
              planRaw?.start_book_no &&
              planRaw?.start_chapter
            ) {

              targets.push({
                bookNo:
                  Number(
                    planRaw.start_book_no
                  ),

                chapterNo:
                  Number(
                    planRaw.start_chapter
                  ),
              });


              const endBook =
                Number(
                  planRaw.end_book_no ??
                  planRaw.start_book_no
                );


              const endChapter =
                Number(
                  planRaw.end_chapter ??
                  planRaw.start_chapter
                );


              if (
                endBook !==
                  Number(
                    planRaw.start_book_no
                  ) ||
                endChapter !==
                  Number(
                    planRaw.start_chapter
                  )
              ) {

                targets.push({
                  bookNo:
                    endBook,

                  chapterNo:
                    endChapter,
                });

              }

            }


            /*
             * Fallback to the existing
             * Bible-reference parser.
             */
            if (
              targets.length === 0
            ) {

              const fallback =
                getBibleReaderTarget(
                  reference
                );


              if (fallback) {

                targets.push({
                  bookNo:
                    Number(
                      fallback.bookNo
                    ),

                  chapterNo:
                    Number(
                      fallback.chapterNo
                    ),
                });

              }

            }


            if (
              targets.length === 0
            ) {

              throw new Error(
                'Unable to identify today\'s Bible reading.'
              );

            }


            /* --------------------------------------------
               Load every assigned chapter.
            --------------------------------------------- */

            const chapterResults =
              await Promise.all(
                targets.map(
                  target =>
                    (supabase as any)
                      .rpc(
                        'get_bible_chapter',
                        {
                          p_translation_code:
                            translation,

                          p_book_no:
                            target.bookNo,

                          p_chapter_no:
                            target.chapterNo,
                        }
                      )
                )
              );


            if (cancelled) {
              return;
            }


            let startSession: {
              translation: string;
              bookNo: number;
              bookName: string;
              chapterNo: number;
              verses: BibleNarrationVerse[];
            } | null = null;


            for (
              let index = 0;
              index <
              chapterResults.length;
              index += 1
            ) {

              const result =
                chapterResults[index];


              if (
                result?.error
              ) {
                throw result.error;
              }


              const target =
                targets[index];


              const verses =
                mapBibleChapterRows(
                  result?.data,
                  {
                    bookNo:
                      target.bookNo,
                    chapterNo:
                      target.chapterNo,
                  }
                );


              if (
                verses.length === 0
              ) {
                continue;
              }


              if (!startSession) {
                startSession = {
                  translation,
                  bookNo:
                    verses[0].book_no ||
                    target.bookNo,
                  bookName:
                    verses[0].book_name ||
                    reference,
                  chapterNo:
                    verses[0].chapter_no ||
                    target.chapterNo,
                  verses,
                };
              }

            }


            if (
              !startSession
            ) {

              throw new Error(
                'Bible text is not available for this reading.'
              );

            }


            if (
              !cancelled
            ) {

              setAudioSession(
                startSession
              );

            }

          }
          catch (
            error: any
          ) {

            if (
              !cancelled
            ) {

              console.warn(
                'Daily Reading Audio:',
                error?.message ??
                error
              );


              setAudioError(
                error?.message ??
                'Audio reading is unavailable.'
              );

            }

          }
          finally {

            if (
              !cancelled
            ) {

              setLoadingAudio(
                false
              );

            }

          }

        };


      void loadAudio();


      return () => {

        cancelled =
          true;

      };

    },
    [
      readingDate,
      reference,
    ]
  );


  return (

    <View
      style={{
        marginTop:
          12,

        marginBottom:
          13,
      }}
    >

      {/* ------------------------------------------
          AUDIO HEADING
      ------------------------------------------- */}

      <View
        style={{
          flexDirection:
            'row',

          alignItems:
            'center',

          justifyContent:
            'space-between',

          marginBottom:
            7,
        }}
      >

        <View>

          <Text
            style={{
              fontSize:
                9,

              fontWeight:
                '900',

              letterSpacing:
                0.7,

              color:
                '#275D45',
            }}
          >
            AUDIO READING
          </Text>


          <Text
            style={{
              marginTop:
                2,

              fontSize:
                11,

              fontWeight:
                '800',

              color:
                '#50645A',
            }}
          >
            Listen to today's Scripture
          </Text>

        </View>


        <Text
          style={{
            fontSize:
              9,

            fontWeight:
              '900',

            color:
              '#718078',
          }}
        >
          {audioTranslation}
        </Text>

      </View>


      {loadingAudio ? (

        <View
          style={{
            minHeight:
              62,

            borderWidth:
              1,

            borderColor:
              '#D8E2DC',

            borderRadius:
              14,

            alignItems:
              'center',

            justifyContent:
              'center',

            backgroundColor:
              '#F7FAF8',
          }}
        >

          <Text
            style={{
              fontSize:
                10,

              fontWeight:
                '800',

              color:
                '#718078',
            }}
          >
            Loading audio reading...
          </Text>

        </View>

      ) : audioSession &&
        audioSession.verses.length > 0 ? (

        <BuklodBibleNarrationBar
          title="Listen to today's reading"
          subtitle="One play continues verse by verse, then to the next chapter, until you stop. This does not mark the reading complete."
          translation={
            audioSession.translation
          }
          language={
            audioSession.translation ===
              'KJV'
              ? 'en-US'
              : 'fil-PH'
          }
          bookNo={
            audioSession.bookNo
          }
          bookName={
            audioSession.bookName
          }
          chapterNo={
            audioSession.chapterNo
          }
          verses={
            audioSession.verses
          }
          continueNextBook
        />

      ) : (

        <View
          style={{
            padding:
              11,

            borderRadius:
              12,

            backgroundColor:
              '#F5F6F5',
          }}
        >

          <Text
            style={{
              fontSize:
                9,

              color:
                '#718078',
            }}
          >
            {
              audioError ??
              'Audio reading is unavailable.'
            }
          </Text>

        </View>

      )}


      <Text
        style={{
          marginTop:
            6,

          fontSize:
            8.5,

          lineHeight:
            13,

          color:
            '#718078',
        }}
      >
        Listening does not submit your Daily Devotion. Tap READ to continue to Scripture and Respond.
      </Text>

    </View>

  );

}


export default function DailyBibleScreen() {

  /* PATCH_153H_4C_RETURN_DATE */
  const params =
    useLocalSearchParams<{
      date?: string | string[];
    }>();

  const requestedDate =
    Array.isArray(params.date)
      ? params.date[0]
      : params.date;

  const weekStart = useMemo(monday, []);
  const days = useMemo(
    () => Array.from({length:7},(_,i)=>iso(addDays(weekStart,i))),
    [weekStart]
  );

  const today = (() => {
  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(new Date());

  const value = (type: string) =>
    parts.find(p => p.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
})();
  const [assignments,setAssignments] = useState<Assignment[]>([]);
  const [submissions,setSubmissions] = useState<Submission[]>([]);
  const [selectedDate,setSelectedDate] = useState(requestedDate && days.includes(requestedDate) ? requestedDate : today);
  const [bibleText,setBibleText] = useState('');
  const [answer,setAnswer] = useState('');
  const [questionAnswers,setQuestionAnswers] =
    useState<string[]>(['','','','']);
  const [language,setLanguage] = useState<'fil'|'en'>('fil');
  const [biblePhotoPath,setBiblePhotoPath] = useState<string|null>(null);
  const [reflectionPhotoPath,setReflectionPhotoPath] = useState<string|null>(null);
  const [bibleDraft,setBibleDraft] = useState<PhotoDraft|null>(null);
  const [reflectionDraft,setReflectionDraft] = useState<PhotoDraft|null>(null);
  const [photoBusy,setPhotoBusy] = useState<'bible'|'reflection'|null>(null);
  const [points,setPoints] = useState(10);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [busy,setBusy] = useState(false);

  /* PATCH_153H_4C_SYNC_DATE */
  useEffect(() => {
    if (
      requestedDate &&
      days.includes(requestedDate)
    ) {
      setSelectedDate(
        requestedDate
      );
    }
  }, [
    requestedDate,
    days,
  ]);

  const load = useCallback(async () => {

    /*
     * AUTOMATIC DAILY BIBLE IS THE SOURCE OF TRUTH.
     *
     * This RPC materializes the current automatic
     * Monday-Sunday reading plan into daily_bible_assignments
     * and ensures active members are assigned.
     */
    /*
     * PATCH 154V-FIX3
     *
     * Use the authenticated-safe server wrapper.
     * The private materialization helper remains private.
     */
    const {
      data:automaticData,
      error:automaticError
    } = await (supabase as any).rpc(
      'ensure_current_automatic_bible_week_v2'
    );

    if(automaticError){
      throw automaticError;
    }

    const automaticRows =
      Array.isArray(automaticData)
        ? automaticData
        : [];

    const automaticIds =
      automaticRows
        .map(
          (row:any)=>
            String(
              row?.assignment_id ?? ''
            )
        )
        .filter(Boolean);

    let databaseRows:any[] = [];

    if(automaticIds.length){
      const {
        data,
        error
      } = await supabase
        .from('daily_bible_assignments')
        .select(
          'id,reading_date,bible_reference,instruction_fil,reflection_question_fil,reflection_question_en,chapter_questions_fil,chapter_questions_en'
        )
        .in(
          'id',
          automaticIds
        );

      if(error){
        console.warn(
          'Daily Bible assignment details:',
          error.message
        );
      }else{
        databaseRows=data ?? [];
      }
    }

    const detailsById=
      new Map(
        databaseRows.map(
          (row:any)=>[
            String(row.id),
            row
          ]
        )
      );

    /*
     * Even if direct table SELECT is restricted by RLS,
     * use the trusted automatic-week RPC result so TODAY
     * never disappears from the dashboard.
     */
    const aa:Assignment[] =
      automaticRows.map(
        (raw:any)=>{
          const id=
            String(
              raw.assignment_id ?? ''
            );

          const detail=
            detailsById.get(id);

          const reference=
            String(
              raw.bible_reference ??
              detail?.bible_reference ??
              ''
            );

          const filQuestions=[
            `Ano ang pangunahing pangyayari o mensahe sa ${reference}?`,
            `Anong talata o bahagi ng ${reference} ang pinaka-napansin mo, at bakit?`,
            `Ano ang itinuturo ng ${reference} tungkol sa Diyos, sa tao, o sa pananampalataya?`,
            `Ano ang isang konkretong bagay na maaari mong gawin bilang tugon sa ${reference}?`,
          ];

          const enQuestions=[
            `What is the main event or message in ${reference}?`,
            `Which verse or part of ${reference} stood out to you most, and why?`,
            `What does ${reference} teach about God, people, or faith?`,
            `What is one concrete action you can take in response to ${reference}?`,
          ];

          return {
            id,

            reading_date:
              String(
                raw.reading_date ??
                detail?.reading_date ??
                ''
              ).slice(0,10),

            bible_reference:
              reference,

            instruction_fil:
              detail?.instruction_fil ??
              'Basahin ang nakatakdang Scripture bago sagutin ang mga tanong.',

            reflection_question_fil:
              detail?.reflection_question_fil ??
              filQuestions[0],

            reflection_question_en:
              detail?.reflection_question_en ??
              enQuestions[0],

            chapter_questions_fil:
              Array.isArray(
                detail?.chapter_questions_fil
              ) &&
              detail.chapter_questions_fil.length>=4
                ? detail.chapter_questions_fil
                : filQuestions,

            chapter_questions_en:
              Array.isArray(
                detail?.chapter_questions_en
              ) &&
              detail.chapter_questions_en.length>=4
                ? detail.chapter_questions_en
                : enQuestions,
          };
        }
      );

    setAssignments(aa);

    if(aa.length){
      const {
        data:s,
        error:se
      } = await supabase
        .from('daily_bible_submissions')
        .select(
          'id,assignment_id,bible_text,bible_photo_path,answer_text,reflection_photo_path,answer_language,status,submitted_at,submitted_on_time,admin_note,question_answers'
        )
        .in(
          'assignment_id',
          aa.map(x=>x.id)
        );

      if(se) throw se;

      setSubmissions(
        (s ?? []) as Submission[]
      );
    }else{
      setSubmissions([]);
    }

    const {data:r} =
      await supabase
        .from('buklod_point_rules')
        .select('base_points')
        .eq(
          'activity_type',
          'daily_bible'
        )
        .eq(
          'is_active',
          true
        )
        .maybeSingle();

    if(r?.base_points != null){
      setPoints(
        Number(r.base_points)
      );
    }

  }, [days]);

  useEffect(()=>{
    load()
      .catch((e:any)=>Alert.alert('Daily Bible Reading',e?.message ?? 'Unable to load.'))
      .finally(()=>setLoading(false));
  },[load]);

  const byDate = useMemo(
    ()=>Object.fromEntries(assignments.map(x=>[x.reading_date,x])) as Record<string,Assignment>,
    [assignments]
  );
  const subByAssignment = useMemo(
    ()=>Object.fromEntries(submissions.map(x=>[x.assignment_id,x])) as Record<string,Submission>,
    [submissions]
  );

  const selected = byDate[selectedDate];
  const submission = selected ? subByAssignment[selected.id] : undefined;

  /* PATCH_153H_4A_OPEN_READER */
  const openAssignedReading = () => {
    if (!selected) return;

    if (selectedDate > today) {
      Alert.alert(
        'Daily Bible Reading',
        'This reading is not open yet.'
      );

      return;
    }

    const target =
      getBibleReaderTarget(
        selected.bible_reference
      );

    if (!target) {
      Alert.alert(
        'Bible Reader',
        `Could not identify the chapter for ${selected.bible_reference}.`
      );

      return;
    }

    router.push({
      pathname: '/bible/read',
      params: {
        book:
          String(target.bookNo),

        chapter:
          String(target.chapterNo),

        source:
          'daily_plan',

        assignment_id:
          selected.id,

        assignedDate:
          selected.reading_date,
      },
    });
  };

  /* PATCH_153H_4B_AUTO_EVIDENCE */
  const buildAssignedBibleEvidence =
    async (): Promise<string | null> => {

      if (!selected) return null;


      // -------------------------------------------
      // Preferred translation
      // -------------------------------------------

      let translation = 'ASD';

      try {
        const preferredResult =
          await (supabase as any).rpc(
            'get_my_preferred_bible_version'
          );

        if (
          !preferredResult?.error &&
          preferredResult?.data
        ) {
          translation =
            String(
              preferredResult.data
            ).toUpperCase();
        }

      } catch {
        translation = 'ASD';
      }


      // -------------------------------------------
      // Resolve the 1 or 2 automatic chapters
      // -------------------------------------------

      const targets:
        Array<{
          bookNo:number;
          chapterNo:number;
        }> = [];


      try {
        const planResult =
          await (supabase as any).rpc(
            'get_automatic_bible_reading',
            {
              p_reading_date:
                selected.reading_date,
            }
          );


        if (!planResult?.error) {

          const plan =
            Array.isArray(
              planResult.data
            )
              ? planResult.data[0]
              : planResult.data;


          if (plan) {

            const startBook =
              Number(
                plan.start_book_no
              );

            const startChapter =
              Number(
                plan.start_chapter
              );

            const endBook =
              Number(
                plan.end_book_no
              );

            const endChapter =
              Number(
                plan.end_chapter
              );


            if (
              Number.isFinite(
                startBook
              ) &&
              Number.isFinite(
                startChapter
              )
            ) {
              targets.push({
                bookNo:
                  startBook,

                chapterNo:
                  startChapter,
              });
            }


            /*
             * Daily plan is 1 or 2 chapters.
             *
             * Same book:
             * Genesis 1-2
             *
             * Cross-book:
             * Malachi 4 + Matthew 1
             */
            if (
              Number.isFinite(
                endBook
              ) &&
              Number.isFinite(
                endChapter
              ) &&
              (
                endBook !==
                  startBook ||
                endChapter !==
                  startChapter
              )
            ) {
              targets.push({
                bookNo:
                  endBook,

                chapterNo:
                  endChapter,
              });
            }
          }
        }

      } catch {
        // Graceful fallback below.
      }


      // -------------------------------------------
      // Legacy/pre-deployment fallback
      // -------------------------------------------

      if (!targets.length) {

        const fallback =
          getBibleReaderTarget(
            selected.bible_reference
          );


        if (fallback) {
          targets.push({
            bookNo:
              fallback.bookNo,

            chapterNo:
              fallback.chapterNo,
          });
        }
      }


      if (!targets.length) {

        /*
         * Preserve old evidence if this is a
         * historical submission.
         */
        if (
          bibleText.trim()
        ) {
          return bibleText.trim();
        }


        throw new Error(
          'Unable to resolve the assigned Bible passage.'
        );
      }


      // -------------------------------------------
      // Fetch the actual built-in Bible text
      // -------------------------------------------

      const sections:string[] =
        [];


      for (
        const target
        of targets
      ) {

        const chapterResult =
          await (supabase as any).rpc(
            'get_bible_chapter',
            {
              p_translation_code:
                translation,

              p_book_no:
                target.bookNo,

              p_chapter_no:
                target.chapterNo,
            }
          );


        if (
          chapterResult?.error
        ) {
          throw chapterResult.error;
        }


        const verses =
          (
            chapterResult?.data ??
            []
          ) as Array<{
            book_name:string;
            chapter_no:number;
            verse_no:number;
            verse_text:string;
          }>;


        if (!verses.length) {
          throw new Error(
            `Bible text is unavailable for ${selected.bible_reference}.`
          );
        }


        const bookName =
          verses[0]?.book_name ??
          selected.bible_reference;


        const heading =
          `${bookName} ${target.chapterNo} (${translation})`;


        const body =
          verses
            .map(
              verse =>
                `${verse.verse_no} ${
                  String(
                    repairMojibakeText(verse.verse_text) ??
                    ''
                  )
                    .replace(
                      /^\u00B6\s*/,
                      ''
                    )
                    .trim()
                }`
            )
            .join('\n');


        sections.push(
          `${heading}\n${body}`
        );
      }


      return sections.join(
        '\n\n'
      );
    };

  useEffect(()=>{
    setBibleText(submission?.bible_text ?? '');
    setAnswer(submission?.answer_text ?? '');
    setLanguage(submission?.answer_language ?? 'fil');
    setBiblePhotoPath(submission?.bible_photo_path ?? null);
    setReflectionPhotoPath(submission?.reflection_photo_path ?? null);
    setBibleDraft(null);
    setReflectionDraft(null);
  },[selectedDate,submission?.id,submission?.status]);

  const approved = submissions.filter(x=>x.status==='approved').length;
  const pending = submissions.filter(x=>x.status==='pending_admin').length;
  const locked = submission?.status==='approved' || submission?.status==='pending_admin';
  /* PATCH_154V_FOUR_QUESTIONS */

  const chapterQuestions =
    (
      language === 'fil'
        ? selected?.chapter_questions_fil
        : selected?.chapter_questions_en
    ) ?? [];

  const chapterAnswersOkay =
    chapterQuestions.length >= 4 &&
    chapterQuestions
      .slice(0,4)
      .every(
        (_: string,index: number)=>
          String(
            questionAnswers[index] ?? ''
          ).trim().length >= 10
      );

  const reflectionEvidenceOkay =
    answer.trim().length >= 20;

  const pickPhoto = async (kind:'bible'|'reflection') => {
    if (locked) return;
    setPhotoBusy(kind);
    try {
      const photo = await chooseEvidencePhoto();
      if (!photo) return;
      if (kind==='bible') setBibleDraft(photo);
      else setReflectionDraft(photo);
    } catch(e:any) {
      Alert.alert('Photo',e?.message ?? 'Could not select this photo.');
    } finally {
      setPhotoBusy(null);
    }
  };

  const uploadPhoto = async (
    userId:string,
    assignmentId:string,
    kind:'bible'|'reflection',
    photo:PhotoDraft
  ) => {
    const path = `${userId}/${assignmentId}/${kind}-${Date.now()}.jpg`;
    const {error} = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(path,base64ToArrayBuffer(photo.base64),{
        contentType:'image/jpeg',
        upsert:false,
      });
    if(error) throw error;
    return path;
  };

  const removeUploaded = async (paths:string[]) => {
    const unique = Array.from(new Set(paths.filter(Boolean)));
    if (!unique.length) return;
    await supabase.storage.from(EVIDENCE_BUCKET).remove(unique);
  };

  const submit = async () => {
    if (!selected) return;


    if (!chapterAnswersOkay) {
      Alert.alert(
        'Chapter Questions Required',
        'Answer all four questions before submitting your Daily Bible reflection.'
      );
      return;
    }

    if (!reflectionEvidenceOkay) {
      Alert.alert(
        'Reflection Required',
        'Answer the assigned question in writing with at least 20 characters. A photo cannot replace the written answer.'
      );
      return;
    }

    setBusy(true);
    const newlyUploaded:string[] = [];

    try {
      const {data:{user},error:userError} = await supabase.auth.getUser();
      if(userError) throw userError;
      if(!user) throw new Error('Authentication required.');

      /* PATCH_153H_4B_GENERATE_TEXT */

      let finalBibleText =
        bibleText.trim() ||
        null;


      /*
       * New Daily Bible submissions automatically
       * store the actual built-in Scripture text.
       *
       * Existing historical evidence remains usable
       * as fallback for backward compatibility.
       */
      try {

        const generatedBibleText =
          await buildAssignedBibleEvidence();


        if (
          generatedBibleText
        ) {
          finalBibleText =
            generatedBibleText;
        }

      } catch (e:any) {

        if (!finalBibleText) {
          throw e;
        }


        console.warn(
          'Using existing Bible evidence fallback:',
          e?.message ?? e
        );
      }


      let finalBiblePath = biblePhotoPath;
      let finalReflectionPath = reflectionPhotoPath;

      if (bibleDraft) {
        finalBiblePath = await uploadPhoto(user.id,selected.id,'bible',bibleDraft);
        newlyUploaded.push(finalBiblePath);
      }

      if (reflectionDraft) {
        finalReflectionPath = await uploadPhoto(user.id,selected.id,'reflection',reflectionDraft);
        newlyUploaded.push(finalReflectionPath);
      }

      const {error} = await supabase.rpc('submit_daily_bible_evidence_v2',{
        p_assignment_id:selected.id,
        p_bible_text:finalBibleText,
        p_reflection_text:answer.trim() || null,
        p_language:language,
        p_bible_photo_path:finalBiblePath,
        p_reflection_photo_path:finalReflectionPath,
      });
      if (error) throw error;

      const oldPaths = [submission?.bible_photo_path,submission?.reflection_photo_path]
        .filter((x):x is string=>!!x)
        .filter(x=>x!==finalBiblePath && x!==finalReflectionPath);

      if(oldPaths.length) await removeUploaded(oldPaths);

      Alert.alert(
        'Submitted',
        'Your Daily Bible reflection is awaiting validation by an authorized Local Pastor or System Admin.'
      );
      await load();
    } catch(e:any) {
      if(newlyUploaded.length) await removeUploaded(newlyUploaded);
      Alert.alert('Submission',e?.message ?? 'Unable to submit.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    !!selected &&
    selectedDate <= today &&
    !locked &&
    reflectionEvidenceOkay;

  if (loading) {
    return <View style={[shared.screen,styles.center]}><ActivityIndicator size="large"/></View>;
  }

  return (
    <BuklodClusterMembershipGate title="Join a Cluster to use Daily Bible Reading">
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[shared.content,styles.content]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async()=>{
            setRefreshing(true);
            try { await load(); } finally { setRefreshing(false); }
          }}
        />
      }
    >
      <BuklodOccasionalAd placement="bible" />
      <View style={styles.header}>
        <View style={{flex:1}}>
          <Text style={shared.h1}>Daily Bible Reading</Text>
          <Text style={shared.muted}>Read Scripture | Reflect | Submit for Validation</Text>
        </View>
        <Pressable onPress={()=>router.back()} style={styles.outline}>
          <Text style={styles.outlineText}>BACK</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={styles.eyebrow}>THIS WEEK</Text>
        <Text style={styles.big}>{approved}/7 valid</Text>
        <Text style={styles.meta}>{pending} pending Pastor approval | Points are awarded only after approval</Text>
        <View style={styles.dots}>
          {days.map(date=>{
            const a=byDate[date];
            const s=a?subByAssignment[a.id]:undefined;
            return <View key={date} style={[
              styles.dot,
              s?.status==='approved' && styles.dotApproved,
              s?.status==='pending_admin' && styles.dotPending,
              s?.status==='rejected' && styles.dotRejected
            ]}/>;
          })}
        </View>
      </Card>

      <SectionTitle>WEEKLY PLAN</SectionTitle>
      <View style={styles.dayRow}>
        {days.map(date=>{
          const a=byDate[date];
          const s=a?subByAssignment[a.id]:undefined;
          const active=selectedDate===date;
          return (
            <Pressable
              key={date}
              onPress={()=>setSelectedDate(date)}
              style={[styles.day,active&&styles.dayActive]}
            >
              <Text style={[styles.dayName,active&&styles.white]}>
                {fromIso(date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}
              </Text>
              <Text style={[styles.dayNum,active&&styles.white]}>{fromIso(date).getDate()}</Text>
              <Text style={[styles.dayState,active&&styles.white]}>
                {!a?'-':s?.status==='approved'?'VALID':s?.status==='pending_admin'?'PEND':s?.status==='rejected'?'REVISE':'OPEN'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>READ & RESPOND</SectionTitle>

      {!selected ? (
        <Card>
          <Text style={shared.h2}>No reading published for this day yet.</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.dateText}>
              {fromIso(selected.reading_date).toLocaleDateString(undefined,{
                weekday:'long',month:'long',day:'numeric',year:'numeric'
              })}
            </Text>

            {/* PATCH_154V_TODAYS_SCRIPTURE_LINK */}
            <Pressable
              disabled={selectedDate > today}
              onPress={openAssignedReading}
              accessibilityRole="button"
              accessibilityLabel="Open today's Scripture in Bible"
              style={({pressed})=>({
                opacity:
                  selectedDate > today
                    ? 0.45
                    : pressed
                      ? 0.72
                      : 1
              })}
            >
              <Text style={styles.reference}>
                {selected.bible_reference}
              </Text>

              <Text
                style={{
                  marginTop:5,
                  fontSize:11,
                  fontWeight:'900',
                  color:'#275D45'
                }}
              >
                OPEN IN BIBLE {'>'}
              </Text>
            </Pressable>
            {!!selected.instruction_fil && <Text style={styles.body}>{selected.instruction_fil}</Text>}

            {/* PATCH_153H_4A_READ_BUTTON */}
            
            {/* DAILY_READING_AUDIO_PREVIEW_V1 */}

            {selectedDate <= today && (

              <DailyReadingAudioPreview
                readingDate={
                  selected.reading_date
                }
                reference={
                  selected.bible_reference
                }
              />

            )}


<Pressable
              disabled={selectedDate > today}
              onPress={openAssignedReading}
              style={[
                styles.readBibleButton,
                selectedDate > today &&
                  styles.readBibleButtonOff,
              ]}
            >
              <View style={{flex:1}}>
                <Text style={styles.readBibleEyebrow}>
                  TODAY'S SCRIPTURE
                </Text>

                <Text style={styles.readBibleTitle}>
                  READ {selected.bible_reference}
                </Text>

                <Text style={styles.readBibleHelp}>
                  Open the full Bible text in ASD or KJV.
                </Text>
              </View>

              <Text style={styles.readBibleArrow}>
                READ {'>'}
              </Text>
            </Pressable>

            <Text style={styles.eyebrow}>
              RESPONSE LANGUAGE
            </Text>

            <View style={styles.langRow}>
              {(['fil','en'] as const).map(l=>(
                <Pressable key={l} disabled={locked} onPress={()=>setLanguage(l)} style={[styles.lang,language===l&&styles.langActive]}>
                  <Text style={[styles.langText,language===l&&styles.white]}>{l==='fil'?'FILIPINO':'ENGLISH'}</Text>
                </Pressable>
              ))}
            </View>

            <Text
              style={[
                styles.eyebrow,
                {marginTop:16}
              ]}
            >
              QUESTIONS ABOUT TODAY'S SCRIPTURE *
            </Text>

            <Text style={styles.help}>
              Answer all four questions before submitting your reflection.
            </Text>

            {chapterQuestions
              .slice(0,4)
              .map(
                (question: string,index: number)=>(
                  <View
                    key={index}
                    style={{marginTop:12}}
                  >
                    <Text style={styles.question}>
                      {index+1}. {question}
                    </Text>

                    <TextInput
                      value={
                        questionAnswers[index] ??
                        ''
                      }
                      onChangeText={(value)=>{
                        setQuestionAnswers(
                          current=>{
                            const next=[
                              ...current
                            ];

                            next[index]=value;

                            return next;
                          }
                        );
                      }}
                      multiline
                      textAlignVertical="top"
                      editable={!locked}
                      placeholder={
                        language==='fil'
                          ? 'Isulat ang sagot...'
                          : 'Write your answer...'
                      }
                      placeholderTextColor="#89958E"
                      style={[
                        styles.input,
                        {
                          minHeight:76,
                          marginTop:7
                        }
                      ]}
                    />

                    <Text style={styles.meta}>
                      {
                        String(
                          questionAnswers[index] ??
                          ''
                        ).trim().length
                      } characters | minimum 10
                    </Text>
                  </View>
                )
              )}

          </Card>
          <Card>
            <Text style={styles.eyebrow}>PERSONAL REFLECTION *</Text>
            <Text style={styles.help}>
              Answer the question in the app. A written answer of at least 20 characters is required. A photo is optional supporting evidence only.
            </Text>

            <TextInput
              value={answer}
              onChangeText={setAnswer}
              multiline
              textAlignVertical="top"
              editable={!locked}
              placeholder="Write your personal reflection and application..."
              placeholderTextColor="#89958E"
              style={styles.input}
            />
            <Text style={styles.meta}>{answer.trim().length} typed characters | minimum 20 required</Text>

            <EvidencePhoto
              title="OPTIONAL REFLECTION PHOTO"
              draft={reflectionDraft}
              existingPath={reflectionPhotoPath}
              busy={photoBusy==='reflection'}
              disabled={locked || photoBusy!==null}
              onPick={()=>pickPhoto('reflection')}
              onRemove={()=>{setReflectionDraft(null);setReflectionPhotoPath(null);}}
            />

            {selectedDate>today && <Text style={styles.warning}>This reading is not open yet.</Text>}
            {submission?.status==='pending_admin' && <Text style={styles.warning}>PENDING PASTOR APPROVAL | No BUKLOD Points awarded yet.</Text>}
            {submission?.status==='approved' && <Text style={styles.valid}>VALIDATED | +{points} BUKLOD Points</Text>}
            {submission?.status==='rejected' && (
              <Text style={styles.reject}>
                Revision requested{submission.admin_note?`: ${submission.admin_note}`:''}
              </Text>
            )}

            <Pressable
              disabled={!canSubmit || busy}
              onPress={submit}
              style={[styles.submit,(!canSubmit||busy)&&styles.submitOff]}
            >
              <Text style={styles.submitText}>
                {busy?'SUBMITTING...':submission?.status==='rejected'?'RESUBMIT EVIDENCE':'SUBMIT FOR PASTOR APPROVAL'}
              </Text>
            </Pressable>
          </Card>
        </>
      )}
    </ScrollView>
    </BuklodClusterMembershipGate>
  );
}

function EvidencePhoto({
  title,
  draft,
  existingPath,
  busy,
  disabled,
  onPick,
  onRemove,
}:{
  title:string;
  draft:PhotoDraft|null;
  existingPath:string|null;
  busy:boolean;
  disabled:boolean;
  onPick:()=>void;
  onRemove:()=>void;
}) {
  const attached = !!draft || !!existingPath;

  return (
    <View style={styles.photoBox}>
      <View style={styles.photoTop}>
        <View style={{flex:1}}>
          <Text style={styles.photoTitle}>{title}</Text>
          <Text style={styles.photoMeta}>{attached?'Photo attached':'Optional when typed evidence is complete'}</Text>
        </View>
        {attached && !disabled && (
          <Pressable onPress={onRemove}><Text style={styles.removeText}>REMOVE</Text></Pressable>
        )}
      </View>

      {!!draft?.uri && <Image source={{uri:draft.uri}} style={styles.preview} resizeMode="cover"/>}

      {!disabled && (
        <Pressable onPress={onPick} style={styles.photoButton}>
          <Text style={styles.photoButtonText}>{busy?'PREPARING...':attached?'REPLACE PHOTO':'ATTACH PHOTO'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  content:{paddingBottom:40,gap:14},
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},
  outline:{paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:'#D7DFDA',borderRadius:12},
  outlineText:{fontSize:11,fontWeight:'900',color:'#275D45'},
  eyebrow:{marginTop:4,fontSize:10.5,fontWeight:'900',color:'#6D7B73'},
  big:{marginTop:5,fontSize:22,fontWeight:'900',color:'#20352A'},
  meta:{marginTop:6,fontSize:11,color:'#718078'},
  dots:{flexDirection:'row',gap:7,marginTop:12},
  dot:{width:18,height:8,borderRadius:99,backgroundColor:'#E0E6E2'},
  dotApproved:{backgroundColor:'#275D45'},
  dotPending:{backgroundColor:'#D4A84F'},
  dotRejected:{backgroundColor:'#9B4A4A'},
  dayRow:{flexDirection:'row',gap:6},
  day:{flex:1,paddingVertical:9,alignItems:'center',borderRadius:13,borderWidth:1,borderColor:'#DDE4E0',backgroundColor:'#FFF'},
  dayActive:{backgroundColor:'#275D45',borderColor:'#275D45'},
  dayName:{fontSize:9,fontWeight:'900',color:'#738078'},
  dayNum:{fontSize:16,fontWeight:'900',color:'#26382F'},
  dayState:{fontSize:7.5,fontWeight:'900',color:'#849089'},
  white:{color:'#FFF'},
  dateText:{fontSize:12,fontWeight:'800',color:'#718078'},
  reference:{marginTop:7,fontSize:24,lineHeight:31,fontWeight:'900',color:'#21372C'},

  readBibleButton:{
    marginTop: 6,
    minHeight:84,
    flexDirection:'row',
    alignItems:'center',
    gap: 6,
    padding:14,
    borderRadius:16,
    borderWidth:1,
    borderColor:'#C8DDD1',
    backgroundColor:'#EEF7F2',
  },

  readBibleButtonOff:{
    opacity:.42,
  },

  readBibleEyebrow:{
    fontSize:8,
    fontWeight:'900',
    letterSpacing:.7,
    color:'#708177',
  },

  readBibleTitle:{
    marginTop:3,
    fontSize:15,
    fontWeight:'900',
    color:'#234A35',
  },

  readBibleHelp:{
    marginTop:4,
    fontSize:10,
    lineHeight:15,
    color:'#74837A',
  },

  readBibleArrow:{
    fontSize:10,
    fontWeight:'900',
    color:'#275D45',
  },
  body:{marginTop:10,fontSize:15,lineHeight:22,color:'#44534B'},
  question:{marginTop:7,fontSize:18,lineHeight:27,fontWeight:'700',color:'#24382E'},
  langRow:{flexDirection:'row',gap:8,marginTop:14},
  lang:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:'#EEF2F0'},
  langActive:{backgroundColor:'#275D45'},
  langText:{fontSize:10,fontWeight:'900',color:'#607068'},
  help:{marginTop:6,fontSize:12.5,lineHeight:19,color:'#65736B'},
  input:{marginTop:10,minHeight:135,borderWidth:1,borderColor:'#D8E0DB',borderRadius:16,padding:14,fontSize:15.5,lineHeight:23,color:'#23372D',backgroundColor:'#FBFCFB'},
  photoBox:{marginTop:12,padding:12,borderRadius:14,borderWidth:1,borderColor:'#DDE4E0',backgroundColor:'#F7F9F8'},
  photoTop:{flexDirection:'row',gap:10,alignItems:'center'},
  photoTitle:{fontSize:10,fontWeight:'900',color:'#536159'},
  photoMeta:{marginTop:3,fontSize:10.5,color:'#7A8780'},
  removeText:{fontSize:10,fontWeight:'900',color:'#9A4747'},
  preview:{marginTop:10,width:'100%',height:180,borderRadius:12,backgroundColor:'#E7ECE9'},
  photoButton:{marginTop:10,minHeight:42,borderRadius:12,borderWidth:1,borderColor:'#275D45',alignItems:'center',justifyContent:'center'},
  photoButtonText:{fontSize:10.5,fontWeight:'900',color:'#275D45'},
  warning:{marginTop:12,fontSize:12.5,fontWeight:'800',color:'#7B632A'},
  valid:{marginTop:12,fontSize:13,fontWeight:'900',color:'#275D45'},
  reject:{marginTop:12,fontSize:12.5,lineHeight:19,fontWeight:'800',color:'#8A3F3F'},
  submit:{marginTop:15,minHeight:50,borderRadius:15,backgroundColor:'#275D45',alignItems:'center',justifyContent:'center'},
  submitOff:{opacity:.38},
  submitText:{fontSize:12,fontWeight:'900',color:'#FFF'},
});

