const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


const startMarker =
  "PATCH_153H_4C_COMPLETION_ACTION";

const endMarker =
  "PATCH_153H_5B_ATTRIBUTION";


const markerIndex =
  src.lastIndexOf(
    startMarker
  );


if (markerIndex < 0) {
  console.error(
    "Old Daily completion marker not found."
  );
  process.exit(1);
}


/*
 * Find beginning of the JSX comment
 * containing the old completion marker.
 */
const start =
  src.lastIndexOf(
    "{/*",
    markerIndex
  );


if (start < 0) {
  console.error(
    "Old Daily completion comment start not found."
  );
  process.exit(1);
}


const nextMarkerIndex =
  src.indexOf(
    endMarker,
    markerIndex
  );


if (nextMarkerIndex < 0) {
  console.error(
    "Attribution boundary not found."
  );
  process.exit(1);
}


/*
 * Preserve the attribution section.
 */
const end =
  src.lastIndexOf(
    "{/*",
    nextMarkerIndex
  );


if (
  end < 0 ||
  end <= start
) {
  console.error(
    "Could not determine old Daily block boundary."
  );
  process.exit(1);
}


const removed =
  src.slice(
    start,
    end
  );


if (
  !removed.includes(
    "source === 'daily_plan'"
  )
) {
  console.error(
    "Safety check failed: target block is not Daily Plan."
  );
  process.exit(1);
}


src =
  src.slice(
    0,
    start
  ) +
`
      {/* OLD DAILY COMPLETION UI REMOVED.
          DAILY_DEVOTION_FOCUSED_READING_V1
          now owns NEXT READING -> RESPOND. */}

` +
  src.slice(
    end
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "OLD DAILY PLAN COMPLETION BLOCK REMOVED"
);
