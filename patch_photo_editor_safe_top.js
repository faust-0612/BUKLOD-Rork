const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "PHOTO_EDITOR_SAFE_TOP_FIX"
  )
) {
  console.log(
    "Photo editor safe top fix already applied."
  );

  process.exit(0);
}


/* ============================================================
   1. SAFE AREA INSIDE PHOTO EDITOR
   ============================================================ */

const hookAnchor =
`function PhotoMarkupEditor({
  visible,
  photo,
  onCancel,
  onDone,
}: {`;


if (
  !src.includes(
    hookAnchor
  )
) {
  console.error(
    "PhotoMarkupEditor anchor not found."
  );

  process.exit(1);
}


/*
 * Add safe area after component props block,
 * immediately before canvasRef.
 */
const canvasAnchor =
`  const canvasRef =
    useCanvasRef();`;


if (
  !src.includes(
    canvasAnchor
  )
) {
  console.error(
    "Photo editor canvasRef anchor not found."
  );

  process.exit(1);
}


src =
  src.replace(
    canvasAnchor,
`  /* PHOTO_EDITOR_SAFE_TOP_FIX */
  const editorInsets =
    useSafeAreaInsets();


  const canvasRef =
    useCanvasRef();`
  );


/* ============================================================
   2. DYNAMIC SAFE HEADER
   ============================================================ */

const headerAnchor =
`        <View
          style={
            photoEditorStyles.header
          }
        >`;


if (
  !src.includes(
    headerAnchor
  )
) {
  console.error(
    "Photo editor header anchor not found."
  );

  process.exit(1);
}


src =
  src.replace(
    headerAnchor,
`        <View
          style={[
            photoEditorStyles.header,
            {
              paddingTop:
                Math.max(
                  editorInsets.top + 8,
                  18
                ),

              minHeight:
                62 +
                Math.max(
                  editorInsets.top,
                  18
                ),
            },
          ]}
        >`
  );


/* ============================================================
   3. REMOVE OLD FIXED HEADER SAFE VALUES
   ============================================================ */

src =
  src.replace(
`      paddingTop:
        Platform.OS ===
          'android'
          ? 18
          : 48,

      minHeight:
        Platform.OS ===
          'android'
          ? 68
          : 96,

`,
``
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "PHOTO EDITOR SAFE TOP INSTALLED"
);

console.log(
  "DONE BUTTON WILL RESPECT STATUS BAR / NOTCH"
);
