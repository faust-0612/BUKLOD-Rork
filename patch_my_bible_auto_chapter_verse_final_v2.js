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
    "MY BIBLE PATCH STOPPED:"
  );
  console.error(message);

  process.exit(1);

}


if (
  src.includes(
    "MY_BIBLE_AUTO_CHAPTER_VERSE_FINAL_V2"
  )
) {

  console.log(
    "Final My Bible patch already installed."
  );

  process.exit(0);

}


/* ============================================================
   MY_BIBLE_AUTO_CHAPTER_VERSE_FINAL_V2
============================================================ */


/* ============================================================
   1. ADD STATES

   IMPORTANT:
   selectedVerseNo already belongs to annotation/highlight.
   Do NOT reuse it.

   passageVerseNo = navigation/audio verse selector.
============================================================ */

const chapterStateRegex =
  /const\s+\[\s*showChapters\s*,\s*setShowChapters\s*\]\s*=\s*useState\(false\);/;


const chapterStateMatch =
  src.match(
    chapterStateRegex
  );


if (
  !chapterStateMatch
) {

  stop(
    "showChapters state not found."
  );

}


src =
  src.replace(
    chapterStateRegex,
`${chapterStateMatch[0]}


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


  const [
    myBibleContinuousReading,
    setMyBibleContinuousReading,
  ] =
    useState(false);`
  );


/* ============================================================
   2. RESET VERSE WHEN BOOK IS CHANGED
============================================================ */

const selectBookStart =
  src.indexOf(
    "  const selectBook ="
  );


const selectChapterStart =
  src.indexOf(
    "  const selectChapter =",
    selectBookStart
  );


if (
  selectBookStart < 0 ||
  selectChapterStart < 0
) {

  stop(
    "selectBook/selectChapter functions not found."
  );

}


let selectBookBlock =
  src.slice(
    selectBookStart,
    selectChapterStart
  );


if (
  !selectBookBlock.includes(
    "setPassageVerseNo"
  )
) {

  selectBookBlock =
    selectBookBlock.replace(
      /setChapterNo\(1\);/,
`setChapterNo(1);

      setPassageVerseNo(
        null
      );

      setShowVersePicker(
        false
      );`
    );

}


src =
  src.slice(
    0,
    selectBookStart
  ) +
  selectBookBlock +
  src.slice(
    selectChapterStart
  );


/* ============================================================
   3. ADD VERSE SELECTION FUNCTION
============================================================ */

const chapterFnStart =
  src.indexOf(
    "  const selectChapter ="
  );


const moveFnStart =
  src.indexOf(
    "  const moveChapter =",
    chapterFnStart
  );


if (
  chapterFnStart < 0 ||
  moveFnStart < 0
) {

  stop(
    "Navigation function boundary not found."
  );

}


let chapterBlock =
  src.slice(
    chapterFnStart,
    moveFnStart
  );


if (
  !chapterBlock.includes(
    "setPassageVerseNo"
  )
) {

  chapterBlock =
    chapterBlock.replace(
      /setChapterNo\(nextChapter\);/,
`setChapterNo(nextChapter);

      setPassageVerseNo(
        null
      );

      setShowVersePicker(
        false
      );`
    );

}


const newFunctions =
`

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
     MY BIBLE CONTINUOUS AUDIO

     chapter 1
       ↓
     chapter 2
       ↓
     last chapter of book
       ↓
     next book chapter 1
       ↓
     continues until STOP
  ======================================================== */

  const advanceMyBibleAudio =
    () => {

      if (
        !isMyBibleMode ||
        !myBibleContinuousReading ||
        !currentBook
      ) {
        return;
      }


      /*
       * A selected verse applies only
       * to the current chapter.
       *
       * Next chapter starts from verse 1.
       */
      setPassageVerseNo(
        null
      );


      const chapterCount =
        Number(
          currentBook.chapter_count
        );


      /* ----------------------------------------
         NEXT CHAPTER IN SAME BOOK
      ----------------------------------------- */

      if (
        chapterNo <
        chapterCount
      ) {

        setChapterNo(
          current =>
            current + 1
        );

        return;

      }


      /* ----------------------------------------
         LAST CHAPTER -> NEXT BOOK
      ----------------------------------------- */

      const nextBook =
        books.find(
          item =>
            Number(
              item.book_no
            ) ===
            bookNo + 1
        );


      if (
        !nextBook
      ) {

        /*
         * End of final available Bible book.
         */
        setMyBibleContinuousReading(
          false
        );

        return;

      }


      setBookNo(
        Number(
          nextBook.book_no
        )
      );


      setChapterNo(
        1
      );

    };


`;


src =
  src.slice(
    0,
    chapterFnStart
  ) +
  chapterBlock +
  newFunctions +
  src.slice(
    moveFnStart
  );


/* ============================================================
   4. BOOK BUTTON:
      CLOSE VERSE PICKER
============================================================ */

const selectorStart =
  src.indexOf(
    "<View style={styles.selectorRow}>"
  );


if (
  selectorStart < 0
) {

  stop(
    "My Bible selector row not found."
  );

}


const selectorCardEnd =
  src.indexOf(
    "</Card>",
    selectorStart
  );


if (
  selectorCardEnd < 0
) {

  stop(
    "My Bible selector Card ending not found."
  );

}


let selectorArea =
  src.slice(
    selectorStart,
    selectorCardEnd
  );


/*
 * BOOK button already closes chapter.
 * Also close verse picker.
 */

const bookCloseNeedle =
`              setShowChapters(
                false
              );`;


if (
  selectorArea.includes(
    bookCloseNeedle
  ) &&
  !selectorArea.includes(
    "setShowVersePicker(\n                false"
  )
) {

  selectorArea =
    selectorArea.replace(
      bookCloseNeedle,
`${bookCloseNeedle}

              setShowVersePicker(
                false
              );`
    );

}


/* ============================================================
   5. CHAPTER BUTTON:
      CLOSE VERSE PICKER
============================================================ */

const chapterToggleNeedle =
`              setShowBooks(
                false
              );`;


const firstBookClose =
  selectorArea.indexOf(
    chapterToggleNeedle
  );


if (
  firstBookClose >= 0
) {

  const after =
    firstBookClose +
    chapterToggleNeedle.length;


  /*
   * Add only if not already immediately present.
   */

  const nearby =
    selectorArea.slice(
      after,
      after + 150
    );


  if (
    !nearby.includes(
      "setShowVersePicker"
    )
  ) {

    selectorArea =
      selectorArea.slice(
        0,
        after
      ) +
`
              
              setShowVersePicker(
                false
              );` +
      selectorArea.slice(
        after
      );

  }

}


/* ============================================================
   6. ADD THIRD SELECTOR: VERSE
============================================================ */

if (
  !selectorArea.includes(
    "MY_BIBLE_VERSE_SELECTOR_FINAL_V2"
  )
) {

  const chapterSelectorEnd =
`              {chapterNo}
            </Text>
          </Pressable>
        </View>`;


  if (
    !selectorArea.includes(
      chapterSelectorEnd
    )
  ) {

    stop(
      "Chapter selector ending not found."
    );

  }


  selectorArea =
    selectorArea.replace(
      chapterSelectorEnd,
`              {chapterNo}
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

        </View>`
    );

}


/* ============================================================
   7. VERSE NUMBER GRID
============================================================ */

if (
  !selectorArea.includes(
    "MY_BIBLE_VERSE_GRID_FINAL_V2"
  )
) {

  selectorArea +=
`

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

`;

}


src =
  src.slice(
    0,
    selectorStart
  ) +
  selectorArea +
  src.slice(
    selectorCardEnd
  );


/* ============================================================
   8. SELECTED VERSE HIGHLIGHT

   Route verse OR manually selected verse.
============================================================ */

const focusedRegex =
  /const focused\s*=\s*requestedVerse\s*>\s*0\s*&&\s*Number\(\s*verse\.verse_no\s*\)\s*===\s*requestedVerse\s*;/;


if (
  focusedRegex.test(
    src
  )
) {

  src =
    src.replace(
      focusedRegex,
`const focusVerseNo =
                  passageVerseNo ??
                  (
                    requestedVerse > 0
                      ? requestedVerse
                      : null
                  );


                const focused =
                  focusVerseNo !==
                    null &&
                  Number(
                    verse.verse_no
                  ) ===
                    focusVerseNo;`
    );

}


/* ============================================================
   9. CONNECT MY BIBLE VOICE TO AUTOMATIC NAVIGATION
============================================================ */

const voiceMarker =
  src.indexOf(
    "BIBLE_TAGALOG_VOICE_READER_V2"
  );


if (
  voiceMarker < 0
) {

  stop(
    "My Bible VoiceReader marker not found."
  );

}


const voiceStart =
  src.indexOf(
    "<VoiceReader",
    voiceMarker
  );


const voiceEnd =
  src.indexOf(
    "/>",
    voiceStart
  );


if (
  voiceStart < 0 ||
  voiceEnd < 0
) {

  stop(
    "My Bible VoiceReader JSX not found."
  );

}


let voiceBlock =
  src.slice(
    voiceStart,
    voiceEnd + 2
  );


if (
  !voiceBlock.includes(
    "advanceMyBibleAudio"
  )
) {

  voiceBlock =
    voiceBlock.replace(
      "<VoiceReader",
`<VoiceReader

            /* MY_BIBLE_CONTINUOUS_AUDIO_FINAL_V2 */

            autoPlay={
              isMyBibleMode &&
              myBibleContinuousReading
            }

            onUserStart={() => {

              if (
                isMyBibleMode
              ) {

                setMyBibleContinuousReading(
                  true
                );

              }

            }}

            onUserStop={() => {

              if (
                isMyBibleMode
              ) {

                setMyBibleContinuousReading(
                  false
                );

              }

            }}

            onFinished={
              advanceMyBibleAudio
            }`
    );

}


/* ============================================================
   10. IF A VERSE IS SELECTED,
       START AUDIO FROM THAT VERSE.

       Next chapter returns to verse 1 automatically.
============================================================ */

if (
  !voiceBlock.includes(
    "passageVerseNo === null"
  )
) {

  voiceBlock =
    voiceBlock.replace(
      "...verses.map(",
`...verses
              .filter(
                verse =>
                  passageVerseNo ===
                    null ||
                  Number(
                    verse.verse_no
                  ) >=
                    passageVerseNo
              )
              .map(`
    );

}


src =
  src.slice(
    0,
    voiceStart
  ) +
  voiceBlock +
  src.slice(
    voiceEnd + 2
  );


/* ============================================================
   11. SHOW CONTINUOUS STATUS
============================================================ */

const updatedVoiceEnd =
  voiceStart +
  voiceBlock.length;


const continuousStatus =
`

        {isMyBibleMode &&
          myBibleContinuousReading && (

          <View
            style={{
              marginTop:
                7,

              marginBottom:
                5,

              paddingHorizontal:
                11,

              paddingVertical:
                8,

              borderRadius:
                11,

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
              The screen will automatically move to the next chapter and next book.
            </Text>

          </View>

        )}

`;


src =
  src.slice(
    0,
    updatedVoiceEnd
  ) +
  continuousStatus +
  src.slice(
    updatedVoiceEnd
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "MY BIBLE FINAL PATCH INSTALLED"
);

console.log(
  "BOOK -> CHAPTER -> VERSE"
);

console.log(
  "AUDIO -> AUTO NEXT CHAPTER -> AUTO NEXT BOOK"
);

