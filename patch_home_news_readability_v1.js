const fs = require("fs");

const path =
  "./src/app/(tabs)/home.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


/*
 * HOME_NEWS_READABILITY_V1
 *
 * Bigger text.
 * Full digest.
 * No 4-line truncation.
 */


/* Remove summary line limit */

src =
  src.replace(
    /\s*numberOfLines=\{\s*4\s*\}/g,
    ""
  );


/*
 * NEWS TITLE
 * 16 / 21  -> 18 / 24
 */

src =
  src.replace(
`                        fontSize:
                          16,

                        lineHeight:
                          21,`,
`                        fontSize:
                          18,

                        lineHeight:
                          24,`
  );


/*
 * NEWS SUMMARY
 * 11.5 / 17 -> 13.5 / 20
 */

src =
  src.replace(
`                          fontSize:
                            11.5,

                          lineHeight:
                            17,`,
`                          fontSize:
                            13.5,

                          lineHeight:
                            20,`
  );


/*
 * Slightly larger source label.
 */

src =
  src.replace(
`                          fontSize:
                            9,

                          fontWeight:
                            '900',`,
`                          fontSize:
                            10,

                          fontWeight:
                            '900',`
  );


/*
 * Slightly larger news age.
 */

src =
  src.replace(
`                          fontSize:
                            8.5,

                          color:
                            colors.muted,`,
`                          fontSize:
                            9.5,

                          color:
                            colors.muted,`
  );


/*
 * Give the card a little more breathing room,
 * but do NOT set maxHeight.
 * It must expand for the full digest.
 */

src =
  src.replace(
`                      minHeight:
                        205,

                      borderWidth:`,
`                      minHeight:
                        230,

                      borderWidth:`
  );


src =
  src.replace(
`                      padding:
                        15,`,
`                      padding:
                        17,`
  );


if (
  !src.includes(
    "HOME_NEWS_READABILITY_V1"
  )
) {

  const anchor =
    "function HomeChurchNewsCarousel()";


  src =
    src.replace(
      anchor,
`/* HOME_NEWS_READABILITY_V1 */

${anchor}`
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "HOME NEWS READABILITY FIX INSTALLED"
);
