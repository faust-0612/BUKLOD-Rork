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


function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


function removeSourceByName(name) {

  const escaped =
    escapeRegex(name);


  const regex =
    new RegExp(
      "\\n\\s*\\{\\s*" +
      "name:\\s*'" +
      escaped +
      "'," +
      "[\\s\\S]*?" +
      "\\n\\s*\\}," +
      "\\n",
      "m"
    );


  src =
    src.replace(
      regex,
      "\n"
    );

}


/* ==========================================================
   1. REMOVE BROAD SOURCES COMPLETELY
========================================================== */

removeSourceByName(
  "CBN Christian World News"
);

removeSourceByName(
  "CBN News"
);

removeSourceByName(
  "CBN Entertainment"
);


/* ==========================================================
   2. MUCH STRONGER EXCLUSION
========================================================== */

const excludedAnchor =
  "function excludedContent(";

const categoryAnchor =
  "const CATEGORY_SIGNALS";

const excludedStart =
  src.indexOf(
    excludedAnchor
  );

const categoryStart =
  src.indexOf(
    categoryAnchor,
    excludedStart
  );


if (
  excludedStart < 0 ||
  categoryStart < 0
) {
  stop(
    "excludedContent/category anchors not found."
  );
}


const newExcluded =
`function excludedContent(
  value:
    string
) {

  const text =
    cleanText(
      value
    )
      .toLowerCase();


  /*
   * BUKLOD feed is intentionally
   * evangelical / Baptist / missions focused.
   */
  const excluded = [

    'pope',
    'papacy',
    'papal',
    'pontiff',
    'vatican',
    'holy see',
    'conclave',

    'roman catholic',
    'catholic church',
    'catholic mass',
    'catholic bishop',
    'catholic bishops',
    'catholic priest',
    'catholic priests',

    'cardinal',
    'archbishop of rome',
    'bishop of rome',

  ];


  return excluded.some(
    term =>
      text.includes(
        term
      )
  );

}


/* ============================================================
   PURGE_EXCLUDED_NEWS_V8

   IMPORTANT:
   Purge runs BEFORE cache checking.
   Therefore old Pope/Vatican stories cannot
   remain simply because the function returned cached=true.
============================================================ */

async function purgeExcludedNews(
  admin:
    any
) {

  const {
    data,
    error,
  } =
    await admin
      .from(
        'church_news_items'
      )
      .select(
        'id, original_title, english_summary'
      )
      .limit(
        250
      );


  if (
    error ||
    !Array.isArray(
      data
    )
  ) {

    return;

  }


  const ids =
    data
      .filter(
        item =>
          excludedContent(
            String(
              item.original_title ??
              ''
            ) +
            ' ' +
            String(
              item.english_summary ??
              ''
            )
          )
      )
      .map(
        item =>
          item.id
      )
      .filter(
        Boolean
      );


  if (
    ids.length >
    0
  ) {

    await admin
      .from(
        'church_news_items'
      )
      .delete()
      .in(
        'id',
        ids
      );


    console.log(
      'PURGED EXCLUDED STORIES:',
      ids.length
    );

  }

}


`;


src =
  src.slice(
    0,
    excludedStart
  ) +
  newExcluded +
  src.slice(
    categoryStart
  );


/* ==========================================================
   3. FULL ARTICLE READER
========================================================== */

const selectAnchor =
  "function selectStories(";

if (
  !src.includes(
    selectAnchor
  )
) {
  stop(
    "selectStories anchor not found."
  );
}


if (
  !src.includes(
    "FULL_ARTICLE_NARRATIVE_V8"
  )
) {

  const helpers =
`

/* ============================================================
   FULL_ARTICLE_NARRATIVE_V8

   Never construct the Home narrative from navigation/index
   snippets.

   We open the ACTUAL article and take consecutive,
   complete sentences from its main cleaned content.
============================================================ */


type ReaderArticle = {

  title:
    string;

  content:
    string;

  timestamp:
    string | null;

};


function cleanArticleParagraph(
  value:
    string
) {

  let text =
    String(
      value ??
      ''
    );


  /*
   * Images.
   */
  text =
    text.replace(
      /!\\[[^\\]]*\\]\\([^)]+\\)/g,
      ' '
    );


  /*
   * Markdown links: preserve visible text.
   */
  text =
    text.replace(
      /\\[([^\\]]+)\\]\\([^)]+\\)/g,
      '$1'
    );


  text =
    text
      .replace(
        /^#{1,6}\\s*/g,
        ''
      )
      .replace(
        /[*_\x60>#]/g,
        ' '
      )
      .replace(
        /\\s+/g,
        ' '
      )
      .trim();


  return cleanText(
    text
  );

}


function badArticleParagraph(
  value:
    string
) {

  const text =
    cleanArticleParagraph(
      value
    );


  const lower =
    text.toLowerCase();


  if (
    text.length <
    55
  ) {
    return true;
  }


  if (
    excludedContent(
      text
    )
  ) {
    return true;
  }


  const starts = [

    'by ',
    'written by ',
    'published ',
    'updated ',
    'last updated ',
    'photo by ',
    'photo:',
    'image:',
    'listen to ',
    'watch ',
    'subscribe ',
    'sign up ',
    'share ',
    'facebook ',
    'instagram ',
    'youtube ',
    'related stories',
    'related articles',
    'read more',
    'learn more',
    'find out',
    'discover ',
    'advertisement',

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


  const contains = [

    'subscribe to our newsletter',
    'all rights reserved',
    'privacy policy',
    'cookie policy',
    'follow us on facebook',
    'follow us on instagram',
    'share this article',
    'share this story',

  ];


  return contains.some(
    item =>
      lower.includes(
        item
      )
  );

}


function stripDateline(
  value:
    string
) {

  let text =
    cleanArticleParagraph(
      value
    );


  /*
   * Examples:
   * Afghanistan (MNN) — ...
   * NASHVILLE (BP) – ...
   * Manila, Philippines — ...
   */
  text =
    text.replace(
      /^[A-Za-zÀ-ÿ .,'’()-]{2,70}\\s*[—–-]\\s*/,
      ''
    );


  return text
    .replace(
      /\\s+/g,
      ' '
    )
    .trim();

}


function articleSentences(
  value:
    string
) {

  const text =
    stripDateline(
      value
    );


  const matches =
    text.match(
      /[^.!?]+[.!?]+/g
    ) ??
    [];


  return matches
    .map(
      item =>
        item
          .replace(
            /\\s+/g,
            ' '
          )
          .trim()
    )
    .filter(
      item =>
        item.length >=
          35 &&
        !excludedContent(
          item
        )
    );

}


function narrativeFromArticle(
  content:
    string,
  title:
    string
) {

  const cleanTitle =
    cleanArticleParagraph(
      title
    )
      .toLowerCase();


  /*
   * Jina's cleaned content is markdown.
   * Blank lines normally preserve article paragraphs.
   */
  const paragraphs =
    String(
      content ??
      ''
    )
      .split(
        /\\n\\s*\\n/
      )
      .map(
        cleanArticleParagraph
      )
      .filter(
        paragraph => {

          if (
            badArticleParagraph(
              paragraph
            )
          ) {
            return false;
          }


          const lower =
            paragraph
              .toLowerCase();


          /*
           * Do not repeat headline.
           */
          if (
            lower ===
              cleanTitle ||
            (
              cleanTitle.length >
                25 &&
              lower.startsWith(
                cleanTitle
              )
            )
          ) {

            return false;

          }


          return true;

        }
      );


  const output:
    string[] = [];


  /*
   * Only use the first meaningful article paragraphs.
   * Do NOT jump randomly around the page.
   */
  for (
    const paragraph
    of paragraphs.slice(
      0,
      6
    )
  ) {

    const sentences =
      articleSentences(
        paragraph
      );


    if (
      sentences.length ===
      0
    ) {
      continue;
    }


    for (
      const sentence
      of sentences
    ) {

      if (
        output.some(
          existing =>
            existing
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
        output.join(
          ' '
        );


      /*
       * Preferred Home narrative:
       * 2 complete sentences.
       *
       * A third sentence is allowed when
       * the first two are very short.
       */
      if (
        output.length >=
          2 &&
        joined.length >=
          180
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
   * One substantial sentence is better
   * than a fabricated/chopped summary.
   */
  if (
    output.length ===
      1 &&
    output[0].length >=
      100
  ) {

    return output[0];

  }


  return '';

}


async function readFullArticle(
  url:
    string
):
  Promise<
    ReaderArticle |
    null
  > {

  try {

    const response =
      await fetch(
        'https://r.jina.ai/' +
        url,
        {
          headers: {

            Accept:
              'application/json',

            'User-Agent':
              'BUKLOD-Christian-News/8.0',

          },
        }
      );


    if (
      !response.ok
    ) {

      console.log(
        'ARTICLE READER HTTP',
        response.status,
        url
      );


      return null;

    }


    const payload =
      await response
        .json();


    /*
     * Reader response can wrap the result
     * in "data".
     */
    const data =
      payload?.data ??
      payload;


    const content =
      String(
        data?.content ??
        ''
      );


    if (
      content.length <
      100
    ) {

      return null;

    }


    const possibleTimestamp =

      data?.publishedTime ??
      data?.published_time ??
      data?.timestamp ??
      data?.date ??
      null;


    let timestamp:
      string |
      null =
        null;


    if (
      possibleTimestamp
    ) {

      const date =
        new Date(
          possibleTimestamp
        );


      if (
        Number.isFinite(
          date.getTime()
        )
      ) {

        timestamp =
          date.toISOString();

      }

    }


    return {

      title:
        cleanArticleParagraph(
          String(
            data?.title ??
            ''
          )
        ),

      content,

      timestamp,

    };

  }
  catch (
    error
  ) {

    console.log(
      'ARTICLE READER FAILED:',
      url,
      String(
        error
      )
    );


    return null;

  }

}


async function hydrateCandidateV8(
  item:
    Candidate
):
  Promise<
    Candidate |
    null
  > {

  /*
   * Reject before making another network call.
   */
  if (
    excludedContent(
      item.original_title
    )
  ) {

    return null;

  }


  const article =
    await readFullArticle(
      item.original_url
    );


  if (
    !article
  ) {

    return null;

  }


  /*
   * Full article title is also checked.
   */
  if (
    excludedContent(
      article.title
    )
  ) {

    return null;

  }


  const narrative =
    narrativeFromArticle(
      article.content,
      article.title ||
      item.original_title
    );


  if (
    !narrative ||
    narrative.length <
      90 ||
    excludedContent(
      narrative
    )
  ) {

    console.log(
      'REJECTED NARRATIVE:',
      item.original_url
    );


    return null;

  }


  const published =
    article.timestamp ||
    item.published_at;


  const time =
    new Date(
      published
    )
      .getTime();


  if (
    !Number.isFinite(
      time
    )
  ) {

    return null;

  }


  /*
   * Maximum 30 days old.
   */
  const age =
    Date.now() -
    time;


  if (
    age <
      -12 *
      60 *
      60 *
      1000 ||
    age >
      30 *
      24 *
      60 *
      60 *
      1000
  ) {

    return null;

  }


  const detection =
    detectContent(
      article.title ||
      item.original_title,
      narrative,
      item.category
    );


  if (
    !detection
  ) {

    return null;

  }


  return {

    ...item,

    original_title:
      article.title ||
      item.original_title,

    english_summary:
      narrative,

    published_at:
      published,

    category:
      detection.category,

    score:
      Math.max(
        item.score,
        detection.score
      ),

  };

}


async function hydrateCandidatesV8(
  candidates:
    Candidate[]
) {

  /*
   * Hydrate newest candidates first.
   */
  const ordered =
    [
      ...candidates,
    ]
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            b.published_at
          ).getTime() -
          new Date(
            a.published_at
          ).getTime()
      )
      .slice(
        0,
        18
      );


  const result:
    Candidate[] = [];


  /*
   * Small groups.
   * Avoid hammering the free Reader service.
   */
  for (
    let index =
      0;

    index <
      ordered.length;

    index +=
      3
  ) {

    const group =
      ordered.slice(
        index,
        index +
        3
      );


    const hydrated =
      await Promise.all(
        group.map(
          hydrateCandidateV8
        )
      );


    for (
      const item
      of hydrated
    ) {

      if (
        item
      ) {

        result.push(
          item
        );

      }

    }


    /*
     * Enough content for Home.
     */
    if (
      result.length >=
      12
    ) {

      break;

    }

  }


  return result;

}


`;


  src =
    src.replace(
      selectAnchor,
      helpers +
      selectAnchor
    );

}


/* ==========================================================
   4. USE FULL ARTICLE HYDRATION
========================================================== */

const oldSelected =
`      const selected =
        selectStories(
          [
            ...rssGroups.flat(),
            ...indexGroups.flat(),
          ]
        );`;


const newSelected =
`      const discovered =
        [
          ...rssGroups.flat(),
          ...indexGroups.flat(),
        ];


      console.log(
        'DISCOVERED:',
        discovered.length
      );


      const hydrated =
        await hydrateCandidatesV8(
          discovered
        );


      console.log(
        'CLEAN FULL ARTICLES:',
        hydrated.length
      );


      const selected =
        selectStories(
          hydrated
        );`;


if (
  src.includes(
    oldSelected
  )
) {

  src =
    src.replace(
      oldSelected,
      newSelected
    );

}
else if (
  !src.includes(
    "CLEAN FULL ARTICLES:"
  )
) {

  stop(
    "Current selected-story block not found."
  );

}


/* ==========================================================
   5. PURGE BEFORE CACHE CHECK
========================================================== */

if (
  !src.includes(
    "PURGE_BEFORE_CACHE_V8"
  )
) {

  const nowAnchor =
`    const now =
      new Date()
        .toISOString();`;


  if (
    !src.includes(
      nowAnchor
    )
  ) {

    stop(
      "now anchor not found."
    );

  }


  src =
    src.replace(
      nowAnchor,
`    /* PURGE_BEFORE_CACHE_V8 */

    await purgeExcludedNews(
      admin
    );


${nowAnchor}`
    );

}


/* ==========================================================
   6. MARKER
========================================================== */

if (
  !src.includes(
    "BUKLOD_CLEAN_NARRATIVE_V8"
  )
) {

  src =
`/* BUKLOD_CLEAN_NARRATIVE_V8 */

${src}`;

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "BUKLOD CLEAN NARRATIVE V8 INSTALLED"
);


