const fs =
  require("fs");


function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}


function write(
  path,
  src
) {
  fs.writeFileSync(
    path,
    src,
    "utf8"
  );
}


function addImport(
  src,
  statement
) {
  if (
    src.includes(
      statement
    )
  ) {
    return src;
  }

  return (
    statement +
    "\n" +
    src
  );
}


function report(
  name,
  changed
) {
  console.log(
    name +
    ": " +
    (
      changed
        ? "OPTIMIZED"
        : "NO CHANGE / ALREADY DONE"
    )
  );
}


/* ============================================================
   A. CONNECT MEMBER SEARCH DEBOUNCE
   ============================================================ */

{
  const path =
    "./src/app/connect/index.tsx";

  let src =
    read(path);

  let changed =
    false;


  if (
    !src.includes(
      "PERF2_CONNECT_SEARCH_SEQ"
    )
  ) {

    const exportAnchor =
      /export default function BuklodConnect\s*\(/;

    if (
      exportAnchor.test(src)
    ) {
      src =
        src.replace(
          exportAnchor,
`let PERF2_CONNECT_SEARCH_SEQ = 0;

/* PERF2_CONNECT_SEARCH_DEBOUNCE */

export default function BuklodConnect(`
        );

      changed =
        true;
    }


    const searchAnchor =
      /setSearch\(\s*q\s*\);/;

    if (
      searchAnchor.test(src)
    ) {
      src =
        src.replace(
          searchAnchor,
`setSearch(q);

    const perfSearchSeq =
      ++PERF2_CONNECT_SEARCH_SEQ;

    /*
     * Clear short searches immediately.
     * Real RPC starts only after typing pauses.
     */
    if (
      q.trim().length < 2
    ) {
      setMembers([]);
      return;
    }

    await new Promise<void>(
      resolve =>
        setTimeout(
          resolve,
          240
        )
    );

    if (
      perfSearchSeq !==
      PERF2_CONNECT_SEARCH_SEQ
    ) {
      return;
    }`
        );

      changed =
        true;
    }


    /*
     * Prevent an older slower RPC response
     * from overwriting a newer search.
     */
    const resultsAnchor =
      /setMembers\(\s*data\s*\?\?\s*\[\]\s*\);/;

    if (
      resultsAnchor.test(src)
    ) {
      src =
        src.replace(
          resultsAnchor,
`if (
      perfSearchSeq !==
      PERF2_CONNECT_SEARCH_SEQ
    ) {
      return;
    }

    setMembers(data ?? []);`
        );

      changed =
        true;
    }
  }


  write(
    path,
    src
  );

  report(
    "CONNECT SEARCH DEBOUNCE",
    changed
  );
}


/* ============================================================
   B. COMMUNITY MENTION SEARCH DEBOUNCE
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let src =
    read(path);

  let changed =
    false;


  if (
    !src.includes(
      "PERF2_MENTION_SEARCH_SEQ"
    )
  ) {

    const exportAnchor =
      /export default function BuklodScreen\s*\(\s*\)\s*\{/;

    if (
      exportAnchor.test(src)
    ) {
      src =
        src.replace(
          exportAnchor,
`let PERF2_MENTION_SEARCH_SEQ = 0;

/* PERF2_MENTION_SEARCH_DEBOUNCE */

export default function BuklodScreen(){`
        );

      changed =
        true;
    }


    const fnAnchor =
      /const\s+searchMentions\s*=\s*async\s*\(\s*q\s*=\s*''\s*\)\s*=>\s*\{/;

    if (
      fnAnchor.test(src)
    ) {
      src =
        src.replace(
          fnAnchor,
`const searchMentions=async(q='')=>{

  const perfMentionSeq =
    ++PERF2_MENTION_SEARCH_SEQ;

  await new Promise<void>(
    resolve =>
      setTimeout(
        resolve,
        220
      )
  );

  if (
    perfMentionSeq !==
    PERF2_MENTION_SEARCH_SEQ
  ) {
    return;
  }
`
        );

      changed =
        true;
    }


    const resultAnchor =
      /setMentionRows\(\s*data\s*\?\?\s*\[\]\s*\)/;

    if (
      resultAnchor.test(src)
    ) {
      src =
        src.replace(
          resultAnchor,
`(
  perfMentionSeq ===
  PERF2_MENTION_SEARCH_SEQ
) && setMentionRows(
  data ?? []
)`
        );

      changed =
        true;
    }
  }


  write(
    path,
    src
  );

  report(
    "COMMUNITY MENTION DEBOUNCE",
    changed
  );
}


/* ============================================================
   C. COMMUNITY PROGRESSIVE LOADING
   40 -> 80 -> 120 -> 160 -> 200
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let src =
    read(path);

  let changed =
    false;


  if (
    !src.includes(
      "PERF2_PROGRESSIVE_FEED"
    )
  ) {

    const componentAnchor =
      /export default function BuklodScreen\(\)\s*\{/;

    if (
      componentAnchor.test(src)
    ) {
      src =
        src.replace(
          componentAnchor,
`export default function BuklodScreen(){

 /* PERF2_PROGRESSIVE_FEED */
 const [
   feedLimit,
   setFeedLimit
 ] = useState(40);`
        );

      changed =
        true;
    }


    /*
     * Old:
     * p_limit:100
     *
     * New:
     * Initial only 40.
     * More are fetched only when needed.
     */
    const limitAnchor =
      /('get_buklod_community_feed_v3'[\s\S]{0,180}?p_limit\s*:\s*)100/;

    if (
      limitAnchor.test(src)
    ) {
      src =
        src.replace(
          limitAnchor,
          "$1feedLimit"
        );

      changed =
        true;
    }


    /*
     * Make feedLimit part of load()
     * dependency so reaching the end
     * fetches the next batch.
     */
    src =
      src.replace(
        /\[\s*user\?\.id\s*,\s*feedFilter\s*\]\s*\)/,
        "[user?.id,feedFilter,feedLimit])"
      );


    const flatListAnchor =
      "<FlatList";

    const flatPos =
      src.indexOf(
        flatListAnchor
      );

    if (
      flatPos >= 0
    ) {

      const insertion =
`
 /* PERF2_PROGRESSIVE_FEED_LIST */
 onEndReachedThreshold={0.45}
 onEndReached={() => {
   if (
     posts.length >= feedLimit &&
     feedLimit < 200
   ) {
     setFeedLimit(
       current =>
         Math.min(
           current + 40,
           200
         )
     );
   }
 }}
`;

      const insertAt =
        flatPos +
        flatListAnchor.length;

      src =
        src.slice(
          0,
          insertAt
        ) +
        insertion +
        src.slice(
          insertAt
        );

      changed =
        true;
    }
  }


  write(
    path,
    src
  );

  report(
    "COMMUNITY PROGRESSIVE FEED",
    changed
  );
}


/* ============================================================
   D. REALTIME EVENT BURST COALESCING
   Fallback if PERF-1 wasn't applied.
   ============================================================ */

function coalesceRealtime(
  path,
  exportName
) {

  let src =
    read(path);


  if (
    src.includes(
      "PERF1_"
    ) ||
    src.includes(
      "PERF2_REALTIME_COALESCE"
    )
  ) {
    return false;
  }


  const callbackRe =
    /\(\)\s*=>\s*(?:void\s+)?load\(\)/g;


  const matches =
    src.match(
      callbackRe
    );


  if (
    !matches?.length
  ) {
    return false;
  }


  const exportText =
    `export default function ${exportName}`;


  const pos =
    src.indexOf(
      exportText
    );


  if (
    pos < 0
  ) {
    return false;
  }


  const helper =
`/* PERF2_REALTIME_COALESCE */

let PERF2_REALTIME_TIMER:
  ReturnType<typeof setTimeout> |
  null =
    null;

function perf2ScheduleReload(
  loader:
    () =>
      unknown |
      Promise<unknown>
) {

  if (
    PERF2_REALTIME_TIMER
  ) {
    clearTimeout(
      PERF2_REALTIME_TIMER
    );
  }

  PERF2_REALTIME_TIMER =
    setTimeout(
      () => {
        PERF2_REALTIME_TIMER =
          null;

        void loader();
      },
      140
    );
}


`;


  src =
    src.slice(
      0,
      pos
    ) +
    helper +
    src.slice(
      pos
    );


  src =
    src.replace(
      callbackRe,
      "() => perf2ScheduleReload(load)"
    );


  write(
    path,
    src
  );

  return true;
}


report(
  "CONNECT REALTIME",
  coalesceRealtime(
    "./src/app/connect/index.tsx",
    "BuklodConnect"
  )
);

report(
  "THREAD REALTIME",
  coalesceRealtime(
    "./src/app/connect/[id].tsx",
    "ConnectThread"
  )
);

report(
  "COMMUNITY REALTIME",
  coalesceRealtime(
    "./src/app/(tabs)/buklod.tsx",
    "BuklodScreen"
  )
);


/* ============================================================
   E. EXPO IMAGE CACHE - COMMUNITY
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let src =
    read(path);

  let changed =
    false;


  src =
    addImport(
      src,
      "import { Image as ExpoImage } from 'expo-image';"
    );


  const postImageRe =
    /<Image\s+source=\{\{\s*uri\s*:\s*item\.media_url\s*\}\}\s+style=\{s\.postImage\}\s*\/>/g;


  if (
    postImageRe.test(src)
  ) {
    postImageRe.lastIndex = 0;

    src =
      src.replace(
        postImageRe,
`<ExpoImage
   source={{
    uri:item.media_url
   }}
   style={s.postImage}
   contentFit="cover"
   cachePolicy="memory-disk"
   transition={80}
  />`
      );

    changed =
      true;
  }


  write(
    path,
    src
  );

  report(
    "COMMUNITY IMAGE CACHE",
    changed
  );
}


/* ============================================================
   F. EXPO IMAGE CACHE - POST DETAIL
   ============================================================ */

{
  const path =
    "./src/app/post/[id].tsx";

  let src =
    read(path);

  let changed =
    false;


  src =
    addImport(
      src,
      "import { Image as ExpoImage } from 'expo-image';"
    );


  const imageRe =
    /<Image\s+source=\{\{\s*uri\s*:\s*post\.media_url\s*\}\}\s+style=\{s\.image\}\s*\/>/g;


  if (
    imageRe.test(src)
  ) {
    imageRe.lastIndex = 0;

    src =
      src.replace(
        imageRe,
`<ExpoImage
   source={{
    uri:post.media_url
   }}
   style={s.image}
   contentFit="cover"
   cachePolicy="memory-disk"
   transition={80}
  />`
      );

    changed =
      true;
  }


  write(
    path,
    src
  );

  report(
    "POST IMAGE CACHE",
    changed
  );
}


/* ============================================================
   G. EXPO IMAGE CACHE - DIRECT MESSAGES
   ============================================================ */

{
  const path =
    "./src/app/connect/[id].tsx";

  let src =
    read(path);

  let changed =
    false;


  src =
    addImport(
      src,
      "import { Image as ExpoImage } from 'expo-image';"
    );


  /*
   * Only replace network message media.
   * Local picker/previews remain React Native Image.
   */
  const messageImageRe =
    /<Image([\s\S]{0,350}?source=\{\{\s*uri\s*:\s*m\.media_url\s*\}\}[\s\S]{0,350}?)\/>/g;


  if (
    messageImageRe.test(src)
  ) {
    messageImageRe.lastIndex = 0;

    src =
      src.replace(
        messageImageRe,
        (
          full,
          middle
        ) => {

          let body =
            middle.replace(
              /\sresizeMode=(?:"cover"|'cover'|\{"cover"\})/,
              ""
            );

          return `<ExpoImage${body}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={60}
                      />`;
        }
      );

    changed =
      true;
  }


  write(
    path,
    src
  );

  report(
    "MESSAGE IMAGE CACHE",
    changed
  );
}


/* ============================================================
   H. PROFILE AVATAR CACHE
   ============================================================ */

{
  const path =
    "./src/components/ProfileAvatar.tsx";

  let src =
    read(path);

  let changed =
    false;


  src =
    addImport(
      src,
      "import { Image as ExpoImage } from 'expo-image';"
    );


  const remoteImageRe =
    /<Image([\s\S]{0,500}?uri\s*:\s*remoteUrl[\s\S]{0,500}?)\/>/;


  if (
    remoteImageRe.test(src)
  ) {

    src =
      src.replace(
        remoteImageRe,
        (
          full,
          middle
        ) => {

          let body =
            middle
              .replace(
                /\sresizeMode="cover"/,
                ""
              )
              .replace(
                /\sresizeMode=\{'cover'\}/,
                ""
              );

          return `<ExpoImage${body}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={60}
      />`;
        }
      );

    changed =
      true;
  }


  write(
    path,
    src
  );

  report(
    "PROFILE AVATAR CACHE",
    changed
  );
}


console.log("");
console.log(
  "PERF-2 FRONTEND PATCH APPLIED"
);
