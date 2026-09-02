const fs = require("fs");

const path =
  "./supabase/functions/sync-church-news/index.ts";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "GEMINI_STRUCTURED_OUTPUT_V10_2"
  )
) {
  console.log(
    "Gemini V10.2 already installed."
  );

  process.exit(0);
}


const oldBlock =
`              generationConfig: {

                temperature:
                  0.2,

                maxOutputTokens:
                  800,

                responseFormat: {

                  text: {

                    mimeType:
                      'application/json',

                    schema,

                  },

                },

              },`;


const newBlock =
`              generationConfig: {

                /* GEMINI_STRUCTURED_OUTPUT_V10_2 */

                temperature:
                  0.2,

                maxOutputTokens:
                  800,

                responseMimeType:
                  'application/json',

                responseSchema:
                  schema,

              },`;


if (
  !src.includes(
    oldBlock
  )
) {

  throw new Error(
    "Old responseFormat block not found. STOP."
  );
}


src =
  src.replace(
    oldBlock,
    newBlock
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "GEMINI STRUCTURED OUTPUT V10.2 INSTALLED"
);
