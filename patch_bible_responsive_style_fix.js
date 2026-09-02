const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


/*
 * PATCH_BIBLE_RESPONSIVE_STYLE_FIX
 *
 * Previous patch inserted:
 *
 *   },
 *   ,
 *   bibleViewToolbar: {
 *
 * The previous style property already
 * had its comma, so the second comma
 * breaks the StyleSheet object.
 */

const pattern =
  /(\n\s*},)\s*\n\s*,\s*\n(\s*bibleViewToolbar\s*:)/m;


if (!pattern.test(src)) {

  /*
   * More tolerant fallback:
   * remove a standalone comma directly
   * before bibleViewToolbar.
   */
  const fallback =
    /\n\s*,\s*\n(\s*bibleViewToolbar\s*:)/m;


  if (!fallback.test(src)) {

    console.error("");
    console.error(
      "STYLE FIX STOPPED: extra comma anchor not found."
    );

    process.exit(1);
  }


  src =
    src.replace(
      fallback,
      "\n$1"
    );

}
else {

  src =
    src.replace(
      pattern,
      "$1\n$2"
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "EXTRA RESPONSIVE STYLE COMMA REMOVED"
);
