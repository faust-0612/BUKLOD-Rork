const fs = require("fs");

const biblePath  = "./src/app/bible/read.tsx";
const layoutPath = "./src/app/_layout.tsx";
const configPath = "./app.config.js";

let bible  = fs.readFileSync(biblePath, "utf8");
let layout = fs.readFileSync(layoutPath, "utf8");
let config = fs.readFileSync(configPath, "utf8");


/* APP MUST SUPPORT ROTATION */

config = config.replace(
  /orientation:\s*['"](?:portrait|landscape|default)['"]/,
  "orientation: 'default'"
);

if (!config.includes("expo-screen-orientation")) {
  config = config.replace(
    "'expo-router',",
    `'expo-router',

      [
        'expo-screen-orientation',
        {
          initialOrientation: 'DEFAULT',
        },
      ],`
  );
}


/* BIBLE READ ROUTE */

if (!layout.includes('name="bible/read"')) {
  layout = layout.replace(
    '<Stack.Screen name="bible/index" />',
    `<Stack.Screen name="bible/index" />

                {/* MY_BIBLE_NATIVE_ROTATION_ROUTE */}
                <Stack.Screen
                  name="bible/read"
                  options={{
                    orientation: 'default',
                  }}
                />`
  );
}


/* NATIVE RUNTIME UNLOCK */

if (!bible.includes("expo-screen-orientation")) {
  const routerImport =
    /(import[\s\S]*?from\s+['"]expo-router['"];)/;

  if (!routerImport.test(bible)) {
    throw new Error(
      "Bible expo-router import not found."
    );
  }

  bible = bible.replace(
    routerImport,
    `$1

import * as ScreenOrientation
  from 'expo-screen-orientation';`
  );
}


if (
  !bible.includes(
    "MY_BIBLE_NATIVE_ROTATION_V2"
  )
) {
  const anchor =
`  const [showBooks, setShowBooks] =
    useState(false);`;

  if (!bible.includes(anchor)) {
    throw new Error(
      "Bible showBooks anchor not found."
    );
  }

  bible = bible.replace(
    anchor,
`${anchor}

  /* MY_BIBLE_NATIVE_ROTATION_V2 */
  useEffect(() => {

    void ScreenOrientation.unlockAsync();

    return () => {
      void ScreenOrientation.lockAsync(
        ScreenOrientation
          .OrientationLock
          .PORTRAIT_UP
      );
    };

  }, []);`
  );
}


fs.writeFileSync(configPath, config, "utf8");
fs.writeFileSync(layoutPath, layout, "utf8");
fs.writeFileSync(biblePath, bible, "utf8");

console.log("MY BIBLE NATIVE ROTATION PATCHED");
