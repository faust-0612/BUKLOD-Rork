const fs = require("fs");

function stop(message) {
  console.error("");
  console.error(
    "PERF-3A STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


/* ============================================================
   A. PERSONAL MESSAGE WINDOWING
   ============================================================ */

{
  const path =
    "./src/app/connect/[id].tsx";

  let src =
    fs.readFileSync(
      path,
      "utf8"
    );


  if (
    !src.includes(
      "PERF3_MESSAGE_WINDOW"
    )
  ) {

    /*
     * --------------------------------------------------------
     * 1. Add message limit state after ScrollView ref.
     * --------------------------------------------------------
     */

    const refRe =
/const\s+ref\s*=\s*useRef<ScrollView\s*\|\s*null>\(\s*null\s*\);/m;


    if (
      !refRe.test(src)
    ) {
      stop(
        "Thread ScrollView ref anchor not found."
      );
    }


    src =
      src.replace(
        refRe,
`$&

  /* PERF3_MESSAGE_WINDOW */
  const [
    perfMessageLimit,
    setPerfMessageLimit,
  ] =
    useState(80);

  const perfLoadingOlderRef =
    useRef(false);


  useEffect(
    () => {
      setPerfMessageLimit(
        80
      );

      perfLoadingOlderRef
        .current =
          false;
    },
    [id]
  );`
      );


    /*
     * --------------------------------------------------------
     * 2. Backend load:
     *    p_limit: 200 -> dynamic 80/160/240...
     * --------------------------------------------------------
     */

    const limitRe =
/p_limit\s*:\s*200\b/;


    if (
      !limitRe.test(src)
    ) {
      stop(
        "Thread p_limit:200 anchor not found."
      );
    }


    src =
      src.replace(
        limitRe,
        "p_limit: perfMessageLimit"
      );


    /*
     * --------------------------------------------------------
     * 3. Ensure load callback updates when limit changes.
     *
     * Only change the callback containing
     * get_connect_messages.
     * --------------------------------------------------------
     */

    const loadStart =
      src.indexOf(
        "const load"
      );

    const loadRpc =
      src.indexOf(
        "get_connect_messages",
        loadStart
      );


    if (
      loadStart < 0 ||
      loadRpc < 0
    ) {
      stop(
        "Thread load callback not found."
      );
    }


    const nextCallback =
      src.indexOf(
        "useEffect",
        loadRpc
      );


    if (
      nextCallback < 0
    ) {
      stop(
        "Could not locate end of thread load callback."
      );
    }


    let loadBlock =
      src.slice(
        loadStart,
        nextCallback
      );


    /*
     * Find final dependency [id]
     * in this callback block.
     */
    if (
      /\[\s*id\s*\]\s*\)\s*;?\s*$/.test(
        loadBlock
      )
    ) {
      loadBlock =
        loadBlock.replace(
          /\[\s*id\s*\]\s*\)\s*;?\s*$/,
          "[id, perfMessageLimit]);"
        );

      src =
        src.slice(
          0,
          loadStart
        ) +
        loadBlock +
        src.slice(
          nextCallback
        );
    }
    else {

      /*
       * Support formatted:
       * }, [id]);
       */
      const depRe =
/\},\s*\[\s*id\s*\]\s*\);/;


      if (
        depRe.test(
          loadBlock
        )
      ) {
        loadBlock =
          loadBlock.replace(
            depRe,
            "}, [id, perfMessageLimit]);"
          );

        src =
          src.slice(
            0,
            loadStart
          ) +
          loadBlock +
          src.slice(
            nextCallback
          );
      }
      else {
        stop(
          "Thread load dependency [id] was not safely found."
        );
      }
    }


    /*
     * --------------------------------------------------------
     * 4. Prevent auto-scroll-to-bottom when LOAD OLDER
     *    expands the message history.
     * --------------------------------------------------------
     */

    const scrollRe =
/onContentSizeChange=\{\(\)\s*=>\s*ref\.current\s*\?\.\s*scrollToEnd\(\s*\{\s*animated\s*:\s*false\s*,?\s*\}\s*\)\s*\}/m;


    if (
      !scrollRe.test(src)
    ) {
      stop(
        "Thread onContentSizeChange anchor not found."
      );
    }


    src =
      src.replace(
        scrollRe,
`onContentSizeChange={() => {

          if (
            perfLoadingOlderRef
              .current
          ) {
            perfLoadingOlderRef
              .current =
                false;

            return;
          }

          ref.current
            ?.scrollToEnd({
              animated:
                false,
            });
        }}`
      );


    /*
     * --------------------------------------------------------
     * 5. Add LOAD OLDER at top of message ScrollView.
     *
     * If returned count equals current limit,
     * there may still be older messages.
     * --------------------------------------------------------
     */

    const emptyRe =
/\{\s*!messages\.length\s*&&\s*\(/m;


    if (
      !emptyRe.test(src)
    ) {
      stop(
        "Thread empty-message anchor not found."
      );
    }


    src =
      src.replace(
        emptyRe,
`{messages.length >=
          perfMessageLimit &&
          perfMessageLimit < 500 && (

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load older messages"
            onPress={() => {

              perfLoadingOlderRef
                .current =
                  true;

              setPerfMessageLimit(
                current =>
                  Math.min(
                    current + 80,
                    500
                  )
              );
            }}
            style={{
              alignSelf:
                'center',

              marginBottom:
                12,

              paddingVertical:
                7,

              paddingHorizontal:
                14,

              borderRadius:
                16,

              borderWidth:
                1,

              borderColor:
                colors.line,

              backgroundColor:
                colors.white,
            }}
          >
            <Text
              style={{
                fontSize:
                  10,

                fontWeight:
                  '900',

                color:
                  colors.greenDark,
              }}
            >
              LOAD OLDER MESSAGES
            </Text>
          </Pressable>
        )}

        {!messages.length && (`
      );
  }


  fs.writeFileSync(
    path,
    src,
    "utf8"
  );

  console.log(
    "MESSAGE WINDOWING READY"
  );
}


/* ============================================================
   B. PROFILE AVATAR CACHE
   ============================================================ */

{
  const path =
    "./src/components/ProfileAvatar.tsx";

  let src =
    fs.readFileSync(
      path,
      "utf8"
    );


  if (
    !src.includes(
      "PERF3_AVATAR_CACHE"
    )
  ) {

    /*
     * Existing cache was intentionally short.
     * Increase to 10 minutes for feed/message scrolling.
     */
    const cacheRe =
/Date\.now\(\)\s*-\s*cached\.at\s*<\s*5000/;


    if (
      cacheRe.test(src)
    ) {
      src =
        src.replace(
          cacheRe,
`/* PERF3_AVATAR_CACHE */
      Date.now() -
        cached.at <
        10 * 60 * 1000`
        );
    }
    else {

      /*
       * Support previously formatted version.
       */
      const cacheRe2 =
/Date\.now\(\)\s*-\s*cached\.at\s*<\s*5\s*\*\s*1000/;


      if (
        cacheRe2.test(src)
      ) {
        src =
          src.replace(
            cacheRe2,
`/* PERF3_AVATAR_CACHE */
      Date.now() -
        cached.at <
        10 * 60 * 1000`
          );
      }
      else {
        console.log(
          "Avatar cache TTL anchor not found; skipped TTL modification."
        );
      }
    }
  }


  fs.writeFileSync(
    path,
    src,
    "utf8"
  );

  console.log(
    "AVATAR CACHE OPTIMIZED"
  );
}


console.log("");
console.log(
  "PERF-3A FRONTEND APPLIED"
);
