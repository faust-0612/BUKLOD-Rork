const fs = require("fs");

const fixes = [
  {
    file: "src/app/bible/index.tsx",
    changes: [
      ["^Ã‚Â¶", "^\\u00B6"]
    ]
  },

  {
    file: "src/app/mzb/home.tsx",
    changes: [
      ["^Ã‚?Â¶", "^\\u00B6"],
      ["â‚±${money(", "\\u20B1${money("]
    ]
  },

  {
    file: "src/app/(tabs)/buklod.tsx",
    changes: [
      ["â–¶", "{'\\u25B6'}"]
    ]
  },

  {
    file: "src/app/advertise/index.tsx",
    changes: [
      ["Video selected â€¢ ", "Video selected - "]
    ]
  },

  {
    file: "src/app/organizations/suborganizations.tsx",
    changes: [
      ["{' â€¢ '}", "{' \\u2022 '}"]
    ]
  },

  {
    file: "src/app/scope/index.tsx",
    changes: [
      ["ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢", "\\u2022"]
    ]
  },

  {
    file: "src/components/BuklodAcceptedCallContent.tsx",
    changes: [
      ["{'  ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢  '}", "{'  \\u2022  '}"]
    ]
  },

  {
    file: "src/app/privacy/consent.tsx",
    changes: [
      ["â€”", "-"]
    ]
  }
];

let changedFiles = 0;
let replacements = 0;

for (const item of fixes) {
  if (!fs.existsSync(item.file)) {
    console.log("SKIP:", item.file);
    continue;
  }

  let s = fs.readFileSync(item.file, "utf8");
  const original = s;

  for (const [bad, good] of item.changes) {
    const count = s.split(bad).length - 1;

    if (count > 0) {
      s = s.split(bad).join(good);
      replacements += count;
    }
  }

  if (s !== original) {
    const backup =
      item.file +
      ".before_moji_exact_" +
      Date.now() +
      ".bak";

    fs.copyFileSync(item.file, backup);
    fs.writeFileSync(item.file, s, "utf8");

    console.log("CLEANED:", item.file);
    changedFiles++;
  }
  else {
    console.log("NO CHANGE:", item.file);
  }
}

console.log("");
console.log("FILES CHANGED:", changedFiles);
console.log("REPLACEMENTS:", replacements);
console.log("MOJIBAKE EXACT CLEANUP COMPLETE");
