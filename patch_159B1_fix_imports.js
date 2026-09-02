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
  console.error(
    "PATCH 159B-1 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


/*
 * IMPORTANT:
 * [^}] prevents the regex from crossing
 * from one import block into another.
 */

const reactRe =
  /import\s*\{([^}]*)\}\s*from\s*['"]react['"];/;

const nativeRe =
  /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"];/;


const reactMatch =
  src.match(
    reactRe
  );

const nativeMatch =
  src.match(
    nativeRe
  );


if (!reactMatch) {
  stop(
    "Exact React import block not found."
  );
}

if (!nativeMatch) {
  stop(
    "Exact react-native import block not found."
  );
}


/* ============================================================
   FIX REACT IMPORT
   React should contain hooks only.
   ============================================================ */

let reactNames =
  reactMatch[1]
    .split(",")
    .map(
      value =>
        value.trim()
    )
    .filter(Boolean)
    .filter(
      value =>
        value !== "Dimensions" &&
        value !== "Linking"
    );

reactNames =
  [...new Set(reactNames)];

src =
  src.replace(
    reactRe,
`import {
  ${reactNames.join(",\n  ")},
} from 'react';`
  );


/* ============================================================
   RE-READ NATIVE IMPORT AFTER REACT CHANGE
   ============================================================ */

const nativeMatch2 =
  src.match(
    nativeRe
  );

if (!nativeMatch2) {
  stop(
    "react-native import disappeared unexpectedly."
  );
}

let nativeNames =
  nativeMatch2[1]
    .split(",")
    .map(
      value =>
        value.trim()
    )
    .filter(Boolean);


/*
 * Remove duplicates first.
 */
nativeNames =
  nativeNames.filter(
    value =>
      value !== "Dimensions" &&
      value !== "Linking"
  );


/*
 * Put them explicitly in react-native.
 */
nativeNames.unshift(
  "Linking"
);

nativeNames.unshift(
  "Dimensions"
);

nativeNames =
  [...new Set(nativeNames)];


src =
  src.replace(
    nativeRe,
`import {
  ${nativeNames.join(",\n  ")},
} from 'react-native';`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "REACT IMPORTS FIXED"
);
