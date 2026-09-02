const fs = require("fs");

const file = "src/app/bible/read.tsx";
let s = fs.readFileSync(file, "utf8");

const backup =
  file + ".before_176F_" +
  new Date().toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0,14) +
  ".bak";

fs.copyFileSync(file, backup);

if (s.includes("PATCH_176F_NO_RECENT_DAILY_PLAN")) {
  console.log("PATCH 176F already installed.");
  process.exit(0);
}

/*
 * When opening DAILY PLAN:
 * - requested route chapter may win
 * - PATCH 176E server sync may win
 * - RECENT PERSONAL BIBLE READING must NEVER win
 */

const bookPattern =
/if\s*\(\s*requestedBook\s*>\s*0\s*\)\s*\{\s*setBookNo\s*\(\s*requestedBook\s*\)\s*;\s*\}\s*else\s+if\s*\(\s*recent\?\.book_no\s*\)\s*\{\s*setBookNo\s*\(\s*Number\s*\(\s*recent\.book_no\s*\)\s*\)\s*;\s*\}\s*else\s*\{\s*setBookNo\s*\(\s*1\s*\)\s*;\s*\}/m;

const bookReplacement = `
if (requestedBook > 0) {
        setBookNo(requestedBook);
      }
      /* PATCH_176F_NO_RECENT_DAILY_PLAN */
      else if (source === 'daily_plan') {
        /*
         * Do nothing here.
         * PATCH 176E owns the canonical Daily Plan chapter.
         * Never restore the user's recent personal Bible chapter.
         */
      }
      else if (recent?.book_no) {
        setBookNo(
          Number(recent.book_no)
        );
      }
      else {
        setBookNo(1);
      }`;

if (!bookPattern.test(s)) {
  throw new Error(
    "PATCH 176F STOPPED: book fallback block not found."
  );
}

s = s.replace(
  bookPattern,
  bookReplacement
);

const chapterPattern =
/if\s*\(\s*requestedChapter\s*>\s*0\s*\)\s*\{\s*setChapterNo\s*\(\s*requestedChapter\s*\)\s*;\s*\}\s*else\s+if\s*\(\s*recent\?\.chapter_no\s*\)\s*\{\s*setChapterNo\s*\(\s*Number\s*\(\s*recent\.chapter_no\s*\)\s*\)\s*;\s*\}\s*else\s*\{\s*setChapterNo\s*\(\s*1\s*\)\s*;\s*\}/m;

const chapterReplacement = `
if (requestedChapter > 0) {
        setChapterNo(
          requestedChapter
        );
      }
      else if (source === 'daily_plan') {
        /*
         * Do nothing.
         * Canonical Daily Plan sync decides the chapter.
         */
      }
      else if (recent?.chapter_no) {
        setChapterNo(
          Number(recent.chapter_no)
        );
      }
      else {
        setChapterNo(1);
      }`;

if (!chapterPattern.test(s)) {
  throw new Error(
    "PATCH 176F STOPPED: chapter fallback block not found."
  );
}

s = s.replace(
  chapterPattern,
  chapterReplacement
);

fs.writeFileSync(
  file,
  s,
  "utf8"
);

const out =
  fs.readFileSync(file, "utf8");

if (
  !out.includes(
    "PATCH_176F_NO_RECENT_DAILY_PLAN"
  )
) {
  throw new Error(
    "PATCH 176F QA FAILED."
  );
}

console.log("");
console.log("PATCH 176F INSTALLED");
console.log(
  "Daily Reading can no longer fall back to Genesis 5 / recent reading."
);
console.log("Backup:", backup);
