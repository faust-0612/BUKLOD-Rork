const fs = require("fs");

const path =
  "./src/app/(tabs)/home.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function stop(message) {

  console.error("");
  console.error("PATCH STOPPED:");
  console.error(message);

  process.exit(1);

}


/* ==========================================================
   ASYNC STORAGE IMPORT
========================================================== */

if (
  !src.includes(
    "from '@react-native-async-storage/async-storage'"
  )
) {

  const anchor =
    "import { router } from 'expo-router';";


  if (
    !src.includes(
      anchor
    )
  ) {

    stop(
      "expo-router import anchor not found."
    );

  }


  src =
    src.replace(
      anchor,
`import AsyncStorage from '@react-native-async-storage/async-storage';

${anchor}`
    );

}


/* ==========================================================
   TRANSLATION HELPERS
========================================================== */

const componentAnchor =
  "function HomeChurchNewsCarousel()";


if (
  !src.includes(
    componentAnchor
  )
) {

  stop(
    "HomeChurchNewsCarousel not found."
  );

}


if (
  !src.includes(
    "HOME_NEWS_LOCAL_TAGALOG_V1"
  )
) {

  const helper =
`

/* ============================================================
   HOME_NEWS_LOCAL_TAGALOG_V1

   FREE / JS-ONLY FLOW

   English source
        ↓
   MyMemory free sentence translation
        ↓
   Local BUKLOD Tagalog reconstruction
        ↓
   AsyncStorage cache
        ↓
   TAGALOG / ORIGINAL toggle
============================================================ */


type LocalTagalogNews = {

  source:
    string;

  title:
    string;

  summary:
    string | null;

  translated_at:
    string;

};


type LocalTagalogNewsCache =
  Record<
    string,
    LocalTagalogNews
  >;


const HOME_NEWS_TAGALOG_CACHE_KEY =
  'buklod.home.church_news.tagalog.v1';


function cleanTranslatedNewsText(
  value:
    string
) {

  return String(
    value ??
    ''
  )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;|&apos;/gi,
      "'"
    )
    .replace(
      /&amp;/gi,
      '&'
    )
    .replace(
      /&lt;/gi,
      '<'
    )
    .replace(
      /&gt;/gi,
      '>'
    )
    .replace(
      /\\s+/g,
      ' '
    )
    .trim();

}


function capitalizeFirst(
  value:
    string
) {

  if (!value) {
    return value;
  }


  return (
    value
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  );

}


/*
 * This does NOT touch the original English.
 *
 * These are presentation rules only for the
 * locally translated Tagalog copy.
 */
function reconstructChurchTagalog(
  input:
    string
) {

  let text =
    cleanTranslatedNewsText(
      input
    );


  /*
   * Church terminology.
   */
  text =
    text
      .replace(
        /\\bmga simbahan\\b/gi,
        'mga iglesia'
      )
      .replace(
        /\\bsimbahan\\b/gi,
        'iglesia'
      )
      .replace(
        /\\bmga bautista\\b/gi,
        'mga Baptist'
      )
      .replace(
        /\\bbautista\\b/gi,
        'Baptist'
      )
      .replace(
        /\\bebanghelyo\\b/gi,
        'Ebanghelyo'
      )
      .replace(
        /\\bmga misyonero\\b/gi,
        'mga misyonero'
      )
      .replace(
        /\\bmisyonero\\b/gi,
        'misyonero'
      )
      .replace(
        /\\bmga misyon\\b/gi,
        'mga gawaing misyon'
      )
      .replace(
        /\\bministeryo\\b/gi,
        'ministeryo'
      )
      .replace(
        /\\bpastor\\b/gi,
        'pastor'
      );


  /*
   * Make common machine-translated
   * "Ang X ay nag..." sentences sound
   * more naturally Filipino:
   *
   * Ang mga iglesia ay naglunsad...
   *      ↓
   * Naglunsad ang mga iglesia...
   */
  const angNag =
    text.match(
      /^Ang\\s+(.+?)\\s+ay\\s+(nag[A-Za-zÀ-ÖØ-öø-ÿ-]+)(.*)$/i
    );


  if (
    angNag
  ) {

    text =
      capitalizeFirst(
        angNag[2]
      ) +
      ' ang ' +
      angNag[1] +
      angNag[3];

  }


  /*
   * Si Juan ay nagsabi...
   *      ↓
   * Nagsabi si Juan...
   */
  const siNag =
    text.match(
      /^Si\\s+(.+?)\\s+ay\\s+(nag[A-Za-zÀ-ÖØ-öø-ÿ-]+)(.*)$/i
    );


  if (
    siNag
  ) {

    text =
      capitalizeFirst(
        siNag[2]
      ) +
      ' si ' +
      siNag[1] +
      siNag[3];

  }


  /*
   * Clean common mechanical phrasing.
   */
  text =
    text
      .replace(
        /\\bsa pamamagitan ng kanilang mga pagsisikap\\b/gi,
        'sa kanilang mga gawain'
      )
      .replace(
        /\\bsa komunidad ng simbahan\\b/gi,
        'sa komunidad ng iglesia'
      )
      .replace(
        /\\bKristiyanong ministeryo\\b/gi,
        'Christian ministry'
      )
      .replace(
        /\\s+([,.!?;:])/g,
        '$1'
      )
      .replace(
        /\\s+/g,
        ' '
      )
      .trim();


  return text;

}


/*
 * MyMemory accepts short translation segments.
 * We keep each request comfortably below the
 * service's maximum by using ~350-char chunks.
 */
function splitNewsForTranslation(
  input:
    string
) {

  const text =
    String(
      input ??
      ''
    )
      .replace(
        /\\s+/g,
        ' '
      )
      .trim();


  if (!text) {
    return [];
  }


  const sentences =
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ??
    [
      text,
    ];


  const chunks:
    string[] = [];


  for (
    const sentence
    of sentences
  ) {

    const clean =
      sentence.trim();


    if (
      clean.length <=
      350
    ) {

      chunks.push(
        clean
      );

      continue;

    }


    const words =
      clean.split(
        /\\s+/
      );


    let current =
      '';


    for (
      const word
      of words
    ) {

      const candidate =
        current
          ? current +
            ' ' +
            word
          : word;


      if (
        candidate.length >
        350
      ) {

        if (
          current
        ) {

          chunks.push(
            current
          );

        }


        current =
          word;

      }
      else {

        current =
          candidate;

      }

    }


    if (
      current
    ) {

      chunks.push(
        current
      );

    }

  }


  return chunks;

}


async function translateNewsSegmentToTagalog(
  segment:
    string
) {

  const url =
    'https://api.mymemory.translated.net/get' +
    '?q=' +
    encodeURIComponent(
      segment
    ) +
    '&langpair=en%7Ctl' +
    '&mt=1';


  const response =
    await fetch(
      url,
      {
        method:
          'GET',

        headers: {
          Accept:
            'application/json',
        },
      }
    );


  if (
    !response.ok
  ) {

    throw new Error(
      'Translation HTTP ' +
      response.status
    );

  }


  const payload =
    await response.json();


  const translated =
    payload
      ?.responseData
      ?.translatedText;


  if (
    typeof translated !==
      'string' ||
    !translated.trim()
  ) {

    const details =
      payload
        ?.responseDetails;


    throw new Error(
      typeof details ===
        'string'
        ? details
        : 'Translation returned no text.'
    );

  }


  return cleanTranslatedNewsText(
    translated
  );

}


async function translateNewsToTagalog(
  input:
    string
) {

  const chunks =
    splitNewsForTranslation(
      input
    );


  if (
    chunks.length ===
    0
  ) {

    return '';

  }


  const translated:
    string[] = [];


  /*
   * Sequential requests are intentional.
   * We do not flood the free service.
   */
  for (
    const chunk
    of chunks
  ) {

    const result =
      await translateNewsSegmentToTagalog(
        chunk
      );


    translated.push(
      result
    );

  }


  return reconstructChurchTagalog(
    translated.join(
      ' '
    )
  );

}


async function readHomeNewsTagalogCache() {

  try {

    const raw =
      await AsyncStorage
        .getItem(
          HOME_NEWS_TAGALOG_CACHE_KEY
        );


    if (!raw) {
      return {};
    }


    const parsed =
      JSON.parse(
        raw
      );


    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {

      return {};

    }


    return parsed as
      LocalTagalogNewsCache;

  }
  catch {

    return {};

  }

}


async function saveHomeNewsTagalogCache(
  cache:
    LocalTagalogNewsCache
) {

  try {

    /*
     * Keep the local cache reasonably small.
     */
    const entries =
      Object.entries(
        cache
      )
        .sort(
          (
            a,
            b
          ) =>
            String(
              b[1]
                ?.translated_at ??
              ''
            ).localeCompare(
              String(
                a[1]
                  ?.translated_at ??
                ''
              )
            )
        )
        .slice(
          0,
          100
        );


    await AsyncStorage
      .setItem(
        HOME_NEWS_TAGALOG_CACHE_KEY,
        JSON.stringify(
          Object.fromEntries(
            entries
          )
        )
      );

  }
  catch {
    // Translation still displays during this session.
  }

}


`;


  src =
    src.replace(
      componentAnchor,
      helper +
      componentAnchor
    );

}


/* ==========================================================
   ADD LOCAL TRANSLATION STATE
========================================================== */

if (
  !src.includes(
    "HOME_NEWS_LOCAL_TRANSLATION_STATE_V1"
  )
) {

  const stateAnchor =
`  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(0);`;


  if (
    !src.includes(
      stateAnchor
    )
  ) {

    stop(
      "activeIndex state anchor not found."
    );

  }


  src =
    src.replace(
      stateAnchor,
`${stateAnchor}


  /* HOME_NEWS_LOCAL_TRANSLATION_STATE_V1 */

  const [
    localTagalog,
    setLocalTagalog,
  ] =
    useState<
      LocalTagalogNewsCache
    >({});


  const [
    translatingTagalog,
    setTranslatingTagalog,
  ] =
    useState(false);`
    );

}


/* ==========================================================
   ADD AUTOMATIC BACKGROUND TRANSLATION
========================================================== */

if (
  !src.includes(
    "HOME_NEWS_AUTO_TRANSLATE_EFFECT_V1"
  )
) {

  const renderAnchor =
`  return (

    <View`;


  const componentStart =
    src.indexOf(
      componentAnchor
    );


  const renderStart =
    src.indexOf(
      renderAnchor,
      componentStart
    );


  if (
    componentStart < 0 ||
    renderStart < 0
  ) {

    stop(
      "HomeChurchNewsCarousel return anchor not found."
    );

  }


  const effect =
`

  /* ========================================================
     HOME_NEWS_AUTO_TRANSLATE_EFFECT_V1
  ======================================================== */

  useEffect(
    () => {

      let active =
        true;


      if (
        items.length ===
        0
      ) {

        return () => {

          active =
            false;

        };

      }


      const run =
        async () => {

          const cache =
            await readHomeNewsTagalogCache();


          if (
            !active
          ) {
            return;
          }


          setLocalTagalog({
            ...cache,
          });


          setTranslatingTagalog(
            true
          );


          /*
           * Home currently shows up to 10 news.
           * Translate only those currently loaded.
           */
          for (
            const item
            of items.slice(
              0,
              10
            )
          ) {

            if (
              !active
            ) {
              break;
            }


            const sourceFingerprint =
              item.original_title +
              '\\n' +
              (
                item.english_summary ??
                ''
              );


            const existing =
              cache[
                item.id
              ];


            if (
              existing &&
              existing.source ===
                sourceFingerprint &&
              existing.title
            ) {

              continue;

            }


            try {

              const translatedTitle =
                await translateNewsToTagalog(
                  item.original_title
                );


              let translatedSummary:
                string |
                null =
                  null;


              if (
                item
                  .english_summary
                  ?.trim()
              ) {

                translatedSummary =
                  await translateNewsToTagalog(
                    item
                      .english_summary
                  );

              }


              cache[
                item.id
              ] = {

                source:
                  sourceFingerprint,

                title:
                  translatedTitle ||
                  item.original_title,

                summary:
                  translatedSummary,

                translated_at:
                  new Date()
                    .toISOString(),

              };


              if (
                active
              ) {

                setLocalTagalog({
                  ...cache,
                });

              }


              await saveHomeNewsTagalogCache(
                cache
              );

            }
            catch (
              error
            ) {

              console.warn(
                'Home News Tagalog:',
                String(
                  error
                )
              );


              /*
               * Stop the batch when the free service
               * reaches a quota/rate limit.
               * Existing cached translations remain.
               */
              break;

            }

          }


          if (
            active
          ) {

            setTranslatingTagalog(
              false
            );

          }

        };


      void run();


      return () => {

        active =
          false;

      };

    },
    [
      items,
    ]
  );


`;


  src =
    src.slice(
      0,
      renderStart
    ) +
    effect +
    src.slice(
      renderStart
    );

}


/* ==========================================================
   USE LOCAL TRANSLATION IN CARD
========================================================== */

const oldTitleBlock =
`                const title =
                  language ===
                    'fil'
                    ? (
                        item
                          .tagalog_title ||
                        item
                          .original_title
                      )
                    : item
                        .original_title;


                const summary =
                  language ===
                    'fil'
                    ? (
                        item
                          .tagalog_summary ||
                        item
                          .english_summary
                      )
                    : item
                        .english_summary;`;


const newTitleBlock =
`                const localTranslation =
                  localTagalog[
                    item.id
                  ];


                const title =
                  language ===
                    'fil'
                    ? (
                        localTranslation
                          ?.title ||
                        item
                          .tagalog_title ||
                        item
                          .original_title
                      )
                    : item
                        .original_title;


                const summary =
                  language ===
                    'fil'
                    ? (
                        localTranslation
                          ?.summary ||
                        item
                          .tagalog_summary ||
                        item
                          .english_summary
                      )
                    : item
                        .english_summary;`;


if (
  src.includes(
    oldTitleBlock
  )
) {

  src =
    src.replace(
      oldTitleBlock,
      newTitleBlock
    );

}
else if (
  !src.includes(
    "const localTranslation ="
  )
) {

  stop(
    "News title/summary render block not found."
  );

}


/* ==========================================================
   SHOW TRANSLATION STATUS
========================================================== */

const oldSubtitle =
`            Baptist • Missions • Evangelical`;


if (
  src.includes(
    oldSubtitle
  ) &&
  !src.includes(
    "Isinasalin sa Tagalog"
  )
) {

  src =
    src.replace(
      oldSubtitle,
`            {language === 'fil' &&
            translatingTagalog
              ? 'Isinasalin sa Tagalog...'
              : 'Baptist • Missions • Evangelical'}`
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "LOCAL TAGALOG NEWS INSTALLED"
);
