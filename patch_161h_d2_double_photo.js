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
  'PATCH 161H-D2 STOPPED:'
 );
 console.error(message);
 process.exit(1);
}


/* ============================================================
   1. DEDUPE media_items BEFORE RENDERING
   ============================================================ */

const mediaStart =
 src.indexOf(
  'const renderCommunityMedia='
 );

const mediaEnd =
 src.indexOf(
  'useEffect(',
  mediaStart
 );

if(
 mediaStart < 0 ||
 mediaEnd < 0
){
 stop(
  'renderCommunityMedia block not found.'
 );
}

let mediaBlock =
 src.slice(
  mediaStart,
  mediaEnd
 );


/*
 * Replace the old media array preparation with
 * a unique media-path/url list.
 */
const oldMediaRx =
 /const media=\s*\(\s*Array\.isArray\(\s*item\?\.media_items\s*\)[\s\S]*?\.slice\(\s*0,\s*5\s*\);/;

if(
 oldMediaRx.test(mediaBlock)
){

 mediaBlock =
  mediaBlock.replace(
   oldMediaRx,
`const rawMedia=
    (
     Array.isArray(
      item?.media_items
     )
      ? item.media_items
      : []
    )
     .filter(
      (x:any)=>
       !!x?.media_url
     );

   const seenMedia=
    new Set<string>();

   const media=
    rawMedia
     .filter(
      (x:any)=>{
       const key=
        String(
         x?.media_path||
         x?.media_url||
         ''
        );

       if(!key){
        return false;
       }

       if(
        seenMedia.has(key)
       ){
        return false;
       }

       seenMedia.add(key);

       return true;
      }
     )
     .slice(
      0,
      5
     );`
  );

}else if(
 !mediaBlock.includes(
  'const seenMedia='
 )
){

 stop(
  'Media-array preparation anchor not found.'
 );
}


src =
 src.slice(
  0,
  mediaStart
 )+
 mediaBlock+
 src.slice(
  mediaEnd
 );


/* ============================================================
   2. ISOLATE COMMUNITY renderItem
   ============================================================ */

const renderStart =
 src.indexOf(
  'renderItem={({item})'
 );

if(renderStart < 0){
 stop(
  'Community renderItem not found.'
 );
}

const reactionMarker =
 '{/* COMMUNITY_ICON_REACTIONS_20260811 */}';

const reactionAt =
 src.indexOf(
  reactionMarker,
  renderStart
 );

if(reactionAt < 0){
 stop(
  'Community reaction marker not found.'
 );
}


/*
 * Work only from renderItem start up to reactions.
 */
let preReaction =
 src.slice(
  renderStart,
  reactionAt
 );


/* ============================================================
   3. REMOVE ALL COLLAGE CALLS BEFORE REINSERTING ONE
   ============================================================ */

const collageBefore =
 (
  preReaction.match(
   /\{renderCommunityMedia\(item\)\}/g
  ) || []
 ).length;

preReaction =
 preReaction.replace(
  /\{renderCommunityMedia\(item\)\}/g,
  ''
 );


/* ============================================================
   4. REMOVE LEGACY SINGLE IMAGE RENDERS
   ============================================================ */

/*
 * Current/older conditional form:
 *
 * {!!item.media_url &&
 *  !String(...).startsWith('video/') &&
 *  <Image ... style={s.postImage}/>}
 */
preReaction =
 preReaction.replace(
  /\{\s*!!item\.media_url[\s\S]{0,400}?<Image[\s\S]{0,300}?style=\{s\.postImage\}[\s\S]{0,40}?\/>\s*\}/g,
  ''
 );


/*
 * Simple legacy form.
 */
preReaction =
 preReaction.replace(
  /\{\s*!!item\.media_url\s*&&\s*<Image[\s\S]{0,250}?style=\{s\.postImage\}[\s\S]{0,40}?\/>\s*\}/g,
  ''
 );


/*
 * Very compact direct Image form.
 */
preReaction =
 preReaction.replace(
  /<Image\s+source=\{\{uri:item\.media_url\}\}\s+style=\{s\.postImage\}\s*\/>/g,
  ''
 );


/* ============================================================
   5. INSERT EXACTLY ONE COLLAGE
   ============================================================ */

preReaction =
 preReaction.trimEnd()+
 '\n    {renderCommunityMedia(item)}\n\n    ';


src =
 src.slice(
  0,
  renderStart
 )+
 preReaction+
 src.slice(
  reactionAt
 );


/* ============================================================
   6. FINAL SOURCE VERIFY
   ============================================================ */

const finalRenderStart =
 src.indexOf(
  'renderItem={({item})'
 );

const finalReactionAt =
 src.indexOf(
  reactionMarker,
  finalRenderStart
 );

const finalPreReaction =
 src.slice(
  finalRenderStart,
  finalReactionAt
 );

const collageAfter =
 (
  finalPreReaction.match(
   /\{renderCommunityMedia\(item\)\}/g
  ) || []
 ).length;

const legacyPostImage =
 /item\.media_url[\s\S]{0,300}?style=\{s\.postImage\}/
  .test(
   finalPreReaction
  );

if(collageAfter !== 1){
 stop(
  'Expected exactly one collage before reactions. Found: '+
  collageAfter
 );
}

if(legacyPostImage){
 stop(
  'Legacy single-photo render still exists before reactions.'
 );
}

if(
 !src.includes(
  'const seenMedia='
 )
){
 stop(
  'Media deduplication block missing.'
 );
}


fs.writeFileSync(
 path,
 src,
 'utf8'
 );


console.log('');
console.log(
 'PATCH 161H-D2 SOURCE APPLIED'
);

console.log(
 'Previous collage calls:',
 collageBefore
);

console.log(
 'Final collage calls: 1'
);

console.log(
 '✓ Duplicate media paths filtered'
);

console.log(
 '✓ Legacy single photo render removed'
);

console.log(
 '✓ Exactly one collage renderer remains'
);
