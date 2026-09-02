const fs = require("fs");

const homePath =
  "./src/app/(tabs)/home.tsx";

const functionPath =
  "./supabase/functions/sync-church-news/index.ts";

let home =
  fs.readFileSync(
    homePath,
    "utf8"
  );

let fn =
  fs.readFileSync(
    functionPath,
    "utf8"
  );


function replaceBetween(
  text,
  startMarker,
  endMarker,
  replacement
) {

  const start =
    text.indexOf(
      startMarker
    );

  const end =
    text.indexOf(
      endMarker,
      start
    );

  if (
    start < 0 ||
    end < 0
  ) {

    throw new Error(
      "Anchor not found: " +
      startMarker +
      " -> " +
      endMarker
    );

  }


  return (
    text.slice(
      0,
      start
    ) +
    replacement +
    "\n\n" +
    text.slice(
      end
    )
  );

}


/* ============================================================
   HOME: STRICT DISPLAY SANITIZER
============================================================ */

const homeSanitizer =
`function sanitizeHomeNewsText(
  value:
    string | null | undefined
) {

  let text =
    String(
      value ?? ''
    );


  /*
   * Preserve visible markdown-link words,
   * but remove the destination URL.
   */
  text =
    text.replace(
      /\\[([^\\]]+)\\]\\((?:https?:\\/\\/)?[^)]+\\)/gi,
      '$1'
    );


  /*
   * Remove Reader / scraper metadata.
   */
  text =
    text.replace(
      /\\b(?:Title|URL\\s*Source|Published\\s*Time|Markdown\\s*Content|Content|Nilalaman|Source\\s*URL|Web\\s*Address|Website)\\s*:\\s*/gi,
      ' '
    );


  /*
   * Remove complete raw URLs.
   */
  text =
    text.replace(
      /https?:\\/\\/[^\\s<>"']+/gi,
      ' '
    );


  text =
    text.replace(
      /\\bwww\\.[^\\s<>"']+/gi,
      ' '
    );


  /*
   * Remove naked domain/path strings.
   */
  text =
    text.replace(
      /\\b[a-z0-9.-]+\\.(?:com|org|net|news|co|uk|ph)(?:\\/[^\\s<>"']*)?/gi,
      ' '
    );


  text =
    text
      .replace(
        /\\(\\s*\\)/g,
        ' '
      )
      .replace(
        /\\s+([,.!?;:])/g,
        '$1'
      )
      .replace(
        /\\s{2,}/g,
        ' '
      )
      .trim();


  /*
   * If after URL removal there is no
   * meaningful language left, show nothing.
   */
  if (
    !/[A-Za-zÀ-ÿ]/.test(
      text
    )
  ) {

    return '';

  }


  return text;

}`;


if (
  home.includes(
    "function sanitizeHomeNewsText("
  )
) {

  home =
    replaceBetween(
      home,
      "function sanitizeHomeNewsText(",
      "function HomeChurchNewsCarousel()",
      homeSanitizer
    );

}


/*
 * Invalidate OLD cached Tagalog translations.
 * This prevents old Content:/URL translations
 * from being reused.
 */
home =
  home.replace(
    "buklod.home.church_news.tagalog.v1",
    "buklod.home.church_news.tagalog.v2"
  );


/*
 * Make rendering sanitize the FINAL value too.
 */
const componentStart =
  home.indexOf(
    "function HomeChurchNewsCarousel()"
  );

let componentEnd =
  home.indexOf(
    "function HomeImportantReminder()",
    componentStart
  );

if (
  componentEnd < 0
) {
  componentEnd =
    home.length;
}


let section =
  home.slice(
    componentStart,
    componentEnd
  );


section =
  section.replace(
    /\{displayNewsTitle\}/g,
    "{sanitizeHomeNewsText(displayNewsTitle)}"
  );


section =
  section.replace(
    /\{displayNewsSummary\}/g,
    "{sanitizeHomeNewsText(displayNewsSummary)}"
  );


/*
 * Fallback for older render structure.
 */
section =
  section.replace(
    /\{title\}/g,
    "{sanitizeHomeNewsText(title)}"
  );


section =
  section.replace(
    /\{summary\}/g,
    "{sanitizeHomeNewsText(summary)}"
  );


home =
  home.slice(
    0,
    componentStart
  ) +
  section +
  home.slice(
    componentEnd
  );


/* ============================================================
   BACKEND: STRICT READER ARTIFACT SANITIZER
============================================================ */

const backendSanitizer =
`function sanitizeNarrativeArtifacts(
  value:
    string
) {

  let text =
    String(
      value ?? ''
    );


  text =
    text.replace(
      /\\[([^\\]]+)\\]\\((?:https?:\\/\\/)?[^)]+\\)/gi,
      '$1'
    );


  text =
    text.replace(
      /\\b(?:Title|URL\\s*Source|Published\\s*Time|Markdown\\s*Content|Content|Nilalaman|Source\\s*URL|Web\\s*Address|Website)\\s*:\\s*/gi,
      ' '
    );


  text =
    text.replace(
      /https?:\\/\\/[^\\s<>"']+/gi,
      ' '
    );


  text =
    text.replace(
      /\\bwww\\.[^\\s<>"']+/gi,
      ' '
    );


  text =
    text.replace(
      /\\b[a-z0-9.-]+\\.(?:com|org|net|news|co|uk|ph)(?:\\/[^\\s<>"']*)?/gi,
      ' '
    );


  return text
    .replace(
      /\\(\\s*\\)/g,
      ' '
    )
    .replace(
      /\\s+([,.!?;:])/g,
      '$1'
    )
    .replace(
      /\\s{2,}/g,
      ' '
    )
    .trim();

}`;


if (
  fn.includes(
    "function sanitizeNarrativeArtifacts("
  )
) {

  fn =
    replaceBetween(
      fn,
      "function sanitizeNarrativeArtifacts(",
      "function normalizeDomain(",
      backendSanitizer
    );

}


/* ============================================================
   REPLACE ARTICLE NARRATIVE SECTION COMPLETELY
============================================================ */

const narrativeBlock =
`function badParagraph(
  input:
    string
) {

  const text =
    sanitizeNarrativeArtifacts(
      cleanMarkdown(
        input
      )
    );


  const lower =
    text.toLowerCase();


  /*
   * URL-only / metadata-only lines become empty
   * after sanitizer and are rejected here.
   */
  if (
    text.length <
    55
  ) {

    return true;

  }


  if (
    excludedStory(
      text
    )
  ) {

    return true;

  }


  const badStarts = [

    'title:',
    'url source:',
    'published time:',
    'markdown content:',
    'content:',
    'nilalaman:',
    'source:',
    'website:',

    'by ',
    'written by ',

    'published ',
    'posted ',
    'updated ',

    'photo by ',
    'photo:',
    'image:',

    'share ',
    'facebook ',
    'instagram ',
    'youtube ',

    'subscribe ',
    'sign up ',

    'read more',
    'learn more',
    'find out',
    'discover ',

    'related stories',
    'related articles',

    'advertisement',

  ];


  if (
    badStarts.some(
      phrase =>
        lower.startsWith(
          phrase
        )
    )
  ) {

    return true;

  }


  const badContains = [

    'subscribe to our newsletter',
    'privacy policy',
    'cookie policy',
    'all rights reserved',
    'follow us on facebook',
    'follow us on instagram',

  ];


  if (
    badContains.some(
      phrase =>
        lower.includes(
          phrase
        )
    )
  ) {

    return true;

  }


  /*
   * Reject navigation/menu-style blocks.
   */
  const pipes =
    (
      text.match(
        /\\|/g
      ) ??
      []
    ).length;


  if (
    pipes >=
    2
  ) {

    return true;

  }


  return false;

}


function stripDateline(
  input:
    string
) {

  return sanitizeNarrativeArtifacts(
    cleanMarkdown(
      input
    )
  )
    .replace(
      /^[A-Z][A-Za-zÀ-ÿ .,'’()/-]{2,70}\\s*[—–-]\\s*/,
      ''
    )
    .replace(
      /^\\([A-Z0-9 .'-]{2,20}\\)\\s*[—–-]\\s*/,
      ''
    )
    .replace(
      /\\s+/g,
      ' '
    )
    .trim();

}


function splitSentences(
  input:
    string
) {

  const text =
    stripDateline(
      input
    );


  if (
    !text ||
    !/[A-Za-zÀ-ÿ]/.test(
      text
    )
  ) {

    return [];

  }


  return (
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ??
    []
  )
    .map(
      sentence =>
        sanitizeNarrativeArtifacts(
          sentence
        )
    )
    .map(
      sentence =>
        sentence.trim()
    )
    .filter(
      sentence =>
        sentence.length >=
          35 &&
        /[A-Za-zÀ-ÿ]/.test(
          sentence
        ) &&
        !excludedStory(
          sentence
        )
    );

}


function buildNarrative(
  markdown:
    string,
  title:
    string
) {

  const cleanTitle =
    sanitizeNarrativeArtifacts(
      cleanMarkdown(
        title
      )
    )
      .toLowerCase();


  const rawParagraphs =
    String(
      markdown ??
      ''
    )
      .split(
        /\\n\\s*\\n/
      );


  const paragraphs:
    string[] = [];


  /*
   * We no longer depend on finding the title first.
   *
   * Reader metadata lines are sanitized/rejected,
   * then we use the first real prose paragraphs.
   */
  for (
    const raw
    of rawParagraphs
  ) {

    const paragraph =
      sanitizeNarrativeArtifacts(
        cleanMarkdown(
          raw
        )
      );


    if (
      !paragraph ||
      badParagraph(
        paragraph
      )
    ) {

      continue;

    }


    const lower =
      paragraph.toLowerCase();


    if (
      lower ===
        cleanTitle ||
      (
        cleanTitle.length >
          20 &&
        lower ===
          cleanTitle
      )
    ) {

      continue;

    }


    /*
     * Giant blocks are normally navigation,
     * footer or malformed scraped content.
     */
    if (
      paragraph.length >
      1400
    ) {

      continue;

    }


    paragraphs.push(
      paragraph
    );


    if (
      paragraphs.length >=
      5
    ) {

      break;

    }

  }


  const output:
    string[] = [];


  /*
   * Use consecutive complete sentences only.
   */
  for (
    const paragraph
    of paragraphs
  ) {

    const sentences =
      splitSentences(
        paragraph
      );


    for (
      const sentence
      of sentences
    ) {

      if (
        output.some(
          previous =>
            previous
              .toLowerCase() ===
            sentence
              .toLowerCase()
        )
      ) {

        continue;

      }


      output.push(
        sentence
      );


      const joined =
        sanitizeNarrativeArtifacts(
          output.join(
            ' '
          )
        );


      /*
       * Preferred:
       * 2 coherent complete sentences.
       *
       * Maximum:
       * 3 sentences.
       */
      if (
        output.length >=
          2 &&
        joined.length >=
          170
      ) {

        return joined;

      }


      if (
        output.length >=
        3
      ) {

        return joined;

      }

    }

  }


  /*
   * Accept one sentence only if it is
   * substantial prose, never a URL.
   */
  if (
    output.length ===
      1
  ) {

    const one =
      sanitizeNarrativeArtifacts(
        output[0]
      );


    if (
      one.length >=
        100 &&
      /[A-Za-zÀ-ÿ]/.test(
        one
      )
    ) {

      return one;

    }

  }


  return '';

}`;


fn =
  replaceBetween(
    fn,
    "function badParagraph(",
    "function findArticleDate(",
    narrativeBlock
  );


/* ============================================================
   WRITE
============================================================ */

fs.writeFileSync(
  homePath,
  home,
  "utf8"
);


fs.writeFileSync(
  functionPath,
  fn,
  "utf8"
);


console.log(
  "STRICT NARRATIVE CLEANUP V2 INSTALLED"
);
