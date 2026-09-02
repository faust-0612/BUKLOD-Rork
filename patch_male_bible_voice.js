const fs = require("fs");

const voicePath =
  "./src/components/VoiceReader.tsx";

const biblePath =
  "./src/app/bible/read.tsx";


let voice =
  fs.readFileSync(
    voicePath,
    "utf8"
  );

let bible =
  fs.readFileSync(
    biblePath,
    "utf8"
  );


function stop(message) {
  console.error("");
  console.error("PATCH STOPPED:");
  console.error(message);
  process.exit(1);
}


/* ==========================================================
   1. MALE VOICE PREFERENCE
========================================================== */

if (
  !voice.includes(
    "BIBLE_MALE_VOICE_PREFERENCE_V1"
  )
) {

  const componentAnchor =
    "export function VoiceReader";


  if (
    !voice.includes(
      componentAnchor
    )
  ) {
    stop(
      "VoiceReader component anchor not found."
    );
  }


  const helper =
`
/* ==========================================================
   BIBLE_MALE_VOICE_PREFERENCE_V1

   Prefer an installed male / masculine voice.
   Android TTS voice metadata is not uniform,
   so we also lower pitch slightly as fallback.
========================================================== */

function maleVoiceScore(
  voice: any
) {

  const identity =
    (
      String(
        voice?.name ??
        ''
      ) +
      ' ' +
      String(
        voice?.identifier ??
        ''
      )
    )
      .toLowerCase();


  let score =
    0;


  if (
    /(^|[\\s_-])(male|man|guy|masculine|boy)([\\s_-]|$)/i
      .test(
        identity
      )
  ) {
    score +=
      100;
  }


  if (
    /(female|woman|girl|feminine)/i
      .test(
        identity
      )
  ) {
    score -=
      100;
  }


  const quality =
    String(
      voice?.quality ??
      ''
    )
      .toLowerCase();


  if (
    quality.includes(
      'enhanced'
    )
  ) {
    score +=
      10;
  }


  return score;

}


`;


  voice =
    voice.replace(
      componentAnchor,
      helper +
      componentAnchor
    );

}


/*
 * Change selected matching voice to
 * highest male-preference score.
 */

const oldVoiceSelection =
  /voiceRef\.current\s*=\s*matches\[0\]\s*\?\.identifier;/;


if (
  oldVoiceSelection.test(
    voice
  )
) {

  voice =
    voice.replace(
      oldVoiceSelection,
`const preferredVoice =
              [...matches]
                .sort(
                  (
                    a: any,
                    b: any
                  ) =>
                    maleVoiceScore(b) -
                    maleVoiceScore(a)
                )[0];


            voiceRef.current =
              preferredVoice
                ?.identifier;`
    );

}


/*
 * Slightly lower pitch so fallback voice
 * sounds more masculine.
 */

voice =
  voice.replace(
    /pitch\s*:\s*1\s*,/g,
    "pitch: 0.82,"
  );


/* ==========================================================
   2. DAILY READING:
      REMOVE "TALATA 1 / TALATA 2..."
========================================================== */

const dailyMarker =
  bible.indexOf(
    "DAILY_DEVOTION_VOICE_READER_V1"
  );


if (
  dailyMarker < 0
) {

  stop(
    "Daily Voice Reader marker not found."
  );

}


const voiceEnd =
  bible.indexOf(
    "/>",
    dailyMarker
  );


if (
  voiceEnd < 0
) {

  stop(
    "Daily VoiceReader ending not found."
  );

}


let dailyBlock =
  bible.slice(
    dailyMarker,
    voiceEnd + 2
  );


const oldVerseSpeech =
`...verses.map(
                    verse =>
                      'Talata ' +
                      Number(
                        verse.verse_no
                      ) +
                      '. ' +
                      String(
                        verse.verse_text ??
                        ''
                      )
                        .replace(
                          /^\\u00B6\\s*/,
                          ''
                        )
                        .trim()
                  ),`;


const newVerseSpeech =
`...verses.map(
                    verse =>
                      String(
                        verse.verse_text ??
                        ''
                      )
                        .replace(
                          /^\\u00B6\\s*/,
                          ''
                        )
                        .trim()
                  ),`;


if (
  dailyBlock.includes(
    oldVerseSpeech
  )
) {

  dailyBlock =
    dailyBlock.replace(
      oldVerseSpeech,
      newVerseSpeech
    );

}
else {

  /*
   * Flexible fallback for slightly reformatted code.
   */

  dailyBlock =
    dailyBlock.replace(
      /'Talata '\s*\+\s*Number\(\s*verse\.verse_no\s*\)\s*\+\s*'\. '\s*\+\s*(String\([\s\S]*?\.trim\(\))/,
      "$1"
    );

}


/*
 * Safety: the Daily voice block must no longer
 * contain the spoken verse-number prefix.
 */

if (
  dailyBlock.includes(
    "'Talata '"
  )
) {

  stop(
    "Spoken Talata prefix still exists in Daily VoiceReader."
  );

}


bible =
  bible.slice(
    0,
    dailyMarker
  ) +
  dailyBlock +
  bible.slice(
    voiceEnd + 2
  );


/* ==========================================================
   SAVE
========================================================== */

fs.writeFileSync(
  voicePath,
  voice,
  "utf8"
);

fs.writeFileSync(
  biblePath,
  bible,
  "utf8"
);


console.log("");
console.log(
  "MALE VOICE PREFERENCE INSTALLED"
);

console.log(
  "VERSE NUMBERS REMOVED FROM DAILY SPEECH"
);
