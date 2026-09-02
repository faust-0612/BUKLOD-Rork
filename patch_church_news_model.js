const fs = require("fs");

const path =
  "./supabase/functions/sync-church-news/index.ts";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


src =
  src.replace(
    /model:\s*'gpt-5\.4-mini'/g,
    "model: 'gpt-5-mini'"
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "OpenAI model set to gpt-5-mini"
);
