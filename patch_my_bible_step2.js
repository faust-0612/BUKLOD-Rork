const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function readSnippet(name) {
  return fs.readFileSync(
    name,
    "utf8"
  );
}


function stop(message) {
  console.error("");
  console.error(
    "MY BIBLE STEP 2 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "MY_BIBLE_ANNOTATIONS_V1"
  )
) {

  console.log(
    "MY BIBLE STEP 2 ALREADY INSTALLED"
  );

  process.exit(0);
}


/* ============================================================
   REACT NATIVE IMPORTS
   ============================================================ */

const rnImport =
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"];/m;


const rnMatch =
  src.match(
    rnImport
  );


if (!rnMatch) {
  stop(
    "React Native import block not found."
  );
}


let imports =
  rnMatch[1];


[
  "Alert",
  "Modal",
  "TextInput",
].forEach(
  name => {

    const exists =
      new RegExp(
        "\\b" +
        name +
        "\\b"
      ).test(
        imports
      );


    if (!exists) {
      imports +=
        "\n  " +
        name +
        ",";
    }

  }
);


src =
  src.replace(
    rnImport,
    "import {" +
    imports +
    "\n} from 'react-native';"
  );


/* ============================================================
   STATE + LOGIC
   Insert after marking state statement.
   ============================================================ */

const markingStart =
  src.indexOf(
    "  const [marking, setMarking] ="
  );


if (
  markingStart <
  0
) {
  stop(
    "marking state anchor not found."
  );
}


const markingEnd =
  src.indexOf(
    ";\n",
    markingStart
  );


if (
  markingEnd <
  0
) {
  stop(
    "marking state end not found."
  );
}


const logic =
  readSnippet(
    "./my_bible_step2_logic.txt"
  );


src =
  src.slice(
    0,
    markingEnd + 2
  ) +
  "\n\n" +
  logic +
  "\n\n" +
  src.slice(
    markingEnd + 2
  );


/* ============================================================
   CHAPTER SEARCH UI
   ============================================================ */

const selectPassage =
`      <SectionTitle>
        SELECT PASSAGE
      </SectionTitle>`;


if (
  !src.includes(
    selectPassage
  )
) {
  stop(
    "SELECT PASSAGE anchor not found."
  );
}


src =
  src.replace(
    selectPassage,
    selectPassage +
    "\n\n" +
    readSnippet(
      "./my_bible_step2_chapter_ui.txt"
    )
  );


/* ============================================================
   VERSE ANNOTATION VARIABLE
   ============================================================ */

const cleanEnd =
`                    .replace(/^\u00B6\s*/, '').trim();`;


const cleanIndex =
  src.indexOf(
    cleanEnd
  );


if (
  cleanIndex <
  0
) {
  stop(
    "cleanText anchor not found."
  );
}


const afterClean =
  cleanIndex +
  cleanEnd.length;


src =
  src.slice(
    0,
    afterClean
  ) +
`
                

                const annotation =
                  bibleAnnotations[
                    Number(
                      verse.verse_no
                    )
                  ];` +
  src.slice(
    afterClean
  );


/* ============================================================
   CONVERT VERSE ROW VIEW -> PRESSABLE
   ============================================================ */

const verseOpen =
`                  <View
                    key={
                      verse.verse_no
                    }
                    style={[
                      styles.verseRow,
                      focused &&
                        styles.focusVerse,
                    ]}
                  >`;


const verseOpenIndex =
  src.indexOf(
    verseOpen,
    afterClean
  );


if (
  verseOpenIndex <
  0
) {
  stop(
    "Verse row opening anchor not found."
  );
}


src =
  src.slice(
    0,
    verseOpenIndex
  ) +
  readSnippet(
    "./my_bible_step2_verse_open.txt"
  ).trimEnd() +
  src.slice(
    verseOpenIndex +
    verseOpen.length
  );


/* ============================================================
   VERSE CLOSING
   ============================================================ */

const verseClose =
`                    </Text>
                  </View>
                );`;


const verseCloseIndex =
  src.indexOf(
    verseClose,
    verseOpenIndex
  );


if (
  verseCloseIndex <
  0
) {
  stop(
    "Verse row closing anchor not found."
  );
}


src =
  src.slice(
    0,
    verseCloseIndex
  ) +
  readSnippet(
    "./my_bible_step2_verse_close.txt"
  ).trimEnd() +
  src.slice(
    verseCloseIndex +
    verseClose.length
  );


/* ============================================================
   ANNOTATION MODAL
   Insert before chapter actions.
   ============================================================ */

const chapterActions =
`      {/* =====================================================
          CHAPTER ACTIONS`;


const chapterActionsIndex =
  src.indexOf(
    chapterActions
  );


if (
  chapterActionsIndex <
  0
) {
  stop(
    "CHAPTER ACTIONS anchor not found."
  );
}


src =
  src.slice(
    0,
    chapterActionsIndex
  ) +
  readSnippet(
    "./my_bible_step2_modal.txt"
  ) +
  "\n" +
  src.slice(
    chapterActionsIndex
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "MY BIBLE CHAPTER SEARCH INSTALLED"
);

console.log(
  "MY BIBLE VERSE HIGHLIGHT INSTALLED"
);

console.log(
  "MY BIBLE PRIVATE NOTES INSTALLED"
);
