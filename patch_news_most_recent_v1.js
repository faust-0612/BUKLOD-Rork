const fs = require("fs");

const functionPath =
  "./supabase/functions/sync-church-news/index.ts";

const homePath =
  "./src/app/(tabs)/home.tsx";

let fn =
  fs.readFileSync(functionPath, "utf8");

let home =
  fs.readFileSync(homePath, "utf8");


/* ==========================================================
   BACKEND: REQUIRE A REAL PUBLICATION DATE
========================================================== */

const rowsAnchor =
`      const rows =
        [
          ...unique.values(),
        ]
          .sort(`;

if (fn.includes(rowsAnchor)) {

  fn =
    fn.replace(
      rowsAnchor,
`      const rows =
        [
          ...unique.values(),
        ]
          /*
           * MOST_RECENT_NEWS_V1
           *
           * Only articles with a real publication date.
           * Do not sort by fetched_at.
           */
          .filter(
            item => {

              if (!item.published_at) {
                return false;
              }

              const published =
                new Date(
                  item.published_at
                ).getTime();

              if (
                !Number.isFinite(
                  published
                )
              ) {
                return false;
              }

              /*
               * Reject obviously incorrect future dates.
               */
              return (
                published <=
                Date.now() +
                12 * 60 * 60 * 1000
              );

            }
          )
          .sort(`
    );

}
else if (
  !fn.includes(
    "MOST_RECENT_NEWS_V1"
  )
) {

  throw new Error(
    "Could not locate backend rows sorting block."
  );

}


/* Keep only newest 10 overall */

fn =
  fn.replace(
    /\.slice\(\s*0,\s*20\s*\)/,
    `.slice(
            0,
            10
          )`
  );


/* ==========================================================
   HOME: EXPLICIT NEWEST-FIRST QUERY
========================================================== */

home =
  home.replace(
    /\.order\(\s*['"]published_at['"]\s*,\s*\{\s*ascending:\s*false\s*\}\s*\)/,
    `.order(
          'published_at',
          {
            ascending: false,
            nullsFirst: false,
          }
        )`
  );


/*
 * If Home already has a published_at order with
 * multiline formatting, ensure nulls go last.
 */
if (
  !home.includes(
    "nullsFirst: false"
  )
) {

  home =
    home.replace(
`            ascending:
              false,`,
`            ascending:
              false,

            nullsFirst:
              false,`
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
  "MOST RECENT NEWS PATCHED"
);
