const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(path, "utf8");


function read(name) {
  return fs.readFileSync(name, "utf8");
}


function stop(message) {
  console.error("");
  console.error("MY BIBLE STEP 2 SAFE FIX STOPPED:");
  console.error(message);
  process.exit(1);
}


/*
 * If it somehow installed already,
 * don't duplicate anything.
 */
if (
  src.includes(
    "MY_BIBLE_ANNOTATIONS_V1"
  )
) {
  console.log(
    "MY BIBLE STEP 2 ALREADY PRESENT"
  );

  process.exit(0);
}


/* ==========================================================
   1. REACT NATIVE IMPORTS
========================================================== */

const rnPattern =
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"];/m;

const rnMatch =
  src.match(rnPattern);

if (!rnMatch) {
  stop(
    "React Native import block not found."
  );
}

let names =
  rnMatch[1];

[
  "Alert",
  "Modal",
  "TextInput",
].forEach(name => {

  if (
    !new RegExp(
      "\\b" + name + "\\b"
    ).test(names)
  ) {
    names +=
      "\n  " +
      name +
      ",";
  }

});

src =
  src.replace(
    rnPattern,
    "import {" +
    names +
    "\n} from 'react-native';"
  );


/* ==========================================================
   2. INSERT ANNOTATION LOGIC

   Use the next stable section marker rather than
   matching the exact useState formatting.
========================================================== */

const logicBoundary =
  "  /* PATCH_153H_4C_PLAN_STEP */";

const logicIndex =
  src.indexOf(
    logicBoundary
  );

if (logicIndex < 0) {
  stop(
    "Daily-plan boundary not found."
  );
}

src =
  src.slice(0, logicIndex) +
  read(
    "./my_bible_step2_logic.txt"
  ) +
  "\n\n" +
  src.slice(logicIndex);


/* ==========================================================
   3. CHAPTER SEARCH

   Put immediately after SELECT PASSAGE heading.
========================================================== */

const selectPattern =
  /(\s*<SectionTitle>\s*SELECT PASSAGE\s*<\/SectionTitle>)/;

if (
  !selectPattern.test(src)
) {
  stop(
    "SELECT PASSAGE heading not found."
  );
}

src =
  src.replace(
    selectPattern,
    "$1\n\n" +
    read(
      "./my_bible_step2_chapter_ui.txt"
    )
  );


/* ==========================================================
   4. FIND THE VERSE MAP AREA
========================================================== */

const verseMapIndex =
  src.indexOf(
    "{verses.map("
  );

if (verseMapIndex < 0) {
  stop(
    "verses.map area not found."
  );
}


/* ==========================================================
   5. INSERT ANNOTATION VARIABLE

   Do NOT match the paragraph-symbol regex.
   Insert directly before the return statement that follows
   cleanText.
========================================================== */

const cleanIndex =
  src.indexOf(
    "const cleanText =",
    verseMapIndex
  );

if (cleanIndex < 0) {
  stop(
    "cleanText declaration not found."
  );
}


const verseReturnIndex =
  src.indexOf(
    "                return (",
    cleanIndex
  );

if (verseReturnIndex < 0) {
  stop(
    "Verse return statement not found."
  );
}


const annotationVariable =
`
                const annotation =
                  bibleAnnotations[
                    Number(
                      verse.verse_no
                    )
                  ];


`;


src =
  src.slice(
    0,
    verseReturnIndex
  ) +
  annotationVariable +
  src.slice(
    verseReturnIndex
  );


/* ==========================================================
   6. REPLACE VERSE ROW OPENING

   Find from the verse return, then locate the first row View.
========================================================== */

const updatedReturnIndex =
  src.indexOf(
    "                return (",
    cleanIndex
  );


const rowStart =
  src.indexOf(
    "                  <View",
    updatedReturnIndex
  );

if (rowStart < 0) {
  stop(
    "Verse row opening View not found."
  );
}


const rowTextStart =
  src.indexOf(
    "                    <Text",
    rowStart
  );

if (rowTextStart < 0) {
  stop(
    "Verse number Text not found."
  );
}


/*
 * Everything immediately before the first verse Text
 * belongs to the opening View.
 */
const openingSection =
  src.slice(
    rowStart,
    rowTextStart
  );


if (
  !openingSection.includes(
    "styles.verseRow"
  )
) {
  stop(
    "Located View is not the verse row."
  );
}


src =
  src.slice(0, rowStart) +
  read(
    "./my_bible_step2_verse_open.txt"
  ).trimEnd() +
  "\n" +
  src.slice(rowTextStart);


/* ==========================================================
   7. REPLACE VERSE ROW CLOSING
========================================================== */

const newRowStart =
  src.indexOf(
    "<Pressable",
    updatedReturnIndex
  );


const nextVerseEnd =
  src.indexOf(
    "                );",
    newRowStart
  );

if (nextVerseEnd < 0) {
  stop(
    "Verse return closing not found."
  );
}


/*
 * Locate the final verse-text closing tag before );
 */
const beforeReturn =
  src.slice(
    newRowStart,
    nextVerseEnd
  );


const lastTextCloseRelative =
  beforeReturn.lastIndexOf(
    "                    </Text>"
  );


if (
  lastTextCloseRelative < 0
) {
  stop(
    "Final verse Text closing tag not found."
  );
}


const finalTextClose =
  newRowStart +
  lastTextCloseRelative;


const oldClosingEnd =
  nextVerseEnd +
  "                );".length;


src =
  src.slice(
    0,
    finalTextClose
  ) +
  read(
    "./my_bible_step2_verse_close.txt"
  ).trimEnd() +
  src.slice(
    oldClosingEnd
  );


/* ==========================================================
   8. ANNOTATION MODAL
========================================================== */

const actionsIndex =
  src.indexOf(
    "          CHAPTER ACTIONS"
  );

if (actionsIndex < 0) {
  stop(
    "CHAPTER ACTIONS marker not found."
  );
}


/*
 * Move backward to the beginning of its JSX comment.
 */
const actionsCommentStart =
  src.lastIndexOf(
    "      {/*",
    actionsIndex
  );

if (
  actionsCommentStart < 0
) {
  stop(
    "CHAPTER ACTIONS comment start not found."
  );
}


src =
  src.slice(
    0,
    actionsCommentStart
  ) +
  read(
    "./my_bible_step2_modal.txt"
  ) +
  "\n" +
  src.slice(
    actionsCommentStart
  );


/* ==========================================================
   SAVE
========================================================== */

fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "MY BIBLE STEP 2 SAFE PATCH APPLIED"
);

console.log(
  "Chapter search installed"
);

console.log(
  "Verse highlights installed"
);

console.log(
  "Private notes installed"
);
