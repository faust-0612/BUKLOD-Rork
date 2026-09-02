const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "from '@/lib/theme'"
  )
) {

  console.log(
    "Theme import already exists - checking colors."
  );


  if (
    !/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*['"]@\/lib\/theme['"]/
      .test(src)
  ) {

    src =
      src.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/theme['"];/,
        (match, names) => {

          const clean =
            names.trim();

          return (
            "import { " +
            (
              clean
                ? clean + ", colors"
                : "colors"
            ) +
            " } from '@/lib/theme';"
          );

        }
      );

  }

}
else {

  const supabaseImport =
    "import { supabase } from '@/lib/supabase';";


  if (
    !src.includes(
      supabaseImport
    )
  ) {
    console.error(
      "Supabase import anchor not found."
    );

    process.exit(1);
  }


  src =
    src.replace(
      supabaseImport,
`${supabaseImport}
import { colors } from '@/lib/theme';`
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "MY BIBLE COLORS IMPORT READY"
);
