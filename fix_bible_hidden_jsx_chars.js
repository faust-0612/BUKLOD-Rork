const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


const before = {
  bom:
    (src.match(/\uFEFF/g) || [])
      .length,

  zeroWidthSpace:
    (src.match(/\u200B/g) || [])
      .length,

  wordJoiner:
    (src.match(/\u2060/g) || [])
      .length,

  zeroWidthNonJoiner:
    (src.match(/\u200C/g) || [])
      .length,

  zeroWidthJoiner:
    (src.match(/\u200D/g) || [])
      .length,
};


console.log(
  "Hidden characters before cleanup:",
  before
);


/*
 * JSX must not contain stray invisible Unicode
 * characters between React Native components.
 */
src =
  src
    .replace(/\uFEFF/g, "")
    .replace(/\u200B/g, "")
    .replace(/\u2060/g, "")
    .replace(/\u200C/g, "")
    .replace(/\u200D/g, "");


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "HIDDEN JSX CHARACTERS REMOVED"
);
