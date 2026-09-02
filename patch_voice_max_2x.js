const fs = require("fs");

const path =
  "./src/components/VoiceReader.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


/* MAX SPEED */

src =
  src.replace(
    /const MAX_RATE\s*=\s*5\s*;/,
    "const MAX_RATE = 2;"
  );


/* HEADER COMMENTS */

src =
  src.replace(
    /0\.5x\s+to\s+5\.0x/gi,
    "0.5x to 2.0x"
  );

src =
  src.replace(
    /0\.5x\s*->\s*5\.0x/gi,
    "0.5x -> 2.0x"
  );


/* PRESET BUTTONS */

src =
  src.replace(
    /const presets\s*=\s*\[\s*0\.5\s*,\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,?\s*\]\s*;/m,
`const presets =
    [
      0.5,
      1,
      1.5,
      2,
    ];`
  );


/*
 * Also handle earlier preset formatting if present.
 */
src =
  src.replace(
    /\[\s*0\.5,\s*1,\s*2,\s*3,\s*4,\s*5,\s*\]/g,
    "[0.5, 1, 1.5, 2]"
  );


/* OLD DISPLAY TEXT */

src =
  src.replace(
    /0\.5x\s*-\s*5\.0x/g,
    "0.5x - 2.0x"
  );

src =
  src.replace(
    /0\.5x\s*-\s*5x/g,
    "0.5x - 2x"
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "VOICE SPEED NOW CAPPED AT 2X"
);
