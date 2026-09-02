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
    "function HomeChurchNewsCarousel()"
  );

if (start < 0) {
  throw new Error(
    "HomeChurchNewsCarousel not found."
  );
}

let end =
  src.indexOf(
    "function HomeImportantReminder()",
    start
  );

if (end < 0) {
  end =
    src.length;
}

let before =
  src.slice(
    0,
    start
  );

let section =
  src.slice(
    start,
    end
  );

let after =
  src.slice(
    end
  );


/*
 * HOME_NEWS_RECENT_SOURCE_UI_V3
 */


/* Remove summary truncation */

section =
  section.replace(
    /\s*numberOfLines=\{\s*4\s*\}/g,
    ""
  );


/* Remove forced card heights */

section =
  section.replace(
    /\s*minHeight:\s*\n?\s*\d+(?:\.\d+)?,/g,
    ""
  );


/* Remove flex spacers */

section =
  section.replace(
    /<View\s+style=\{\{\s*flex:\s*(?:\n\s*)?1,\s*\}\}\s*\/>/g,
    ""
  );


/* Explicitly identify publisher */

if (
  !section.includes(
    "SOURCE:"
  )
) {

  section =
    section.replace(
      "{item.source_name}",
      "SOURCE: {item.source_name}"
    );

}


/*
 * Add swipe instruction immediately after
 * horizontal news carousel.
 */

if (
  !section.includes(
    "SWIPE FOR MORE"
  )
) {

  const close =
    "</ScrollView>";


  const index =
    section.indexOf(
      close
    );


  if (
    index >=
    0
  ) {

    const insertion =
`${close}

      <Text
        style={{
          marginTop:
            7,

          marginBottom:
            2,

          textAlign:
            'center',

          fontSize:
            11,

          fontWeight:
            '800',

          letterSpacing:
            0.5,

          color:
            colors.muted,
        }}
      >
        SWIPE FOR MORE →
      </Text>`;


    section =
      section.slice(
        0,
        index
      ) +
      insertion +
      section.slice(
        index +
        close.length
      );

  }

}


/*
 * Add marker.
 */

if (
  !section.includes(
    "HOME_NEWS_RECENT_SOURCE_UI_V3"
  )
) {

  section =
`/* HOME_NEWS_RECENT_SOURCE_UI_V3 */

${section}`;

}


src =
  before +
  section +
  after;


fs.writeFileSync(
  path,
  src,
  "utf8"
);

console.log(
  "HOME RECENT NEWS UI PATCHED"
);
