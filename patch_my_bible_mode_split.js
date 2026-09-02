const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function stop(message) {
  console.error("");
  console.error(
    "MY BIBLE MODE SPLIT STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "MY_BIBLE_MODE_SPLIT_V1"
  )
) {
  console.log(
    "MY BIBLE MODE SPLIT ALREADY INSTALLED"
  );

  process.exit(0);
}


/* ============================================================
   1. FIX COLORS IMPORT
   ============================================================ */

if (
  !/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*['"]@\/lib\/theme['"]/
    .test(src)
) {

  if (
    /from\s*['"]@\/lib\/theme['"]/
      .test(src)
  ) {

    src =
      src.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/theme['"];/,
        (match, names) => {

          const clean =
            names.trim();

          return (
            "import { " +
            (
              clean
                ? clean + ", colors"
                : "colors"
            ) +
            " } from '@/lib/theme';"
          );
        }
      );

  }
  else {

    const supabaseImport =
      "import { supabase } from '@/lib/supabase';";

    if (
      !src.includes(
        supabaseImport
      )
    ) {
      stop(
        "Supabase import anchor not found."
      );
    }


    src =
      src.replace(
        supabaseImport,
`${supabaseImport}
import { colors } from '@/lib/theme';`
      );
  }

}


/* ============================================================
   2. ADD useLocalSearchParams
   ============================================================ */

const routerImportPattern =
  /import\s*\{([^}]*)\}\s*from\s*['"]expo-router['"];/m;

const routerMatch =
  src.match(
    routerImportPattern
  );


if (!routerMatch) {
  stop(
    "expo-router import not found."
  );
}


if (
  !/\buseLocalSearchParams\b/
    .test(
      routerMatch[1]
    )
) {

  let names =
    routerMatch[1]
      .trim();


  names +=
    names
      ? ", useLocalSearchParams"
      : "useLocalSearchParams";


  src =
    src.replace(
      routerImportPattern,
      "import { " +
      names +
      " } from 'expo-router';"
    );

}


/* ============================================================
   3. CREATE MODE FLAGS
   ============================================================ */

const annotationMarker =
  "  /* ==========================================================\n     MY_BIBLE_ANNOTATIONS_V1";


const markerIndex =
  src.indexOf(
    annotationMarker
  );


if (
  markerIndex < 0
) {
  stop(
    "MY_BIBLE_ANNOTATIONS_V1 marker not found."
  );
}


const modeLogic =
`  /* ==========================================================
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
    bibleReaderSource ===
    'my_bible';


  const isDailyReadingMode =
    bibleReaderSource ===
    'daily_plan';


`;


src =
  src.slice(
    0,
    markerIndex
  ) +
  modeLogic +
  src.slice(
    markerIndex
  );


/* ============================================================
   4. ADD MODE HEADER

   MY BIBLE:
   easy navigation / search / annotations

   DAILY:
   focused guided reading
   ============================================================ */

const bibleVersionIndex =
  src.indexOf(
    "BIBLE VERSION"
  );


if (
  bibleVersionIndex < 0
) {
  stop(
    "BIBLE VERSION heading not found."
  );
}


const bibleVersionTextStart =
  src.lastIndexOf(
    "<Text",
    bibleVersionIndex
  );


if (
  bibleVersionTextStart < 0
) {
  stop(
    "BIBLE VERSION Text start not found."
  );
}


const lineStart =
  src.lastIndexOf(
    "\n",
    bibleVersionTextStart
  ) + 1;


const modeHeader =
`      {/* MY_BIBLE_MODE_HEADER_V1 */}

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


`;


src =
  src.slice(
    0,
    lineStart
  ) +
  modeHeader +
  src.slice(
    lineStart
  );


/* ============================================================
   HELPER:
   WRAP ONE LAUNCH CARD IN MY BIBLE MODE
   ============================================================ */

function wrapPressableByStyle(
  source,
  styleName
) {

  const styleNeedle =
    "style={styles." +
    styleName +
    "}";


  const styleIndex =
    source.indexOf(
      styleNeedle
    );


  if (
    styleIndex < 0
  ) {
    console.log(
      styleName +
      " card not found - skipping."
    );

    return source;
  }


  const start =
    source.lastIndexOf(
      "<Pressable",
      styleIndex
    );


  if (
    start < 0
  ) {
    stop(
      styleName +
      " Pressable start not found."
    );
  }


  const lineStart =
    source.lastIndexOf(
      "\n",
      start
    ) + 1;


  const closingIndex =
    source.indexOf(
      "</Pressable>",
      styleIndex
    );


  if (
    closingIndex < 0
  ) {
    stop(
      styleName +
      " Pressable closing not found."
    );
  }


  const closingEnd =
    closingIndex +
    "</Pressable>".length;


  const block =
    source.slice(
      lineStart,
      closingEnd
    );


  const wrapped =
`      {isMyBibleMode && (
        <>
${block}
        </>
      )}`;


  return (
    source.slice(
      0,
      lineStart
    ) +
    wrapped +
    source.slice(
      closingEnd
    )
  );

}


/* Report is MY BIBLE feature */
src =
  wrapPressableByStyle(
    src,
    "reportLaunch"
  );


/* Word/phrase search launch is MY BIBLE feature */
src =
  wrapPressableByStyle(
    src,
    "searchLaunch"
  );


/* ============================================================
   5. HIDE SELECT PASSAGE +
      QUICK CHAPTER SEARCH FROM DAILY MODE
   ============================================================ */

const selectMatch =
  src.match(
    /<SectionTitle>\s*SELECT PASSAGE\s*<\/SectionTitle>/
  );


if (
  !selectMatch ||
  selectMatch.index ===
    undefined
) {
  stop(
    "SELECT PASSAGE section not found."
  );
}


const selectStart =
  src.lastIndexOf(
    "\n",
    selectMatch.index
  ) + 1;


/*
 * Find the next main CHAPTER section.
 */
const chapterWordIndex =
  src.indexOf(
    "          CHAPTER\n",
    selectMatch.index
  );


if (
  chapterWordIndex < 0
) {
  stop(
    "Main CHAPTER section not found after SELECT PASSAGE."
  );
}


const chapterCommentStart =
  src.lastIndexOf(
    "      {/*",
    chapterWordIndex
  );


if (
  chapterCommentStart < 0
) {
  stop(
    "CHAPTER comment boundary not found."
  );
}


const navigationBlock =
  src.slice(
    selectStart,
    chapterCommentStart
  );


const wrappedNavigation =
`      {/* MY_BIBLE_FULL_NAVIGATION_V1 */}
      {isMyBibleMode && (
        <>
${navigationBlock}
        </>
      )}


`;


src =
  src.slice(
    0,
    selectStart
  ) +
  wrappedNavigation +
  src.slice(
    chapterCommentStart
  );


/* ============================================================
   6. ANNOTATIONS ONLY IN MY BIBLE

   Daily Reading verses stay clean and focused.
   ============================================================ */

src =
  src.replace(
    /onPress=\{\(\)\s*=>\s*openBibleAnnotation\(\s*Number\(\s*verse\.verse_no\s*\),\s*cleanText\s*\)\s*\}/m,
`onPress={
                      isMyBibleMode
                        ? () =>
                            openBibleAnnotation(
                              Number(
                                verse.verse_no
                              ),
                              cleanText
                            )
                        : undefined
                    }`
  );


/*
 * Highlight background should not appear in
 * guided Daily Reading.
 */
src =
  src.replace(
    /annotation\s*\?\s*\.highlight_color\s*\?/g,
    "isMyBibleMode &&\n                      annotation\n                        ?.highlight_color\n                        ?"
  );


/*
 * Note badge only in MY BIBLE.
 */
src =
  src.replace(
    /\{annotation\s*\?\s*\.note_text\s*&&\s*\(/g,
    "{isMyBibleMode && annotation?.note_text && ("
  );


/*
 * Modal cannot open from Daily Reading.
 */
src =
  src.replace(
    /visible=\{\s*annotationModalVisible\s*\}/,
`visible={
          isMyBibleMode &&
          annotationModalVisible
        }`
  );


/* ============================================================
   SAVE
   ============================================================ */

fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "MY BIBLE / DAILY READING MODES SEPARATED"
);

console.log(
  "MY BIBLE = FULL NAVIGATION + SEARCH + NOTES"
);

console.log(
  "DAILY READING = GUIDED READING"
);
