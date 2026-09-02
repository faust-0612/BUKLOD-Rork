const fs = require("fs");


function stop(message) {
  console.error("");
  console.error("PATCH 159D STOPPED:");
  console.error(message);
  process.exit(1);
}


/* ============================================================
   A. CONNECT DASHBOARD
   ============================================================ */

{
  const path =
    "./src/app/connect/index.tsx";

  let src =
    fs.readFileSync(
      path,
      "utf8"
    );


  /* Remove duplicate safe-area top spacing.
     Parent Messages header already handles the top area. */
  const oldTop =
/paddingTop:\s*Math\.max\(\s*insets\.top\s*\+\s*8,\s*18\s*\),/m;

  if (
    !oldTop.test(src)
  ) {
    stop(
      "Dashboard paddingTop anchor not found."
    );
  }

  src =
    src.replace(
      oldTop,
      "paddingTop: 8,"
    );


  /* Compact FIND MEMBER spacing */
  const findTitle =
/<SectionTitle>\s*FIND MEMBER\s*<\/SectionTitle>/m;

  if (
    !findTitle.test(src)
  ) {
    stop(
      "FIND MEMBER title anchor not found."
    );
  }

  src =
    src.replace(
      findTitle,
`<Text style={s.compactFindTitle}>
              FIND MEMBER
            </Text>`
    );


  /* Compact MESSAGES heading */
  const messagesTitle =
/<SectionTitle>\s*MESSAGES\s*<\/SectionTitle>/m;

  if (
    messagesTitle.test(src)
  ) {
    src =
      src.replace(
        messagesTitle,
`<Text style={s.compactMessagesTitle}>
              MESSAGES
            </Text>`
      );
  }


  /* Add local compact styles */
  const styleAnchor =
/eyebrow:\s*\{/m;

  if (
    !styleAnchor.test(src)
  ) {
    stop(
      "Dashboard style anchor not found."
    );
  }

  if (
    !src.includes(
      "compactFindTitle:"
    )
  ) {
    src =
      src.replace(
        styleAnchor,
`compactFindTitle: {
    marginTop: 5,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: colors.muted,
  },

  compactMessagesTitle: {
    marginTop: 12,
    marginBottom: 2,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: colors.muted,
  },

  eyebrow: {`
      );
  }


  fs.writeFileSync(
    path,
    src,
    "utf8"
  );
}


/* ============================================================
   B. CONVERSATION HEADER
   ============================================================ */

{
  const path =
    "./src/app/connect/[id].tsx";

  let src =
    fs.readFileSync(
      path,
      "utf8"
    );


  /* Whole nav row gets safe-area spacing,
     not only the member name. */
  const headerJSX =
/<View\s+style=\{s\.header\}\s*>/m;

  if (
    !headerJSX.test(src)
  ) {
    stop(
      "Thread header JSX anchor not found."
    );
  }

  src =
    src.replace(
      headerJSX,
`<View
        style={[
          s.header,
          {
            paddingTop:
              Math.max(
                insets.top + 6,
                18
              ),

            paddingBottom: 10,

            minHeight:
              72 +
              Math.max(
                insets.top,
                12
              ),
          },
        ]}
      >`
    );


  /* Remove old name-only offset.
     All header controls now move together. */
  const oldHeaderName =
/headerName:\s*\{\s*flex:\s*1,\s*\/\*\s*PATCH_159C_HEADER_SPACE\s*\*\/\s*paddingTop:\s*10,\s*\}/m;

  if (
    oldHeaderName.test(src)
  ) {
    src =
      src.replace(
        oldHeaderName,
`headerName: {
        flex: 1,
        paddingTop: 0,
      }`
      );
  }


  fs.writeFileSync(
    path,
    src,
    "utf8"
  );
}


console.log("");
console.log(
  "PATCH 159D LAYOUT APPLIED"
);
