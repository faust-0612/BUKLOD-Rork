const fs = require("fs");

const path =
  "./src/app/reels/index.tsx";


function removeSequence(
  buffer,
  sequence
) {

  const chunks = [];

  let cursor = 0;
  let removed = 0;


  while (true) {

    const index =
      buffer.indexOf(
        sequence,
        cursor
      );


    if (index < 0) {
      chunks.push(
        buffer.subarray(
          cursor
        )
      );

      break;
    }


    chunks.push(
      buffer.subarray(
        cursor,
        index
      )
    );


    cursor =
      index +
      sequence.length;

    removed++;
  }


  return {
    buffer:
      Buffer.concat(
        chunks
      ),

    removed,
  };
}


let buffer =
  fs.readFileSync(
    path
  );


console.log(
  "ORIGINAL BYTES:",
  buffer.length
);


/*
 * Actual UTF-8 BOM:
 *
 * EF BB BF
 */
const utf8Bom =
  Buffer.from([
    0xEF,
    0xBB,
    0xBF,
  ]);


/*
 * UTF-8 encoding of the
 * mojibake characters:
 *
 * i-diaeresis = C3 AF
 * right angle quote = C2 BB
 * inverted question = C2 BF
 *
 * Together this represents:
 * the visible broken BOM text
 * seen by TypeScript.
 */
const mojibakeBom =
  Buffer.from([
    0xC3,
    0xAF,
    0xC2,
    0xBB,
    0xC2,
    0xBF,
  ]);


/*
 * Remove actual BOM bytes
 * anywhere in the file.
 */
const pass1 =
  removeSequence(
    buffer,
    utf8Bom
  );

buffer =
  pass1.buffer;


/*
 * Remove mojibake BOM bytes.
 */
const pass2 =
  removeSequence(
    buffer,
    mojibakeBom
  );

buffer =
  pass2.buffer;


/*
 * Extra defensive cleanup:
 * remove Unicode code point
 * U+FEFF and visible mojibake
 * after decoding.
 */
let text =
  buffer.toString(
    "utf8"
  );


const beforeChars =
  text.length;


text =
  text
    .split(
      String.fromCharCode(
        0xFEFF
      )
    )
    .join("")
    .split(
      String.fromCharCode(
        0x00EF,
        0x00BB,
        0x00BF
      )
    )
    .join("");


const charCleanup =
  beforeChars -
  text.length;


fs.writeFileSync(
  path,
  text,
  {
    encoding:
      "utf8",
  }
);


/*
 * VERIFY BYTES
 */
const verify =
  fs.readFileSync(
    path
  );


const actualBomRemaining =
  verify.indexOf(
    utf8Bom
  );


const mojibakeRemaining =
  verify.indexOf(
    mojibakeBom
  );


if (
  actualBomRemaining >= 0 ||
  mojibakeRemaining >= 0
) {

  console.error("");
  console.error(
    "PATCH 161B-3 STOPPED:"
  );

  console.error(
    "Forbidden BOM byte sequence remains."
  );

  process.exit(1);
}


console.log("");
console.log(
  "UTF8 BOM SEQUENCES REMOVED:",
  pass1.removed
);

console.log(
  "MOJIBAKE BOM SEQUENCES REMOVED:",
  pass2.removed
);

console.log(
  "EXTRA INVALID CHARACTERS REMOVED:",
  charCleanup
);

console.log(
  "FINAL BYTES:",
  verify.length
);

console.log("");
console.log(
  "BYTE-LEVEL CLEANUP PASSED"
);
