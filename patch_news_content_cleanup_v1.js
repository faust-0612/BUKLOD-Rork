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


/* ============================================================
   1. HOME DISPLAY SANITIZER
   Works even on OLD cached Tagalog translations.
============================================================ */

if (
  !home.includes(
    "HOME_NEWS_CONTENT_SANITIZER_V1"
  )
) {

  const anchor =
    "function HomeChurchNewsCarousel()";


  if (
    !home.includes(
      anchor
    )
  ) {

    throw new Error(
      "HomeChurchNewsCarousel not found."
    );

  }


  const helper =
`

/* HOME_NEWS_CONTENT_SANITIZER_V1 */

function sanitizeHomeNewsText(
  value:
    string | null | undefined
) {

  return String(
    value ?? ''
  )
    /*
     * Jina / scraper labels.
     */
    .replace(
      /\\b(?:Markdown\\s+Content|Content|Nilalaman|URL\\s+Source|Source\\s+URL|Web\\s+Address|Website)\\s*:\\s*/gi,
      ''
    )

    /*
     * Raw web addresses must never appear
     * inside the news narrative.
     */
    .replace(
      /https?:\\/\\/[^\\s)\\]}>,]+/gi,
      ''
    )
    .replace(
      /www\\.[^\\s)\\]}>,]+/gi,
      ''
    )

    /*
     * Remove leftover markdown-link syntax
     * while preserving visible words.
     */
    .replace(
      /\\[([^\\]]+)\\]\\([^)]*\\)/g,
      '$1'
    )

    /*
     * Clean punctuation/spaces left by removed URLs.
     */
    .replace(
      /\\(\\s*\\)/g,
      ''
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

}


`;


  home =
    home.replace(
      anchor,
      helper +
      anchor
    );

}


/*
 * Apply sanitizer to the final TITLE and SUMMARY
 * values used by the card.
 */
const titleSummaryBlock =
/const title =([\s\S]*?)const summary =([\s\S]*?);/m;

const match =
  home.match(
    titleSummaryBlock
  );


if (
  match &&
  !home.includes(
    "const displayNewsTitle ="
  )
) {

  const whole =
    match[0];


  const replacement =
`${whole}

                const displayNewsTitle =
                  sanitizeHomeNewsText(
                    title
                  );

                const displayNewsSummary =
                  sanitizeHomeNewsText(
                    summary
                  );`;


  home =
    home.replace(
      whole,
      replacement
    );


  /*
   * Only inside HomeChurchNewsCarousel section:
   * render sanitized values instead.
   */
  const start =
    home.indexOf(
      "function HomeChurchNewsCarousel()"
    );

  let end =
    home.indexOf(
      "function HomeImportantReminder()",
      start
    );

  if (
    end < 0
  ) {
    end =
      home.length;
  }


  let section =
    home.slice(
      start,
      end
    );


  section =
    section.replace(
      /\{title\}/g,
      "{displayNewsTitle}"
    );


  section =
    section.replace(
      /\{summary\}/g,
      "{displayNewsSummary}"
    );


  home =
    home.slice(
      0,
      start
    ) +
    section +
    home.slice(
      end
    );

}


/* ============================================================
   2. BACKEND SANITIZER
   Future fetched narratives are clean before DB save.
============================================================ */

if (
  fn.includes(
    "function cleanMarkdown("
  ) &&
  !fn.includes(
    "NEWS_BACKEND_CONTENT_SANITIZER_V1"
  )
) {

  const cleanEndAnchor =
    "function normalizeDomain(";


  const index =
    fn.indexOf(
      cleanEndAnchor
    );


  if (
    index < 0
  ) {

    throw new Error(
      "normalizeDomain anchor not found."
    );

  }


  const backendHelper =
`

/* NEWS_BACKEND_CONTENT_SANITIZER_V1 */

function sanitizeNarrativeArtifacts(
  value:
    string
) {

  return String(
    value ?? ''
  )
    .replace(
      /\\b(?:Markdown\\s+Content|Content|Nilalaman|URL\\s+Source|Source\\s+URL|Web\\s+Address|Website)\\s*:\\s*/gi,
      ''
    )
    .replace(
      /https?:\\/\\/[^\\s)\\]}>,]+/gi,
      ''
    )
    .replace(
      /www\\.[^\\s)\\]}>,]+/gi,
      ''
    )
    .replace(
      /\\(\\s*\\)/g,
      ''
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

}


`;


  fn =
    fn.slice(
      0,
      index
    ) +
    backendHelper +
    fn.slice(
      index
    );

}


/*
 * Sanitize final narrative returned by buildNarrative.
 * This catches Reader artifacts before DB save.
 */
fn =
  fn.replace(
    /return joined;/g,
    `return sanitizeNarrativeArtifacts(
          joined
        );`
  );


fn =
  fn.replace(
    /return output\[0\];/g,
    `return sanitizeNarrativeArtifacts(
      output[0]
    );`
  );


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
  "NEWS CONTENT CLEANUP INSTALLED"
);
