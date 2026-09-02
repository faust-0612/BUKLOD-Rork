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

let end =
  src.indexOf(
    "function HomeImportantReminder()",
    start
  );

if (
  start < 0
) {
  throw new Error(
    "HomeChurchNewsCarousel not found."
  );
}

if (
  end < 0
) {
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


if (
  !section.includes(
    "HOME_NEWS_MOUNT_GUARD_V1"
  )
) {

  /*
   * ---------------------------------------------------------
   * 1. GUARD setItems AFTER ASYNC QUERY
   * ---------------------------------------------------------
   */

  const loadCachedIndex =
    section.indexOf(
      "const loadCached ="
    );

  if (
    loadCachedIndex < 0
  ) {
    throw new Error(
      "loadCached not found."
    );
  }


  const setItemsIndex =
    section.indexOf(
      "setItems(",
      loadCachedIndex
    );

  if (
    setItemsIndex < 0
  ) {
    throw new Error(
      "setItems inside loadCached not found."
    );
  }


  /*
   * Find indentation before setItems.
   */
  const lineStart =
    section.lastIndexOf(
      "\n",
      setItemsIndex
    ) + 1;


  const guard =
`          if (!active) {
            return;
          }


          /* HOME_NEWS_MOUNT_GUARD_V1 */

`;


  section =
    section.slice(
      0,
      lineStart
    ) +
    guard +
    section.slice(
      lineStart
    );


  /*
   * ---------------------------------------------------------
   * 2. AFTER FIRST loadCached(), STOP THE REST OF run()
   *    IF COMPONENT ALREADY UNMOUNTED
   * ---------------------------------------------------------
   */

  const runIndex =
    section.indexOf(
      "const run ="
    );


  const firstLoadCall =
    section.indexOf(
      "await loadCached();",
      runIndex
    );


  if (
    firstLoadCall < 0
  ) {
    throw new Error(
      "First await loadCached() not found."
    );
  }


  const afterLoadCall =
    firstLoadCall +
    "await loadCached();".length;


  const runGuard =
`

          if (!active) {
            return;
          }
`;


  section =
    section.slice(
      0,
      afterLoadCall
    ) +
    runGuard +
    section.slice(
      afterLoadCall
    );

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
  "HOME NEWS MOUNT GUARD INSTALLED"
);
