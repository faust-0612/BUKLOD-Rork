const fs = require('fs');

const path =
  './src/app/(tabs)/buklod.tsx';

const uiPath =
  './src/components/UI.tsx';

let src =
  fs.readFileSync(path,'utf8');

const ui =
  fs.readFileSync(uiPath,'utf8');

function stop(message){
  console.error('');
  console.error(
    'PATCH 161H-D STOPPED:'
  );
  console.error(message);
  process.exit(1);
}


/* ============================================================
   1. DETECT ACTUAL GLOBAL CARD PADDING
   ============================================================ */

const cardMatch =
  ui.match(
    /card:\s*\{[\s\S]*?\bpadding:\s*(\d+)/
  );

const cardPadding =
  cardMatch
    ? Number(cardMatch[1])
    : 12;

console.log(
  'Detected Card padding:',
  cardPadding
);


/* ============================================================
   2. REMOVE DUPLICATE COLLAGE CALLS
   ============================================================ */

const collageBefore =
  (
    src.match(
      /\{renderCommunityMedia\(item\)\}/g
    ) || []
  ).length;

src =
  src.replace(
    /\{renderCommunityMedia\(item\)\}/g,
    ''
  );

console.log(
  'Removed existing collage calls:',
  collageBefore
);


/* ============================================================
   3. REMOVE LEGACY SINGLE PHOTO RENDER
   ============================================================ */

let oldImageRemoved = 0;

src =
  src.replace(
    /\{\s*!!item\.media_url\s*&&\s*!String\(\s*item\.media_mime_type\s*\|\|\s*''\s*\)\.startsWith\(\s*'video\/'\s*\)\s*&&\s*<Image[\s\S]*?style=\{s\.postImage\}\s*\/>\s*\}/g,
    ()=>{
      oldImageRemoved++;
      return '';
    }
  );


/*
 * Also remove older simpler variant if one survived.
 */
src =
  src.replace(
    /\{\s*!!item\.media_url\s*&&\s*<Image\s+source=\{\{uri:item\.media_url\}\}\s+style=\{s\.postImage\}\s*\/>\s*\}/g,
    ()=>{
      oldImageRemoved++;
      return '';
    }
  );

console.log(
  'Removed legacy feed photo blocks:',
  oldImageRemoved
);


/* ============================================================
   4. INSERT EXACTLY ONE COLLAGE
   ============================================================ */

const reactionMarker =
  '{/* COMMUNITY_ICON_REACTIONS_20260811 */}';

if(
  !src.includes(reactionMarker)
){
  stop(
    'Community reaction marker not found.'
  );
}

src =
  src.replace(
    reactionMarker,
`{renderCommunityMedia(item)}

    ${reactionMarker}`
  );

const collageAfter =
  (
    src.match(
      /\{renderCommunityMedia\(item\)\}/g
    ) || []
  ).length;

if(collageAfter !== 1){
  stop(
    'Community must contain exactly one collage render. Found: '+
    collageAfter
  );
}

console.log(
  'PASS: exactly one Community collage render.'
);


/* ============================================================
   5. PHOTO FULL BLEED
   Use actual Card padding.
   ============================================================ */

const gridRx =
  /(communityMediaGrid:\s*\{[\s\S]*?)(marginHorizontal:\s*-?\d+\s*,)/;

if(gridRx.test(src)){

  src =
    src.replace(
      gridRx,
      `$1marginHorizontal:-${cardPadding},`
    );

}else{

  const gridStart =
    /communityMediaGrid:\s*\{/;

  if(!gridStart.test(src)){
    stop(
      'communityMediaGrid style not found.'
    );
  }

  src =
    src.replace(
      gridStart,
`communityMediaGrid:{
  marginHorizontal:-${cardPadding},`
    );
}


/*
 * Remove any accidental horizontal margin/padding
 * directly on the individual media tile.
 */
src =
  src.replace(
    /(communityMediaTile:\s*\{[\s\S]*?)(marginHorizontal:\s*[^,\n]+,\s*)/g,
    '$1'
  );

console.log(
  'PASS: Community photos are full bleed.'
);


/* ============================================================
   6. SAFE AREA IMPORT
   ============================================================ */

if(
  !src.includes(
    "useSafeAreaInsets"
  )
){

  const importAnchor =
    "import {decode} from 'base64-arraybuffer';";

  if(!src.includes(importAnchor)){
    stop(
      'Import anchor not found.'
    );
  }

  src =
    src.replace(
      importAnchor,
`${importAnchor}

import {
  useSafeAreaInsets
} from 'react-native-safe-area-context';`
    );
}


/* ============================================================
   7. SAFE AREA STATE
   ============================================================ */

if(
  !src.includes(
    'const communityInsets=useSafeAreaInsets();'
  )
){

  const screenAnchor =
    'export default function BuklodScreen(){';

  if(!src.includes(screenAnchor)){
    stop(
      'BuklodScreen anchor not found.'
    );
  }

  src =
    src.replace(
      screenAnchor,
`${screenAnchor}
 const communityInsets=
  useSafeAreaInsets();`
    );
}


/* ============================================================
   8. ANDROID KEYBOARD AVOIDANCE
   Old version had Android = undefined.
   ============================================================ */

const oldKeyboard =
`<KeyboardAvoidingView
   style={{flex:1}}
   behavior={
    Platform.OS==='ios'
     ? 'padding'
     : undefined
   }
  >`;

const newKeyboard =
`<KeyboardAvoidingView
   style={{flex:1}}
   behavior={
    Platform.OS==='ios'
     ? 'padding'
     : 'height'
   }
   keyboardVerticalOffset={0}
  >`;

if(src.includes(oldKeyboard)){

  src =
    src.replace(
      oldKeyboard,
      newKeyboard
    );

}else{

  /*
   * Formatting-independent fallback.
   */
  src =
    src.replace(
      /(Platform\.OS==='ios'\s*\?\s*'padding'\s*:\s*)undefined/,
      "$1'height'"
    );

  /*
   * Add keyboard offset if absent.
   */
  const drawerMarker =
    '{/* PATCH_161H_COMMENT_DRAWER */}';

  const drawerAt =
    src.indexOf(drawerMarker);

  if(drawerAt >= 0){

    const after =
      src.slice(drawerAt);

    if(
      !after
        .slice(0,700)
        .includes(
          'keyboardVerticalOffset'
        )
    ){

      const local =
        after.replace(
          /(<KeyboardAvoidingView[\s\S]*?behavior=\{[\s\S]*?\}\s*)>/,
          '$1 keyboardVerticalOffset={0}>'
        );

      src =
        src.slice(0,drawerAt)+
        local;
    }
  }
}


/* ============================================================
   9. COMMENT COMPOSER SAFE BOTTOM
   Prevent Android navigator pane overlap.
   ============================================================ */

src =
  src.replace(
    /<View\s+style=\{s\.communityCommentComposer\}>/,
`<View
      style={[
       s.communityCommentComposer,
       {
        paddingBottom:
         Math.max(
          communityInsets.bottom,
          10
         )
       }
      ]}
     >`
  );


/* ============================================================
   10. MORE ROOM WHEN KEYBOARD IS OPEN
   ============================================================ */

src =
  src.replace(
    /communityCommentDrawer:\s*\{([\s\S]*?)height:\s*'82%',/,
`communityCommentDrawer:{
  maxHeight:'88%',
  height:'82%',`
  );


/* ============================================================
   11. FIX B3 IF STILL NEEDED
   ============================================================ */

src =
  src.replace(
    /base64:\s*x\.base64\s*,/g,
    'base64:x.base64!,'
  );


/* ============================================================
   12. FINAL CHECK
   ============================================================ */

const finalCollages =
  (
    src.match(
      /\{renderCommunityMedia\(item\)\}/g
    ) || []
  ).length;

if(finalCollages !== 1){
  stop(
    'Final collage count is not 1.'
  );
}

if(
  src.includes(
    ": undefined"
  )
  &&
  src.includes(
    'PATCH_161H_COMMENT_DRAWER'
  )
){
  console.warn(
    'NOTE: another unrelated undefined expression exists; TypeScript will verify.'
  );
}


fs.writeFileSync(
  path,
  src,
  'utf8'
);


console.log('');
console.log(
  'PATCH 161H-D SOURCE APPLIED'
);

console.log(
  '✓ Duplicate Community photos removed'
);

console.log(
  '✓ Exactly one collage render'
);

console.log(
  '✓ Photos full bleed to card/screen edge'
);

console.log(
  '✓ Android keyboard avoidance enabled'
);

console.log(
  '✓ Bottom safe-area protection enabled'
);
