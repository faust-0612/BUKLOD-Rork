const fs = require("fs");

const files = [
  "src/app/bible/index.tsx",
  "src/app/bible/read.tsx",
  "src/app/mzb/home.tsx",
  "src/components/BuklodHomeFaithPanel.tsx",
  "src/app/(tabs)/home.tsx",
];

const replacements = [
  ["ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢", "-"],
  ["Ã¢â‚¬Â¢", "-"],
  ["â€¢", "-"],

  ["Ã¢â‚¬Âº", ">"],
  ["â€º", ">"],
  ["Â»", ">"],

  ["Ã¢â‚¬Â¹", "<"],
  ["â€¹", "<"],

  ["Ã¢â‚¬â€œ", "-"],
  ["â€“", "-"],

  ["Ã¢â‚¬â€", "-"],
  ["â€”", "-"],

  ["Ã¢â‚¬â„¢", "'"],
  ["â€™", "'"],

  ["Ã¢â‚¬Å“", '"'],
  ["â€œ", '"'],

  ["Ã¢â‚¬Â", '"'],
  ["â€�", '"'],

  ["Â·", "|"],
];

let changed = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log("SKIP:", file);
    continue;
  }

  let text = fs.readFileSync(file, "utf8");
  const original = text;

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good);
  }

  /*
   * Keep common UI separators ASCII-safe.
   */
  text = text
    .replace(/ • /g, " | ")
    .replace(/ ›/g, " >")
    .replace(/‹ /g, "< ");

  if (text !== original) {
    const stamp =
      new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);

    fs.copyFileSync(
      file,
      `${file}.before_moji_${stamp}.bak`
    );

    fs.writeFileSync(
      file,
      text,
      "utf8"
    );

    console.log("CLEANED:", file);
    changed++;
  }
  else {
    console.log("CLEAN:", file);
  }
}

console.log("");
console.log(
  `MOJIBAKE CLEANUP COMPLETE - ${changed} file(s) changed`
);
