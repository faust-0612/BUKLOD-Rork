const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let text =
  fs.readFileSync(
    path,
    "utf8"
  );

let lines =
  text.split(/\r?\n/);


function stop(message) {
  console.error("");
  console.error(
    "PATCH 159B-2 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


function findImportBlock(
  moduleName
) {
  const endNeedle =
    `from '${moduleName}';`;

  const end =
    lines.findIndex(
      line =>
        line.includes(
          endNeedle
        )
    );

  if (end < 0) {
    stop(
      `Import for ${moduleName} not found.`
    );
  }

  let start = end;

  while (
    start >= 0 &&
    !lines[start]
      .trim()
      .startsWith(
        'import {'
      )
  ) {
    start--;
  }

  if (start < 0) {
    stop(
      `Start of ${moduleName} import not found.`
    );
  }

  return {
    start,
    end,
  };
}


function extractNames(
  start,
  end
) {
  const block =
    lines
      .slice(
        start,
        end + 1
      )
      .join('\n');

  const match =
    block.match(
      /import\s*\{([\s\S]*?)\}\s*from/
    );

  if (!match) {
    stop(
      'Could not parse import names.'
    );
  }

  return match[1]
    .split(',')
    .map(
      x => x.trim()
    )
    .filter(Boolean);
}


function makeBlock(
  names,
  moduleName
) {
  const unique =
    [...new Set(names)];

  return [
    'import {',
    ...unique.map(
      name =>
        `  ${name},`
    ),
    `} from '${moduleName}';`,
  ];
}


/* ============================================================
   REACT
   ============================================================ */

{
  const block =
    findImportBlock(
      'react'
    );

  let names =
    extractNames(
      block.start,
      block.end
    );

  names =
    names.filter(
      name =>
        name !==
          'Dimensions' &&
        name !==
          'Linking'
    );

  lines.splice(
    block.start,
    block.end -
      block.start +
      1,
    ...makeBlock(
      names,
      'react'
    )
  );
}


/* ============================================================
   REACT-NATIVE
   Re-find after first replacement because line numbers changed.
   ============================================================ */

{
  const block =
    findImportBlock(
      'react-native'
    );

  let names =
    extractNames(
      block.start,
      block.end
    );

  names =
    names.filter(
      name =>
        name !==
          'Dimensions' &&
        name !==
          'Linking'
    );

  names.unshift(
    'Linking'
  );

  names.unshift(
    'Dimensions'
  );

  lines.splice(
    block.start,
    block.end -
      block.start +
      1,
    ...makeBlock(
      names,
      'react-native'
    )
  );
}


fs.writeFileSync(
  path,
  lines.join('\n'),
  'utf8'
);

console.log("");
console.log(
  "IMPORT BLOCKS HARD-FIXED"
);
