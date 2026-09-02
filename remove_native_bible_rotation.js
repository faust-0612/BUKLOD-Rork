const fs = require("fs");

const biblePath =
  "./src/app/bible/read.tsx";

const layoutPath =
  "./src/app/_layout.tsx";

const configPath =
  "./app.config.js";


let bible =
  fs.readFileSync(
    biblePath,
    "utf8"
  );

let layout =
  fs.readFileSync(
    layoutPath,
    "utf8"
  );

let config =
  fs.readFileSync(
    configPath,
    "utf8"
  );


/* ============================================================
   1. REMOVE NATIVE IMPORT
============================================================ */

bible =
  bible.replace(
    /\s*import\s+\*\s+as\s+ScreenOrientation\s+from\s+['"]expo-screen-orientation['"];\s*/g,
    "\n"
  );


/* ============================================================
   2. REMOVE OUR ROTATION EFFECTS
============================================================ */

bible =
  bible.replace(
    /\s*\/\*\s*MY_BIBLE_NATIVE_ROTATION_V1\s*\*\/[\s\S]*?useEffect\s*\([\s\S]*?\},\s*\[\]\s*\);\s*/g,
    "\n"
  );


bible =
  bible.replace(
    /\s*\/\*\s*MY_BIBLE_NATIVE_ROTATION_V2\s*\*\/[\s\S]*?useEffect\s*\([\s\S]*?\},\s*\[\]\s*\);\s*/g,
    "\n"
  );


/* ============================================================
   SAFETY
============================================================ */

if (
  bible.includes(
    "ScreenOrientation"
  )
) {
  console.error(
    "A ScreenOrientation reference still remains in bible/read.tsx."
  );

  process.exit(1);
}


/* ============================================================
   3. REMOVE SCREEN ORIENTATION CONFIG PLUGIN
============================================================ */

config =
  config.replace(
    /\s*\[\s*['"]expo-screen-orientation['"]\s*,\s*\{\s*initialOrientation\s*:\s*['"]DEFAULT['"]\s*,?\s*\}\s*,?\s*\]\s*,?/g,
    "\n"
  );


/*
 * While native rotation is disabled,
 * return app config to portrait.
 */
config =
  config.replace(
    /orientation\s*:\s*['"](?:default|landscape|portrait)['"]/,
    "orientation: 'portrait'"
  );


/* ============================================================
   4. REMOVE ROTATION-ONLY BIBLE STACK ENTRY
============================================================ */

layout =
  layout.replace(
    /\s*\{\/\*\s*MY_BIBLE_NATIVE_ROTATION_ROUTE\s*\*\/\}\s*<Stack\.Screen[\s\S]*?name=["']bible\/read["'][\s\S]*?\/>\s*/g,
    "\n"
  );


fs.writeFileSync(
  biblePath,
  bible,
  "utf8"
);

fs.writeFileSync(
  layoutPath,
  layout,
  "utf8"
);

fs.writeFileSync(
  configPath,
  config,
  "utf8"
);


console.log(
  "NATIVE ROTATION CODE REMOVED"
);
