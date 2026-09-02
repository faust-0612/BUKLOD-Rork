const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let lines =
  fs.readFileSync(
    path,
    "utf8"
  ).split(/\r?\n/);


function stop(message) {
  console.error("");
  console.error(
    "PATCH 159C STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


function findImport(moduleName) {
  const endText =
    `from '${moduleName}';`;

  const end =
    lines.findIndex(
      line =>
        line.includes(
          endText
        )
    );

  if (end < 0) {
    stop(
      `${moduleName} import not found.`
    );
  }

  let start = end;

  while (
    start >= 0 &&
    !lines[start]
      .trim()
      .startsWith(
        "import {"
      )
  ) {
    start--;
  }

  if (start < 0) {
    stop(
      `${moduleName} import start not found.`
    );
  }

  return {
    start,
    end,
  };
}


function importNames(
  start,
  end
) {
  const block =
    lines
      .slice(
        start,
        end + 1
      )
      .join("\n");

  const match =
    block.match(
      /import\s*\{([^}]*)\}\s*from/
    );

  if (!match) {
    stop(
      "Could not parse import."
    );
  }

  return match[1]
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}


function importBlock(
  names,
  moduleName
) {
  return [
    "import {",
    ...[...new Set(names)]
      .map(
        name =>
          `  ${name},`
      ),
    `} from '${moduleName}';`,
  ];
}


/* ============================================================
   1. FIX REACT IMPORT
   ============================================================ */

{
  const {
    start,
    end,
  } =
    findImport("react");

  let names =
    importNames(
      start,
      end
    );

  names =
    names.filter(
      name =>
        name !== "Dimensions" &&
        name !== "Linking"
    );

  lines.splice(
    start,
    end - start + 1,
    ...importBlock(
      names,
      "react"
    )
  );
}


/* ============================================================
   2. FIX REACT-NATIVE IMPORT
   ============================================================ */

{
  const {
    start,
    end,
  } =
    findImport(
      "react-native"
    );

  let names =
    importNames(
      start,
      end
    );

  names =
    names.filter(
      name =>
        name !== "Dimensions" &&
        name !== "Linking"
    );

  names.unshift(
    "Linking"
  );

  names.unshift(
    "Dimensions"
  );

  lines.splice(
    start,
    end - start + 1,
    ...importBlock(
      names,
      "react-native"
    )
  );
}


let src =
  lines.join("\n");


/* ============================================================
   3. LOWER MEMBER NAME / HEADER TEXT
   ============================================================ */

const headerNameRe =
/headerName:\s*\{\s*flex:\s*1,\s*(?:paddingTop:\s*\d+,\s*)?\}/m;

if (
  !headerNameRe.test(src)
) {
  stop(
    "headerName style anchor not found."
  );
}

src =
  src.replace(
    headerNameRe,
`headerName: {
        flex: 1,

        /* PATCH_159C_HEADER_SPACE */
        paddingTop: 10,
      }`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);

console.log("");
console.log(
  "PATCH 159C HEADER SPACE APPLIED"
);
