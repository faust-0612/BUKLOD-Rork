from __future__ import annotations

import html
import re
import shutil
import urllib.request
import zipfile

from pathlib import Path


ROOT = Path.cwd()
CACHE = ROOT / ".cache" / "bible"
MIGRATIONS = ROOT / "supabase" / "migrations"

CACHE.mkdir(parents=True, exist_ok=True)
MIGRATIONS.mkdir(parents=True, exist_ok=True)


# ============================================================================
# OFFICIAL SOURCES
# ============================================================================

SOURCES = {
    "ASD": {
        "title": "Biblica Open Ang Salita ng Diyos 2025",
        "url": "https://openbible-api-1.biblica.com/artifactContent/6900c8bab85e9f0375b9db58",
        "zip": CACHE / "asd2025_usfm.zip",
        "dir": CACHE / "asd2025_usfm",
        "migration": MIGRATIONS / "20260811080000_patch153h2b_asd_full_text.sql",
        "license": "CC BY-SA 4.0",
        "source": "Open.Bible / Biblica, Inc.",
    },
    "KJV": {
        "title": "King James Version",
        "url": "https://ebible.org/Scriptures/eng-kjv2006_usfm.zip",
        "zip": CACHE / "eng-kjv2006_usfm.zip",
        "dir": CACHE / "eng-kjv2006_usfm",
        "migration": MIGRATIONS / "20260811080500_patch153h2b_kjv_full_text.sql",
        "license": "Public Domain outside the United Kingdom",
        "source": "eBible.org",
    },
}


# ============================================================================
# 66-BOOK CANON
# ============================================================================

BOOKS = {
    "GEN": (1, "Genesis"),
    "EXO": (2, "Exodus"),
    "LEV": (3, "Leviticus"),
    "NUM": (4, "Numbers"),
    "DEU": (5, "Deuteronomy"),
    "JOS": (6, "Joshua"),
    "JDG": (7, "Judges"),
    "RUT": (8, "Ruth"),
    "1SA": (9, "1 Samuel"),
    "2SA": (10, "2 Samuel"),
    "1KI": (11, "1 Kings"),
    "2KI": (12, "2 Kings"),
    "1CH": (13, "1 Chronicles"),
    "2CH": (14, "2 Chronicles"),
    "EZR": (15, "Ezra"),
    "NEH": (16, "Nehemiah"),
    "EST": (17, "Esther"),
    "JOB": (18, "Job"),
    "PSA": (19, "Psalms"),
    "PRO": (20, "Proverbs"),
    "ECC": (21, "Ecclesiastes"),
    "SNG": (22, "Song of Solomon"),
    "ISA": (23, "Isaiah"),
    "JER": (24, "Jeremiah"),
    "LAM": (25, "Lamentations"),
    "EZK": (26, "Ezekiel"),
    "DAN": (27, "Daniel"),
    "HOS": (28, "Hosea"),
    "JOL": (29, "Joel"),
    "AMO": (30, "Amos"),
    "OBA": (31, "Obadiah"),
    "JON": (32, "Jonah"),
    "MIC": (33, "Micah"),
    "NAM": (34, "Nahum"),
    "HAB": (35, "Habakkuk"),
    "ZEP": (36, "Zephaniah"),
    "HAG": (37, "Haggai"),
    "ZEC": (38, "Zechariah"),
    "MAL": (39, "Malachi"),

    "MAT": (40, "Matthew"),
    "MRK": (41, "Mark"),
    "LUK": (42, "Luke"),
    "JHN": (43, "John"),
    "ACT": (44, "Acts"),
    "ROM": (45, "Romans"),
    "1CO": (46, "1 Corinthians"),
    "2CO": (47, "2 Corinthians"),
    "GAL": (48, "Galatians"),
    "EPH": (49, "Ephesians"),
    "PHP": (50, "Philippians"),
    "COL": (51, "Colossians"),
    "1TH": (52, "1 Thessalonians"),
    "2TH": (53, "2 Thessalonians"),
    "1TI": (54, "1 Timothy"),
    "2TI": (55, "2 Timothy"),
    "TIT": (56, "Titus"),
    "PHM": (57, "Philemon"),
    "HEB": (58, "Hebrews"),
    "JAS": (59, "James"),
    "1PE": (60, "1 Peter"),
    "2PE": (61, "2 Peter"),
    "1JN": (62, "1 John"),
    "2JN": (63, "2 John"),
    "3JN": (64, "3 John"),
    "JUD": (65, "Jude"),
    "REV": (66, "Revelation"),
}


EXPECTED_CHAPTERS = 1189


# ============================================================================
# DOWNLOAD
# ============================================================================

def download(url: str, target: Path):
    if target.exists() and zipfile.is_zipfile(target):
        print(f"Using cached: {target}")
        return

    if target.exists():
        target.unlink()

    print(f"Downloading: {url}")

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 BUKLOD-Bible-Importer/1.0",
            "Accept": "*/*",
        },
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        with target.open("wb") as f:
            shutil.copyfileobj(response, f)

    if not zipfile.is_zipfile(target):
        target.unlink(missing_ok=True)
        raise RuntimeError(
            f"Downloaded file is not a valid ZIP: {target}"
        )

    print(f"Downloaded: {target}")


def extract(source_zip: Path, directory: Path):
    if directory.exists():
        shutil.rmtree(directory)

    directory.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(source_zip, "r") as z:
        z.extractall(directory)

    print(f"Extracted: {directory}")


# ============================================================================
# USFM CLEANING
# ============================================================================

def clean_source_document(text: str) -> str:
    # Remove footnotes / cross references completely.
    patterns = [
        r"\\f\s.*?\\f\*",
        r"\\fe\s.*?\\fe\*",
        r"\\ef\s.*?\\ef\*",
        r"\\x\s.*?\\x\*",
        r"\\ex\s.*?\\ex\*",
        r"\\fig\s.*?\\fig\*",
    ]

    for pattern in patterns:
        text = re.sub(
            pattern,
            " ",
            text,
            flags=re.DOTALL,
        )

    return text


def clean_inline(text: str) -> str:
    if not text:
        return ""

    # Preserve actual displayed word from USFM \w ... \w* structures
    text = re.sub(
        r"\\\+?w\s+([^|\\]+)(?:\|[^\\]*?)?\\\+?w\*",
        r"\1",
        text,
    )

    # Remove alternate verse numbering metadata.
    text = re.sub(
        r"\\va\s+.*?\\va\*",
        " ",
        text,
    )

    text = re.sub(
        r"\\vp\s+.*?\\vp\*",
        " ",
        text,
    )

    # Remove milestone attributes.
    text = re.sub(
        r"\\[A-Za-z0-9+\-]+-s\s+[^\\]*?\\\*",
        " ",
        text,
    )

    text = re.sub(
        r"\\[A-Za-z0-9+\-]+-e\\\*",
        " ",
        text,
    )

    # Strip ordinary remaining USFM markers but retain their text.
    text = re.sub(
        r"\\\+?[A-Za-z][A-Za-z0-9+\-]*\*?",
        " ",
        text,
    )

    # Strip stray attribute portions.
    text = re.sub(
        r'\|[A-Za-z0-9_\-]+="[^"]*"',
        " ",
        text,
    )

    text = text.replace("~", " ")
    text = html.unescape(text)

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.strip()


SKIP_PREFIXES = {
    "id", "ide", "h", "toc1", "toc2", "toc3",
    "mt", "mt1", "mt2", "mt3", "mt4",
    "mte", "mte1", "mte2",
    "ms", "ms1", "ms2", "ms3",
    "s", "s1", "s2", "s3", "s4",
    "sr", "r", "d", "sp",
    "cl", "cd", "rem",
}

CONTINUATION_PREFIXES = {
    "p", "m", "po", "pr", "cls",
    "pmo", "pm", "pmc", "pmr",
    "pi", "pi1", "pi2", "pi3",
    "mi", "nb", "pc",
    "q", "q1", "q2", "q3", "q4",
    "qr", "qc", "qa", "qm", "qm1", "qm2", "qm3",
    "li", "li1", "li2", "li3", "li4",
}


def marker_name(line: str):
    m = re.match(
        r"^\\([A-Za-z0-9+\-]+)",
        line.strip(),
    )
    return m.group(1) if m else None


def first_verse_number(token: str):
    m = re.search(r"\d+", token)
    return int(m.group()) if m else None


# ============================================================================
# USFM PARSER
# ============================================================================

def read_text(path: Path):
    raw = path.read_bytes()

    for encoding in (
        "utf-8-sig",
        "utf-8",
        "cp1252",
    ):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            pass

    return raw.decode(
        "utf-8",
        errors="replace",
    )


def parse_directory(directory: Path):
    rows = {}

    books_seen = set()
    chapters_seen = set()

    source_files = []

    for file in directory.rglob("*"):
        if not file.is_file():
            continue

        try:
            sample = read_text(file)
        except Exception:
            continue

        if "\\id " not in sample:
            continue

        source_files.append(
            (file, sample)
        )

    if not source_files:
        raise RuntimeError(
            f"No USFM files found under {directory}"
        )

    for file, source in source_files:
        source = clean_source_document(source)

        id_match = re.search(
            r"(?m)^\\id\s+([A-Z0-9]{3})\b",
            source,
        )

        if not id_match:
            continue

        book_code = id_match.group(1)

        if book_code not in BOOKS:
            # Ignore glossary/front matter/non-canonical extras.
            continue

        book_no, book_name = BOOKS[book_code]

        books_seen.add(book_no)

        current_chapter = None
        current_key = None

        for original_line in source.splitlines():
            line = original_line.strip()

            if not line:
                continue

            chapter_match = re.search(
                r"\\c\s+(\d+)",
                line,
            )

            if chapter_match:
                current_chapter = int(
                    chapter_match.group(1)
                )

                chapters_seen.add(
                    (
                        book_no,
                        current_chapter,
                    )
                )

                current_key = None

            if current_chapter is None:
                continue

            verse_matches = list(
                re.finditer(
                    r"\\v\s+([0-9]+(?:[a-z]?|[-–][0-9]+[a-z]?|,[0-9]+)*)\s*",
                    line,
                    flags=re.IGNORECASE,
                )
            )

            if verse_matches:
                for index, match in enumerate(
                    verse_matches
                ):
                    token = match.group(1)

                    verse_no = first_verse_number(
                        token
                    )

                    if verse_no is None:
                        continue

                    start = match.end()

                    if index + 1 < len(verse_matches):
                        end = verse_matches[
                            index + 1
                        ].start()
                    else:
                        end = len(line)

                    body = clean_inline(
                        line[start:end]
                    )

                    key = (
                        book_no,
                        current_chapter,
                        verse_no,
                    )

                    current_key = key

                    if key not in rows:
                        rows[key] = {
                            "book_no": book_no,
                            "book_name": book_name,
                            "chapter_no": current_chapter,
                            "verse_no": verse_no,
                            "verse_text": body,
                        }
                    elif body:
                        previous = rows[key][
                            "verse_text"
                        ]

                        if body not in previous:
                            rows[key][
                                "verse_text"
                            ] = (
                                previous + " " + body
                            ).strip()

                continue

            # Append paragraph/poetry continuation belonging to
            # the most recent verse.
            if current_key is not None:
                marker = marker_name(line)

                if marker:
                    if marker in SKIP_PREFIXES:
                        continue

                    if marker not in CONTINUATION_PREFIXES:
                        continue

                    payload = re.sub(
                        r"^\\[A-Za-z0-9+\-]+\s*",
                        "",
                        line,
                        count=1,
                    )
                else:
                    payload = line

                payload = clean_inline(
                    payload
                )

                if payload:
                    previous = rows[
                        current_key
                    ]["verse_text"]

                    if payload not in previous:
                        rows[current_key][
                            "verse_text"
                        ] = (
                            previous + " " + payload
                        ).strip()

    final_rows = [
        row
        for _, row in sorted(
            rows.items(),
            key=lambda item: item[0],
        )
        if row["verse_text"].strip()
    ]

    return (
        final_rows,
        books_seen,
        chapters_seen,
    )


# ============================================================================
# SQL OUTPUT
# ============================================================================

def sql_string(value: str):
    return "'" + value.replace(
        "'",
        "''",
    ) + "'"


def write_migration(
    translation: str,
    config: dict,
    rows: list,
):
    path = config["migration"]

    out = []

    out.append(
        "-- ============================================================================"
    )
    out.append(
        f"-- PATCH 153H-2B - {translation} FULL BIBLE TEXT"
    )
    out.append(
        f"-- {config['title']}"
    )
    out.append(
        f"-- Source: {config['source']}"
    )
    out.append(
        f"-- License: {config['license']}"
    )
    out.append(
        "-- Generated automatically from the official USFM source."
    )
    out.append(
        "-- DO NOT MANUALLY EDIT VERSE CONTENT."
    )
    out.append(
        "-- ============================================================================"
    )
    out.append("")
    out.append("begin;")
    out.append("")

    # Allows deterministic rebuild of the translation.
    out.append(
        "delete from public.bible_verses "
        f"where translation_code = {sql_string(translation)};"
    )
    out.append("")

    batch_size = 250

    for start in range(
        0,
        len(rows),
        batch_size,
    ):
        batch = rows[
            start:start + batch_size
        ]

        out.append(
            "insert into public.bible_verses ("
        )
        out.append(
            "  translation_code,"
        )
        out.append(
            "  book_no,"
        )
        out.append(
            "  chapter_no,"
        )
        out.append(
            "  verse_no,"
        )
        out.append(
            "  verse_text,"
        )
        out.append(
            "  paragraph_start"
        )
        out.append(
            ") values"
        )

        values = []

        for row in batch:
            values.append(
                "("
                + sql_string(translation)
                + ","
                + str(row["book_no"])
                + ","
                + str(row["chapter_no"])
                + ","
                + str(row["verse_no"])
                + ","
                + sql_string(
                    row["verse_text"]
                )
                + ",false)"
            )

        out.append(
            ",\n".join(values)
        )

        out.append(
            "on conflict ("
            "translation_code,"
            "book_no,"
            "chapter_no,"
            "verse_no"
            ") do update set "
            "verse_text = excluded.verse_text;"
        )

        out.append("")

    out.append("commit;")
    out.append("")
    out.append(
        "-- END PATCH 153H-2B"
    )

    path.write_text(
        "\n".join(out),
        encoding="utf-8",
    )

    print(
        f"Generated migration: {path}"
    )


# ============================================================================
# VALIDATION
# ============================================================================

def validate(
    translation: str,
    rows: list,
    books_seen: set,
    chapters_seen: set,
):
    verse_count = len(rows)
    book_count = len(books_seen)
    chapter_count = len(chapters_seen)

    print("")
    print(
        f"{translation} VALIDATION"
    )
    print(
        f"  Books:    {book_count}"
    )
    print(
        f"  Chapters: {chapter_count}"
    )
    print(
        f"  Verses:   {verse_count}"
    )

    if book_count != 66:
        raise RuntimeError(
            f"{translation}: expected 66 books, "
            f"found {book_count}"
        )

    if chapter_count != EXPECTED_CHAPTERS:
        raise RuntimeError(
            f"{translation}: expected "
            f"{EXPECTED_CHAPTERS} chapters, "
            f"found {chapter_count}"
        )

    if verse_count < 30000:
        raise RuntimeError(
            f"{translation}: verse count "
            f"looks incomplete ({verse_count})"
        )

    # Required spot checks
    required = [
        (1, 1, 1),      # Genesis 1:1
        (19, 23, 1),    # Psalm 23:1
        (43, 3, 16),    # John 3:16
        (66, 22, 21),   # Revelation 22:21
    ]

    keys = {
        (
            r["book_no"],
            r["chapter_no"],
            r["verse_no"],
        )
        for r in rows
    }

    for key in required:
        if key not in keys:
            raise RuntimeError(
                f"{translation}: missing required "
                f"spot-check verse {key}"
            )

    print(
        f"  PASS: {translation} canonical validation"
    )


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("")
    print(
        "BUKLOD FULL BIBLE IMPORT BUILDER"
    )
    print(
        "================================"
    )

    for translation in (
        "ASD",
        "KJV",
    ):
        config = SOURCES[
            translation
        ]

        print("")
        print(
            f"=== {translation} ==="
        )

        download(
            config["url"],
            config["zip"],
        )

        extract(
            config["zip"],
            config["dir"],
        )

        (
            rows,
            books_seen,
            chapters_seen,
        ) = parse_directory(
            config["dir"]
        )

        validate(
            translation,
            rows,
            books_seen,
            chapters_seen,
        )

        write_migration(
            translation,
            config,
            rows,
        )

    print("")
    print(
        "================================"
    )
    print(
        "FULL BIBLE IMPORT BUILD COMPLETE"
    )
    print("")
    print(
        "Generated:"
    )

    for translation in (
        "ASD",
        "KJV",
    ):
        print(
            "  "
            + str(
                SOURCES[
                    translation
                ]["migration"]
            )
        )

    print("")
    print(
        "NO DATABASE PUSH WAS PERFORMED."
    )


if __name__ == "__main__":
    main()