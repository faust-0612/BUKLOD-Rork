const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );

function stop(message) {
  console.error("");
  console.error("PATCH 159A-1 STOPPED:");
  console.error(message);
  process.exit(1);
}


/* ============================================================
   1. REMOVE Dimensions FROM REACT IMPORT
   ============================================================ */

const reactImportRe =
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]react['"];/;

const reactMatch =
  src.match(
    reactImportRe
  );

if (!reactMatch) {
  stop(
    "React import block not found."
  );
}

let reactNames =
  reactMatch[1]
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
    .filter(
      x =>
        x !== "Dimensions" &&
        x !== "Linking"
    );

src =
  src.replace(
    reactImportRe,
`import {
  ${reactNames.join(",\n  ")},
} from 'react';`
  );


/* ============================================================
   2. ADD Dimensions TO REACT-NATIVE IMPORT
   ============================================================ */

const nativeImportRe =
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"];/;

const nativeMatch =
  src.match(
    nativeImportRe
  );

if (!nativeMatch) {
  stop(
    "react-native import block not found."
  );
}

let nativeNames =
  nativeMatch[1]
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

if (
  !nativeNames.includes(
    "Dimensions"
  )
) {
  nativeNames.unshift(
    "Dimensions"
  );
}

src =
  src.replace(
    nativeImportRe,
`import {
  ${nativeNames.join(",\n  ")},
} from 'react-native';`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);

console.log(
  "DIMENSIONS IMPORT FIXED"
);
