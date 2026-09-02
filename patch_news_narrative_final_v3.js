const fs = require("fs");

const path =
  "./src/app/(tabs)/home.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


const start =
  src.indexOf(
    "function sanitizeHomeNewsText("
  );

const end =
  src.indexOf(
    "function HomeChurchNewsCarousel()",
    start
  );


if (
  start < 0 ||
  end < 0
) {

  throw new Error(
    "sanitizeHomeNewsText/HomeChurchNewsCarousel anchors not found."
  );

}


const sanitizer =
`function sanitizeHomeNewsText(
  value:
    string | null | undefined
) {

  let text =
    String(
      value ?? ''
    )
      .replace(
        /\\s+/g,
        ' '
      )
      .trim();


  /*
   * -------------------------------------------------------
   * 1. READER METADATA
   * -------------------------------------------------------
   */
  text =
    text.replace(
      /\\b(?:Title|URL\\s*Source|Published\\s*Time|Markdown\\s*Content|Markdown|Content|Nilalaman|Source\\s*URL|Web\\s*Address|Website)\\s*:?\\s*/gi,
      ' '
    );


  /*
   * -------------------------------------------------------
   * 2. NORMAL RAW URLs
   * -------------------------------------------------------
   */
  text =
    text.replace(
      /https?:\\/\\/[^\\s<>"']+/gi,
      ' '
    );


  text =
    text.replace(
      /www\\.[^\\s<>"']+/gi,
      ' '
    );


  /*
   * -------------------------------------------------------
   * 3. MANGLED / TRANSLATED URLS
   *
   * Examples:
   *
   * com/resource - library/news/article-name
   * baptistpress.com / resource - library / news
   * org/stories/something
   * -------------------------------------------------------
   */
  text =
    text.replace(
      /\\b(?:[a-z0-9-]+\\.)?(?:com|org|net|news|co|uk|ph)\\s*(?:\\/|\\\\)\\s*(?:[a-z0-9_-]+\\s*(?:[-/]\\s*)?){1,30}/gi,
      ' '
    );


  text =
    text.replace(
      /\\b[a-z0-9.-]+\\.(?:com|org|net|news|co|uk|ph)(?:\\s*[/\\\\-]\\s*[a-z0-9._-]+)+/gi,
      ' '
    );


  /*
   * -------------------------------------------------------
   * 4. IF A REAL NEWS DATELINE EXISTS,
   *    DISCARD EVERYTHING BEFORE IT.
   *
   * Example:
   * junk junk BOSTON (BP) – actual story...
   * -------------------------------------------------------
   */
  const dateline =
    text.match(
      /\\b[A-Z][A-Z .,'’/-]{2,45}\\s*\\([A-Z0-9]{2,8}\\)\\s*[—–-]\\s*/
    );


  if (
    dateline &&
    typeof dateline.index ===
      'number'
  ) {

    text =
      text.slice(
        dateline.index +
        dateline[0].length
      );

  }


  /*
   * Dateline without parenthetical source:
   * MANILA, Philippines — actual story...
   */
  text =
    text.replace(
      /^[A-Z][A-Za-zÀ-ÿ .,'’/-]{2,55}\\s*[—–-]\\s*/,
      ''
    );


  /*
   * -------------------------------------------------------
   * 5. REMOVE LEFTOVER MARKDOWN / PATH GARBAGE
   * -------------------------------------------------------
   */
  text =
    text
      .replace(
        /\\[([^\\]]+)\\]\\([^)]*\\)/g,
        '$1'
      )
      .replace(
        /\\b(?:resource|library|news|article|stories)\\s*[/\\\\-]\\s*(?:[a-z0-9_-]+\\s*[/\\\\-]?\\s*){2,}/gi,
        ' '
      );


  /*
   * -------------------------------------------------------
   * 6. REMOVE PROMO / TRANSLATION JUNK
   * -------------------------------------------------------
   */
  text =
    text
      .replace(
        /\\b(?:Subukan Natin|Subukan natin|Matuto Pa|Matuto pa|Alamin Pa|Alamin pa|Basahin Pa|Basahin pa|Read More|Learn More|Find Out More)\\b[.!]?\\s*$/gi,
        ''
      );


  /*
   * -------------------------------------------------------
   * 7. FINAL TYPOGRAPHIC CLEAN
   * -------------------------------------------------------
   */
  text =
    text
      .replace(
        /\\s+-\\s+/g,
        '-'
      )
      .replace(
        /\\s+([,.!?;:])/g,
        '$1'
      )
      .replace(
        /\\(\\s*\\)/g,
        ' '
      )
      .replace(
        /\\s{2,}/g,
        ' '
      )
      .trim();


  /*
   * URL-only content must show NOTHING.
   */
  if (
    text.length <
      35 ||
    !/[A-Za-zÀ-ÿ]/.test(
      text
    )
  ) {

    return '';

  }


  return text;

}`;


src =
  src.slice(
    0,
    start
  ) +
  sanitizer +
  "\n\n" +
  src.slice(
    end
  );


/*
 * ---------------------------------------------------------
 * NEW CACHE VERSION
 *
 * Old contaminated Tagalog translations must not be reused.
 * ---------------------------------------------------------
 */
src =
  src.replace(
    /buklod\\.home\\.church_news\\.tagalog\\.v\\d+/g,
    "buklod.home.church_news.tagalog.v3"
  );


/*
 * ---------------------------------------------------------
 * SANITIZE BEFORE TRANSLATION
 * ---------------------------------------------------------
 */

const translateStart =
  src.indexOf(
    "async function translateNewsToTagalog("
  );

if (
  translateStart >=
  0
) {

  const chunksAnchor =
`  const chunks =
    splitNewsForTranslation(
      input
    );`;


  const cleanChunks =
`  const cleanInput =
    sanitizeHomeNewsText(
      input
    );


  if (
    !cleanInput
  ) {

    return '';

  }


  const chunks =
    splitNewsForTranslation(
      cleanInput
    );`;


  if (
    src.includes(
      chunksAnchor
    )
  ) {

    src =
      src.replace(
        chunksAnchor,
        cleanChunks
      );

  }

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "NEWS NARRATIVE FINAL CLEAN V3 INSTALLED"
);
