const fs = require("fs");

const file = "src/app/bible/read.tsx";
let s = fs.readFileSync(file, "utf8");

const stamp =
  new Date().toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

const backup =
  `${file}.before_176E_${stamp}.bak`;

fs.copyFileSync(file, backup);

if (s.includes("PATCH_176E_DAILY_PLAN_READER_SYNC")) {
  console.log("PATCH 176E already installed.");
  process.exit(0);
}

const anchorRegex =
  /(\s*const\s+\[\s*showBooks\s*,\s*setShowBooks\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*;)/m;

if (!anchorRegex.test(s)) {
  throw new Error(
    "PATCH 176E STOPPED: showBooks anchor not found."
  );
}

const patch = `

  /*
   * PATCH_176E_DAILY_PLAN_READER_SYNC
   *
   * Daily Reading must always open the canonical
   * automatic assignment for assignedDate.
   *
   * Never fall back to the user's recent Bible chapter
   * when entering through source=daily_plan.
   */
  useEffect(() => {
    if (
      source !== 'daily_plan' ||
      !assignedDate
    ) {
      return;
    }

    let active = true;

    const syncDailyPlanChapter =
      async () => {
        try {
          const { data, error } =
            await (supabase as any).rpc(
              'get_automatic_bible_reading',
              {
                p_reading_date:
                  assignedDate,
              }
            );

          if (
            !active ||
            error
          ) {
            if (error) {
              console.warn(
                'Daily Bible reader sync:',
                error.message
              );
            }

            return;
          }

          const raw =
            Array.isArray(data)
              ? data[0] ?? null
              : data ?? null;

          if (!raw) {
            return;
          }

          const nextBook =
            Number(
              raw.start_book_no ?? 0
            );

          const nextChapter =
            Number(
              raw.start_chapter ?? 0
            );

          if (
            nextBook > 0 &&
            nextChapter > 0
          ) {
            setBookNo(nextBook);
            setChapterNo(nextChapter);

            setDailyPlanStep(1);
          }
        }
        catch (error) {
          console.warn(
            'Daily Bible reader sync:',
            error
          );
        }
      };

    void syncDailyPlanChapter();

    return () => {
      active = false;
    };
  }, [
    source,
    assignedDate,
  ]);
`;

s = s.replace(
  anchorRegex,
  patch + "\n$1"
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
    "PATCH_176E_DAILY_PLAN_READER_SYNC"
  ) ||
  !out.includes(
    "'get_automatic_bible_reading'"
  )
) {
  throw new Error(
    "PATCH 176E QA FAILED."
  );
}

console.log("");
console.log("PATCH 176E INSTALLED");
console.log(
  "Daily Plan reader now follows assignedDate."
);
console.log(
  "Recent Genesis chapter can no longer override it."
);
console.log("Backup:", backup);
