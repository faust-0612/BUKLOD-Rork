const fs = require("fs");
const path = require("path");

function walk(dir) {
  let files = [];

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      files = files.concat(walk(full));
    }
    else if (
      full.endsWith(".ts") ||
      full.endsWith(".tsx")
    ) {
      files.push(full);
    }
  }

  return files;
}

function stop(message) {
  console.error("");
  console.error(
    "CALL FIX 2 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}

const candidates =
  walk("./src").filter(file => {
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
      )
    );
  });

if (!candidates.length) {
  stop(
    "BUKLOD call source was not found."
  );
}

console.log("");
console.log("CALL SOURCE:");

for (const file of candidates) {
  console.log(" - " + file);
}

let patched = 0;

for (const file of candidates) {

  let src =
    fs.readFileSync(
      file,
      "utf8"
    );

  if (
    src.includes(
      "PATCH_CALL_VIDEO_ENABLED"
    )
  ) {
    console.log(
      "Already patched: " +
      file
    );
    continue;
  }

  /*
   * Capture the SAME expression used
   * by camera_default_on.
   *
   * Example:
   *
   * camera_default_on:
   *   mode === 'video',
   *
   * becomes:
   *
   * enabled:
   *   mode === 'video',
   * camera_default_on:
   *   mode === 'video',
   */
  const re =
    /camera_default_on\s*:\s*([^,\r\n}]+)\s*,/g;

  let matches = 0;

  src =
    src.replace(
      re,
      (
        full,
        expression
      ) => {
        matches++;

        const expr =
          expression.trim();

        return `/* PATCH_CALL_VIDEO_ENABLED */
            enabled: ${expr},
            camera_default_on: ${expr},`;
      }
    );

  if (!matches) {
    stop(
      "camera_default_on expression not found in " +
      file
    );
  }

  fs.copyFileSync(
    file,
    file +
      ".before-call-video-enabled"
  );

  fs.writeFileSync(
    file,
    src,
    "utf8"
  );

  patched += matches;

  console.log(
    "PATCHED: " +
    file
  );
}

if (!patched) {
  console.log(
    "Video enabled patch already exists."
  );
}
else {
  console.log(
    "VIDEO ENABLED SETTINGS ADDED: " +
    patched
  );
}

console.log("");
console.log(
  "CALL FIX 2 APPLIED"
);
