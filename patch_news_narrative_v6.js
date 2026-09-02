const fs = require("fs");

const path =
  "./supabase/functions/sync-church-news/index.ts";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function stop(message) {
  console.error("");
  console.error("PATCH STOPPED:");
  console.error(message);
  process.exit(1);
}


/* ==========================================================
   1. REMOVE BROAD RELIGION NEWS SERVICE
========================================================== */

src =
  src.replace(
    /\n\s*\{\s*name:\s*'Religion News Service',[\s\S]*?indexUrl:\s*'https:\/\/religionnews\.com\/category\/faiths\/christianity\/',[\s\S]*?\n\s*\},\n?/,
    "\n"
  );


/* ==========================================================
   2. ADD STRICT BUKLOD CONTENT FILTER
========================================================== */

if (
  !src.includes(
    "BUKLOD_EVANGELICAL_FILTER_V6"
  )
) {

  const anchor =
    "function isBoilerplate(";


  if (
    !src.includes(anchor)
  ) {
    stop(
      "isBoilerplate anchor not found."
    );
  }


  const helper =
`

/* ============================================================
   BUKLOD_EVANGELICAL_FILTER_V6

   BUKLOD Home News is intentionally focused on:
   - evangelical / Baptist churches
   - Gospel missions
   - missionaries
   - persecution of Christians
   - church planting and growth
   - Bible work
   - revival and ministry
   - Christian worship/music

   Broad Catholic/Vatican/Pope coverage is excluded.
============================================================ */


function isExcludedChurchNews(
  value:
    string
) {

  const text =
    clean(
      value
    )
      .toLowerCase();


  const excluded = [

    'pope ',
    'pope francis',
    'pope leo',
    'the pope',
    'vatican',
    'papal ',
    'pontiff',
    'roman catholic',
    'catholic church',
    'catholic bishop',
    'catholic bishops',
    'catholic mass',
    'cardinal ',

  ];


  return excluded.some(
    term =>
      text.includes(
        term
      )
  );

}


function removeNewsDateline(
  value:
    string
) {

  let text =
    clean(
      value
    );


  /*
   * NASHVILLE (BP) — Story...
   * MANILA, Philippines — Story...
   */
  text =
    text.replace(
      /^[A-Z][A-Z .,'()/-]{2,55}\s*[—–-]\s*/,
      ''
    );


  /*
   * (BP) — Story...
   */
  text =
    text.replace(
      /^\([A-Z0-9 .'-]{2,20}\)\s*[—–-]\s*/,
      ''
    );


  return text
    .replace(
      /\s+/g,
      ' '
    )
    .trim();

}


function looksLikeArticleNavigation(
  value:
    string
) {

  const text =
    clean(
      value
    );


  const lower =
    text.toLowerCase();


  if (
    !text ||
    text.length <
    45
  ) {
    return true;
  }


  const starts = [

    'by ',
    'written by ',
    'published ',
    'updated ',
    'photo by ',
    'photo:',
    'image:',
    'caption:',
    'share ',
    'facebook ',
    'instagram ',
    'twitter ',
    'x.com ',
    'email ',
    'print ',
    'related ',
    'more stories ',
    'latest stories ',
    'advertisement ',

  ];


  if (
    starts.some(
      item =>
        lower.startsWith(
          item
        )
    )
  ) {
    return true;
  }


  /*
   * Navigation/menu lines often contain
   * several separators.
   */
  const separators =
    (
      text.match(
        /\||›|»/g
      ) ??
      []
    ).length;


  if (
    separators >=
    2
  ) {
    return true;
  }


  return false;

}


`;


  src =
    src.replace(
      anchor,
      helper +
      anchor
    );

}


/* ==========================================================
   3. REPLACE DIGEST WITH CLEAN NARRATIVE
========================================================== */

const digestStart =
  src.indexOf(
    "function digestFromReader("
  );


const relevanceStart =
  src.indexOf(
    "function christianRelevant(",
    digestStart
  );


if (
  digestStart < 0 ||
  relevanceStart < 0
) {

  stop(
    "digestFromReader/christianRelevant anchors not found."
  );

}


const newDigest =
`function digestFromReader(
  markdown:
    string,
  title:
    string
) {

  /*
   * We want a small coherent news story,
   * not random extracted fragments.
   */

  const rawLines =
    markdown
      .split(
        '\\n'
      )
      .map(
        line =>
          clean(
            line
          )
      )
      .filter(
        Boolean
      );


  const cleanTitle =
    clean(
      title
    )
      .toLowerCase();


  /*
   * Try to begin reading AFTER the actual title.
   */
  let titleIndex =
    rawLines.findIndex(
      line => {

        const normalized =
          line.toLowerCase();


        return (
          normalized ===
            cleanTitle ||
          (
            cleanTitle.length >
              25 &&
            normalized.includes(
              cleanTitle
            )
          )
        );

      }
    );


  if (
    titleIndex <
    0
  ) {
    titleIndex =
      0;
  }


  const candidates:
    string[] = [];


  for (
    let index =
      titleIndex + 1;

    index <
      Math.min(
        rawLines.length,
        titleIndex + 100
      );

    index++
  ) {

    let line =
      rawLines[
        index
      ];


    if (
      !line ||
      looksLikeArticleNavigation(
        line
      ) ||
      isBoilerplate(
        line
      ) ||
      isExcludedChurchNews(
        line
      )
    ) {

      continue;

    }


    line =
      removeNewsDateline(
        line
      );


    if (
      line.length <
      55
    ) {
      continue;
    }


    /*
     * Reject title repetition.
     */
    if (
      line
        .toLowerCase() ===
      cleanTitle
    ) {
      continue;
    }


    candidates.push(
      line
    );


    /*
     * Intro paragraphs are normally enough.
     */
    if (
      candidates.length >=
      5
    ) {
      break;
    }

  }


  const narrative:
    string[] = [];


  for (
    const paragraph
    of candidates
  ) {

    const parts =
      sentenceList(
        paragraph
      );


    for (
      let sentence
      of parts
    ) {

      sentence =
        removeNewsDateline(
          sentence
        );


      if (
        !sentence ||
        sentence.length <
          35 ||
        isExcludedChurchNews(
          sentence
        )
      ) {

        continue;

      }


      /*
       * Avoid duplicate sentences.
       */
      if (
        narrative.some(
          existing =>
            existing
              .toLowerCase() ===
            sentence
              .toLowerCase()
        )
      ) {

        continue;

      }


      narrative.push(
        sentence
      );


      const combined =
        narrative.join(
          ' '
        );


      /*
       * Ideal Home digest:
       * 2-3 complete narrative sentences.
       */
      if (
        narrative.length >=
          2 &&
        combined.length >=
          180
      ) {

        return narrative
          .slice(
            0,
            3
          )
          .join(
            ' '
          )
          .replace(
            /\\s+/g,
            ' '
          )
          .trim();

      }


      if (
        narrative.length >=
        3
      ) {

        return narrative
          .join(
            ' '
          )
          .replace(
            /\\s+/g,
            ' '
          )
          .trim();

      }

    }

  }


  /*
   * One strong complete sentence is allowed.
   * Otherwise reject the article rather than
   * showing garbage fragments.
   */
  if (
    narrative.length ===
      1 &&
    narrative[0].length >=
      100
  ) {

    return narrative[0];

  }


  return '';

}


`;


src =
  src.slice(
    0,
    digestStart
  ) +
  newDigest +
  src.slice(
    relevanceStart
  );


/* ==========================================================
   4. REPLACE RELEVANCE FILTER
========================================================== */

const relevanceNewStart =
  src.indexOf(
    "function christianRelevant("
  );


const discoverStart =
  src.indexOf(
    "async function discoverCandidates()",
    relevanceNewStart
  );


if (
  relevanceNewStart < 0 ||
  discoverStart < 0
) {

  stop(
    "christianRelevant/discoverCandidates anchors not found."
  );

}


const newRelevance =
`function christianRelevant(
  item:
    NewsRow
) {

  const text =
    (
      item.original_title +
      ' ' +
      (
        item.english_summary ??
        ''
      )
    );


  /*
   * Absolute exclusion.
   */
  if (
    isExcludedChurchNews(
      text
    )
  ) {

    return false;

  }


  /*
   * Current sources are evangelical,
   * Baptist, mission, persecution or
   * Christian-music publishers.
   *
   * Still require meaningful article text.
   */
  if (
    !item
      .english_summary ||
    item
      .english_summary
      .length <
      80
  ) {

    return false;

  }


  return true;

}


`;


src =
  src.slice(
    0,
    relevanceNewStart
  ) +
  newRelevance +
  src.slice(
    discoverStart
  );


/* ==========================================================
   5. REQUIRE REAL NARRATIVE
========================================================== */

const digestAssignment =
`    const digest =
      digestFromReader(
        markdown,
        item.original_title
      );`;


if (
  src.includes(
    digestAssignment
  ) &&
  !src.includes(
    "REQUIRE_CLEAN_NARRATIVE_V6"
  )
) {

  src =
    src.replace(
      digestAssignment,
`${digestAssignment}


    /* REQUIRE_CLEAN_NARRATIVE_V6 */

    if (
      !digest ||
      digest.length <
        80 ||
      isExcludedChurchNews(
        digest
      )
    ) {

      console.log(
        'Rejected poor digest:',
        item.original_url
      );


      return null;

    }`
    );

}


/* ==========================================================
   6. MOST RECENT = MAX 30 DAYS
========================================================== */

src =
  src.replace(
    /45 \*\s*\n?\s*24 \*/,
    "30 *\n        24 *"
  );


/* ==========================================================
   7. REMOVE OLD POPE/CATHOLIC STORIES FROM DATABASE
========================================================== */

const successAnchor =
`      await admin
        .from(
          'church_news_sync_state'
        )
        .upsert({`;


if (
  src.includes(
    successAnchor
  ) &&
  !src.includes(
    "REMOVE_EXCLUDED_EXISTING_NEWS_V6"
  )
) {

  const cleanup =
`      /* REMOVE_EXCLUDED_EXISTING_NEWS_V6 */

      const excludedDatabaseTerms = [

        '%pope%',
        '%vatican%',
        '%papal%',
        '%pontiff%',
        '%roman catholic%',
        '%catholic church%',
        '%cardinal %',

      ];


      for (
        const term
        of excludedDatabaseTerms
      ) {

        await admin
          .from(
            'church_news_items'
          )
          .delete()
          .ilike(
            'original_title',
            term
          );


        await admin
          .from(
            'church_news_items'
          )
          .delete()
          .ilike(
            'english_summary',
            term
          );

      }


`;


  src =
    src.replace(
      successAnchor,
      cleanup +
      successAnchor
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "NARRATIVE CHRISTIAN NEWS V6 INSTALLED"
);
