const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(path, "utf8");


function stop(message) {
  console.error("");
  console.error("MY BIBLE PATCH STOPPED:");
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "MY_BIBLE_VERSE_CONTINUOUS_V1"
  )
) {
  console.log(
    "My Bible Verse + Continuous already installed."
  );
  process.exit(0);
}


/* ==========================================================
   1. STATES
========================================================== */

const stateAnchor =
`  const [showChapters, setShowChapters] =
    useState(false);`;


if (!src.includes(stateAnchor)) {
  stop("showChapters state anchor not found.");
}


src =
  src.replace(
    stateAnchor,
`${stateAnchor}


  /* MY_BIBLE_VERSE_CONTINUOUS_V1 */

  const [showVerses, setShowVerses] =
    useState(false);


  const [
    selectedVerseNo,
    setSelectedVerseNo,
  ] =
    useState(
      requestedVerse > 0
        ? requestedVerse
        : 0
    );


  const [
    continuousReading,
    setContinuousReading,
  ] =
    useState(false);`
  );


/* ==========================================================
   2. BOOK SELECTION
========================================================== */

const oldBookEnd =
`      setShowBooks(false);
      setShowChapters(true);
    };`;


if (!src.includes(oldBookEnd)) {
  stop("selectBook ending not found.");
}


src =
  src.replace(
    oldBookEnd,
`      setSelectedVerseNo(0);

      setShowBooks(false);
      setShowChapters(true);
      setShowVerses(false);
    };`
  );


/* ==========================================================
   3. CHAPTER SELECTION + VERSE SELECTION
========================================================== */

const oldChapter =
`      setChapterNo(nextChapter);
      setShowChapters(false);
    };`;


if (!src.includes(oldChapter)) {
  stop("selectChapter block not found.");
}


src =
  src.replace(
    oldChapter,
`      setChapterNo(nextChapter);

      setSelectedVerseNo(0);

      setShowChapters(false);
      setShowVerses(false);
    };


  const selectVerse =
    (
      nextVerse: number
    ) => {

      setSelectedVerseNo(
        nextVerse
      );

      setShowVerses(false);

    };`
  );


/* ==========================================================
   4. CONTINUOUS ADVANCE ENGINE
========================================================== */

const moveChapterIndex =
  src.indexOf(
    "  const moveChapter ="
  );


if (moveChapterIndex < 0) {
  stop("moveChapter function not found.");
}


/*
 * Insert continuous function before moveChapter.
 */
const continuousFunction =
`
  /*
   * MY BIBLE CONTINUOUS READING
   *
   * Current chapter
   * -> next chapter
   * -> next Bible book chapter 1
   * -> Revelation 22 then stop.
   */
  const advanceContinuousReading =
    () => {

      if (
        source !== 'my_bible' ||
        !continuousReading ||
        !currentBook
      ) {
        return;
      }


      setSelectedVerseNo(0);


      const chapterCount =
        Number(
          currentBook.chapter_count
        );


      /*
       * Same book -> next chapter.
       */
      if (
        chapterNo <
        chapterCount
      ) {

        setChapterNo(
          chapterNo + 1
        );

        return;

      }


      /*
       * End of book -> next available book.
       */
      const nextBook =
        [...books]
          .sort(
            (a, b) =>
              Number(a.book_no) -
              Number(b.book_no)
          )
          .find(
            book =>
              Number(
                book.book_no
              ) >
              bookNo
          );


      /*
       * Revelation 22 / final available chapter.
       */
      if (!nextBook) {

        setContinuousReading(
          false
        );

        return;

      }


      setBookNo(
        Number(
          nextBook.book_no
        )
      );

      setChapterNo(1);

    };


`;


src =
  src.slice(
    0,
    moveChapterIndex
  ) +
  continuousFunction +
  src.slice(
    moveChapterIndex
  );


/* ==========================================================
   5. THREE SELECTORS: BOOK / CHAPTER / VERSE
========================================================== */

/*
 * When BOOK opens, close VERSE.
 */
src =
  src.replace(
`              setShowChapters(
                false
              );`,
`              setShowChapters(
                false
              );

              setShowVerses(
                false
              );`
  );


/*
 * Find CHAPTER selector closing Pressable and
 * add VERSE selector before selectorRow closes.
 */
const chapterValueAnchor =
`              {chapterNo}
            </Text>
          </Pressable>
        </View>`;


if (!src.includes(chapterValueAnchor)) {
  stop("Chapter selector JSX anchor not found.");
}


src =
  src.replace(
    chapterValueAnchor,
`              {chapterNo}
            </Text>
          </Pressable>


          {/* ================================
              VERSE SELECTOR
          ================================= */}

          <Pressable
            onPress={() => {

              setShowVerses(
                v => !v
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
                selectedVerseNo > 0
                  ? selectedVerseNo
                  : 'ALL'
              }
            </Text>

          </Pressable>

        </View>`
  );


/* ==========================================================
   6. VERSE GRID
========================================================== */

const selectorCardEnd =
`          )}
      </Card>`;


const selectorCardIndex =
  src.indexOf(
    selectorCardEnd,
    src.indexOf(
      "SELECT PASSAGE"
    )
  );


if (selectorCardIndex < 0) {
  stop("Select Passage Card ending not found.");
}


const verseGrid =
`
        

        {/* ================================================
            MY BIBLE VERSE SELECTOR GRID
        ================================================= */}

        {showVerses &&
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
                  selectedVerseNo ===
                  verseNo;


                return (

                  <Pressable
                    key={
                      verseNo
                    }

                    onPress={() =>
                      selectVerse(
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

`;


src =
  src.slice(
    0,
    selectorCardIndex
  ) +
  verseGrid +
  src.slice(
    selectorCardIndex
  );


/* ==========================================================
   7. SELECTED VERSE HIGHLIGHT
========================================================== */

const oldFocused =
`const focused =
                  requestedVerse >
                    0 &&
                  Number(
                    verse.verse_no
                  ) ===
                    requestedVerse;`;


if (
  src.includes(
    oldFocused
  )
) {

  src =
    src.replace(
      oldFocused,
`const focusVerseNo =
                  selectedVerseNo > 0
                    ? selectedVerseNo
                    : requestedVerse;


                const focused =
                  focusVerseNo >
                    0 &&
                  Number(
                    verse.verse_no
                  ) ===
                    focusVerseNo;`
    );

}


/* ==========================================================
   8. FULL MY BIBLE VOICE READER

   There may now be 2 VoiceReaders:
   - Daily Devotion
   - My Bible

   We modify LAST one only.
========================================================== */

const voiceMatches =
  [...src.matchAll(
    /<VoiceReader[\s\S]*?\/>/g
  )];


if (!voiceMatches.length) {
  stop("No VoiceReader JSX found.");
}


const lastVoice =
  voiceMatches[
    voiceMatches.length - 1
  ];


const originalVoice =
  lastVoice[0];


let newVoice =
  originalVoice;


/*
 * Do not duplicate continuous props.
 */
if (
  !newVoice.includes(
    "autoPlay="
  )
) {

  newVoice =
    newVoice.replace(
      "<VoiceReader",
`<VoiceReader

            autoPlay={
              source === 'my_bible' &&
              continuousReading
            }

            onUserStart={() => {

              if (
                source ===
                'my_bible'
              ) {

                setContinuousReading(
                  true
                );

              }

            }}

            onUserStop={() => {

              if (
                source ===
                'my_bible'
              ) {

                setContinuousReading(
                  false
                );

              }

            }}

            onFinished={
              advanceContinuousReading
            }`
    );

}


/*
 * Remove spoken "Talata 1..." here as well.
 * VoiceReader also has a final sanitizer,
 * but source text should already be clean.
 */
newVoice =
  newVoice.replace(
    /'Talata '\s*\+\s*Number\(\s*verse\.verse_no\s*\)\s*\+\s*'\. '\s*\+\s*/g,
    ""
  );


src =
  src.slice(
    0,
    lastVoice.index
  ) +
  newVoice +
  src.slice(
    lastVoice.index +
    originalVoice.length
  );


/* ==========================================================
   9. CONTINUOUS STATUS UNDER MY BIBLE VOICE
========================================================== */

const updatedVoiceIndex =
  src.lastIndexOf(
    newVoice
  );


const voiceClose =
  updatedVoiceIndex +
  newVoice.length;


const statusUI =
`

        {source === 'my_bible' &&
          continuousReading && (

          <View
            style={{
              marginTop:
                8,

              paddingHorizontal:
                11,

              paddingVertical:
                8,

              borderRadius:
                10,

              backgroundColor:
                '#EEF6F1',
            }}
          >

            <Text
              style={{
                fontSize:
                  9,

                fontWeight:
                  '900',

                color:
                  '#275D45',
              }}
            >
              CONTINUOUS READING ON
            </Text>

            <Text
              style={{
                marginTop:
                  2,

                fontSize:
                  8.5,

                color:
                  '#64746B',
              }}
            >
              Next chapter and next book will play automatically.
            </Text>

          </View>

        )}
`;


src =
  src.slice(
    0,
    voiceClose
  ) +
  statusUI +
  src.slice(
    voiceClose
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "MY BIBLE VERSE SELECTOR INSTALLED"
);

console.log(
  "CONTINUOUS CHAPTER + BOOK READING INSTALLED"
);
