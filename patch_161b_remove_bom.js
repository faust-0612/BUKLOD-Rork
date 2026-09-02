const fs = require("fs");

const files = [
  "./src/app/reels/index.tsx",
  "./patch_161b_reel_player.txt",
  "./patch_161b_reels_tail.txt",
  "./patch_161b_reels_styles.txt",
];

let totalRemoved = 0;

for (const file of files) {

  if (!fs.existsSync(file)) {
    continue;
  }

  let src =
    fs.readFileSync(
      file,
      "utf8"
    );

  const actualBomCount =
    (
      src.match(/\uFEFF/g)
      || []
    ).length;

  const mojibakeCount =
    (
      src.match(/???/g)
      || []
    ).length;

  const before =
    actualBomCount +
    mojibakeCount;

  src =
    src
      .replace(/\uFEFF/g, "")
      .replace(/???/g, "");

  /*
   * Node writeFileSync("utf8")
   * writes UTF-8 without adding
   * a BOM in the middle/start.
   */
  fs.writeFileSync(
    file,
    src,
    "utf8"
  );

  totalRemoved +=
    before;

  console.log(
    file +
    " -> removed " +
    before +
    " BOM artifact(s)"
  );
}


const finalSrc =
  fs.readFileSync(
    "./src/app/reels/index.tsx",
    "utf8"
  );

const remainingActual =
  (
    finalSrc.match(/\uFEFF/g)
    || []
  ).length;

const remainingMojibake =
  (
    finalSrc.match(/???/g)
    || []
  ).length;


if (
  remainingActual !== 0 ||
  remainingMojibake !== 0
) {
  console.error("");
  console.error(
    "PATCH 161B-2 STOPPED:"
  );
  console.error(
    "BOM artifacts still remain."
  );
  process.exit(1);
}


console.log("");
console.log(
  "TOTAL BOM ARTIFACTS REMOVED: " +
  totalRemoved
);

console.log(
  "REELS SOURCE IS BOM-CLEAN"
);
