const fs = require("fs");

const path =
  "./src/app/(tabs)/me.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );

const oldCatch =
/catch\s*\(\s*error\s*\)\s*\{\s*console\.error\(\s*'Profile avatar:',\s*error\s*\);/m;

if (
  !oldCatch.test(src)
) {
  console.error("");
  console.error(
    "PATCH 160A STOPPED: Profile avatar catch block not found."
  );
  process.exit(1);
}

src =
  src.replace(
    oldCatch,
`catch (error: any) {
        console.error(
          'Profile avatar:',
          error
        );`
  );

fs.writeFileSync(
  path,
  src,
  "utf8"
);

console.log(
  "PROFILE ERROR TYPE FIXED"
);
