const fs = require("fs");
const ts = require("typescript");

const path =
  "./src/app/_layout.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );

function stop(message) {
  console.error("");
  console.error(
    "CALL FIX 3 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


/* ============================================================
   1. ADD GestureHandlerRootView IMPORT
   ============================================================ */

if (
  !src.includes(
    "GestureHandlerRootView"
  )
) {
  const expoImport =
    /import[^\n]+from\s+['"]expo-router['"];\s*/;

  const match =
    src.match(
      expoImport
    );

  if (!match) {
    stop(
      "expo-router import anchor not found."
    );
  }

  src =
    src.replace(
      expoImport,
      match[0] +
      "import { GestureHandlerRootView } from 'react-native-gesture-handler';\n"
    );
}


/* ============================================================
   2. PARSE ROOT LAYOUT SAFELY
   ============================================================ */

let sourceFile =
  ts.createSourceFile(
    path,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );


const rootLayout =
  sourceFile.statements.find(
    node =>
      ts.isFunctionDeclaration(
        node
      ) &&
      node.name?.text ===
        "RootLayout"
  );


if (
  !rootLayout ||
  !rootLayout.body
) {
  stop(
    "RootLayout function not found."
  );
}


const returnStatement =
  rootLayout.body.statements.find(
    node =>
      ts.isReturnStatement(
        node
      )
  );


if (
  !returnStatement ||
  !returnStatement.expression
) {
  stop(
    "RootLayout return statement not found."
  );
}


/*
 * return (
 *   <Something />
 * )
 *
 * TypeScript may represent this as
 * ParenthesizedExpression.
 */
let expression =
  returnStatement.expression;

if (
  ts.isParenthesizedExpression(
    expression
  )
) {
  expression =
    expression.expression;
}


const start =
  expression.getStart(
    sourceFile
  );

const end =
  expression.getEnd();


const currentRoot =
  src.slice(
    start,
    end
  );


if (
  currentRoot.includes(
    "<GestureHandlerRootView"
  )
) {
  console.log(
    "RootLayout is already wrapped."
  );
}
else {

  const wrapped =
`<GestureHandlerRootView
      style={{ flex: 1 }}
    >
      ${currentRoot}
    </GestureHandlerRootView>`;


  src =
    src.slice(
      0,
      start
    ) +
    wrapped +
    src.slice(
      end
    );


  fs.writeFileSync(
    path,
    src,
    "utf8"
  );

  console.log(
    "ROOT LAYOUT WRAPPED WITH GestureHandlerRootView"
  );
}


console.log("");
console.log(
  "CALL FIX 3 APPLIED"
);
