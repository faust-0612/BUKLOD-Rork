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
  console.error("FIX STOPPED:");
  console.error(message);
  process.exit(1);
}


/* =========================================================
   FIX_CONTINUOUS_STATUS_JSX_V1

   The status block was inserted directly beside
   <VoiceReader /> inside:

   condition && (
      <VoiceReader />
      {status}
   )

   which is invalid without a Fragment.

   Status UI is nonessential, so remove it.
   Continuous logic remains intact.
========================================================= */


const textIndex =
  src.indexOf(
    "CONTINUOUS READING ON"
  );


if (textIndex < 0) {

  console.log(
    "Continuous status block not found. Nothing removed."
  );

}
else {

  const blockStart =
    src.lastIndexOf(
      "{isMyBibleMode &&",
      textIndex
    );


  if (blockStart < 0) {
    stop(
      "Could not find beginning of continuous status block."
    );
  }


  /*
   * Find exact closing of the inserted status JSX.
   */
  const closeCandidates = [
    "\n        )}",
    "\r\n        )}",
    "\n          )}",
    "\r\n          )}",
  ];


  let blockEnd =
    -1;

  let closingLength =
    0;


  for (
    const candidate
    of closeCandidates
  ) {

    const found =
      src.indexOf(
        candidate,
        textIndex
      );


    if (
      found >= 0 &&
      (
        blockEnd < 0 ||
        found < blockEnd
      )
    ) {

      blockEnd =
        found;

      closingLength =
        candidate.length;

    }

  }


  if (blockEnd < 0) {
    stop(
      "Could not find end of continuous status block."
    );
  }


  src =
    src.slice(
      0,
      blockStart
    ) +
    src.slice(
      blockEnd +
      closingLength
    );


  console.log(
    "Broken continuous status JSX removed."
  );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "Continuous audio logic preserved."
);

console.log(
  "Verse selector logic preserved."
);
