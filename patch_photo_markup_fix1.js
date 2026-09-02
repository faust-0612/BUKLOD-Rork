const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "PHOTO_MARKUP_TEXT_NARROWING_FIX"
  )
) {
  console.log(
    "Text narrowing fix already applied."
  );

  process.exit(0);
}


/*
 * The final branch renders SkiaText.
 * Explicitly narrow MarkupItem to
 * kind === 'text' so TypeScript knows
 * point and text exist.
 */

const anchor =
`      return (
        <SkiaText
          key={key}
          x={
            mark.point.x
          }
          y={
            mark.point.y
          }
          text={
            mark.text
          }`;


if (
  !src.includes(
    anchor
  )
) {

  console.error("");
  console.error(
    "PHOTO MARKUP FIX 1 STOPPED:"
  );

  console.error(
    "SkiaText render anchor not found."
  );

  process.exit(1);
}


src =
  src.replace(
    anchor,
`      /* PHOTO_MARKUP_TEXT_NARROWING_FIX */
      if (
        mark.kind !==
        'text'
      ) {
        return null;
      }


      return (
        <SkiaText
          key={key}
          x={
            mark.point.x
          }
          y={
            mark.point.y
          }
          text={
            mark.text
          }`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "TEXT MARK TYPE NARROWING INSTALLED"
);
