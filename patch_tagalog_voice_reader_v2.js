const fs = require("fs");

const biblePath =
  "./src/app/bible/read.tsx";

const lessonPath =
  "./src/app/learn/lesson.tsx";


function stop(message) {
  console.error("");
  console.error("VOICE READER V2 STOPPED:");
  console.error(message);
  process.exit(1);
}


function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}


function write(path,text) {
  fs.writeFileSync(
    path,
    text,
    "utf8"
  );
}


/* ============================================================
   BIBLE
   ============================================================ */

{
  let src =
    read(biblePath);


  if (
    !src.includes(
      "@/components/VoiceReader"
    )
  ) {

    const anchor =
`import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';`;


    if (
      !src.includes(anchor)
    ) {
      stop(
        "Bible UI import anchor not found."
      );
    }


    src =
      src.replace(
        anchor,
        anchor +
        "\nimport { VoiceReader } from '@/components/VoiceReader';"
      );

  }


  if (
    !src.includes(
      "BIBLE_TAGALOG_VOICE_READER_V2"
    )
  ) {

    const anchor =
`        {chapterLoading ? (`;


    if (
      !src.includes(anchor)
    ) {
      stop(
        "Bible chapter render anchor not found."
      );
    }


    const insert =
`        {/* BIBLE_TAGALOG_VOICE_READER_V2 */}
        {!chapterLoading &&
          verses.length > 0 && (
          <VoiceReader
            title="PAKINGGAN ANG KABANATA"
            subtitle={
              translation === 'ASD'
                ? 'Malinaw na Tagalog / Filipino voice'
                : 'Audio reader for this Bible version'
            }
            language={
              translation === 'ASD'
                ? 'fil-PH'
                : 'en-US'
            }
            text={[
              (currentBook?.book_name ?? 'Bible') +
                ', kabanata ' +
                chapterNo +
                '.',

              ...verses.map(
                verse =>
                  'Talata ' +
                  Number(
                    verse.verse_no
                  ) +
                  '. ' +
                  String(
                    verse.verse_text ?? ''
                  )
                    .replace(
                      /^\\u00B6\\s*/,
                      ''
                    )
                    .trim()
              ),
            ].join(' ')}
          />
        )}


`;


    src =
      src.replace(
        anchor,
        insert +
        anchor
      );

  }


  write(
    biblePath,
    src
  );


  console.log(
    "BIBLE VOICE READER INSTALLED"
  );
}


/* ============================================================
   LESSON
   ============================================================ */

{
  let src =
    read(lessonPath);


  if (
    !src.includes(
      "@/components/VoiceReader"
    )
  ) {

    const anchor =
`import { Button, Card, SectionTitle, shared } from '@/components/UI';`;


    if (
      !src.includes(anchor)
    ) {
      stop(
        "Lesson UI import anchor not found."
      );
    }


    src =
      src.replace(
        anchor,
        anchor +
        "\nimport { VoiceReader } from '@/components/VoiceReader';"
      );

  }


  if (
    !src.includes(
      "LESSON_TAGALOG_VOICE_READER_V2"
    )
  ) {

    const anchor =
`      <SectionTitle>LESSON</SectionTitle>`;


    if (
      !src.includes(anchor)
    ) {
      stop(
        "Lesson section anchor not found."
      );
    }


    const insert =
`      <SectionTitle>LESSON</SectionTitle>

      {/* LESSON_TAGALOG_VOICE_READER_V2 */}
      <VoiceReader
        title="PAKINGGAN ANG LESSON"
        subtitle="Malinaw na Tagalog / Filipino voice"
        language="fil-PH"
        text={[
          String(
            lesson.title ?? ''
          ),

          String(
            lesson.content ?? ''
          ),
        ]
          .filter(Boolean)
          .join('. ')}
      />`;


    src =
      src.replace(
        anchor,
        insert
      );

  }


  write(
    lessonPath,
    src
  );


  console.log(
    "LESSON VOICE READER INSTALLED"
  );
}


console.log("");
console.log(
  "VOICE READER V2 PATCH APPLIED"
);