const fs = require("fs");


/* ==========================================================
   HOME IMPORT FIX
========================================================== */

const homePath =
  "./src/app/(tabs)/home.tsx";

let home =
  fs.readFileSync(
    homePath,
    "utf8"
  );


function rewriteNamedImport(
  source,
  moduleName,
  removeNames = [],
  addNames = []
) {

  const escaped =
    moduleName.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );


  const regex =
    new RegExp(
      `import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*['"]${escaped}['"];`
    );


  const match =
    source.match(
      regex
    );


  if (!match) {
    throw new Error(
      `Import not found: ${moduleName}`
    );
  }


  let names =
    match[1]
      .split(',')
      .map(
        item =>
          item.trim()
      )
      .filter(Boolean);


  names =
    names.filter(
      name =>
        !removeNames.includes(
          name
        )
    );


  for (
    const name
    of addNames
  ) {

    if (
      !names.includes(
        name
      )
    ) {
      names.push(
        name
      );
    }

  }


  const replacement =
`import {
  ${names.join(',\n  ')},
} from '${moduleName}';`;


  return source.replace(
    regex,
    replacement
  );

}


/*
 * Linking / Dimensions belong to react-native,
 * NOT react.
 */
home =
  rewriteNamedImport(
    home,
    "react",
    [
      "Linking",
      "Dimensions",
    ],
    []
  );


home =
  rewriteNamedImport(
    home,
    "react-native",
    [],
    [
      "Linking",
      "Dimensions",
    ]
  );


fs.writeFileSync(
  homePath,
  home,
  "utf8"
);



/* ==========================================================
   ADMIN BUTTON FIX
========================================================== */

const adminPath =
  "./src/app/admin/home-reminder.tsx";

let admin =
  fs.readFileSync(
    adminPath,
    "utf8"
  );


/*
 * Current shared Button component supports:
 * title / onPress / outline
 *
 * It does NOT support disabled.
 */
admin =
  admin.replace(
    /\s+disabled=\{\s*saving\s*\}/g,
    ""
  );


/*
 * Prevent double save even without a disabled prop.
 */
if (
  !admin.includes(
    "HOME_REMINDER_SAVE_GUARD_V1"
  )
) {

  const saveAnchor =
`  const save =
    async () => {`;


  if (
    !admin.includes(
      saveAnchor
    )
  ) {
    throw new Error(
      "Admin reminder save() anchor not found."
    );
  }


  admin =
    admin.replace(
      saveAnchor,
`${saveAnchor}

      /* HOME_REMINDER_SAVE_GUARD_V1 */

      if (saving) {
        return;
      }`
    );

}


fs.writeFileSync(
  adminPath,
  admin,
  "utf8"
);


console.log(
  "HOME NEWS TYPESCRIPT FIX APPLIED"
);
