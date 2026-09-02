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
    "BIBLE RESPONSIVE READER STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "BIBLE_RESPONSIVE_READER_V1"
  )
) {
  console.log(
    "Bible responsive reader already installed."
  );

  process.exit(0);
}


/* ============================================================
   1. ADD useWindowDimensions
   ============================================================ */

if (
  !src.includes(
    "useWindowDimensions"
  )
) {

  const importPattern =
    /import\s*\{([\s\S]*?)\}\s*from\s*'react-native';/m;


  const match =
    src.match(
      importPattern
    );


  if (!match) {
    stop(
      "React Native import block not found."
    );
  }


  const inner =
    match[1];


  const replacement =
`import {
${inner.trimEnd()}
  useWindowDimensions,
} from 'react-native';`;


  src =
    src.replace(
      importPattern,
      replacement
    );

}


/* ============================================================
   2. RESPONSIVE READER STATE
   Insert immediately before currentBook
   ============================================================ */

const currentBookAnchor =
`  const currentBook = useMemo(`;


if (
  !src.includes(
    currentBookAnchor
  )
) {
  stop(
    "currentBook anchor not found."
  );
}


const responsiveLogic =
`  /* BIBLE_RESPONSIVE_READER_V1 */

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


`;


src =
  src.replace(
    currentBookAnchor,
    responsiveLogic +
    currentBookAnchor
  );


/* ============================================================
   3. ADD VIEW / ZOOM TOOLBAR
   Directly before chapter content.
   ============================================================ */

const chapterAnchor =
`        {chapterLoading ? (`;


if (
  !src.includes(
    chapterAnchor
  )
) {
  stop(
    "Bible chapter content anchor not found."
  );
}


const readerToolbar =
`        {/* BIBLE RESPONSIVE VIEW CONTROLS */}

        {!chapterLoading &&
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


`;


src =
  src.replace(
    chapterAnchor,
    readerToolbar +
    chapterAnchor
  );


/* ============================================================
   4. RESPONSIVE VERSE NUMBER
   ============================================================ */

const verseNumberPattern =
/style=\{\s*styles\.verseNumber\s*\}/m;


if (
  !verseNumberPattern.test(
    src
  )
) {
  stop(
    "verseNumber style anchor not found."
  );
}


src =
  src.replace(
    verseNumberPattern,
`style={[
                        styles.verseNumber,
                        {
                          fontSize:
                            11 *
                            bibleZoom,

                          lineHeight:
                            28 *
                            bibleZoom,
                        },
                      ]}`
  );


/* ============================================================
   5. RESPONSIVE VERSE TEXT
   ============================================================ */

const verseTextPattern =
/style=\{\s*styles\.verseText\s*\}/m;


if (
  !verseTextPattern.test(
    src
  )
) {
  stop(
    "verseText style anchor not found."
  );
}


src =
  src.replace(
    verseTextPattern,
`style={[
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
                      ]}`
  );


/* ============================================================
   6. RESPONSIVE CONTENT WIDTH
   Main ScrollView
   ============================================================ */

const mainScroll =
`    <ScrollView
      style={shared.screen}
      contentContainerStyle={[
        shared.content,
        styles.content,
      ]}
    >`;


if (
  src.includes(
    mainScroll
  )
) {

  src =
    src.replace(
      mainScroll,
`    <ScrollView
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
    >`
    );

}


/* ============================================================
   7. STYLES
   ============================================================ */

const styleEnd =
  src.lastIndexOf(
    "});"
  );


if (
  styleEnd < 0
) {
  stop(
    "Bible stylesheet end not found."
  );
}


const responsiveStyles =
`,

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
    }`;


src =
  src.slice(
    0,
    styleEnd
  ) +
  responsiveStyles +
  "\n" +
  src.slice(
    styleEnd
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "BIBLE RESPONSIVE READER INSTALLED"
);

console.log(
  "PORTRAIT / LANDSCAPE DETECTION INSTALLED"
);

console.log(
  "A- / A+ ZOOM INSTALLED"
);

console.log(
  "AUTO FIT INSTALLED"
);

console.log(
  "RESPONSIVE VERSE REFLOW INSTALLED"
);
