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
  'PATCH 161H-D2A STOPPED:'
 );
 console.error(message);
 process.exit(1);
}


/* ============================================================
   1. MEDIA RENDERER DEDUPE
   ============================================================ */

const mediaStart =
 src.indexOf(
  'const renderCommunityMedia='
 );

if(mediaStart < 0){
 stop(
  'renderCommunityMedia not found.'
 );
}


let mediaEnd =
 src.indexOf(
  'useEffect(',
  mediaStart
 );


if(mediaEnd < 0){
 mediaEnd =
  src.indexOf(
   'const shareOutside',
   mediaStart
  );
}


if(mediaEnd < 0){
 stop(
  'Could not isolate renderCommunityMedia.'
 );
}


let mediaBlock =
 src.slice(
  mediaStart,
  mediaEnd
 );


if(
 !mediaBlock.includes(
  'const seenMedia='
 )
){

 const mediaArrayRx =
  /const media=\s*\(\s*Array\.isArray\(\s*item\?\.media_items\s*\)[\s\S]*?\.slice\(\s*0,\s*5\s*\);/;


 if(
  !mediaArrayRx.test(
   mediaBlock
  )
 ){
  stop(
   'Current media-array preparation block not found.'
  );
 }


 mediaBlock =
  mediaBlock.replace(
   mediaArrayRx,
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

       /*
        * Prefer storage path because signed URLs
        * may differ even for the same file.
        */
       const key=
        String(
         x?.media_path||
         x?.media_url||
         ''
        )
         .trim();


       if(!key){
        return false;
       }


       if(
        seenMedia.has(
         key
        )
       ){
        return false;
       }


       seenMedia.add(
        key
       );

       return true;
      }
     )
     .slice(
      0,
      5
     );`
  );


 src =
  src.slice(
   0,
   mediaStart
  )+
  mediaBlock+
  src.slice(
   mediaEnd
  );


 console.log(
  '✓ Media path deduplication installed'
 );

}else{

 console.log(
  '✓ Media path deduplication already installed'
 );
}


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


let reactionAt =
 src.indexOf(
  reactionMarker,
  renderStart
 );


if(reactionAt < 0){
 stop(
  'Community reaction marker not found.'
 );
}


let beforeReaction =
 src.slice(
  renderStart,
  reactionAt
 );


/* ============================================================
   3. REMOVE ALL EXISTING COLLAGE CALLS FIRST
   ============================================================ */

const oldCollageCount =
 (
  beforeReaction.match(
   /\{renderCommunityMedia\(item\)\}/g
  ) || []
 ).length;


beforeReaction =
 beforeReaction.replace(
  /\{renderCommunityMedia\(item\)\}/g,
  ''
 );


console.log(
 'Old collage calls removed:',
 oldCollageCount
);


/* ============================================================
   4. STRUCTURAL JSX BRACE MATCHER
   ============================================================ */

function findClosingBrace(
 text,
 openIndex
){
 let depth=0;

 let quote=null;

 let escaped=false;


 for(
  let i=openIndex;
  i<text.length;
  i++
 ){
  const ch=
   text[i];


  if(quote){

   if(escaped){
    escaped=false;
    continue;
   }


   if(ch==='\\'){
    escaped=true;
    continue;
   }


   if(ch===quote){
    quote=null;
   }

   continue;
  }


  if(
   ch==="'" ||
   ch==='"' ||
   ch==='`'
  ){
   quote=ch;
   continue;
  }


  if(ch==='{'){
   depth++;
  }
  else if(ch==='}'){
   depth--;

   if(depth===0){
    return i;
   }
  }
 }


 return -1;
}



function findLegacyOuterBlock(
 text,
 targetIndex
){
 /*
  * Walk backwards through every possible opening brace.
  * We ignore small style={s.postImage} braces because
  * they do not contain item.media_url.
  */
 for(
  let open=
   text.lastIndexOf(
    '{',
    targetIndex
   );

  open>=0;

  open=
   text.lastIndexOf(
    '{',
    open-1
   )
 ){
  const close=
   findClosingBrace(
    text,
    open
   );


  if(
   close<targetIndex
  ){
   continue;
  }


  const block=
   text.slice(
    open,
    close+1
   );


  if(
   block.includes(
    's.postImage'
   )
   &&
   block.includes(
    'item.media_url'
   )
   &&
   (
    block.includes(
     '<Image'
    )
    ||
    block.includes(
     '<ExpoImage'
    )
   )
  ){
   return {
    open,
    close,
    block
   };
  }


  /*
   * Prevent walking all the way into the
   * whole renderItem function unnecessarily.
   */
  if(
   targetIndex-open >
   1200
  ){
   break;
  }
 }


 return null;
}


/* ============================================================
   5. REMOVE LEGACY PHOTO JSX BLOCKS
   ============================================================ */

let legacyRemoved=0;


while(true){

 const target=
  beforeReaction.indexOf(
   's.postImage'
  );


 if(target<0){
  break;
 }


 const match=
  findLegacyOuterBlock(
   beforeReaction,
   target
  );


 if(!match){

  /*
   * This s.postImage may not be a feed image.
   * Search for the next one.
   */
  const nextTarget=
   beforeReaction.indexOf(
    's.postImage',
    target+1
   );


  if(nextTarget<0){
   break;
  }


  /*
   * Temporarily mask this occurrence so the
   * next candidate can be inspected.
   */
  beforeReaction =
   beforeReaction.slice(
    0,
    target
   )+
   's.__checkedPostImage'+
   beforeReaction.slice(
    target+
    's.postImage'.length
   );

  continue;
 }


 console.log('');
 console.log(
  'REMOVING LEGACY PHOTO BLOCK:'
 );

 console.log(
  match.block
   .slice(
    0,
    500
   )
 );


 beforeReaction =
  beforeReaction.slice(
   0,
   match.open
  )+
  '\n'+
  beforeReaction.slice(
   match.close+1
  );


 legacyRemoved++;
}


/*
 * Restore any temporarily masked unrelated
 * style references.
 */
beforeReaction =
 beforeReaction.replace(
  /s\.__checkedPostImage/g,
  's.postImage'
 );


console.log('');
console.log(
 'Legacy feed photo blocks removed:',
 legacyRemoved
);


/* ============================================================
   6. REMOVE SIMPLE DIRECT LEGACY FORMS AS EXTRA SAFETY
   ============================================================ */

beforeReaction =
 beforeReaction.replace(
  /<Image\s+source=\{\{uri:item\.media_url\}\}[\s\S]*?\/>/g,
  ''
 );


beforeReaction =
 beforeReaction.replace(
  /<ExpoImage\s+source=\{\{uri:item\.media_url\}\}[\s\S]*?\/>/g,
  ''
 );


/* ============================================================
   7. INSERT EXACTLY ONE COLLAGE
   ============================================================ */

beforeReaction =
 beforeReaction.trimEnd()+
 '\n\n    {renderCommunityMedia(item)}\n\n    ';


src =
 src.slice(
  0,
  renderStart
 )+
 beforeReaction+
 src.slice(
  reactionAt
 );


/* ============================================================
   8. FINAL STRUCTURAL VERIFY
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


if(
 finalRenderStart<0 ||
 finalReactionAt<0
){
 stop(
  'Final render structure is invalid.'
 );
}


const finalFeedHead =
 src.slice(
  finalRenderStart,
  finalReactionAt
 );


const finalCollages =
 (
  finalFeedHead.match(
   /\{renderCommunityMedia\(item\)\}/g
  ) || []
 ).length;


const directLegacyImage =
 (
  finalFeedHead.includes(
   'item.media_url'
  )
  &&
  finalFeedHead.includes(
   's.postImage'
  )
 );


console.log('');
console.log(
 '=== FINAL PHOTO VERIFY ==='
);

console.log(
 'Collage render count:',
 finalCollages
);

console.log(
 'Legacy item.media_url + s.postImage:',
 directLegacyImage
  ? 'YES'
  : 'NO'
);

console.log(
 'Media dedupe:',
 src.includes(
  'const seenMedia='
 )
  ? 'YES'
  : 'NO'
);


if(finalCollages!==1){
 stop(
  'Exactly one collage was expected.'
 );
}


if(directLegacyImage){
 console.log('');
 console.log(
  'REMAINING PRE-REACTION SOURCE:'
 );

 console.log(
  finalFeedHead.slice(
   Math.max(
    0,
    finalFeedHead.indexOf(
     'item.media_url'
    )-300
   ),
   Math.min(
    finalFeedHead.length,
    finalFeedHead.indexOf(
     's.postImage'
    )+300
   )
  )
 );

 stop(
  'A legacy single-photo render still remains.'
 );
}


if(
 !src.includes(
  'const seenMedia='
 )
){
 stop(
  'Media dedupe was not installed.'
 );
}


/* ============================================================
   9. WRITE
   ============================================================ */

fs.writeFileSync(
 path,
 src,
 'utf8'
 );


console.log('');
console.log(
 'PATCH 161H-D2A SOURCE APPLIED'
);

console.log(
 '✓ Legacy single-photo JSX structurally removed'
);

console.log(
 '✓ One collage renderer only'
);

console.log(
 '✓ Duplicate media path filtering enabled'
);

console.log(
 '✓ Zoom/reactions/save untouched'
);
