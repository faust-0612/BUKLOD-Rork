const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


const oldBlock =
`  /* MY_BIBLE_NATIVE_ROTATION_V1 */
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
  );`;


if (
  src.includes(oldBlock)
) {
  src =
    src.replace(
      oldBlock,
      ""
    );

  console.log(
    "OLD ROTATION V1 HOOK REMOVED"
  );
}
else {
  console.log(
    "OLD V1 HOOK NOT FOUND - NOTHING REMOVED"
  );
}


fs.writeFileSync(
  path,
  src,
  "utf8"
);
