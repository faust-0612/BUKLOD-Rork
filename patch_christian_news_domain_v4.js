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
   ADD DOMAIN-SPECIFIC DISCOVERY CONFIG
========================================================== */

if (
  !src.includes(
    "CHRISTIAN_NEWS_DOMAIN_DISCOVERY_V4"
  )
) {

  const anchor =
    "const USER_AGENT =";


  if (
    !src.includes(
      anchor
    )
  ) {
    stop(
      "USER_AGENT anchor not found."
    );
  }


  const config =
`

/* ============================================================
   CHRISTIAN_NEWS_DOMAIN_DISCOVERY_V4

   IMPORTANT:
   Query trusted publishers DIRECTLY in GDELT.

   General news sources:
   require explicitly Christian terms.

   Christian / mission / persecution / music sources:
   their own recent coverage may be considered directly.
============================================================ */


const GENERAL_NEWS_DOMAINS =
  new Set([

    'reuters.com',
    'apnews.com',
    'bbc.com',
    'bbc.co.uk',
    'dw.com',
    'france24.com',

  ]);


const CHRISTIAN_DISCOVERY_DOMAINS = [

  /* International news */
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'dw.com',
  'france24.com',

  /* Christian journalism */
  'religionnews.com',
  'christianitytoday.com',
  'baptistpress.com',
  'evangelicalfocus.com',
  'premierchristian.news',

  /* Missions */
  'imb.org',
  'mnnonline.org',
  'lausanne.org',

  /* Persecution */
  'opendoorsus.org',
  'opendoorsuk.org',
  'csw.org.uk',
  'persecution.org',

  /* Christian music */
  'ccmmagazine.com',
  'newreleasetoday.com',
  'gospelmusic.org',

];


const GENERAL_CHRISTIAN_QUERY =
  '(' +
  [
    'Christian',
    'Christianity',
    'evangelical',
    'Baptist',
    'missionary',
    'missionaries',
    '"Christian mission"',
    '"Christian missions"',
    '"persecuted Christians"',
    '"Christian persecution"',
    '"Bible translation"',
    '"Bible distribution"',
    '"Christian revival"',
    '"Christian ministry"',
    '"Christian music"',
    '"worship song"',
    'Gospel',
  ].join(
    ' OR '
  ) +
  ')';


function titleLooksChristian(
  title:
    string
) {

  const text =
    String(
      title ??
      ''
    )
      .toLowerCase();


  const positive = [

    'christian',
    'christians',
    'christianity',
    'evangelical',
    'evangelicals',
    'baptist',
    'missionary',
    'missionaries',
    'mission',
    'missions',
    'gospel',
    'bible',
    'persecution',
    'persecuted',
    'revival',
    'worship',
    'ministry',
    'church',
    'churches',
    'pastor',

  ];


  return positive.some(
    word =>
      text.includes(
        word
      )
  );

}


`;


  src =
    src.replace(
      anchor,
      config +
      anchor
    );

}


/* ==========================================================
   REPLACE discover()
========================================================== */

const discoverStart =
  src.indexOf(
    "async function discover("
  );


const diversifyStart =
  src.indexOf(
    "function diversify(",
    discoverStart
  );


if (
  discoverStart < 0 ||
  diversifyStart < 0
) {

  stop(
    "discover()/diversify() anchors not found."
  );

}


const newDiscover =
`async function discover(
  timespan: string
) {

  /*
   * Query each trusted publisher directly.
   *
   * This fixes the previous behavior where we
   * searched the whole internet first and then
   * filtered the first results by publisher.
   */
  const queries =
    CHRISTIAN_DISCOVERY_DOMAINS
      .map(
        domain => {

          const isGeneral =
            GENERAL_NEWS_DOMAINS
              .has(
                domain
              );


          return {

            domain,

            query:
              isGeneral
                ? (
                    'domainis:' +
                    domain +
                    ' ' +
                    GENERAL_CHRISTIAN_QUERY
                  )
                : (
                    'domainis:' +
                    domain
                  ),

          };

        }
      );


  const batches:
    {
      domain:
        string;

      articles:
        GdeltArticle[];

    }[] = [];


  /*
   * Small batches reduce pressure on the
   * free GDELT endpoint.
   */
  const batchSize =
    5;


  for (
    let index =
      0;

    index <
      queries.length;

    index +=
      batchSize
  ) {

    const group =
      queries.slice(
        index,
        index +
        batchSize
      );


    const results =
      await Promise.all(
        group.map(
          async item => ({

            domain:
              item.domain,

            articles:
              await gdeltSearch(
                item.query,
                timespan
              ),

          })
        )
      );


    batches.push(
      ...results
    );

  }


  const found =
    new Map<
      string,
      Candidate
    >();


  for (
    const batch
    of batches
  ) {

    for (
      const article
      of batch.articles
    ) {

      if (
        !article.url ||
        !article.title
      ) {
        continue;
      }


      /*
       * GDELT may label English as either
       * English or ENG depending on output.
       */
      if (
        article.language
      ) {

        const language =
          String(
            article.language
          )
            .toLowerCase();


        if (
          language !==
            'english' &&
          language !==
            'eng' &&
          language !==
            'en'
        ) {

          continue;

        }

      }


      let url:
        URL;


      try {

        url =
          new URL(
            article.url
          );

      }
      catch {

        continue;

      }


      const source =
        sourceForDomain(
          article.domain ||
          url.hostname ||
          batch.domain
        );


      if (
        !source
      ) {
        continue;
      }


      const date =
        parseGdeltDate(
          article.seendate ||
          ''
        );


      if (
        !date
      ) {
        continue;
      }


      const publishedTime =
        new Date(
          date
        ).getTime();


      if (
        !Number.isFinite(
          publishedTime
        )
      ) {
        continue;
      }


      /*
       * Maximum age:
       * 31 days.
       *
       * No 2023 / 2024 fallback.
       */
      const age =
        Date.now() -
        publishedTime;


      if (
        age <
          -12 *
          60 *
          60 *
          1000 ||
        age >
          31 *
          24 *
          60 *
          60 *
          1000
      ) {

        continue;

      }


      const title =
        cleanText(
          article.title
        );


      if (
        title.length <
        12
      ) {
        continue;
      }


      /*
       * Extra relevance check only for
       * Reuters/AP/BBC/DW/etc.
       *
       * Dedicated Christian publishers do
       * not need this additional title test.
       */
      if (
        GENERAL_NEWS_DOMAINS
          .has(
            batch.domain
          ) &&
        !titleLooksChristian(
          title
        )
      ) {

        continue;

      }


      /*
       * Remove obvious unrelated people/products
       * whose first name happens to be Christian.
       */
      const falsePositiveNames = [

        'christian bale',
        'christian dior',
        'christian horner',
        'christian pulisic',
        'christian mccaffrey',
        'christian louboutin',
        'christian nodal',

      ];


      if (
        falsePositiveNames.some(
          name =>
            title
              .toLowerCase()
              .includes(
                name
              )
        )
      ) {
        continue;
      }


      url.hash =
        '';


      found.set(
        url.toString(),
        {

          original_url:
            url.toString(),

          original_title:
            title,

          source_name:
            source.name,

          source_domain:
            source.domain,

          published_at:
            date,

        }
      );

    }

  }


  const result =
    [
      ...found.values(),
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
      );


  console.log(
    'DOMAIN DISCOVERY',
    timespan,
    'found',
    result.length,
    'trusted Christian stories'
  );


  return result;

}


`;


src =
  src.slice(
    0,
    discoverStart
  ) +
  newDiscover +
  src.slice(
    diversifyStart
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "CHRISTIAN NEWS DOMAIN DISCOVERY V4 INSTALLED"
);
