const fs = require("fs");

const configPath =
  "./app.config.js";

const biblePath =
  "./src/app/bible/read.tsx";

const layoutPath =
  "./src/app/_layout.tsx";


function fail(message) {
  console.error("");
  console.error(
    "MY BIBLE ROTATION PATCH STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


/* ============================================================
   A. APP CONFIG
   ============================================================ */

let config =
  fs.readFileSync(
    configPath,
    "utf8"
  );


/*
 * Native binary must allow both
 * portrait and landscape.
 */
if (
  /orientation:\s*['"](portrait|landscape|default)['"]/
    .test(config)
) {

  config =
    config.replace(
      /orientation:\s*['"](portrait|landscape|default)['"]/,
      "orientation: 'default'"
    );

}
else {

  const versionPattern =
    /(version:\s*['"][^'"]+['"],)/;


  if (
    !versionPattern.test(config)
  ) {
    fail(
      "Could not locate app version anchor in app.config.js."
    );
  }


  config =
    config.replace(
      versionPattern,
      "$1\n\n    orientation: 'default',"
    );

}


/*
 * Add Screen Orientation config plugin.
 */
if (
  !config.includes(
    "expo-screen-orientation"
  )
) {

  const pluginAnchor =
    "'expo-router',";


  if (
    !config.includes(
      pluginAnchor
    )
  ) {
    fail(
      "expo-router plugin anchor not found."
    );
  }


  config =
    config.replace(
      pluginAnchor,
`'expo-router',

      [
        'expo-screen-orientation',
        {
          initialOrientation:
            'DEFAULT',
        },
      ],`
    );

}


fs.writeFileSync(
  configPath,
  config,
  "utf8"
);


/* ============================================================
   B. BIBLE READING SCREEN
   ============================================================ */

let bible =
  fs.readFileSync(
    biblePath,
    "utf8"
  );


if (
  !bible.includes(
    "expo-screen-orientation"
  )
) {

  const routerPattern =
    /(import\s*\{[\s\S]*?\}\s*from\s*'expo-router';)/;


  if (
    !routerPattern.test(
      bible
    )
  ) {
    fail(
      "Bible expo-router import anchor not found."
    );
  }


  bible =
    bible.replace(
      routerPattern,
`$1

import * as ScreenOrientation
  from 'expo-screen-orientation';`
    );

}


/*
 * Insert orientation hook inside the
 * existing Bible component using the
 * current showBooks state as anchor.
 */
if (
  !bible.includes(
    "MY_BIBLE_NATIVE_ROTATION_V1"
  )
) {

  const stateAnchor =
`  const [showBooks, setShowBooks] =
    useState(false);`;


  if (
    !bible.includes(
      stateAnchor
    )
  ) {
    fail(
      "Bible showBooks state anchor not found."
    );
  }


  bible =
    bible.replace(
      stateAnchor,
`${stateAnchor}


  /* MY_BIBLE_NATIVE_ROTATION_V1 */
  useEffect(
    () => {

      /*
       * While Bible Reading is open,
       * allow the device to rotate
       * naturally between portrait
       * and landscape.
       */
      void ScreenOrientation
        .unlockAsync();


      return () => {

        /*
         * Return normal BUKLOD screens
         * to upright portrait after
         * leaving Bible Reading.
         */
        void ScreenOrientation
          .lockAsync(
            ScreenOrientation
              .OrientationLock
              .PORTRAIT_UP
          );

      };

    },
    []
  );`
    );

}


fs.writeFileSync(
  biblePath,
  bible,
  "utf8"
);


/* ============================================================
   C. EXPO ROUTER SCREEN OPTION
   ============================================================ */

let layout =
  fs.readFileSync(
    layoutPath,
    "utf8"
  );


if (
  !layout.includes(
    'name="bible/read"'
  )
) {

  const indexAnchor =
    '<Stack.Screen name="bible/index" />';


  if (
    !layout.includes(
      indexAnchor
    )
  ) {
    fail(
      "bible/index Stack.Screen anchor not found."
    );
  }


  layout =
    layout.replace(
      indexAnchor,
`${indexAnchor}

                {/* MY_BIBLE_NATIVE_ROTATION_ROUTE */}
                <Stack.Screen
                  name="bible/read"
                  options={{
                    orientation:
                      'default',
                  }}
                />`
    );

}
else {

  /*
   * If bible/read already exists,
   * don't duplicate it.
   */
  console.log(
    "bible/read route already exists."
  );

}


fs.writeFileSync(
  layoutPath,
  layout,
  "utf8"
);


console.log("");
console.log(
  "APP ORIENTATION = DEFAULT"
);

console.log(
  "SCREEN ORIENTATION PLUGIN INSTALLED IN CONFIG"
);

console.log(
  "BIBLE READING NATIVE ROTATION INSTALLED"
);

console.log(
  "BIBLE READ ROUTE ALLOWS DEFAULT ORIENTATION"
);
