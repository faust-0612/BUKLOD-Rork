const fs = require("fs");

const functionPath =
  "./supabase/functions/sync-church-news/index.ts";

const homePath =
  "./src/app/(tabs)/home.tsx";


let fn =
  fs.readFileSync(
    functionPath,
    "utf8"
  );

let home =
  fs.readFileSync(
    homePath,
    "utf8"
  );


function stop(message) {
  console.error("");
  console.error("PATCH STOPPED:");
  console.error(message);
  process.exit(1);
}


/* ==========================================================
   1. REAL NEWS DIGEST HELPERS
========================================================== */

if (
  !fn.includes(
    "FREE_NEWS_REAL_DIGEST_V2"
  )
) {

  const anchor =
    "async function loadArticle(";


  if (
    !fn.includes(
      anchor
    )
  ) {
    stop(
      "loadArticle() anchor not found."
    );
  }


  const helpers =
`

/* ============================================================
   FREE_NEWS_REAL_DIGEST_V2

   Do not use promotional meta descriptions such as:
   "Learn about..."
   "Find out..."
   "Discover..."

   Instead extract actual article paragraphs and create
   a short 1-5 sentence news digest.
============================================================ */


function isNewsBoilerplate(
  value: string
) {

  const text =
    cleanText(
      value
    );


  if (
    !text ||
    text.length <
    45
  ) {
    return true;
  }


  const lower =
    text.toLowerCase();


  const blockedStarts = [

    'learn about ',
    'learn more ',
    'find out ',
    'discover ',
    'read about ',
    'read more ',
    'click here ',
    'click to ',
    'subscribe ',
    'sign up ',
    'stay updated ',
    'get the latest ',
    'welcome to ',
    'explore ',
    'watch ',
    'listen ',
    'download ',

  ];


  if (
    blockedStarts.some(
      item =>
        lower.startsWith(
          item
        )
    )
  ) {
    return true;
  }


  const blockedContains = [

    'subscribe to our newsletter',
    'sign up for our newsletter',
    'follow us on facebook',
    'follow us on instagram',
    'all rights reserved',
    'privacy policy',
    'cookie policy',
    'terms of use',
    'related stories',
    'related articles',
    'share this article',
    'share this story',

  ];


  return blockedContains.some(
    item =>
      lower.includes(
        item
      )
  );

}


function splitIntoSentences(
  value: string
) {

  const text =
    cleanText(
      value
    );


  if (!text) {
    return [];
  }


  return (
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ??
    []
  )
    .map(
      item =>
        item.trim()
    )
    .filter(
      item =>
        item.length >=
        25
    );

}


function makeNewsDigest(
  paragraphs: string[]
) {

  const sentences:
    string[] = [];


  for (
    const paragraph
    of paragraphs
  ) {

    if (
      isNewsBoilerplate(
        paragraph
      )
    ) {
      continue;
    }


    for (
      const sentence
      of splitIntoSentences(
        paragraph
      )
    ) {

      if (
        isNewsBoilerplate(
          sentence
        )
      ) {
        continue;
      }


      if (
        sentences.some(
          existing =>
            existing
              .toLowerCase() ===
            sentence
              .toLowerCase()
        )
      ) {
        continue;
      }


      sentences.push(
        sentence
      );


      /*
       * Maximum five sentences.
       */
      if (
        sentences.length >=
        5
      ) {
        break;
      }

    }


    if (
      sentences.length >=
      5
    ) {
      break;
    }

  }


  /*
   * Usually 2-4 sentences is enough.
   * Do not force five.
   */
  let selected =
    sentences;


  if (
    selected.length >
    3
  ) {

    const firstThree =
      selected
        .slice(
          0,
          3
        )
        .join(
          ' '
        );


    if (
      firstThree.length >=
      280
    ) {

      selected =
        selected.slice(
          0,
          3
        );

    }
    else {

      selected =
        selected.slice(
          0,
          Math.min(
            5,
            selected.length
          )
        );

    }

  }


  return selected
    .join(
      ' '
    )
    .replace(
      /\\s+/g,
      ' '
    )
    .trim();

}


function extractArticleParagraphs(
  html: string
) {

  /*
   * Prefer the actual <article> element.
   * Fall back to <main>, then full HTML.
   */
  const articleMatch =
    html.match(
      /<article\\b[^>]*>([\\s\\S]*?)<\\/article>/i
    );


  const mainMatch =
    html.match(
      /<main\\b[^>]*>([\\s\\S]*?)<\\/main>/i
    );


  const source =
    articleMatch?.[1] ||
    mainMatch?.[1] ||
    html;


  const paragraphs:
    string[] = [];


  const paragraphRegex =
    /<p\\b[^>]*>([\\s\\S]*?)<\\/p>/gi;


  let match:
    RegExpExecArray |
    null;


  while (
    (
      match =
        paragraphRegex.exec(
          source
        )
    )
  ) {

    const paragraph =
      cleanText(
        match[1] ??
        ''
      );


    if (
      !paragraph ||
      paragraph.length <
      45 ||
      isNewsBoilerplate(
        paragraph
      )
    ) {
      continue;
    }


    paragraphs.push(
      paragraph
    );


    if (
      paragraphs.length >=
      12
    ) {
      break;
    }

  }


  return paragraphs;

}


`;


  fn =
    fn.replace(
      anchor,
      helpers +
      anchor
    );

}


/* ==========================================================
   2. REPLACE META DESCRIPTION SUMMARY WITH REAL DIGEST
========================================================== */

const oldDescriptionBlock =
`    const description =
      cleanText(
        extractMeta(
          html,
          'og:description'
        ) ||
        extractMeta(
          html,
          'description'
        ) ||
        ''
      );`;


const newDescriptionBlock =
`    const articleParagraphs =
      extractArticleParagraphs(
        html
      );


    const articleDigest =
      makeNewsDigest(
        articleParagraphs
      );


    const metaDescription =
      cleanText(
        extractMeta(
          html,
          'og:description'
        ) ||
        extractMeta(
          html,
          'description'
        ) ||
        ''
      );


    const description =
      articleDigest ||
      (
        !isNewsBoilerplate(
          metaDescription
        )
          ? makeNewsDigest(
              [
                metaDescription,
              ]
            )
          : ''
      );`;


if (
  fn.includes(
    oldDescriptionBlock
  )
) {

  fn =
    fn.replace(
      oldDescriptionBlock,
      newDescriptionBlock
    );

}
else if (
  !fn.includes(
    "const articleDigest ="
  )
) {

  stop(
    "Current article description block not found."
  );

}


/* ==========================================================
   3. EVANGELICAL FOCUS:
      FETCH ARTICLE PAGE, NOT RSS TEASER ONLY
========================================================== */

const oldEvPush =
`      rows.push({

        source_name:
          sourceName,

        source_domain:
          domain,

        original_title:
          title,

        english_summary:
          description ||
          null,

        original_url:
          link,

        published_at:
          pubDate,

      });`;


const newEvPush =
`      const article =
        await loadArticle(
          sourceName,
          domain,
          link,
          title
        );


      if (
        article
      ) {

        rows.push(
          article
        );

      }
      else {

        const rssDigest =
          makeNewsDigest(
            [
              description,
            ]
          );


        rows.push({

          source_name:
            sourceName,

          source_domain:
            domain,

          original_title:
            title,

          english_summary:
            rssDigest ||
            null,

          original_url:
            link,

          published_at:
            pubDate,

        });

      }`;


if (
  fn.includes(
    oldEvPush
  )
) {

  fn =
    fn.replace(
      oldEvPush,
      newEvPush
    );

}


/* ==========================================================
   4. HOME CARD: REMOVE EXCESS BOTTOM SPACE
========================================================== */

/*
 * Remove the flex spacer that forces the
 * button to the bottom and creates blank space.
 */
home =
  home.replace(
`                    <View
                      style={{
                        flex:
                          1,
                      }}
                    />


`,
    ""
  );


/*
 * Remove fixed/minimum card height.
 * Card should follow actual content height.
 */
home =
  home.replace(
    /\s*minHeight:\s*\n\s*230,\s*/g,
    "\n"
  );


home =
  home.replace(
    /\s*minHeight:\s*\n\s*205,\s*/g,
    "\n"
  );


/*
 * Keep a compact gap before original-link button.
 */
home =
  home.replace(
`                        marginTop:
                          12,`,
`                        marginTop:
                          9,`
  );


if (
  !home.includes(
    "HOME_NEWS_NO_EXCESS_SPACE_V2"
  )
) {

  const homeAnchor =
    "function HomeChurchNewsCarousel()";


  if (
    !home.includes(
      homeAnchor
    )
  ) {
    stop(
      "HomeChurchNewsCarousel anchor missing."
    );
  }


  home =
    home.replace(
      homeAnchor,
`/* HOME_NEWS_NO_EXCESS_SPACE_V2 */

${homeAnchor}`
    );

}


fs.writeFileSync(
  functionPath,
  fn,
  "utf8"
);


fs.writeFileSync(
  homePath,
  home,
  "utf8"
);


console.log(
  "REAL NEWS DIGEST + COMPACT CARD PATCHED"
);
