import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const SOURCES = {
  ASD: {
    dir: path.join(ROOT, ".cache", "bible", "asd2025"),
    output: path.join(
      ROOT,
      "supabase",
      "migrations",
      "20260811080000_patch153h2b_asd_full_text.sql"
    ),
    title: "Biblica Open Ang Salita ng Diyos 2025",
    license: "CC BY-SA 4.0",
    source: "Open.Bible / Biblica, Inc."
  },

  KJV: {
    dir: path.join(ROOT, ".cache", "bible", "kjv"),
    output: path.join(
      ROOT,
      "supabase",
      "migrations",
      "20260811080500_patch153h2b_kjv_full_text.sql"
    ),
    title: "King James Version",
    license: "Public Domain outside the United Kingdom",
    source: "eBible.org"
  }
};

const BOOKS = {
  GEN:[1,"Genesis"], EXO:[2,"Exodus"], LEV:[3,"Leviticus"],
  NUM:[4,"Numbers"], DEU:[5,"Deuteronomy"], JOS:[6,"Joshua"],
  JDG:[7,"Judges"], RUT:[8,"Ruth"], "1SA":[9,"1 Samuel"],
  "2SA":[10,"2 Samuel"], "1KI":[11,"1 Kings"], "2KI":[12,"2 Kings"],
  "1CH":[13,"1 Chronicles"], "2CH":[14,"2 Chronicles"],
  EZR:[15,"Ezra"], NEH:[16,"Nehemiah"], EST:[17,"Esther"],
  JOB:[18,"Job"], PSA:[19,"Psalms"], PRO:[20,"Proverbs"],
  ECC:[21,"Ecclesiastes"], SNG:[22,"Song of Solomon"],
  ISA:[23,"Isaiah"], JER:[24,"Jeremiah"], LAM:[25,"Lamentations"],
  EZK:[26,"Ezekiel"], DAN:[27,"Daniel"], HOS:[28,"Hosea"],
  JOL:[29,"Joel"], AMO:[30,"Amos"], OBA:[31,"Obadiah"],
  JON:[32,"Jonah"], MIC:[33,"Micah"], NAM:[34,"Nahum"],
  HAB:[35,"Habakkuk"], ZEP:[36,"Zephaniah"], HAG:[37,"Haggai"],
  ZEC:[38,"Zechariah"], MAL:[39,"Malachi"], MAT:[40,"Matthew"],
  MRK:[41,"Mark"], LUK:[42,"Luke"], JHN:[43,"John"],
  ACT:[44,"Acts"], ROM:[45,"Romans"], "1CO":[46,"1 Corinthians"],
  "2CO":[47,"2 Corinthians"], GAL:[48,"Galatians"],
  EPH:[49,"Ephesians"], PHP:[50,"Philippians"],
  COL:[51,"Colossians"], "1TH":[52,"1 Thessalonians"],
  "2TH":[53,"2 Thessalonians"], "1TI":[54,"1 Timothy"],
  "2TI":[55,"2 Timothy"], TIT:[56,"Titus"], PHM:[57,"Philemon"],
  HEB:[58,"Hebrews"], JAS:[59,"James"], "1PE":[60,"1 Peter"],
  "2PE":[61,"2 Peter"], "1JN":[62,"1 John"], "2JN":[63,"2 John"],
  "3JN":[64,"3 John"], JUD:[65,"Jude"], REV:[66,"Revelation"]
};

function walk(dir) {
  let files = [];

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      files = files.concat(walk(full));
    } else {
      files.push(full);
    }
  }

  return files;
}

function cleanDocument(text) {
  // Remove footnotes and cross references.
  text = text.replace(/\\f\s[\s\S]*?\\f\*/g, " ");
  text = text.replace(/\\fe\s[\s\S]*?\\fe\*/g, " ");
  text = text.replace(/\\x\s[\s\S]*?\\x\*/g, " ");
  text = text.replace(/\\fig\s[\s\S]*?\\fig\*/g, " ");

  // Remove headings which must not become part of verse text.
  text = text.replace(
    /^\\(?:s\d*|ms\d*|sr|r|d|sp|cl|cd|rem|mt\d*|mte\d*|toc\d*|h)\s+.*$/gm,
    ""
  );

  return text;
}

function cleanVerse(text) {
  if (!text) return "";

  // Preserve displayed word while removing USFM word attributes.
  text = text.replace(
    /\\\+?w\s+([^|\\]+)(?:\|[^\\]*?)?\\\+?w\*/g,
    "$1"
  );

  text = text.replace(/\\va\s+.*?\\va\*/g, " ");
  text = text.replace(/\\vp\s+.*?\\vp\*/g, " ");

  // Strip normal inline/paragraph USFM markers.
  text = text.replace(
    /\\\+?[A-Za-z][A-Za-z0-9+\-]*\*?/g,
    " "
  );

  // Remove residual USFM attributes.
  text = text.replace(
    /\|[A-Za-z0-9_\-]+="[^"]*"/g,
    " "
  );

  text = text
    .replace(/~/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return text.replace(/\s+/g, " ").trim();
}

function verseNumber(token) {
  const match = String(token).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseTranslation(directory) {
  const rows = new Map();
  const booksSeen = new Set();
  const chaptersSeen = new Set();

  for (const file of walk(directory)) {
    let source;

    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const id = source.match(/^\\id\s+([A-Z0-9]{3})\b/m);

    if (!id) continue;

    const code = id[1];

    if (!BOOKS[code]) continue;

    const [bookNo, bookName] = BOOKS[code];

    booksSeen.add(bookNo);

    source = cleanDocument(source);

    const chapterRegex =
      /\\c\s+(\d+)([\s\S]*?)(?=\\c\s+\d+|$)/g;

    let chapterMatch;

    while ((chapterMatch = chapterRegex.exec(source)) !== null) {
      const chapterNo = Number(chapterMatch[1]);

      chaptersSeen.add(`${bookNo}:${chapterNo}`);

      const chapterText = chapterMatch[2];

      const verseRegex =
        /\\v\s+([0-9]+(?:[a-z]?|[-–][0-9]+[a-z]?|,[0-9]+)*)\s*([\s\S]*?)(?=\\v\s+[0-9]+|$)/gi;

      let verseMatch;

      while ((verseMatch = verseRegex.exec(chapterText)) !== null) {
        const vNo = verseNumber(verseMatch[1]);

        if (!vNo) continue;

        const verseText = cleanVerse(verseMatch[2]);

        if (!verseText) continue;

        const key = `${bookNo}:${chapterNo}:${vNo}`;

        if (!rows.has(key)) {
          rows.set(key, {
            bookNo,
            bookName,
            chapterNo,
            verseNo: vNo,
            verseText
          });
        } else {
          const current = rows.get(key);

          if (!current.verseText.includes(verseText)) {
            current.verseText =
              `${current.verseText} ${verseText}`.trim();
          }
        }
      }
    }
  }

  const result = [...rows.values()].sort((a,b) =>
    a.bookNo - b.bookNo ||
    a.chapterNo - b.chapterNo ||
    a.verseNo - b.verseNo
  );

  return {
    rows: result,
    booksSeen,
    chaptersSeen
  };
}

function sqlString(text) {
  return "'" + String(text).replace(/'/g, "''") + "'";
}

function validate(code, parsed) {
  const {
    rows,
    booksSeen,
    chaptersSeen
  } = parsed;

  console.log("");
  console.log(`${code} VALIDATION`);
  console.log(`  Books:    ${booksSeen.size}`);
  console.log(`  Chapters: ${chaptersSeen.size}`);
  console.log(`  Verses:   ${rows.length}`);

  if (booksSeen.size !== 66) {
    throw new Error(
      `${code}: expected 66 books, found ${booksSeen.size}`
    );
  }

  if (chaptersSeen.size !== 1189) {
    throw new Error(
      `${code}: expected 1189 chapters, found ${chaptersSeen.size}`
    );
  }

  if (rows.length < 30000) {
    throw new Error(
      `${code}: verse count appears incomplete: ${rows.length}`
    );
  }

  const required = [
    "1:1:1",
    "19:23:1",
    "43:3:16",
    "66:22:21"
  ];

  const keys = new Set(
    rows.map(
      r => `${r.bookNo}:${r.chapterNo}:${r.verseNo}`
    )
  );

  for (const key of required) {
    if (!keys.has(key)) {
      throw new Error(
        `${code}: missing required spot-check ${key}`
      );
    }
  }

  console.log(`  PASS: ${code}`);
}

function writeMigration(code, config, rows) {
  const output = [];

  output.push(
    "-- ============================================================================"
  );
  output.push(
    `-- PATCH 153H-2B - ${code} FULL BIBLE TEXT`
  );
  output.push(`-- ${config.title}`);
  output.push(`-- Source: ${config.source}`);
  output.push(`-- License: ${config.license}`);
  output.push(
    "-- Generated from the official USFM source."
  );
  output.push(
    "-- DO NOT MANUALLY EDIT VERSE CONTENT."
  );
  output.push(
    "-- ============================================================================"
  );
  output.push("");
  output.push("begin;");
  output.push("");

  output.push(
    `delete from public.bible_verses where translation_code = ${sqlString(code)};`
  );
  output.push("");

  const batchSize = 250;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    output.push(`
insert into public.bible_verses (
  translation_code,
  book_no,
  chapter_no,
  verse_no,
  verse_text,
  paragraph_start
) values`.trim());

    output.push(
      batch.map(row =>
        `(${sqlString(code)},${row.bookNo},${row.chapterNo},${row.verseNo},${sqlString(row.verseText)},false)`
      ).join(",\n")
    );

    output.push(`
on conflict (
  translation_code,
  book_no,
  chapter_no,
  verse_no
)
do update set
  verse_text = excluded.verse_text;
`.trim());

    output.push("");
  }

  output.push("commit;");
  output.push("");
  output.push("-- END PATCH 153H-2B");

  fs.writeFileSync(
    config.output,
    output.join("\n"),
    "utf8"
  );

  console.log(`Generated: ${config.output}`);
}

for (const code of ["ASD","KJV"]) {
  const config = SOURCES[code];

  if (!fs.existsSync(config.dir)) {
    throw new Error(
      `Missing extracted source directory: ${config.dir}`
    );
  }

  console.log("");
  console.log(`Processing ${code}...`);

  const parsed = parseTranslation(config.dir);

  validate(code, parsed);

  writeMigration(
    code,
    config,
    parsed.rows
  );
}

console.log("");
console.log("FULL BIBLE IMPORT BUILD COMPLETE");
console.log("NO DATABASE PUSH WAS PERFORMED.");