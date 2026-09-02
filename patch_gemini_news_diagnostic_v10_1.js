const fs = require("fs");

const path =
  "./supabase/functions/sync-church-news/index.ts";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "GEMINI_NEWS_DIAGNOSTIC_V10_1"
  )
) {
  console.log(
    "Diagnostic V10.1 already installed."
  );

  process.exit(0);
}


/* ============================================================
   1. GLOBAL DIAGNOSTIC BUFFER
============================================================ */

const typeAnchor =
`type FinalStory = {`;


if (
  !src.includes(
    typeAnchor
  )
) {
  throw new Error(
    "FinalStory anchor not found."
  );
}


src =
  src.replace(
    typeAnchor,
`/* GEMINI_NEWS_DIAGNOSTIC_V10_1 */

const NEWS_DIAGNOSTICS:
  string[] = [];


function addDiagnostic(
  value: string
) {

  if (
    NEWS_DIAGNOSTICS.length <
    20
  ) {

    NEWS_DIAGNOSTICS.push(
      value
        .replace(
          /\\s+/g,
          ' '
        )
        .slice(
          0,
          500
        )
    );
  }
}


${typeAnchor}`
  );


/* ============================================================
   2. DISCOVERY FAILURES
============================================================ */

src =
  src.replace(
`    console.log(
      'DISCOVERY FAILED',
      source.name,
      String(
        error
      )
    );


    return [];`,
`    const diagnostic =
      'DISCOVERY_FAILED [' +
      source.name +
      '] ' +
      String(
        error
      );


    console.log(
      diagnostic
    );


    addDiagnostic(
      diagnostic
    );


    return [];`
  );


/* ============================================================
   3. NO DATE
============================================================ */

src =
  src.replace(
`      console.log(
        'REJECT NO DATE',
        candidate.original_url
      );


      return null;`,
`      const diagnostic =
        'NO_DATE [' +
        candidate.source_name +
        '] ' +
        candidate.original_title;


      console.log(
        diagnostic
      );


      addDiagnostic(
        diagnostic
      );


      return null;`
  );


/* ============================================================
   4. OLD / FUTURE DATE
============================================================ */

const ageReject =
`    if (
      age <
        -24 *
        60 *
        60 *
        1000 ||
      age >
        45 *
        24 *
        60 *
        60 *
        1000
    ) {

      return null;
    }`;


if (
  src.includes(
    ageReject
  )
) {

  src =
    src.replace(
      ageReject,
`    if (
      age <
        -24 *
        60 *
        60 *
        1000 ||
      age >
        45 *
        24 *
        60 *
        60 *
        1000
    ) {

      addDiagnostic(
        'DATE_REJECT [' +
        candidate.source_name +
        '] ' +
        published +
        ' | ' +
        title
      );


      return null;
    }`
    );
}


/* ============================================================
   5. SHORT ARTICLE
============================================================ */

src =
  src.replace(
`      console.log(
        'REJECT SHORT ARTICLE',
        candidate.original_url
      );


      return null;`,
`      const diagnostic =
        'SHORT_ARTICLE [' +
        candidate.source_name +
        '] chars=' +
        article.length +
        ' | ' +
        title;


      console.log(
        diagnostic
      );


      addDiagnostic(
        diagnostic
      );


      return null;`
  );


/* ============================================================
   6. GEMINI REJECTION
============================================================ */

src =
  src.replace(
`      console.log(
        'GEMINI REJECT',
        candidate.source_name,
        '|',
        title,
        '|',
        result.reason
      );


      return null;`,
`      const diagnostic =
        'GEMINI_REJECT [' +
        candidate.source_name +
        '] ' +
        result.reason +
        ' | ' +
        title;


      console.log(
        diagnostic
      );


      addDiagnostic(
        diagnostic
      );


      return null;`
  );


/* ============================================================
   7. WEAK OUTPUT
============================================================ */

src =
  src.replace(
`      console.log(
        'REJECT WEAK OUTPUT',
        title
      );


      return null;`,
`      const diagnostic =
        'WEAK_OUTPUT [' +
        candidate.source_name +
        '] title=' +
        result.tagalog_title.length +
        ' summary=' +
        result.tagalog_summary.length +
        ' english=' +
        result.english_summary.length +
        ' | ' +
        title;


      console.log(
        diagnostic
      );


      addDiagnostic(
        diagnostic
      );


      return null;`
  );


/* ============================================================
   8. ACTUAL GEMINI / FETCH / JSON ERRORS
============================================================ */

src =
  src.replace(
`    console.log(
      'PROCESS FAILED',
      candidate.original_url,
      String(
        error
      )
    );


    return null;`,
`    const diagnostic =
      'PROCESS_FAILED [' +
      candidate.source_name +
      '] ' +
      String(
        error
      ) +
      ' | ' +
      candidate.original_title;


    console.log(
      diagnostic
    );


    addDiagnostic(
      diagnostic
    );


    return null;`
  );


/* ============================================================
   9. RESET DIAGNOSTICS PER REQUEST
============================================================ */

const serveAnchor =
`    if (
      req.method !==
      'POST'
    ) {`;


if (
  !src.includes(
    serveAnchor
  )
) {

  throw new Error(
    "Deno serve request anchor not found."
  );
}


src =
  src.replace(
    serveAnchor,
`    NEWS_DIAGNOSTICS.length =
      0;


${serveAnchor}`
  );


/* ============================================================
   10. MAKE FINAL ERROR ACTUALLY USEFUL
============================================================ */

src =
  src.replace(
`        throw new Error(
          'Gemini found no qualified recent Christian stories.'
        );`,
`        throw new Error(
          'NO_QUALIFIED_STORIES :: ' +
          (
            NEWS_DIAGNOSTICS.length
              ? NEWS_DIAGNOSTICS
                  .slice(
                    0,
                    12
                  )
                  .join(
                    ' || '
                  )
              : 'No diagnostic reason was captured.'
          )
        );`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "GEMINI NEWS DIAGNOSTIC V10.1 INSTALLED"
);
