const fs = require("fs");
const path = require("path");

function walk(dir) {
  let result = [];

  for (
    const name of
    fs.readdirSync(dir)
  ) {
    const full =
      path.join(
        dir,
        name
      );

    const stat =
      fs.statSync(
        full
      );

    if (
      stat.isDirectory()
    ) {
      result =
        result.concat(
          walk(full)
        );
    }
    else if (
      full.endsWith(".ts") ||
      full.endsWith(".tsx")
    ) {
      result.push(
        full
      );
    }
  }

  return result;
}


function stop(message) {
  console.error("");
  console.error(
    "CALL FIX 4 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


const files =
  walk("./src");


const candidates =
  files.filter(
    file => {
      const src =
        fs.readFileSync(
          file,
          "utf8"
        );

      return (
        src.includes(
          "buklod_call_mode"
        ) &&
        src.includes(
          "camera_default_on"
        ) &&
        src.includes(
          "settings_override"
        )
      );
    }
  );


if (
  candidates.length === 0
) {
  stop(
    "BUKLOD call creation source not found."
  );
}


console.log("");
console.log(
  "CALL SOURCES:"
);


for (
  const file of candidates
) {
  console.log(
    " - " + file
  );


  let src =
    fs.readFileSync(
      file,
      "utf8"
    );


  fs.copyFileSync(
    file,
    file +
      ".before-call-fix4"
  );


  /*
   * Previous fix may have:
   *
   * enabled: mode === 'video'
   *
   * That blocks upgrading a voice
   * call to video.
   *
   * Keep camera_default_on dynamic,
   * but capability enabled always.
   */

  const enabledRe =
    /enabled\s*:\s*([^,\r\n}]+)\s*,\s*(camera_default_on\s*:)/g;


  if (
    enabledRe.test(src)
  ) {
    enabledRe.lastIndex = 0;

    src =
      src.replace(
        enabledRe,
`enabled: true,
            $2`
      );
  }
  else {
    /*
     * If enabled has not yet been
     * added, insert it before
     * camera_default_on.
     */
    const cameraRe =
      /(camera_default_on\s*:)/g;

    if (
      !cameraRe.test(src)
    ) {
      stop(
        "camera_default_on not found in " +
        file
      );
    }

    cameraRe.lastIndex = 0;

    src =
      src.replace(
        cameraRe,
`enabled: true,
            $1`
      );
  }


  fs.writeFileSync(
    file,
    src,
    "utf8"
  );


  console.log(
    "VIDEO UPGRADE ENABLED: " +
    file
  );
}


console.log("");
console.log(
  "VOICE <-> VIDEO CAPABILITY READY"
);
