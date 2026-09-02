const fs = require("fs");

const files = [
  "./src/app/connect/index.tsx",
  "./src/app/connect/[id].tsx",
  "./src/app/(tabs)/buklod.tsx",
  "./src/app/post/[id].tsx",
];

function stop(message) {
  console.error("");
  console.error(
    "PATCH 158 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}

function addImport(source) {
  if (
    source.includes(
      "@/lib/dateTime"
    )
  ) {
    return source;
  }

  const themeImport =
    /import\s*\{\s*colors\s*\}\s*from\s*['"]@\/lib\/theme['"];/;

  if (
    !themeImport.test(source)
  ) {
    stop(
      "Could not find theme import."
    );
  }

  return source.replace(
    themeImport,
    match =>
      `${match}\nimport {formatSpecificDateTime} from '@/lib/dateTime';`
  );
}

function replaceCreatedAt(source) {
  /*
   * Converts:
   * new Date(x.created_at).toLocaleString()
   * new Date(x.created_at).toLocaleDateString()
   *
   * including multiline versions.
   */
  return source.replace(
    /new\s+Date\(\s*([A-Za-z_$][\w$]*)\.created_at\s*\)\.toLocale(?:String|DateString)\([^)]*\)/g,
    "formatSpecificDateTime($1.created_at)"
  );
}


/* ============================================================
   CONNECT THREAD
   ============================================================ */

{
  const path =
    "./src/app/connect/[id].tsx";

  let source =
    fs.readFileSync(
      path,
      "utf8"
    );

  source =
    addImport(source);

  source =
    replaceCreatedAt(source);

  fs.writeFileSync(
    path,
    source,
    "utf8"
  );
}


/* ============================================================
   BUKLOD COMMUNITY FEED
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let source =
    fs.readFileSync(
      path,
      "utf8"
    );

  source =
    addImport(source);

  source =
    replaceCreatedAt(source);

  fs.writeFileSync(
    path,
    source,
    "utf8"
  );
}


/* ============================================================
   POST DETAIL + COMMENTS
   ============================================================ */

{
  const path =
    "./src/app/post/[id].tsx";

  let source =
    fs.readFileSync(
      path,
      "utf8"
    );

  source =
    addImport(source);

  source =
    replaceCreatedAt(source);

  fs.writeFileSync(
    path,
    source,
    "utf8"
  );
}


/* ============================================================
   CONNECT DASHBOARD / INBOX
   ============================================================ */

{
  const path =
    "./src/app/connect/index.tsx";

  let source =
    fs.readFileSync(
      path,
      "utf8"
    );

  source =
    addImport(source);

  /*
   * Add exact date/time below every conversation preview.
   */
  if (
    !source.includes(
      "formatSpecificDateTime(item.last_message_at)"
    )
  ) {
    const lastMessage =
      /(<Text\s+numberOfLines=\{2\}\s+style=\{s\.last\}>\{item\.last_message\s*\|\|\s*'Start a conversation\.'\}<\/Text>)/;

    if (
      !lastMessage.test(source)
    ) {
      stop(
        "Connect inbox last-message anchor not found."
      );
    }

    source =
      source.replace(
        lastMessage,
        `$1<Text style={s.meta}>{formatSpecificDateTime(item.last_message_at)}</Text>`
      );
  }

  fs.writeFileSync(
    path,
    source,
    "utf8"
  );
}

console.log("");
console.log(
  "PATCH 158 TIMESTAMPS APPLIED"
);
