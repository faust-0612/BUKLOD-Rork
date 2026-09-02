const fs = require("fs");

const path =
  "./src/components/VoiceReader.tsx";

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


if (
  src.includes(
    "FILIPINO_TTS_CONTRACTIONS_V1"
  )
) {

  console.log(
    "Filipino TTS contraction fix already installed."
  );

  process.exit(0);

}


/* ==========================================================
   1. ADD FILIPINO SPEECH NORMALIZER
========================================================== */

const componentAnchor =
  "export function VoiceReader";


if (
  !src.includes(
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
   FILIPINO_TTS_CONTRACTIONS_V1

   Displayed Bible text remains unchanged.
   Only the text sent to Filipino TTS is expanded.

   Examples:
   nawa'y  -> nawa ay
   ako'y   -> ako ay
   siya'y  -> siya ay
   tayo'y  -> tayo ay
   ako't   -> ako at
========================================================== */

function normalizeFilipinoSpeech(
  input: string
) {

  return String(
    input ?? ''
  )

    /*
     * Normalize curly apostrophes first.
     */
    .replace(
      /[’‘]/g,
      "'"
    )

    /*
     * Filipino contraction:
     * ako'y -> ako ay
     * nawa'y -> nawa ay
     */
    .replace(
      /([A-Za-zÀ-ÖØ-öø-ÿ]+)'y\\b/gi,
      '$1 ay'
    )

    /*
     * Filipino contraction:
     * ako't -> ako at
     * puso't -> puso at
     */
    .replace(
      /([A-Za-zÀ-ÖØ-öø-ÿ]+)'t\\b/gi,
      '$1 at'
    )

    .replace(
      /\\s+/g,
      ' '
    )
    .trim();

}


`;


src =
  src.replace(
    componentAnchor,
    helper +
    componentAnchor
  );


/* ==========================================================
   2. APPLY ONLY TO FILIPINO AUDIO

   ASD/fil-PH gets expanded pronunciation.
   English/KJV remains untouched.
========================================================== */

const speechTextRegex =
  /const\s+speechText\s*=\s*useMemo\(\s*\(\)\s*=>\s*normalizeText\(\s*text\s*\)\s*,\s*\[\s*text\s*\]\s*\)\s*;/m;


if (
  speechTextRegex.test(
    src
  )
) {

  src =
    src.replace(
      speechTextRegex,
`const speechText =
    useMemo(
      () => {

        const normalized =
          normalizeText(
            text
          );


        return String(
          language
        )
          .toLowerCase()
          .startsWith(
            'fil'
          )
            ? normalizeFilipinoSpeech(
                normalized
              )
            : normalized;

      },
      [
        text,
        language,
      ]
    );`
    );

}
else {

  /*
   * Handle multiline formatting of the same code.
   */
  const start =
    src.indexOf(
      "const speechText ="
    );


  const chunksStart =
    src.indexOf(
      "const chunks =",
      start
    );


  if (
    start < 0 ||
    chunksStart < 0
  ) {

    stop(
      "speechText useMemo block not found."
    );

  }


  src =
    src.slice(
      0,
      start
    ) +
`const speechText =
    useMemo(
      () => {

        const normalized =
          normalizeText(
            text
          );


        return String(
          language
        )
          .toLowerCase()
          .startsWith(
            'fil'
          )
            ? normalizeFilipinoSpeech(
                normalized
              )
            : normalized;

      },
      [
        text,
        language,
      ]
    );


  ` +
    src.slice(
      chunksStart
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "FILIPINO TTS CONTRACTION FIX INSTALLED"
);
