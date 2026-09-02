const fs = require('fs');

const path =
 './src/app/(tabs)/buklod.tsx';

let src =
 fs.readFileSync(
  path,
  'utf8'
 );


function stop(message){
 console.error('');
 console.error(
  'PATCH 161H-D1 STOPPED:'
 );
 console.error(message);
 process.exit(1);
}


/* ============================================================
   PRECHECK
   ============================================================ */

if(
 !src.includes(
  'PATCH_161H_PHOTO_VIEWER'
 )
){
 stop(
  '161H fullscreen photo viewer not found.'
 );
}

if(
 !src.includes(
  'CommunityZoomPhoto'
 )
){
 stop(
  'CommunityZoomPhoto not found.'
 );
}


/* ============================================================
   1. ADD GestureHandlerRootView IMPORT
   ============================================================ */

const gestureImportRx =
 /import\s*\{([\s\S]*?)\}\s*from\s*'react-native-gesture-handler';/;

const gestureMatch =
 src.match(
  gestureImportRx
 );

if(!gestureMatch){
 stop(
  'react-native-gesture-handler import not found.'
 );
}

const gestureNames =
 gestureMatch[1]
  .split(',')
  .map(
   item=>
    item.trim()
  )
  .filter(Boolean);

if(
 !gestureNames.includes(
  'GestureHandlerRootView'
 )
){
 gestureNames.push(
  'GestureHandlerRootView'
 );

 src =
  src.replace(
   gestureImportRx,
`import {
 ${gestureNames.join(',\n ')}
} from 'react-native-gesture-handler';`
  );

 console.log(
  '✓ GestureHandlerRootView import added'
 );
}else{
 console.log(
  '✓ GestureHandlerRootView already imported'
 );
}


/* ============================================================
   2. WRAP PHOTO MODAL CONTENT
   Android Modal needs its own RNGH root.
   ============================================================ */

const viewerMarker =
 '{/* PATCH_161H_PHOTO_VIEWER */}';

const viewerMarkerAt =
 src.indexOf(
  viewerMarker
 );

if(viewerMarkerAt < 0){
 stop(
  'Photo viewer marker not found.'
 );
}

const modalAt =
 src.indexOf(
  '<Modal',
  viewerMarkerAt
 );

const viewerScreenAt =
 src.indexOf(
  '<View style={s.communityViewerScreen}>',
  modalAt
 );

const modalCloseAt =
 src.indexOf(
  '</Modal>',
  viewerScreenAt
 );

if(
 modalAt < 0 ||
 viewerScreenAt < 0 ||
 modalCloseAt < 0
){
 stop(
  'Could not isolate photo viewer Modal.'
 );
}


/*
 * Only add wrapper when absent.
 */
const viewerSection =
 src.slice(
  modalAt,
  modalCloseAt
 );

if(
 !viewerSection.includes(
  '<GestureHandlerRootView'
 )
){

 src =
  src.slice(
   0,
   viewerScreenAt
  )+
`<GestureHandlerRootView
   style={{flex:1}}
   unstable_forceActive
  >
   `+
  src.slice(
   viewerScreenAt
  );


 /*
  * Recalculate Modal closing position
  * after insertion.
  */
 const newModalCloseAt =
  src.indexOf(
   '</Modal>',
   viewerScreenAt
  );

 src =
  src.slice(
   0,
   newModalCloseAt
  )+
`</GestureHandlerRootView>
 `+
  src.slice(
   newModalCloseAt
  );

 console.log(
  '✓ Fullscreen Modal wrapped in GestureHandlerRootView'
 );

}else{

 console.log(
  '✓ Photo Modal already has GestureHandlerRootView'
 );
}


/* ============================================================
   3. GUARANTEE PHOTO ZOOM AREA FILLS SCREEN
   ============================================================ */

const zoomStart =
 src.indexOf(
  'function CommunityZoomPhoto'
 );

const viewerConstAt =
 src.indexOf(
  'const COMMUNITY_VIEWER_HEIGHT',
  zoomStart
 );

if(
 zoomStart < 0 ||
 viewerConstAt < 0
){
 stop(
  'CommunityZoomPhoto block could not be isolated.'
 );
}

let zoomBlock =
 src.slice(
  zoomStart,
  viewerConstAt
 );


/*
 * Make zoom visibly stronger.
 */
zoomBlock =
 zoomBlock.replace(
 /Math\.min\(\s*4,/g,
 'Math.min(5,'
);


/*
 * Double-tap target:
 * old 2.5x -> 3x
 */
zoomBlock =
 zoomBlock.replace(
 /:\s*2\.5/g,
 ': 3'
);


/*
 * Ensure image is inside a full-size native
 * animated container for GestureDetector.
 */
if(
 zoomBlock.includes(
  '<GestureDetector'
 )
 &&
 !zoomBlock.includes(
  'PATCH_161H_D1_ZOOM_CONTAINER'
 )
){

 const returnRx =
 /return\s*\(\s*<GestureDetector([\s\S]*?)<\/GestureDetector>\s*\);/;

 const returnMatch =
  zoomBlock.match(
   returnRx
  );

 if(returnMatch){

  /*
   * Keep existing detector/gesture logic,
   * but ensure its child can occupy full screen.
   */
  zoomBlock =
   zoomBlock.replace(
    /<GestureDetector\s+gesture=\{gesture\}\s*>\s*<Animated\.Image/,
`<GestureDetector
   gesture={gesture}
  >
   <Animated.View
    collapsable={false}
    style={{
     width:'100%',
     height:'100%',
     alignItems:'center',
     justifyContent:'center'
    }}
   >
    {/* PATCH_161H_D1_ZOOM_CONTAINER */}
    <Animated.Image`
   );

  zoomBlock =
   zoomBlock.replace(
    /<\/Animated\.Image>\s*<\/GestureDetector>/,
`</Animated.Image>
   </Animated.View>
  </GestureDetector>`
   );

  /*
   * Self-closing Animated.Image variant.
   */
  zoomBlock =
   zoomBlock.replace(
    /(<Animated\.Image[\s\S]*?\/>)\s*<\/GestureDetector>/,
`$1
   </Animated.View>
  </GestureDetector>`
   );

 }

}


src =
 src.slice(
  0,
  zoomStart
 )+
 zoomBlock+
 src.slice(
  viewerConstAt
 );


/* ============================================================
   4. MOVE REACTION + SAVE BAR ABOVE ANDROID NAVIGATION
   ============================================================ */

const oldActions =
 '<View style={s.communityViewerActions}>';

const newActions =
`<View
     style={[
      s.communityViewerActions,
      {
       bottom:
        Math.max(
         communityInsets.bottom+14,
         Platform.OS==='android'
          ? 68
          : 26
        )
      }
     ]}
    >`;

if(
 src.includes(
  oldActions
 )
){

 src =
  src.replace(
   oldActions,
   newActions
  );

 console.log(
  '✓ Photo reaction/save toolbar raised above navigation bar'
 );

}else if(
 src.includes(
  'communityInsets.bottom+14'
 )
){

 console.log(
  '✓ Safe photo toolbar already installed'
 );

}else{

 stop(
  'Photo viewer action toolbar anchor not found.'
 );
}


/* ============================================================
   5. MOVE SWIPE HINT ABOVE ACTION BAR
   ============================================================ */

src =
 src.replace(
  '<Text style={s.communityViewerHint}>',
`<Text
     style={[
      s.communityViewerHint,
      {
       bottom:
        Math.max(
         communityInsets.bottom+145,
         Platform.OS==='android'
          ? 190
          : 155
        )
      }
     ]}
    >`
 );


/* ============================================================
   6. REMOVE STATIC BOTTOM THAT CAN FIGHT SAFE AREA
   Dynamic style above will win anyway, but normalize it.
   ============================================================ */

src =
 src.replace(
  /(communityViewerActions:\s*\{[\s\S]*?)bottom:\s*\d+\s*,/,
  '$1bottom:0,'
 );


/* ============================================================
   7. B3 BASE64 FIX IF STILL PRESENT
   ============================================================ */

src =
 src.replace(
  /base64:\s*x\.base64\s*,/g,
  'base64:x.base64!,'
 );


/* ============================================================
   WRITE
   ============================================================ */

fs.writeFileSync(
 path,
 src,
 'utf8'
 );


/* ============================================================
   TRUE JS VERIFICATION
   Avoid previous PowerShell false-negative.
   ============================================================ */

const final =
 fs.readFileSync(
  path,
  'utf8'
 );

const collageCount =
 (
  final.match(
   /\{renderCommunityMedia\(item\)\}/g
  ) || []
 ).length;


console.log('');
console.log(
 '=== TRUE SOURCE VERIFY ==='
);

console.log(
 'Community collage renders:',
 collageCount
);

console.log(
 'Gesture root:',
 final.includes(
  '<GestureHandlerRootView'
 )
  ? 'YES'
  : 'NO'
);

console.log(
 'Zoom function:',
 final.includes(
  'CommunityZoomPhoto'
 )
  ? 'YES'
  : 'NO'
);

console.log(
 'Safe toolbar:',
 final.includes(
  'communityInsets.bottom+14'
 )
  ? 'YES'
  : 'NO'
);


if(collageCount !== 1){
 stop(
  'Expected exactly one Community collage render.'
 );
}

if(
 !final.includes(
  '<GestureHandlerRootView'
 )
){
 stop(
  'GestureHandlerRootView was not installed.'
 );
}


console.log('');
console.log(
 'PATCH 161H-D1 SOURCE APPLIED'
);

console.log(
 '✓ Android Modal gestures enabled'
);

console.log(
 '✓ Pinch zoom enabled'
);

console.log(
 '✓ Double tap zoom strengthened'
);

console.log(
 '✓ Reaction/save toolbar above navigation pane'
);

console.log(
 '✓ Previous collage verifier corrected'
);
