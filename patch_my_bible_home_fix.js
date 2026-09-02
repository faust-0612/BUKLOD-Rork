const fs = require("fs");

const homePath =
  "./src/app/(tabs)/home.tsx";

const replacementPath =
  "./my_bible_home_pair_replacement.txt";

let src =
  fs.readFileSync(
    homePath,
    "utf8"
  );

const replacement =
  fs.readFileSync(
    replacementPath,
    "utf8"
  );


const start =
  src.indexOf(
    "function HomeDailyBayanihanPair() {"
  );

const end =
  src.indexOf(
    "function HomeDailyBibleStrip() {",
    start
  );


if(start < 0){
  console.error(
    "HomeDailyBayanihanPair start not found."
  );

  process.exit(1);
}


if(end < 0){
  console.error(
    "HomeDailyBibleStrip boundary not found."
  );

  process.exit(1);
}


src =
  src.slice(0,start) +
  replacement +
  "\n" +
  src.slice(end);


fs.writeFileSync(
  homePath,
  src,
  "utf8"
);


console.log(
  "MY BIBLE HOME SPLIT V2 INSTALLED"
);
