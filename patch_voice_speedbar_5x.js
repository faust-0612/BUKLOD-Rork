const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


/* Import shared VoiceReader if needed. */

if (
  !src.includes(
    "from '@/components/VoiceReader'"
  )
) {

  const anchor =
    "import { supabase } from '@/lib/supabase';";


  if (
    !src.includes(
      anchor
    )
  ) {

    console.error(
      "Supabase import anchor not found."
    );

    process.exit(1);

  }


  src =
    src.replace(
      anchor,
`${anchor}
import { VoiceReader } from '@/components/VoiceReader';`
    );

}


/*
 * If previous Daily Voice patch is already
 * present, do not duplicate it.
 */
if (
  !src.includes(
    "DAILY_DEVOTION_VOICE_READER_V1"
  )
) {

  const dailyMarker =
    src.indexOf(
      "DAILY_DEVOTION_FOCUSED_READING_V1"
    );


  if (
    dailyMarker < 0
  ) {

    console.error(
      "Focused Daily Devotion marker not found."
    );

    process.exit(1);

  }


  const anchor =
    src.indexOf(
      "{chapterLoading ? (",
      dailyMarker
    );


  if (
    anchor < 0
  ) {

    console.error(
      "Daily verse loading anchor not found."
    );

    process.exit(1);

  }


  const block =
`
          {/* DAILY_DEVOTION_VOICE_READER_V1 */}

          {!chapterLoading &&
            verses.length > 0 && (

            <View
              style={{
                marginBottom:
                  14,
              }}
            >

              <VoiceReader
                title="PAKINGGAN ANG READING"

                language={
                  translation ===
                  'ASD'
                    ? 'fil-PH'
                    : 'en-US'
                }

                text={[
                  (
                    currentBook
                      ?.book_name ??
                    'Bible'
                  ) +
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
                        verse.verse_text ??
                        ''
                      )
                        .replace(
                          /^\\u00B6\\s*/,
                          ''
                        )
                        .trim()
                  ),
                ]}
              />

            </View>

          )}


`;


  src =
    src.slice(
      0,
      anchor
    ) +
    block +
    src.slice(
      anchor
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "DAILY VOICE + 5X SPEED BAR READY"
);
