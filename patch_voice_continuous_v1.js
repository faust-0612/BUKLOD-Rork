const fs = require("fs");

const path =
  "./src/components/VoiceReader.tsx";

let src =
  fs.readFileSync(path, "utf8");


function stop(message) {
  console.error("");
  console.error("VOICE PATCH STOPPED:");
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "VOICE_READER_CONTINUOUS_AUTOPLAY_V1"
  )
) {
  console.log(
    "Continuous VoiceReader already installed."
  );
  process.exit(0);
}


/* =========================================================
   ADD PROPS
========================================================= */

const propAnchor =
  "  disabled?: boolean;";


if (!src.includes(propAnchor)) {
  stop("VoiceReader disabled prop anchor not found.");
}


src =
  src.replace(
    propAnchor,
`  disabled?: boolean;

  /* VOICE_READER_CONTINUOUS_AUTOPLAY_V1 */
  autoPlay?: boolean;

  onUserStart?: () => void;
  onUserStop?: () => void;`
  );


/* =========================================================
   DESTRUCTURE PROPS
========================================================= */

const destructureAnchor =
  "  disabled = false,";


if (!src.includes(destructureAnchor)) {
  stop("VoiceReader destructure anchor not found.");
}


src =
  src.replace(
    destructureAnchor,
`  disabled = false,

  autoPlay = false,

  onUserStart,
  onUserStop,`
  );


/* =========================================================
   MANUAL STOP -> TELL PARENT
========================================================= */

const stopFunctionIndex =
  src.indexOf(
    "const stop ="
  );


if (stopFunctionIndex < 0) {
  stop("VoiceReader stop() not found.");
}


const stopTokenIndex =
  src.indexOf(
    "runTokenRef.current +=",
    stopFunctionIndex
  );


if (stopTokenIndex < 0) {
  stop("VoiceReader stop token anchor not found.");
}


src =
  src.slice(
    0,
    stopTokenIndex
  ) +
`onUserStop?.();


        ` +
  src.slice(
    stopTokenIndex
  );


/* =========================================================
   MANUAL START -> ENABLE CONTINUOUS MODE
========================================================= */

const startIndex =
  src.indexOf(
    "const start ="
  );


if (startIndex < 0) {
  stop("VoiceReader start() not found.");
}


const setSpeakingIndex =
  src.indexOf(
    "setSpeakingSafe(",
    startIndex
  );


if (setSpeakingIndex < 0) {
  stop("VoiceReader start speaking anchor not found.");
}


/*
 * Insert onUserStart immediately before
 * start sets speaking=true.
 */
src =
  src.slice(
    0,
    setSpeakingIndex
  ) +
`onUserStart?.();


        ` +
  src.slice(
    setSpeakingIndex
  );


/* =========================================================
   AUTOPLAY AFTER PASSAGE CHANGES

   Find component mounted lifecycle.
   The passage-reset effect appears immediately
   before this section in current VoiceReader.
========================================================= */

const mountedAnchor =
`  useEffect(
    () => {

      mountedRef.current =`;


const mountedIndex =
  src.indexOf(
    mountedAnchor
  );


if (mountedIndex < 0) {
  stop("VoiceReader mounted effect anchor not found.");
}


const autoPlayEffect =
`
  /* ========================================================
     VOICE_READER_CONTINUOUS_AUTOPLAY_V1
     Automatically start new chapter after text changes.
  ======================================================== */

  useEffect(
    () => {

      if (
        !autoPlay ||
        disabled ||
        !speechText ||
        !chunks.length
      ) {
        return;
      }


      /*
       * If already speaking, do not restart.
       */
      if (
        speakingRef.current
      ) {
        return;
      }


      const timer =
        setTimeout(
          () => {

            if (
              mountedRef.current &&
              !speakingRef.current
            ) {
              void start();
            }

          },
          180
        );


      return () =>
        clearTimeout(timer);

    },
    [
      autoPlay,
      speechText,
      language,
      disabled,
      chunks.length,
      start,
    ]
  );


`;


src =
  src.slice(
    0,
    mountedIndex
  ) +
  autoPlayEffect +
  src.slice(
    mountedIndex
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "VOICE READER CONTINUOUS AUTOPLAY INSTALLED"
);
