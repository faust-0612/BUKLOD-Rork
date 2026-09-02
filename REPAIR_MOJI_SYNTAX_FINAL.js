const fs = require("fs");

function fixFile(path, fixer) {
  let s = fs.readFileSync(path, "utf8");

  const backup =
    path + ".before_syntax_repair_" +
    Date.now() + ".bak";

  fs.copyFileSync(path, backup);

  const out = fixer(s);

  fs.writeFileSync(path, out, "utf8");

  console.log("FIXED:", path);
  console.log("BACKUP:", backup);
}

/* DAILY BIBLE */
fixFile(
  "src/app/bible/index.tsx",
  (s) => {
    s = s.replace(
      /OPEN IN BIBLE\s*>/g,
      "OPEN IN BIBLE {'>'}"
    );

    s = s.replace(
      /\bREAD\s*>/g,
      "READ {'>'}"
    );

    return s;
  }
);

/* MZB HOME */
fixFile(
  "src/app/mzb/home.tsx",
  (s) => {
    s = s.replace(
      /'Loading today's reading\.\.\.'/g,
      `"Loading today's reading..."`
    );

    return s;
  }
);

/* HARD QA */
const bible =
  fs.readFileSync(
    "src/app/bible/index.tsx",
    "utf8"
  );

const mzb =
  fs.readFileSync(
    "src/app/mzb/home.tsx",
    "utf8"
  );

if (bible.includes("OPEN IN BIBLE >")) {
  throw new Error(
    "QA FAILED: raw OPEN IN BIBLE > still exists"
  );
}

if (/\bREAD\s*>/.test(bible)) {
  throw new Error(
    "QA FAILED: raw READ > still exists"
  );
}

if (
  mzb.includes(
    "'Loading today's reading...'"
  )
) {
  throw new Error(
    "QA FAILED: broken today's string still exists"
  );
}

console.log("");
console.log("SYNTAX REPAIR QA CLEAN");
