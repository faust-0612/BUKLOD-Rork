const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );

function stop(message) {
  console.error("");
  console.error(
    "PATCH 159A STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


/* ============================================================
   1. ADD DIMENSIONS IMPORT
   ============================================================ */

if (
  !src.match(
    /\bDimensions\b/
  )
) {
  src =
    src.replace(
      /import\s*\{\s*([\s\S]*?)\}\s*from\s*['"]react-native['"];/,
      (full, inside) => {
        return `import {\n  Dimensions,\n${inside.trim()}\n} from 'react-native';`;
      }
    );
}


/* ============================================================
   2. SMART LONG PRESS
   Save whether menu should appear ABOVE the tapped message.
   ============================================================ */

const oldLongPress =
/onLongPress=\{\s*m\.is_deleted\s*\?\s*undefined\s*:\s*\(\)\s*=>\s*\{\s*setSelected\(\s*m\s*\);\s*setActionOpen\(\s*true\s*\);\s*\}\s*\}/m;

if (
  !oldLongPress.test(src)
) {
  stop(
    "Current message onLongPress block was not found."
  );
}

src =
  src.replace(
    oldLongPress,
`onLongPress={
                  m.is_deleted
                    ? undefined
                    : (event) => {
                        const screenHeight =
                          Dimensions
                            .get('window')
                            .height;

                        const pressY =
                          event
                            .nativeEvent
                            .pageY;

                        /*
                         * Lower 45% of screen:
                         * show options ABOVE message.
                         *
                         * Upper area:
                         * show options BELOW message.
                         */
                        const menuAbove =
                          pressY >
                          screenHeight * 0.55;

                        setSelected({
                          ...m,
                          __menuAbove:
                            menuAbove,
                        });

                        setActionOpen(
                          true
                        );
                      }
                }`
  );


/* ============================================================
   3. MAKE INLINE OPTIONS POSITION ADAPTIVE
   ============================================================ */

const oldPosition =
/top:\s*['"]100%['"],\s*left:\s*m\.is_mine\s*\?\s*undefined\s*:\s*0,\s*right:\s*m\.is_mine\s*\?\s*0\s*:\s*undefined,\s*marginTop:\s*5,/m;

if (
  !oldPosition.test(src)
) {
  stop(
    "Inline MESSAGE OPTIONS position block was not found."
  );
}

src =
  src.replace(
    oldPosition,
`top:
                        selected?.__menuAbove
                          ? undefined
                          : '100%',

                      bottom:
                        selected?.__menuAbove
                          ? '100%'
                          : undefined,

                      left:
                        m.is_mine
                          ? undefined
                          : 0,

                      right:
                        m.is_mine
                          ? 0
                          : undefined,

                      marginTop:
                        selected?.__menuAbove
                          ? 0
                          : 5,

                      marginBottom:
                        selected?.__menuAbove
                          ? 5
                          : 0,`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);

console.log("");
console.log(
  "PATCH 159A SMART OPTIONS APPLIED"
);
