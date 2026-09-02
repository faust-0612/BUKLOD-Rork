const fs = require("fs");

const path =
  "./src/app/(tabs)/home.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


const componentStart =
  src.indexOf(
    "function HomeChurchNewsCarousel()"
  );

if (componentStart < 0) {
  throw new Error(
    "HomeChurchNewsCarousel not found."
  );
}


let componentEnd =
  src.indexOf(
    "function HomeImportantReminder()",
    componentStart
  );

if (componentEnd < 0) {
  componentEnd =
    src.length;
}


let before =
  src.slice(
    0,
    componentStart
  );

let section =
  src.slice(
    componentStart,
    componentEnd
  );

let after =
  src.slice(
    componentEnd
  );


/* ============================================================
   HOME_NEWS_SOURCE_AFTER_ORIGINAL_V1
============================================================ */


/*
 * If already patched, do not duplicate.
 */
if (
  section.includes(
    "HOME_NEWS_SOURCE_AFTER_ORIGINAL_V1"
  )
) {

  console.log(
    "Source position already patched."
  );

  process.exit(0);
}


/*
 * Remove old standalone source text from the upper/content
 * portion of the card.
 *
 * Handles:
 *
 * SOURCE: {item.source_name}
 *
 * and:
 *
 * {item.source_name}
 */
section =
  section.replace(
    /<Text\b[\s\S]{0,700}?>\s*SOURCE:\s*\{item\.source_name\}\s*<\/Text>/g,
    ""
  );


section =
  section.replace(
    /<Text\b[\s\S]{0,700}?>\s*\{item\.source_name\}\s*<\/Text>/g,
    ""
  );


/*
 * Find BASAHIN ANG ORIGINAL.
 */
const originalLabelIndex =
  section.indexOf(
    "BASAHIN ANG ORIGINAL"
  );

if (originalLabelIndex < 0) {
  throw new Error(
    "BASAHIN ANG ORIGINAL label not found."
  );
}


/*
 * Find the Pressable containing the original-link button.
 */
const pressableCloseIndex =
  section.indexOf(
    "</Pressable>",
    originalLabelIndex
  );

if (pressableCloseIndex < 0) {
  throw new Error(
    "Original-link Pressable closing tag not found."
  );
}


const insertAt =
  pressableCloseIndex +
  "</Pressable>".length;


const sourceBlock =
`

                    {/* HOME_NEWS_SOURCE_AFTER_ORIGINAL_V1 */}

                    <Text
                      style={{
                        marginTop:
                          5,

                        fontSize:
                          11.5,

                        lineHeight:
                          16,

                        color:
                          colors.muted,

                        fontWeight:
                          '600',
                      }}
                    >
                      Source:{' '}
                      <Text
                        style={{
                          fontWeight:
                            '800',

                          color:
                            colors.text,
                        }}
                      >
                        {item.source_name}
                      </Text>
                    </Text>
`;


section =
  section.slice(
    0,
    insertAt
  ) +
  sourceBlock +
  section.slice(
    insertAt
  );


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
  "NEWS SOURCE MOVED BELOW ORIGINAL LINK"
);
