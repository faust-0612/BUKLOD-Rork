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
   HOME QUALITY HELPERS
============================================================ */

if (
  !home.includes(
    "HOME_NEWS_QUALITY_FILTER_V4"
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


  const helpers =
`

/* HOME_NEWS_QUALITY_FILTER_V4 */

function cleanNewsTitleForDisplay(
  value:
    string | null | undefined,
  source:
    string | null | undefined
) {

  let text =
    sanitizeHomeNewsText(
      value
    );


  if (
    !text
  ) {
    return '';
  }


  /*
   * Remove duplicated publisher suffix:
   *
   * Story title | Baptist Press
   * Story title - Baptist Press
   */
  if (
    source
  ) {

    const escaped =
      String(
        source
      )
        .replace(
          /[.*+?^$}{()|[\\]\\\\]/g,
          '\\\\$&'
        );


    text =
      text.replace(
        new RegExp(
          '\\\\s*(?:\\\\||[-–—])\\\\s*' +
          escaped +
          '\\\\s*$',
          'i'
        ),
        ''
      );

  }


  return text
    .replace(
      /\\s{2,}/g,
      ' '
    )
    .trim();

}


function cleanNewsNarrativeForDisplay(
  value:
    string | null | undefined
) {

  let text =
    sanitizeHomeNewsText(
      value
    );


  if (
    !text
  ) {
    return '';
  }


  /*
   * Remove path fragments that survived
   * translation, e.g.
   *
   * "- response/ BOGOTÁ..."
   */
  text =
    text.replace(
      /^(?:[-–—]\\s*)?(?:resource|library|news|response|stories|article)\\s*[\\/\\\\-]+\\s*/gi,
      ''
    );


  text =
    text.replace(
      /\\b(?:resource|library|news|response|stories|article)\\s*\\/\\s*/gi,
      ' '
    );


  /*
   * Remove obvious malformed final sentence,
   * e.g. "resulta ng 7."
   */
  const parts =
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ??
    [];


  const good =
    parts
      .map(
        sentence =>
          sentence.trim()
      )
      .filter(
        sentence => {

          if (
            sentence.length <
            35
          ) {
            return false;
          }


          const letters =
            (
              sentence.match(
                /[A-Za-zÀ-ÿ]/g
              ) ??
              []
            ).length;


          if (
            letters <
            20
          ) {
            return false;
          }


          /*
           * Reject path-like sentences.
           */
          if (
            /(?:\\.com|\\.org|\\.net|\\/news\\/|\\/resource|\\/stories)/i.test(
              sentence
            )
          ) {
            return false;
          }


          /*
           * Reject endings that are basically
           * incomplete numeric artifacts.
           */
          if (
            /\\b(?:ng|sa|of|the|resulta|result)\\s+\\d+[.]?$/i.test(
              sentence
            )
          ) {
            return false;
          }


          return true;

        }
      )
      .slice(
        0,
        3
      );


  return good
    .join(
      ' '
    )
    .replace(
      /\\s{2,}/g,
      ' '
    )
    .trim();

}


function usableHomeNewsStory(
  title:
    string,
  summary:
    string
) {

  /*
   * Never render an empty giant card.
   */
  if (
    !title ||
    title.length <
      12
  ) {

    return false;

  }


  if (
    !summary ||
    summary.length <
      70
  ) {

    return false;

  }


  return true;

}


`;


  home =
    home.replace(
      anchor,
      helpers +
      anchor
    );

}


/* ============================================================
   BUMP TAGALOG CACHE
============================================================ */

home =
  home.replace(
    /buklod\\.home\\.church_news\\.tagalog\\.v\\d+/g,
    "buklod.home.church_news.tagalog.v4"
  );


/* ============================================================
   CLEAN FINAL TITLE/SUMMARY VARIABLES
============================================================ */

home =
  home.replace(
`                const displayNewsTitle =
                  sanitizeHomeNewsText(
                    title
                  );

                const displayNewsSummary =
                  sanitizeHomeNewsText(
                    summary
                  );`,
`                const displayNewsTitle =
                  cleanNewsTitleForDisplay(
                    title,
                    item.source_name
                  );

                const displayNewsSummary =
                  cleanNewsNarrativeForDisplay(
                    summary
                  );`
  );


/* ============================================================
   FILTER ITEMS BEFORE RENDERING
============================================================ */

const mapAnchor =
  "items.map(";


if (
  home.includes(
    mapAnchor
  ) &&
  !home.includes(
    "const displayItems ="
  )
) {

  /*
   * Create cleaned/usable carousel list before return.
   */
  const returnAnchor =
    "  return (\n";


  const componentIndex =
    home.indexOf(
      "function HomeChurchNewsCarousel()"
    );


  const returnIndex =
    home.indexOf(
      returnAnchor,
      componentIndex
    );


  if (
    returnIndex >=
    0
  ) {

    const filterBlock =
`

  const displayItems =
    items.filter(
      item => {

        const localTranslation =
          localTagalog[
            item.id
          ];


        const rawTitle =
          language ===
            'fil'
            ? (
                localTranslation
                  ?.title ||
                item
                  .tagalog_title ||
                item
                  .original_title
              )
            : item
                .original_title;


        const rawSummary =
          language ===
            'fil'
            ? (
                localTranslation
                  ?.summary ||
                item
                  .tagalog_summary ||
                item
                  .english_summary
              )
            : item
                .english_summary;


        const cleanedTitle =
          cleanNewsTitleForDisplay(
            rawTitle,
            item.source_name
          );


        const cleanedSummary =
          cleanNewsNarrativeForDisplay(
            rawSummary
          );


        return usableHomeNewsStory(
          cleanedTitle,
          cleanedSummary
        );

      }
    );


`;


    home =
      home.slice(
        0,
        returnIndex
      ) +
      filterBlock +
      home.slice(
        returnIndex
      );

  }


  /*
   * Carousel must now use displayItems.
   */
  const sectionStart =
    home.indexOf(
      "function HomeChurchNewsCarousel()"
    );

  let sectionEnd =
    home.indexOf(
      "function HomeImportantReminder()",
      sectionStart
    );

  if (
    sectionEnd < 0
  ) {
    sectionEnd =
      home.length;
  }


  let section =
    home.slice(
      sectionStart,
      sectionEnd
    );


  section =
    section.replace(
      /\bitems\.map\(/g,
      "displayItems.map("
    );


  home =
    home.slice(
      0,
      sectionStart
    ) +
    section +
    home.slice(
      sectionEnd
    );

}


/* ============================================================
   BACKEND: REJECT BAD STORY NARRATIVES
============================================================ */

if (
  !fn.includes(
    "BACKEND_NEWS_QUALITY_FILTER_V4"
  )
) {

  const anchor =
    "async function hydrateStory(";


  if (
    !fn.includes(
      anchor
    )
  ) {

    throw new Error(
      "hydrateStory not found."
    );

  }


  const helper =
`

/* BACKEND_NEWS_QUALITY_FILTER_V4 */

function acceptableNarrative(
  value:
    string
) {

  const text =
    sanitizeNarrativeArtifacts(
      value
    );


  if (
    !text ||
    text.length <
    90
  ) {

    return false;

  }


  /*
   * Raw/mangled URL or scraper-path residue.
   */
  if (
    /(?:https?:\\/\\/|www\\.|\\.com\\/|\\.org\\/|\\/resource|\\/news\\/|\\/stories\\/)/i.test(
      text
    )
  ) {

    return false;

  }


  /*
   * Reader labels must never survive.
   */
  if (
    /\\b(?:markdown content|url source|content:|nilalaman:)\\b/i.test(
      text
    )
  ) {

    return false;

  }


  const sentences =
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ??
    [];


  const meaningful =
    sentences.filter(
      sentence => {

        const letters =
          (
            sentence.match(
              /[A-Za-zÀ-ÿ]/g
            ) ??
            []
          ).length;


        return (
          sentence.trim().length >=
            35 &&
          letters >=
            20 &&
          !/\\b(?:ng|sa|of|the|resulta|result)\\s+\\d+[.]?$/i.test(
            sentence.trim()
          )
        );

      }
    );


  return meaningful.length >=
    1;

}


`;


  fn =
    fn.replace(
      anchor,
      helper +
      anchor
    );

}


/*
 * Existing hydrateStory currently checks narrative length.
 * Strengthen that gate.
 */
fn =
  fn.replace(
`    if (
      !narrative ||
      narrative.length <
        90
    ) {`,
`    if (
      !narrative ||
      !acceptableNarrative(
        narrative
      )
    ) {`
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
  "FINAL NEWS QUALITY FILTER V4 INSTALLED"
);

