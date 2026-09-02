const fs = require("fs");

const path =
  "./src/components/VoiceReader.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function fail(message) {
  console.error("");
  console.error("PATCH STOPPED:");
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "VOICE_RATE_PERSIST_BETWEEN_CHAPTERS_V1"
  )
) {

  console.log(
    "Persistent voice rate already installed."
  );

  process.exit(0);

}


/* ==========================================================
   1. MODULE-LEVEL PERSISTENT RATE

   Survives VoiceReader unmount/remount when
   automatic chapter navigation loads new text.
========================================================== */

const rateStepRegex =
  /const\s+RATE_STEP\s*=\s*0\.1\s*;/;


if (
  !rateStepRegex.test(src)
) {

  fail(
    "RATE_STEP anchor not found."
  );

}


src =
  src.replace(
    rateStepRegex,
`const RATE_STEP = 0.1;


/* VOICE_RATE_PERSIST_BETWEEN_CHAPTERS_V1 */
let persistedVoiceRate =
  1;`
  );


/* ==========================================================
   2. RATE STATE MUST START FROM SAVED RATE
========================================================== */

const rateStateRegex =
  /const\s*\[\s*rate\s*,\s*setRate\s*\]\s*=\s*useState(?:<number>)?\(\s*1\s*\)\s*;/;


if (
  !rateStateRegex.test(src)
) {

  fail(
    "Rate state initializer not found."
  );

}


src =
  src.replace(
    rateStateRegex,
`const [
    rate,
    setRate,
  ] =
    useState<number>(
      persistedVoiceRate
    );`
  );


/* ==========================================================
   3. RATE REF MUST ALSO START FROM SAVED RATE
========================================================== */

const rateRefRegex =
  /const\s+rateRef\s*=\s*useRef(?:<number>)?\(\s*1\s*\)\s*;/;


if (
  !rateRefRegex.test(src)
) {

  fail(
    "rateRef initializer not found."
  );

}


src =
  src.replace(
    rateRefRegex,
`const rateRef =
    useRef<number>(
      persistedVoiceRate
    );`
  );


/* ==========================================================
   4. WHEN USER CHANGES SPEED,
      SAVE IT FOR NEXT CHAPTER
========================================================== */

const rateAssignRegex =
  /rateRef\.current\s*=\s*next\s*;/;


if (
  !rateAssignRegex.test(src)
) {

  fail(
    "Rate update assignment not found."
  );

}


src =
  src.replace(
    rateAssignRegex,
`rateRef.current =
          next;

        /*
         * Keep this exact speed when
         * VoiceReader mounts again for
         * the next chapter/book.
         */
        persistedVoiceRate =
          next;`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "VOICE SPEED PERSISTENCE INSTALLED"
);

console.log(
  "Speed now survives chapter/book changes."
);
