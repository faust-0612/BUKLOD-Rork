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
    "DAILY VOICE PATCH STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "DAILY_DEVOTION_VOICE_READER_V1"
  )
) {
  console.log(
    "Daily Voice Reader already installed."
  );
  process.exit(0);
}


/* =========================================================
   FIND EXISTING VOICE READER FROM FULL BIBLE
========================================================= */

const voiceStart =
  src.indexOf(
    "<VoiceReader"
  );


if (voiceStart < 0) {
  stop(
    "Existing <VoiceReader> was not found. Do not add a new native module yet."
  );
}


const voiceEnd =
  src.indexOf(
    "/>",
    voiceStart
  );


if (voiceEnd < 0) {
  stop(
    "Could not determine VoiceReader JSX ending."
  );
}


let voiceBlock =
  src.slice(
    voiceStart,
    voiceEnd + 2
  );


/*
 * Daily-specific button wording if the
 * existing component has a title prop.
 */
voiceBlock =
  voiceBlock
    .replace(
      /PAKINGGAN ANG KABANATA/g,
      "PAKINGGAN ANG READING"
    )
    .replace(
      /LISTEN TO CHAPTER/g,
      "LISTEN TO READING"
    );


/* =========================================================
   FIND DAILY DEVOTION READING
========================================================= */

const dailyMarker =
  src.indexOf(
    "DAILY_DEVOTION_FOCUSED_READING_V1"
  );


if (dailyMarker < 0) {
  stop(
    "Focused Daily Devotion marker not found."
  );
}


/*
 * Insert immediately before the chapter-loading /
 * verse rendering section of the dedicated Daily UI.
 */
const loadingAnchor =
  src.indexOf(
    "{chapterLoading ? (",
    dailyMarker
  );


if (loadingAnchor < 0) {
  stop(
    "Daily chapter-loading anchor not found."
  );
}


const voiceUI =
`
          {/* DAILY_DEVOTION_VOICE_READER_V1 */}

          {!chapterLoading &&
            verses.length > 0 && (

            <View
              style={{
                marginBottom: 14,
              }}
            >

              ${voiceBlock}

            </View>

          )}


`;


src =
  src.slice(
    0,
    loadingAnchor
  ) +
  voiceUI +
  src.slice(
    loadingAnchor
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "DAILY DEVOTION VOICE READER INSTALLED"
);
console.log(
  "Using existing BUKLOD VoiceReader"
);
