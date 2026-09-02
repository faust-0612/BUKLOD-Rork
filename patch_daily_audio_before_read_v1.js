const fs = require("fs");

const path =
  "./src/app/bible/index.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function stop(message) {
  console.error("");
  console.error(
    "DAILY AUDIO PATCH STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "DAILY_READING_AUDIO_PREVIEW_V1"
  )
) {

  console.log(
    "Daily Reading Audio Preview already installed."
  );

  process.exit(0);

}


/* ==========================================================
   1. IMPORT SHARED VOICE READER
========================================================== */

if (
  !src.includes(
    "from '@/components/VoiceReader'"
  )
) {

  const importAnchor =
    "import { supabase } from '@/lib/supabase';";


  if (
    !src.includes(
      importAnchor
    )
  ) {
    stop(
      "Supabase import anchor not found."
    );
  }


  src =
    src.replace(
      importAnchor,
`${importAnchor}
import { VoiceReader } from '@/components/VoiceReader';`
    );

}


/* ==========================================================
   2. AUDIO PREVIEW COMPONENT

   Uses:
   - current preferred ASD/KJV
   - automatic Daily Bible plan
   - all chapters assigned for that day
   - NO spoken verse numbers
========================================================== */

const componentAnchor =
  "export default function";


if (
  !src.includes(
    componentAnchor
  )
) {
  stop(
    "Main Daily Bible component not found."
  );
}


const audioComponent =
`
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
    audioText,
    setAudioText,
  ] =
    useState<string[]>([]);


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

          setAudioText(
            []
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
                'Unable to identify today\\'s Bible reading.'
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


            const speech:
              string[] = [];


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


              const rows =
                (
                  result?.data ??
                  []
                ) as Array<{
                  book_name?: string;
                  chapter_no?: number;
                  verse_no?: number;
                  verse_text?: string;
                }>;


              if (
                rows.length === 0
              ) {
                continue;
              }


              const target =
                targets[index];


              const bookName =
                String(
                  rows[0]
                    ?.book_name ??
                  reference
                );


              /*
               * Chapter heading may be spoken.
               * Individual verse numbers are NOT.
               */
              speech.push(
                translation ===
                  'KJV'
                  ? \`\${bookName}, chapter \${target.chapterNo}.\`
                  : \`\${bookName}, kabanata \${target.chapterNo}.\`
              );


              for (
                const verse
                of rows
              ) {

                const clean =
                  String(
                    verse.verse_text ??
                    ''
                  )
                    .replace(
                      /^¶\\s*/,
                      ''
                    )
                    .trim();


                if (clean) {
                  speech.push(
                    clean
                  );
                }

              }

            }


            if (
              speech.length === 0
            ) {

              throw new Error(
                'Bible text is not available for this reading.'
              );

            }


            if (
              !cancelled
            ) {

              setAudioText(
                speech
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

      ) : audioText.length > 0 ? (

        <VoiceReader

          title="PAKINGGAN ANG READING OF THE DAY"

          language={
            audioTranslation ===
              'KJV'
              ? 'en-US'
              : 'fil-PH'
          }

          text={
            audioText
          }

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


`;


src =
  src.replace(
    componentAnchor,
    audioComponent +
    componentAnchor
  );


/* ==========================================================
   3. PLACE AUDIO IMMEDIATELY BEFORE READ BUTTON
========================================================== */

const readButtonMarker =
  "styles.readBibleButton";


const readStyleIndex =
  src.indexOf(
    readButtonMarker
  );


if (
  readStyleIndex < 0
) {
  stop(
    "Daily READ button style marker not found."
  );
}


/*
 * Find the Pressable that owns readBibleButton.
 */
const readPressableStart =
  src.lastIndexOf(
    "<Pressable",
    readStyleIndex
  );


if (
  readPressableStart < 0
) {
  stop(
    "Daily READ Pressable start not found."
  );
}


const audioUI =
`
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


`;


src =
  src.slice(
    0,
    readPressableStart
  ) +
  audioUI +
  src.slice(
    readPressableStart
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "DAILY AUDIO PREVIEW INSTALLED BEFORE READ"
);
