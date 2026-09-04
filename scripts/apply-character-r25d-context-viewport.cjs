const fs = require('fs');

const renderer = 'src/components/points/BuklodCharacterLayeredArt.tsx';
const profile = 'src/components/points/BuklodProfileCharacterCard.tsx';
const thumb = 'src/components/points/BuklodCharacterItemThumb.tsx';

function mustReplace(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) {
    throw new Error(`R25D anchor missing: ${label}`);
  }
  return text.replace(from, to);
}

function addMarker(text, anchor, marker) {
  if (text.includes(marker)) return text;
  if (!text.includes(anchor)) {
    throw new Error(`R25D marker anchor missing: ${marker}`);
  }
  return text.replace(anchor, `${anchor}\n${marker}`);
}

let r = fs.readFileSync(renderer, 'utf8');
r = addMarker(
  r,
  '/* BUKLOD_CHARACTER_R25C_CONTAINMENT */',
  '/* BUKLOD_CHARACTER_R25D_CONTEXT_VIEWPORT */',
);
r = mustReplace(
  r,
  "  height: number;\n  showStage?: boolean;",
  "  height: number;\n  viewportWidth?: number;\n  showStage?: boolean;",
  'renderer viewport prop',
);
r = mustReplace(
  r,
  "  height,\n  showStage = false,",
  "  height,\n  viewportWidth,\n  showStage = false,",
  'renderer viewport destructure',
);
r = mustReplace(
  r,
  "  const artWidth = Math.max(\n    1,\n    Math.round(height * aspect),\n  );",
  "  const artWidth = Math.max(\n    1,\n    Math.round(height * aspect),\n  );\n\n  // R25D: compact surfaces get a hard viewport without distorting the\n  // character. The full layered figure keeps its native proportions and is\n  // centered inside the context-specific frame.\n  const resolvedViewportWidth =\n    typeof viewportWidth === 'number' &&\n    Number.isFinite(viewportWidth) &&\n    viewportWidth > 0\n      ? Math.max(1, Math.round(viewportWidth))\n      : null;\n\n  const frameWidth =\n    resolvedViewportWidth ??\n    (showStage\n      ? Math.max(116, artWidth * 2.25)\n      : artWidth);",
  'renderer frame width',
);
r = mustReplace(
  r,
  "          { width: artWidth, height },",
  "          { width: frameWidth, height },",
  'fallback viewport width',
);
r = mustReplace(
  r,
  "          width: showStage\n            ? Math.max(116, artWidth * 2.25)\n            : artWidth,\n          height,",
  "          width: frameWidth,\n          height,\n          overflow: resolvedViewportWidth\n            ? 'hidden'\n            : 'visible',",
  'outer viewport width',
);
fs.writeFileSync(renderer, r);

let p = fs.readFileSync(profile, 'utf8');
p = addMarker(
  p,
  '/* BUKLOD_PROFILE_POINTS_CLAIM_R1 */',
  '/* BUKLOD_CHARACTER_R25D_PROFILE_VIEWPORT */',
);
p = mustReplace(
  p,
  "      artPress: {\n        width: 82,\n        height: 130,\n        alignItems: 'center',\n        justifyContent:\n          'flex-end',\n        overflow: 'visible',\n      },",
  "      artPress: {\n        width: 82,\n        height: 130,\n        flexShrink: 0,\n        alignItems: 'center',\n        justifyContent:\n          'flex-end',\n        overflow: 'hidden',\n        borderRadius: 14,\n      },",
  'profile portrait frame',
);
p = mustReplace(
  p,
  "                  height={124}\n                  showStage={\n                    false\n                  }\n                  showEffects",
  "                  height={124}\n                  viewportWidth={82}\n                  showStage={\n                    false\n                  }\n                  showEffects={false}",
  'profile renderer contract',
);
fs.writeFileSync(profile, p);

let t = fs.readFileSync(thumb, 'utf8');
t = addMarker(
  t,
  '/* BUKLOD_CHARACTER_R25B_DEPLOY_TRIGGER */',
  '/* BUKLOD_CHARACTER_R25D_THUMB_VIEWPORT */',
);
t = mustReplace(
  t,
  "            height={Math.round(size * 1.16)}\n            showStage={false}",
  "            height={Math.round(size * 1.16)}\n            viewportWidth={Math.max(44, Math.round(size * 0.92))}\n            showStage={false}",
  'thumbnail renderer contract',
);
fs.writeFileSync(thumb, t);

console.log('BUKLOD_CHARACTER_R25D_CONTEXT_VIEWPORT_APPLIED=1');
