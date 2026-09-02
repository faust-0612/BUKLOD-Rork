const fs = require("fs");

const path =
  "./src/components/VoiceReader.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "VOICE_STRIP_VERSE_LABELS_V1"
  )
) {
  console.log(
    "Verse-label speech filter already installed."
  );
  process.exit(0);
}


const needle =
`.replace(/\\s+/g, ' ')
    .trim();`;


const replacement =
`/* VOICE_STRIP_VERSE_LABELS_V1 */
    .replace(
      /\\b(?:Talata|Verse)\\s+\\d+\\s*[.:,;-]?\\s*/gi,
      ''
    )
    .replace(/\\s+/g, ' ')
    .trim();`;


/*
 * normalizeText has two possible return branches
 * because text may be string or string[].
 * Replace ALL occurrences.
 */
let count = 0;

src =
  src.replace(
    /\.replace\(\/\\s\+\/g,\s*' '\)\s*\.trim\(\);/g,
    match => {
      count += 1;

      return `/* VOICE_STRIP_VERSE_LABELS_V1 */
    .replace(
      /\\b(?:Talata|Verse)\\s+\\d+\\s*[.:,;-]?\\s*/gi,
      ''
    )
    .replace(/\\s+/g, ' ')
    .trim();`;
    }
  );


if (count === 0) {
  console.error(
    "normalizeText cleanup anchor not found."
  );
  process.exit(1);
}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "SPOKEN TALATA / VERSE NUMBERS REMOVED"
);
console.log(
  `Updated ${count} normalizeText branch(es).`
);
