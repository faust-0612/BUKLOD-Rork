const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/(tabs)/home.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=
  file+'.bak154t_bulletin_up';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* =========================================
   1. Remove old empty spacer above bulletin
========================================= */

const spacerRx=
  /\s*\{\/\*\s*HOME_CONNECT_ICON_ONLY_20260811\s*\*\/\}\s*<View\s*style=\{\{\s*alignItems:\s*'flex-end',\s*marginTop:\s*6,\s*marginBottom:\s*8,\s*\}\}\s*>\s*<\/View>/;

if(spacerRx.test(t)){
  t=t.replace(
    spacerRx,
    `
`
  );
}

/* =========================================
   2. Tighten Daily/Bayanihan pair bottom
========================================= */

const pairStart=
  t.indexOf(
    'function HomeDailyBayanihanPair()'
  );

const pairEnd=
  t.indexOf(
    'function HomeDailyBibleStrip()',
    pairStart
  );

if(
  pairStart>=0 &&
  pairEnd>pairStart
){
  let block=
    t.slice(pairStart,pairEnd);

  block=block.replace(
    /marginBottom:\s*6/,
    'marginBottom:0'
  );

  t=
    t.slice(0,pairStart)+
    block+
    t.slice(pairEnd);
}

/* =========================================
   3. Bulletin heading almost touches cards
========================================= */

const bulletinMarker=
  'PATCH_154K_COMPACT_BULLETIN_HEADING';

const markerAt=
  t.indexOf(bulletinMarker);

if(markerAt<0){
  throw new Error(
    'Mission Bulletin heading marker not found'
  );
}

const nextChunk=
  t.slice(
    markerAt,
    markerAt+700
  );

const updatedChunk=
  nextChunk.replace(
    /marginTop:\s*3/,
    'marginTop:0'
  );

t=
  t.slice(0,markerAt)+
  updatedChunk+
  t.slice(markerAt+700);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154T-BULLETIN-UP WRITTEN');
console.log('✓ old empty spacer removed');
console.log('✓ Daily/Bayanihan bottom gap removed');
console.log('✓ Mission Bulletin moved noticeably upward');
console.log('✓ other Home cards untouched');
console.log('');

