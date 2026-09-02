const fs = require("fs");
const path = require("path");

const root = "./src";

function walk(dir) {
  let out = [];

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      out = out.concat(walk(full));
      continue;
    }

    if (
      full.endsWith(".ts") ||
      full.endsWith(".tsx")
    ) {
      out.push(full);
    }
  }

  return out;
}

function stop(message) {
  console.error("");
  console.error("CALL FIX STOPPED:");
  console.error(message);
  process.exit(1);
}

const allFiles = walk(root);

const candidates =
  allFiles.filter(file => {
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
        "settings_override"
      ) &&
      src.includes(
        "camera_default_on"
      )
    );
  });

console.log("");
console.log("CALL SOURCE CANDIDATES:");

for (const file of candidates) {
  console.log(" - " + file);
}

if (!candidates.length) {
  stop(
    "Could not locate BUKLOD Stream call creation source."
  );
}

let totalPatched = 0;

for (const file of candidates) {
  let src =
    fs.readFileSync(
      file,
      "utf8"
    );

  /*
   * Don't duplicate if already fixed.
   */
  if (
    src.includes(
      "PATCH_CALL_TARGET_RESOLUTION"
    )
  ) {
    console.log(
      "Already patched: " +
      file
    );

    continue;
  }

  const original = src;

  /*
   * Add a valid Stream target resolution
   * beside camera_default_on.
   */
  src =
    src.replace(
      /camera_default_on\s*:\s*([^,\r\n}]+)\s*,?/g,
      (
        full,
        expression
      ) => {
        totalPatched++;

        return `camera_default_on: ${expression.trim()},
            /* PATCH_CALL_TARGET_RESOLUTION */
            target_resolution: {
              width: 1280,
              height: 720,
              bitrate: 1500000,
            },`;
      }
    );

  if (src === original) {
    stop(
      "Found call source but camera_default_on could not be patched: " +
      file
    );
  }

  fs.copyFileSync(
    file,
    file +
      ".before-call-resolution-fix"
  );

  fs.writeFileSync(
    file,
    src,
    "utf8"
  );

  console.log(
    "PATCHED: " +
    file
  );
}

if (
  totalPatched === 0 &&
  !candidates.every(
    file =>
      fs.readFileSync(
        file,
        "utf8"
      ).includes(
        "PATCH_CALL_TARGET_RESOLUTION"
      )
  )
) {
  stop(
    "No call resolution setting was patched."
  );
}

console.log("");
console.log(
  "STREAM TARGET RESOLUTION FIX APPLIED"
);
