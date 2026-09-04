const fs = require('fs');

const renderer = 'src/components/points/BuklodCharacterLayeredArt.tsx';
const sheet = 'src/components/points/BuklodCharacterCustomizeSheet.tsx';

function mustReplace(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) {
    throw new Error(`R25C anchor missing: ${label}`);
  }
  return text.replace(from, to);
}

let r = fs.readFileSync(renderer, 'utf8');
if (!r.includes('BUKLOD_CHARACTER_R25C_CONTAINMENT')) {
  r = r.replace(
    '/* BUKLOD_CHARACTER_R25_PROPORTION_SAFE_LAYERING */',
    '/* BUKLOD_CHARACTER_R25_PROPORTION_SAFE_LAYERING */\n/* BUKLOD_CHARACTER_R25C_CONTAINMENT */',
  );
}
r = mustReplace(
  r,
  "  art: {\n    zIndex: 3,\n    position: 'relative',\n    overflow: 'visible',\n  },",
  "  art: {\n    zIndex: 3,\n    position: 'relative',\n    overflow: 'hidden',\n  },",
  'renderer art clipping',
);
r = mustReplace(
  r,
  "  fallback: {\n    alignItems: 'center',\n    justifyContent: 'center',\n    overflow: 'visible',\n  },",
  "  fallback: {\n    alignItems: 'center',\n    justifyContent: 'center',\n    overflow: 'hidden',\n  },",
  'fallback clipping',
);
fs.writeFileSync(renderer, r);

let s = fs.readFileSync(sheet, 'utf8');
if (!s.includes('BUKLOD_CHARACTER_R25C_CONTAINMENT')) {
  s = s.replace(
    '/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */',
    '/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */\n/* BUKLOD_CHARACTER_R25C_CONTAINMENT */',
  );
}
s = mustReplace(
  s,
  "      heroRow: {\n        marginTop: 12,\n        marginHorizontal:\n          14,\n        minHeight: 182,",
  "      heroRow: {\n        marginTop: 12,\n        marginHorizontal:\n          14,\n        minHeight: 188,",
  'hero height',
);
s = mustReplace(
  s,
  "        backgroundColor:\n          withAlpha(\n            theme.accentSoft,\n            0.34,\n          ),\n      },\n\n      heroArt: {\n        width: 118,\n        height: 166,\n        alignItems: 'center',\n        justifyContent:\n          'flex-end',\n        overflow: 'visible',\n      },",
  "        backgroundColor:\n          withAlpha(\n            theme.accentSoft,\n            0.34,\n          ),\n        overflow: 'hidden',\n      },\n\n      heroArt: {\n        width: 128,\n        height: 170,\n        flexShrink: 0,\n        alignItems: 'center',\n        justifyContent:\n          'flex-end',\n        overflow: 'hidden',\n        borderRadius: 18,\n      },",
  'hero containment',
);
s = mustReplace(
  s,
  '                  height={160}',
  '                  height={154}',
  'hero preview scale',
);
fs.writeFileSync(sheet, s);

console.log('BUKLOD_CHARACTER_R25C_CONTAINMENT_APPLIED=1');
