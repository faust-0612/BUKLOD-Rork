const fs = require("fs");

const file = "src/app/bible/index.tsx";
const backup =
  file + ".before_176D_" +
  new Date().toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14) +
  ".bak";

let s = fs.readFileSync(file, "utf8");
fs.copyFileSync(file, backup);

console.log("Backup:", backup);

/* ---------------------------------------------------------
   1. Add canonical Manila calendar helper
--------------------------------------------------------- */

if (!s.includes("DAILY_BIBLE_MANILA_DATE_V1")) {

  const anchor =
`const fromIso = (s: string) => {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y,m-1,d);
};`;

  if (!s.includes(anchor)) {
    throw new Error(
      "PATCH 176D STOPPED: fromIso anchor not found."
    );
  }

  const addition =
`${anchor}

/* DAILY_BIBLE_MANILA_DATE_V1
 * Daily Bible backend uses Asia/Manila.
 * Keep the app calendar on the same canonical date.
 */
const manilaTodayIso = () => {
  const shifted =
    new Date(
      Date.now() +
      8 * 60 * 60 * 1000
    );

  return \`\${shifted.getUTCFullYear()}-\${String(
    shifted.getUTCMonth() + 1
  ).padStart(2,'0')}-\${String(
    shifted.getUTCDate()
  ).padStart(2,'0')}\`;
};`;

  s = s.replace(anchor, addition);
}

/* ---------------------------------------------------------
   2. Today's selected date must be Manila date
--------------------------------------------------------- */

const oldToday = "const today = iso(new Date());";
const newToday = "const today = manilaTodayIso();";

if (s.includes(oldToday)) {
  s = s.replace(oldToday, newToday);
}
else if (!s.includes(newToday)) {
  throw new Error(
    "PATCH 176D STOPPED: today anchor not found."
  );
}

/* ---------------------------------------------------------
   3. Week must also be based on Manila date
--------------------------------------------------------- */

const oldWeek =
  "const weekStart = useMemo(monday, []);";

const newWeek =
`const weekStart = useMemo(
    () => {
      const d =
        fromIso(manilaTodayIso());

      d.setHours(12,0,0,0);

      d.setDate(
        d.getDate() -
        ((d.getDay()+6)%7)
      );

      return d;
    },
    []
  );`;

if (s.includes(oldWeek)) {
  s = s.replace(oldWeek, newWeek);
}
else if (!s.includes("fromIso(manilaTodayIso())")) {
  throw new Error(
    "PATCH 176D STOPPED: weekStart anchor not found."
  );
}

fs.writeFileSync(file, s, "utf8");

/* ---------------------------------------------------------
   QA
--------------------------------------------------------- */

const out = fs.readFileSync(file, "utf8");

if (!out.includes("const today = manilaTodayIso();")) {
  throw new Error(
    "PATCH 176D QA FAILED: Manila today missing."
  );
}

if (!out.includes("DAILY_BIBLE_MANILA_DATE_V1")) {
  throw new Error(
    "PATCH 176D QA FAILED: helper missing."
  );
}

console.log("");
console.log("PATCH 176D APPLIED");
console.log("Daily Bible calendar = Asia/Manila");
console.log("No DB migration required.");
