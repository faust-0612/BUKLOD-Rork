const fs = require("fs");


function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}


function write(path, src) {
  fs.writeFileSync(
    path,
    src,
    "utf8"
  );
}


function addFlatListPerf(
  src,
  kind
) {
  const marker =
    `PERF1_FLATLIST_${kind}`;

  if (
    src.includes(marker)
  ) {
    return {
      src,
      patched: false,
      already: true,
    };
  }

  const position =
    src.indexOf(
      "<FlatList"
    );

  if (position < 0) {
    return {
      src,
      patched: false,
      already: false,
    };
  }


  const settings =
    kind === "COMMUNITY"
      ? `
      /* PERF1_FLATLIST_COMMUNITY */
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={60}
      windowSize={5}
      `
      : `
      /* PERF1_FLATLIST_CONNECT */
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      `;


  const insertAt =
    position +
    "<FlatList".length;


  src =
    src.slice(
      0,
      insertAt
    ) +
    settings +
    src.slice(
      insertAt
    );


  return {
    src,
    patched: true,
    already: false,
  };
}


/*
 * Coalesce bursts of realtime events.
 *
 * Example:
 * reaction insert + counter update +
 * comment/post changes can occur very close
 * together. Instead of 3 complete RPC reloads,
 * one reload occurs after the short burst.
 */
function patchRealtimeReloads(
  src,
  marker
) {

  if (
    src.includes(marker)
  ) {
    return {
      src,
      count: 0,
      already: true,
    };
  }


  const callbackRegex =
    /\(\)\s*=>\s*(?:void\s+)?load\(\)/g;


  let count = 0;


  const next =
    src.replace(
      callbackRegex,
      () => {
        count++;

        return `() =>
          schedulePerfReload(
            load
          )`;
      }
    );


  if (!count) {
    return {
      src,
      count: 0,
      already: false,
    };
  }


  /*
   * Insert module-level coalescer after imports.
   * Find the last import declaration.
   */
  const importRegex =
    /import[\s\S]*?from\s+['"][^'"]+['"];\s*/g;


  let match;
  let lastEnd = 0;


  while (
    (
      match =
        importRegex.exec(next)
    ) !== null
  ) {
    lastEnd =
      importRegex.lastIndex;
  }


  if (!lastEnd) {
    throw new Error(
      `Could not locate imports for ${marker}`
    );
  }


  const helper =
`

/* ${marker} */
let perfReloadTimer:
  ReturnType<
    typeof setTimeout
  > | null =
    null;


function schedulePerfReload(
  loader:
    () =>
      unknown
      | Promise<unknown>
) {
  if (
    perfReloadTimer
  ) {
    clearTimeout(
      perfReloadTimer
    );
  }

  perfReloadTimer =
    setTimeout(
      () => {
        perfReloadTimer =
          null;

        void loader();
      },
      140
    );
}


`;


  const patched =
    next.slice(
      0,
      lastEnd
    ) +
    helper +
    next.slice(
      lastEnd
    );


  return {
    src: patched,
    count,
    already: false,
  };
}


/* ============================================================
   ROOT BOOT
   ============================================================ */

{
  const path =
    "./src/app/_layout.tsx";

  let src =
    read(path);


  const bootImport =
    "import '@/lib/performanceBoot';";


  if (
    !src.includes(
      bootImport
    )
  ) {
    src =
      bootImport +
      "\n" +
      src;
  }


  write(
    path,
    src
  );

  console.log(
    "PERF BOOT: READY"
  );
}


/* ============================================================
   CONNECT DASHBOARD
   ============================================================ */

{
  const path =
    "./src/app/connect/index.tsx";

  let src =
    read(path);


  const list =
    addFlatListPerf(
      src,
      "CONNECT"
    );

  src =
    list.src;


  const realtime =
    patchRealtimeReloads(
      src,
      "PERF1_CONNECT_REALTIME"
    );

  src =
    realtime.src;


  write(
    path,
    src
  );


  console.log(
    "CONNECT LIST:",
    list.patched
      ? "OPTIMIZED"
      : list.already
        ? "ALREADY OPTIMIZED"
        : "NO FLATLIST FOUND"
  );

  console.log(
    "CONNECT REALTIME CALLBACKS COALESCED:",
    realtime.count
  );
}


/* ============================================================
   CONNECT THREAD
   ============================================================ */

{
  const path =
    "./src/app/connect/[id].tsx";

  let src =
    read(path);


  const realtime =
    patchRealtimeReloads(
      src,
      "PERF1_THREAD_REALTIME"
    );

  src =
    realtime.src;


  write(
    path,
    src
  );


  console.log(
    "THREAD REALTIME CALLBACKS COALESCED:",
    realtime.count
  );
}


/* ============================================================
   COMMUNITY
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let src =
    read(path);


  const list =
    addFlatListPerf(
      src,
      "COMMUNITY"
    );

  src =
    list.src;


  const realtime =
    patchRealtimeReloads(
      src,
      "PERF1_COMMUNITY_REALTIME"
    );

  src =
    realtime.src;


  write(
    path,
    src
  );


  console.log(
    "COMMUNITY LIST:",
    list.patched
      ? "OPTIMIZED"
      : list.already
        ? "ALREADY OPTIMIZED"
        : "NO FLATLIST FOUND"
  );

  console.log(
    "COMMUNITY REALTIME CALLBACKS COALESCED:",
    realtime.count
  );
}


/* ============================================================
   REELS
   Only tune an existing FlatList.
   Do NOT blindly restructure the current Reels UI here.
   ============================================================ */

{
  const path =
    "./src/app/reels/index.tsx";


  if (
    fs.existsSync(path)
  ) {
    let src =
      read(path);


    if (
      src.includes(
        "<FlatList"
      ) &&
      !src.includes(
        "PERF1_FLATLIST_REELS"
      )
    ) {

      const pos =
        src.indexOf(
          "<FlatList"
        );

      const insertAt =
        pos +
        "<FlatList".length;


      src =
        src.slice(
          0,
          insertAt
        ) +
`
      /* PERF1_FLATLIST_REELS */
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      updateCellsBatchingPeriod={80}
      windowSize={3}
      ` +
        src.slice(
          insertAt
        );


      write(
        path,
        src
      );


      console.log(
        "REELS LIST: OPTIMIZED"
      );
    }
    else {
      console.log(
        "REELS LIST: PERF-2 REQUIRED"
      );
    }
  }
}


console.log("");
console.log(
  "PERF-1 PATCH APPLIED"
);
