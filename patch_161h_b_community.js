const fs = require('fs');

const path =
  './src/app/(tabs)/buklod.tsx';

let src =
  fs.readFileSync(
    path,
    'utf8'
  );

function stop(message) {
  console.error('');
  console.error(
    'PATCH 161H-B STOPPED:'
  );
  console.error(message);
  process.exit(1);
}

function requireText(
  text,
  name
) {
  if (!src.includes(text)) {
    stop(
      'Missing anchor: ' +
      name
    );
  }
}

if (
  src.includes(
    'PATCH_161H_SINGLE_SCREEN_COMMUNITY'
  )
) {
  stop(
    'PATCH 161H-B already appears to be installed.'
  );
}


/* ============================================================
   PRECHECK
   ============================================================ */

requireText(
  "get_buklod_community_feed_v3",
  'Community V3 feed'
);

requireText(
  "const pickPhoto",
  'pickPhoto'
);

requireText(
  "const publish",
  'publish'
);

requireText(
  "const react",
  'post reaction'
);

requireText(
  "const shareOutside",
  'shareOutside'
);

requireText(
  "renderItem={({item})",
  'Community renderItem'
);

requireText(
  "mentionOpen",
  'Mention modal'
);


/* ============================================================
   A. IMPORTS
   ============================================================ */

src =
  src.replace(
    /import\s*\{([^}]*)\}\s*from\s*'react-native';/,
    (
      match,
      body
    ) => {
      const names =
        body
          .split(',')
          .map(
            x =>
              x.trim()
          )
          .filter(Boolean);

      const needed = [
        'Dimensions',
        'KeyboardAvoidingView',
        'Platform',
      ];

      for (
        const name
        of needed
      ) {
        if (
          !names.includes(name)
        ) {
          names.push(name);
        }
      }

      return (
        'import {' +
        names.join(',') +
        "} from 'react-native';"
      );
    }
  );


/* ============================================================
   B. VIEWER CONSTANT
   ============================================================ */

const componentAnchor =
  'export default function BuklodScreen(){';

if (
  !src.includes(
    componentAnchor
  )
) {
  stop(
    'BuklodScreen component anchor not found.'
  );
}

src =
  src.replace(
    componentAnchor,
`const COMMUNITY_VIEWER_HEIGHT=
 Dimensions.get('window').height;

// PATCH_161H_SINGLE_SCREEN_COMMUNITY
${componentAnchor}`
  );


/* ============================================================
   C. PHOTO STATE -> PHOTO ARRAY
   ============================================================ */

const photoStateRx =
 /\[photo,setPhoto\]=useState<Photo\|null>\(null\)/;

if (
  !photoStateRx.test(src)
) {
  stop(
    'Single-photo state anchor not found.'
  );
}

src =
  src.replace(
    photoStateRx,
    '[photos,setPhotos]=useState<Photo[]>([])'
  );


/* ============================================================
   D. COMMENTS / VIEWER STATE
   Insert before main load()
   ============================================================ */

const loadIndex =
  src.indexOf(
    'const load=useCallback'
  );

if (
  loadIndex < 0
) {
  stop(
    'Community load() insertion point not found.'
  );
}

const stateBlock =
`
 // PATCH_161H_DRAWER_STATE
 const [commentOpen,setCommentOpen]=
  useState(false);

 const [commentPost,setCommentPost]=
  useState<any|null>(null);

 const [comments,setComments]=
  useState<any[]>([]);

 const [commentText,setCommentText]=
  useState('');

 const [commentBusy,setCommentBusy]=
  useState(false);

 const [replyTo,setReplyTo]=
  useState<any|null>(null);

 const [
  commentReactionTarget,
  setCommentReactionTarget
 ]=useState<any|null>(null);

 const [
  commentReactionOpen,
  setCommentReactionOpen
 ]=useState(false);

 const [viewerOpen,setViewerOpen]=
  useState(false);

 const [viewerItems,setViewerItems]=
  useState<any[]>([]);

 const [viewerIndex,setViewerIndex]=
  useState(0);

`;

src =
  src.slice(
    0,
    loadIndex
  ) +
  stateBlock +
  src.slice(
    loadIndex
  );


/* ============================================================
   E. LOAD 1-5 MEDIA ITEMS
   Reuse existing feed load and enrich `next`.
   ============================================================ */

let mediaInsertIndex =
  src.indexOf(
    '// COMMUNITY_AUTHOR_CIRCLE_RANK'
  );

if (
  mediaInsertIndex < 0
) {
  mediaInsertIndex =
    src.indexOf(
      'const authorIds'
    );
}

if (
  mediaInsertIndex < 0
) {
  stop(
    'Community media insertion point not found.'
  );
}

const mediaLoadBlock =
`
  // PATCH_161H_MEDIA_LOAD
  const mediaMap:
   Record<string,any[]> =
   {};

  const mediaPostIds=
   next
    .map(
     (p:any)=>p?.id
    )
    .filter(Boolean);

  if(mediaPostIds.length){
   const {
    data:mediaRows,
    error:mediaError
   }=
    await (
     supabase as any
    ).rpc(
     'get_buklod_post_media_v1',
     {
      p_post_ids:
       mediaPostIds
     }
    );

   if(mediaError){
    console.warn(
     'Community photos:',
     mediaError.message
    );
   }
   else{
    const signedMedia=
     await Promise.all(
      (mediaRows??[])
       .map(
        async(row:any)=>{
         const {
          data:signed
         }=
          await supabase
           .storage
           .from(
            'community-media'
           )
           .createSignedUrl(
            row.media_path,
            3600
           );

         return {
          ...row,
          media_url:
           signed?.signedUrl??
           null
         };
        }
       )
     );

    for(
     const row
     of signedMedia
    ){
     if(!row?.post_id){
      continue;
     }

     if(
      !mediaMap[
       row.post_id
      ]
     ){
      mediaMap[
       row.post_id
      ]=[];
     }

     mediaMap[
      row.post_id
     ].push(row);
    }
   }
  }

  for(const p of next){
   const loaded=
    mediaMap[p.id]??[];

   if(loaded.length){
    p.media_items=
     loaded.sort(
      (a:any,b:any)=>
       Number(
        a.media_position??0
       )-
       Number(
        b.media_position??0
       )
     );
   }
   else if(
    p.media_url &&
    !String(
     p.media_mime_type??
     ''
    )
     .toLowerCase()
     .startsWith(
      'video/'
     )
   ){
    p.media_items=[
     {
      post_id:p.id,
      media_position:0,
      media_path:
       p.media_path,
      media_mime_type:
       p.media_mime_type,
      media_size_bytes:
       p.media_size_bytes,
      media_url:
       p.media_url
     }
    ];
   }
   else{
    p.media_items=[];
   }
  }

`;

src =
  src.slice(
    0,
    mediaInsertIndex
  ) +
  mediaLoadBlock +
  src.slice(
    mediaInsertIndex
  );


/* ============================================================
   F. MULTI PHOTO PICKER
   ============================================================ */

const pickStart =
  src.indexOf(
    'const pickPhoto'
  );

const searchMentionStart =
  src.indexOf(
    'const searchMentions',
    pickStart
  );

if (
  pickStart < 0 ||
  searchMentionStart < 0
) {
  stop(
    'Could not isolate pickPhoto().'
  );
}

const newPicker =
`const pickPhoto=async()=>{
  if(photos.length>=5){
   return Alert.alert(
    'Photos',
    'Maximum of 5 photos per post.'
   );
  }

  try{
   setPhotoBusy(true);

   const P=
    await import(
     'expo-image-picker'
    );

   const M=
    await import(
     'expo-image-manipulator'
    );

   const perm=
    await P
     .requestMediaLibraryPermissionsAsync();

   if(!perm.granted){
    return Alert.alert(
     'Photos',
     'Please allow photo access.'
    );
   }

   const remaining=
    5-photos.length;

   const result=
    await P
     .launchImageLibraryAsync({
      mediaTypes:
       ['images'] as any,
      allowsMultipleSelection:
       true,
      selectionLimit:
       remaining,
      quality:.9
     });

   if(
    result.canceled ||
    !result.assets?.length
   ){
    return;
   }

   const prepared:
    Photo[]=[];

   for(
    const asset
    of result.assets
     .slice(
      0,
      remaining
     )
   ){
    const image=
     await M
      .manipulateAsync(
       asset.uri,
       [
        {
         resize:{
          width:1400
         }
        }
       ],
       {
        compress:.78,
        format:
         M.SaveFormat.JPEG,
        base64:true
       }
      );

    if(!image.base64){
     continue;
    }

    prepared.push({
     uri:image.uri,
     base64:
      image.base64,
     sizeBytes:
      Math.ceil(
       image.base64.length*
       .75
      )
    });
   }

   if(!prepared.length){
    throw new Error(
     'Could not prepare the selected photos.'
    );
   }

   setPhotos(
    current=>
     [
      ...current,
      ...prepared
     ].slice(
      0,
      5
     )
   );
  }
  catch(e:any){
   Alert.alert(
    'Photos',
    e?.message||
    'Could not select photos.'
   );
  }
  finally{
   setPhotoBusy(false);
  }
 };

 const removePhoto=
  (index:number)=>{
   setPhotos(
    current=>
     current.filter(
      (_item,i)=>
       i!==index
     )
   );
  };

 `;

src =
  src.slice(
    0,
    pickStart
  ) +
  newPicker +
  src.slice(
    searchMentionStart
  );


/* ============================================================
   G. MULTI PHOTO PUBLISH
   ============================================================ */

const publishStart =
  src.indexOf(
    'const publish'
  );

const reactStart =
  src.indexOf(
    'const react',
    publishStart
  );

if (
  publishStart < 0 ||
  reactStart < 0
) {
  stop(
    'Could not isolate Community publish().'
  );
}

const newPublish =
`const publish=async()=>{
  if(!user)return;

  if(
   audience==='group' &&
   !group?.id
  ){
   return Alert.alert(
    'BUKLOD',
    'No active Cluster. Choose LOCAL or PUBLIC.'
   );
  }

  if(
   (
    audience==='local' ||
    audience==='public'
   ) &&
   !profile?.church_id
  ){
   return Alert.alert(
    'BUKLOD',
    'A Local Church is required.'
   );
  }

  if(
   !body.trim() &&
   !photos.length
  ){
   return Alert.alert(
    'BUKLOD',
    'Write a message or add photos.'
   );
  }

  setBusy(true);

  const uploaded:
   Array<{
    media_path:string;
    media_mime_type:string;
    media_size_bytes:number;
   }>=[];

  let createdPostId:
   string|null=
   null;

  try{
   for(
    let index=0;
    index<photos.length;
    index++
   ){
    const photo=
     photos[index];

    const path=
     \`\${user.id}/post-\${Date.now()}-\${index}-\${Math.random().toString(36).slice(2)}.jpg\`;

    const {
     error:uploadError
    }=
     await supabase
      .storage
      .from(
       'community-media'
      )
      .upload(
       path,
       decode(
        photo.base64
       ),
       {
        contentType:
         'image/jpeg',
        upsert:false
       }
      );

    if(uploadError){
     throw uploadError;
    }

    uploaded.push({
     media_path:path,
     media_mime_type:
      'image/jpeg',
     media_size_bytes:
      photo.sizeBytes
    });
   }

   const first=
    uploaded[0]??null;

   const {
    data:created,
    error:createError
   }=
    await (
     supabase as any
    ).rpc(
     'create_buklod_community_post_v3',
     {
      p_audience:
       audience,
      p_group_id:
       audience==='group'
        ? group?.id??null
        : null,
      p_category:
       category,
      p_body:
       body.trim()||
       (
        uploaded.length>1
         ? 'Shared photos.'
         : 'Shared a photo.'
       ),
      p_media_path:
       first?.media_path??
       null,
      p_media_mime_type:
       first?.media_mime_type??
       null,
      p_media_size_bytes:
       first?.media_size_bytes??
       null,
      p_mentioned_user_ids:
       mentions.map(
        x=>x.user_id
       )
     }
    );

   if(createError){
    throw createError;
   }

   createdPostId=
    typeof created==='string'
     ? created
     : Array.isArray(created)
     ? (
        typeof created[0]==='string'
         ? created[0]
         : created[0]?.id??null
       )
     : created?.id??null;

   if(!createdPostId){
    throw new Error(
     'Post was created but its ID was not returned.'
    );
   }

   if(uploaded.length){
    const {
     error:mediaError
    }=
     await (
      supabase as any
     ).rpc(
      'set_buklod_post_media_v1',
      {
       p_post_id:
        createdPostId,
       p_media:
        uploaded
      }
     );

    if(mediaError){
     throw mediaError;
    }
   }

   setBody('');
   setComposerHeight(52);
   setPhotos([]);
   setMentions([]);

   await load();
  }
  catch(e:any){
   /*
    * If post creation itself failed,
    * remove all uploaded files.
    *
    * If the post already exists,
    * keep photo #1 because the legacy
    * community_posts field still points
    * to it.
    */
   if(!createdPostId){
    if(uploaded.length){
     await supabase
      .storage
      .from(
       'community-media'
      )
      .remove(
       uploaded.map(
        x=>x.media_path
       )
      );
    }
   }
   else if(
    uploaded.length>1
   ){
    await supabase
     .storage
     .from(
      'community-media'
     )
     .remove(
      uploaded
       .slice(1)
       .map(
        x=>x.media_path
       )
     );
   }

   Alert.alert(
    'Could Not Post',
    e?.message||
    'Posting failed.'
   );

   await load();
  }
  finally{
   setBusy(false);
  }
 };

 `;

src =
  src.slice(
    0,
    publishStart
  ) +
  newPublish +
  src.slice(
    reactStart
  );


/* ============================================================
   H. COMMENT DRAWER FUNCTIONS + PHOTO VIEWER
   ============================================================ */

const shareIndex =
  src.indexOf(
    'const shareOutside'
  );

if (
  shareIndex < 0
) {
  stop(
    'shareOutside insertion point not found.'
  );
}

const interactionBlock =
`
 // PATCH_161H_INTERACTIONS

 const reactionLabel=
  (value?:string|null)=>{
   if(!value)return '';

   return (
    RX.find(
     r=>r.key===value
    )?.label??
    value
   );
  };


 const commentReactionTotal=
  (item:any)=>{
   return Object
    .values(
     item?.reaction_counts??
     {}
    )
    .reduce(
     (
      total:number,
      value:any
     )=>
      total+
      Number(
       value??0
      ),
     0
    );
  };


 const loadComments=
  useCallback(
   async(
    postId:string
   )=>{
    const [
     commentsResult,
     reactionsResult
    ]=
     await Promise.all([
      (
       supabase as any
      ).rpc(
       'get_buklod_post_comments_v4',
       {
        p_post_id:
         postId
       }
      ),

      (
       supabase as any
      ).rpc(
       'get_buklod_comment_reactions_v1',
       {
        p_post_id:
         postId
       }
      )
     ]);

    if(
     commentsResult.error
    ){
     Alert.alert(
      'Comments',
      commentsResult
       .error
       .message
     );
     return;
    }

    const rows=
     (
      commentsResult.data??
      []
     ) as any[];

    const clusterMap=
     await getClusterLabels(
      rows.map(
       (row:any)=>
        row.user_id
      )
     );

    const reactionMap=
     new Map<string,any>();

    for(
     const row
     of (
      reactionsResult.data??
      []
     )
    ){
     reactionMap.set(
      String(
       row.comment_id
      ),
      row
     );
    }

    setComments(
     rows.map(
      (row:any)=>{
       const reaction=
        reactionMap.get(
         String(row.id)
        );

       return {
        ...row,
        cluster_name:
         clusterMap[
          row.user_id
         ]??null,
        reaction_counts:
         reaction?.reaction_counts??
         {},
        my_reaction:
         reaction?.my_reaction??
         null
       };
      }
     )
    );
   },
   []
  );


 const openComments=
  async(
   post:any
  )=>{
   setCommentPost(post);
   setComments([]);
   setCommentText('');
   setReplyTo(null);
   setCommentOpen(true);

   await loadComments(
    post.id
   );
  };


 const closeComments=
  ()=>{
   setCommentOpen(false);
   setReplyTo(null);
   setCommentText('');
   setCommentReactionOpen(false);
   setCommentReactionTarget(null);
  };


 const submitCommunityComment=
  async()=>{
   if(
    !commentPost?.id ||
    !commentText.trim() ||
    commentBusy
   ){
    return;
   }

   let finalBody=
    commentText.trim();

   if(replyTo){
    const mention=
     '@'+
     String(
      replyTo.commenter_name||
      'BUKLOD Member'
     );

    if(
     !finalBody
      .toLowerCase()
      .startsWith(
       mention.toLowerCase()
      )
    ){
     finalBody=
      mention+
      ' '+
      finalBody;
    }
   }

   setCommentBusy(true);

   const {error}=
    await (
     supabase as any
    ).rpc(
     'add_buklod_post_comment_v4',
     {
      p_post_id:
       commentPost.id,
      p_body:
       finalBody,
      p_parent_id:
       replyTo?.id??
       null
     }
    );

   setCommentBusy(false);

   if(error){
    return Alert.alert(
     'Comment',
     error.message
    );
   }

   setCommentText('');
   setReplyTo(null);

   await Promise.all([
    loadComments(
     commentPost.id
    ),
    load()
   ]);
  };


 const openCommentReaction=
  (item:any)=>{
   setCommentReactionTarget(
    item
   );
   setCommentReactionOpen(
    true
   );
  };


 const reactToComment=
  async(
   reaction:Reaction
  )=>{
   const target=
    commentReactionTarget;

   if(!target?.id){
    return;
   }

   const targetId=
    String(target.id);

   const previous=
    (
     target.my_reaction??
     null
    ) as
     Reaction|null;

   const nextReaction=
    previous===reaction
     ? null
     : reaction;

   setCommentReactionOpen(
    false
   );

   setCommentReactionTarget(
    null
   );

   setComments(
    current=>
     current.map(
      item=>{
       if(
        String(item.id)!==
        targetId
       ){
        return item;
       }

       const counts={
        ...(
         item.reaction_counts??
         {}
        )
       };

       if(previous){
        counts[previous]=
         Math.max(
          0,
          Number(
           counts[previous]??
           0
          )-1
         );
       }

       if(nextReaction){
        counts[nextReaction]=
         Number(
          counts[nextReaction]??
          0
         )+1;
       }

       return {
        ...item,
        my_reaction:
         nextReaction,
        reaction_counts:
         counts
       };
      }
     )
   );

   const {error}=
    await (
     supabase as any
    ).rpc(
     'set_buklod_comment_reaction_v1',
     {
      p_comment_id:
       targetId,
      p_reaction:
       reaction
     }
    );

   if(error){
    Alert.alert(
     'Reaction',
     error.message
    );

    if(commentPost?.id){
     await loadComments(
      commentPost.id
     );
    }
   }
  };


 const openPhotoViewer=
  (
   media:any[],
   index:number
  )=>{
   if(!media.length){
    return;
   }

   setViewerItems(media);
   setViewerIndex(index);
   setViewerOpen(true);
  };


 const renderCommunityMedia=
  (item:any)=>{
   const media=
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
     )
     .slice(
      0,
      5
     );

   const count=
    media.length;

   if(!count){
    return null;
   }

   return (
    <View style={s.communityMediaGrid}>
     {media.map(
      (
       photo:any,
       index:number
      )=>{
       const tileStyle=
        count===1
         ? s.communityMediaOne
         : count===2
         ? s.communityMediaHalfTall
         : (
            count===3 &&
            index===0
           )
         ? s.communityMediaWide
         : (
            count===5 &&
            index===0
           )
         ? s.communityMediaWide
         : count===5
         ? s.communityMediaHalfSmall
         : s.communityMediaHalf;

       return (
        <Pressable
         key={
          photo.media_path||
          String(index)
         }
         onPress={()=>
          openPhotoViewer(
           media,
           index
          )
         }
         style={[
          s.communityMediaTile,
          tileStyle
         ]}
        >
         <Image
          source={{
           uri:
            photo.media_url
          }}
          style={
           s.communityMediaImage
          }
          resizeMode="cover"
         />
        </Pressable>
       );
      }
     )}
    </View>
   );
  };


 useEffect(
  ()=>{
   if(
    !commentOpen ||
    !commentPost?.id
   ){
    return;
   }

   const postId=
    String(
     commentPost.id
    );

   const channel=
    supabase
     .channel(
      \`community-drawer:\${postId}\`
     )
     .on(
      'postgres_changes',
      {
       event:'*',
       schema:'public',
       table:'comments',
       filter:
        \`post_id=eq.\${postId}\`
      },
      ()=>{
       void loadComments(
        postId
       );
      }
     )
     .on(
      'postgres_changes',
      {
       event:'*',
       schema:'public',
       table:
        'comment_reactions'
      },
      ()=>{
       void loadComments(
        postId
       );
      }
     )
     .subscribe();

   return ()=>{
    supabase
     .removeChannel(
      channel
     );
   };
  },
  [
   commentOpen,
   commentPost?.id,
   loadComments
  ]
 );


`;

src =
  src.slice(
    0,
    shareIndex
  ) +
  interactionBlock +
  src.slice(
    shareIndex
  );


/* ============================================================
   I. COMPOSER TEXT
   ============================================================ */

src =
  src.replace(
    /\{photoBusy\?'Preparing\.\.\.':photo\?'Photo Added':'Add Photo'\}/g,
`{photoBusy
 ? 'Preparing...'
 : photos.length
 ? \`\${photos.length}/5 Photos\`
 : 'Add Photos'}`
  );


/* ============================================================
   J. COMPOSER PHOTO PREVIEW
   ============================================================ */

const previewRx =
 /\{\!\!photo&&<><Image source=\{\{uri:photo\.uri\}\} style=\{s\.preview\}\/><Button title="REMOVE PHOTO" outline onPress=\{\(\)=>setPhoto\(null\)\}\/><\/>\}/;

if (
  !previewRx.test(src)
) {
  stop(
    'Old single-photo preview anchor not found.'
  );
}

src =
  src.replace(
    previewRx,
`{!!photos.length&&(
     <View style={s.communityComposerPhotos}>
      {photos.map((photo,index)=>
       <View
        key={photo.uri}
        style={s.communityComposerPhoto}
       >
        <Image
         source={{uri:photo.uri}}
         style={s.communityComposerPhotoImage}
        />

        <Pressable
         onPress={()=>removePhoto(index)}
         style={s.communityComposerPhotoRemove}
        >
         <MaterialCommunityIcons
          name="close"
          size={16}
          color="#FFFFFF"
         />
        </Pressable>
       </View>
      )}
     </View>
    )}`
  );


/* ============================================================
   K. REMOVE WHOLE-POST NAVIGATION
   ============================================================ */

const outerPostRx =
 /return\s+<Pressable\s+onPress=\{\(\)=>router\.push\(`\/post\/\$\{item\.id\}` as any\)\}><Card>/;

if (
  !outerPostRx.test(src)
) {
  stop(
    'Whole-post Pressable anchor not found.'
  );
}

src =
  src.replace(
    outerPostRx,
    'return <Card>'
  );


const closingPostRx =
 /<\/Card>\s*<\/Pressable>\s*\}\}\s*\/>/;

if (
  !closingPostRx.test(src)
) {
  stop(
    'Whole-post closing Pressable anchor not found.'
  );
}

src =
  src.replace(
    closingPostRx,
    '</Card>}}/>'
  );


/* ============================================================
   L. COMMENTS BUTTON -> DRAWER
   ============================================================ */

src =
  src.replace(
    /router\.push\(`\/post\/\$\{item\.id\}` as any\)/g,
    'openComments(item)'
  );


/* ============================================================
   M. REPLACE SINGLE FEED IMAGE WITH COLLAGE
   ============================================================ */

let mediaReplaced =
  false;

const currentImageRx =
 /\{\!\!item\.media_url\s*&&\s*!String\(item\.media_mime_type\|\|''\)\.startsWith\('video\/'\)\s*&&\s*<Image source=\{\{uri:item\.media_url\}\} style=\{s\.postImage\}\/>\}/;

if (
  currentImageRx.test(src)
) {
  src =
    src.replace(
      currentImageRx,
      '{renderCommunityMedia(item)}'
    );

  mediaReplaced =
    true;
}

if (
  !mediaReplaced
) {
  const simpleImageRx =
   /\{\!\!item\.media_url&&<Image source=\{\{uri:item\.media_url\}\} style=\{s\.postImage\}\/>\}/;

  if (
    simpleImageRx.test(src)
  ) {
    src =
      src.replace(
        simpleImageRx,
        '{renderCommunityMedia(item)}'
      );

    mediaReplaced =
      true;
  }
}

if (
  !mediaReplaced
) {
  /*
   * Final safe fallback:
   * add collage before reaction row.
   */
  const reactionMarker =
   '{/* COMMUNITY_ICON_REACTIONS_20260811 */}';

  if (
    !src.includes(
      reactionMarker
    )
  ) {
    stop(
      'Community feed image/reaction anchor not found.'
    );
  }

  src =
    src.replace(
      reactionMarker,
      `{renderCommunityMedia(item)}
    ${reactionMarker}`
    );
}


/* ============================================================
   N. INSERT FULLSCREEN VIEWER + COMMENT DRAWER
   ============================================================ */

let modalAnchor =
  '{/* PATCH_161C_AUDIENCE_DRAWER */}';

if (
  !src.includes(
    modalAnchor
  )
) {
  modalAnchor =
    '<Modal visible={mentionOpen}';
}

if (
  !src.includes(
    modalAnchor
  )
) {
  stop(
    'Modal insertion point not found.'
  );
}

const communityModals =
`{/* PATCH_161H_PHOTO_VIEWER */}
 <Modal
  visible={viewerOpen}
  animationType="fade"
  onRequestClose={()=>
   setViewerOpen(false)
  }
 >
  <View style={s.communityViewerScreen}>

   <FlatList
    key={
     'viewer-'+
     viewerIndex+
     '-'+
     viewerItems.length
    }
    data={viewerItems}
    keyExtractor={(item,index)=>
     String(
      item?.media_path||
      item?.media_url||
      index
     )
    }
    horizontal={false}
    pagingEnabled
    showsVerticalScrollIndicator={false}
    initialScrollIndex={
     Math.min(
      viewerIndex,
      Math.max(
       0,
       viewerItems.length-1
      )
     )
    }
    getItemLayout={(_data,index)=>({
     length:
      COMMUNITY_VIEWER_HEIGHT,
     offset:
      COMMUNITY_VIEWER_HEIGHT*
      index,
     index
    })}
    onMomentumScrollEnd={event=>{
     const nextIndex=
      Math.round(
       event.nativeEvent
        .contentOffset.y/
       COMMUNITY_VIEWER_HEIGHT
      );

     setViewerIndex(
      Math.max(
       0,
       Math.min(
        nextIndex,
        viewerItems.length-1
       )
      )
     );
    }}
    renderItem={({item})=>
     <View
      style={{
       height:
        COMMUNITY_VIEWER_HEIGHT,
       alignItems:'center',
       justifyContent:'center'
      }}
     >
      <Image
       source={{
        uri:item.media_url
       }}
       style={s.communityViewerImage}
       resizeMode="contain"
      />
     </View>
    }
   />

   <View style={s.communityViewerTop}>
    <Text style={s.communityViewerCount}>
     {viewerIndex+1} / {viewerItems.length}
    </Text>

    <Pressable
     onPress={()=>
      setViewerOpen(false)
     }
     style={s.communityViewerClose}
    >
     <MaterialCommunityIcons
      name="close"
      size={27}
      color="#FFFFFF"
     />
    </Pressable>
   </View>

   {viewerItems.length>1&&(
    <Text style={s.communityViewerHint}>
     Swipe vertically for more photos
    </Text>
   )}

  </View>
 </Modal>


 {/* PATCH_161H_COMMENT_DRAWER */}
 <Modal
  visible={commentOpen}
  transparent
  animationType="slide"
  onRequestClose={closeComments}
 >
  <KeyboardAvoidingView
   style={{flex:1}}
   behavior={
    Platform.OS==='ios'
     ? 'padding'
     : undefined
   }
  >
   <View style={s.communityCommentOverlay}>

    <Pressable
     style={{flex:1}}
     onPress={closeComments}
    />

    <View style={s.communityCommentDrawer}>

     <View style={s.communityDrawerHandle}/>

     <View style={s.communityCommentHeader}>
      <View style={{flex:1}}>
       <Text style={s.communityCommentTitle}>
        Comments
       </Text>

       {!!commentPost&&(
        <Text
         numberOfLines={1}
         style={s.communityCommentPostMeta}
        >
         {commentPost.author_name||
          'BUKLOD Member'}
         {' • '}
         {comments.length}
         {' '}
         {comments.length===1
          ? 'comment'
          : 'comments'}
        </Text>
       )}
      </View>

      <Pressable
       onPress={closeComments}
       style={s.communityDrawerClose}
      >
       <MaterialCommunityIcons
        name="close"
        size={22}
        color={colors.text}
       />
      </Pressable>
     </View>


     <ScrollView
      style={{flex:1}}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={
       s.communityCommentList
      }
     >
      {!comments.length&&(
       <Text style={s.communityCommentEmpty}>
        No comments yet. Be the first to respond.
       </Text>
      )}

      {comments.map(c=>{
       const parent=
        c.parent_id
         ? comments.find(
            x=>
             String(x.id)===
             String(c.parent_id)
           )
         : null;

       const totalReactions=
        commentReactionTotal(c);

       return (
        <View
         key={c.id}
         style={[
          s.communityCommentItem,
          c.parent_id&&
           s.communityReplyItem
         ]}
        >

         <ProfileAvatar
          userId={c.user_id}
          name={
           c.commenter_name||
           'BUKLOD Member'
          }
          size={34}
         />

         <View style={{flex:1}}>

          <View style={s.communityCommentBubble}>
           <Text style={s.communityCommentName}>
            {c.commenter_name||
             'BUKLOD Member'}
           </Text>

           <Text style={s.communityCommentMeta}>
            {formatClusterName(
             c.cluster_name
            )}
            {' • '}
            {formatSpecificDateTime(
             c.created_at
            )}
           </Text>

           {!!parent&&(
            <Text style={s.communityReplyingTo}>
             Replying to{' '}
             {parent.commenter_name||
              'BUKLOD Member'}
            </Text>
           )}

           <Text style={s.communityCommentBody}>
            {c.body}
           </Text>
          </View>


          <View style={s.communityCommentActions}>

           <Pressable
            onPress={()=>
             setReplyTo(c)
            }
           >
            <Text style={s.communityCommentActionText}>
             Reply
            </Text>
           </Pressable>

           <Pressable
            onPress={()=>
             openCommentReaction(c)
            }
            style={s.communityCommentReactButton}
           >
            <MaterialCommunityIcons
             name={
              c.my_reaction
               ? (
                  RX.find(
                   r=>
                    r.key===
                    c.my_reaction
                  )?.icon??
                  'emoticon-outline'
                 )
               : 'emoticon-outline'
             }
             size={16}
             color={
              c.my_reaction
               ? colors.greenDark
               : colors.muted
             }
            />

            <Text
             style={[
              s.communityCommentActionText,
              c.my_reaction&&
               s.communityCommentActionActive
             ]}
            >
             {c.my_reaction
              ? reactionLabel(
                 c.my_reaction
                )
              : 'React'}
             {totalReactions>0
              ? \` · \${totalReactions}\`
              : ''}
            </Text>
           </Pressable>

          </View>

         </View>
        </View>
       );
      })}
     </ScrollView>


     {!!replyTo&&(
      <View style={s.communityReplyBanner}>
       <View style={{flex:1}}>
        <Text style={s.communityReplyBannerLabel}>
         Replying to
        </Text>

        <Text style={s.communityReplyBannerName}>
         {replyTo.commenter_name||
          'BUKLOD Member'}
        </Text>
       </View>

       <Pressable
        onPress={()=>
         setReplyTo(null)
        }
       >
        <MaterialCommunityIcons
         name="close"
         size={20}
         color={colors.greenDark}
        />
       </Pressable>
      </View>
     )}


     <View style={s.communityCommentComposer}>

      <TextInput
       value={commentText}
       onChangeText={setCommentText}
       multiline
       placeholder={
        replyTo
         ? 'Write a reply...'
         : 'Write a comment...'
       }
       style={s.communityCommentInput}
      />

      <Pressable
       disabled={
        commentBusy||
        !commentText.trim()
       }
       onPress={()=>
        void submitCommunityComment()
       }
       style={[
        s.communityCommentSend,
        (
         commentBusy||
         !commentText.trim()
        )&&{
         opacity:.4
        }
       ]}
      >
       <MaterialCommunityIcons
        name="send"
        size={20}
        color="#FFFFFF"
       />
      </Pressable>

     </View>

    </View>
   </View>
  </KeyboardAvoidingView>
 </Modal>


 {/* PATCH_161H_COMMENT_REACTION_PICKER */}
 <Modal
  visible={commentReactionOpen}
  transparent
  animationType="fade"
  onRequestClose={()=>{
   setCommentReactionOpen(false);
   setCommentReactionTarget(null);
  }}
 >
  <View style={s.communityReactionOverlay}>
   <Pressable
    style={{flex:1}}
    onPress={()=>{
     setCommentReactionOpen(false);
     setCommentReactionTarget(null);
    }}
   />

   <View style={s.communityReactionPicker}>
    {RX.map(item=>
     <Pressable
      key={item.key}
      onPress={()=>
       void reactToComment(
        item.key
       )
      }
      style={[
       s.communityReactionChoice,
       commentReactionTarget
        ?.my_reaction===
        item.key &&
        s.communityReactionChoiceActive
      ]}
     >
      <MaterialCommunityIcons
       name={item.icon}
       size={22}
       color={colors.greenDark}
      />

      <Text style={s.communityReactionChoiceText}>
       {item.label}
      </Text>
     </Pressable>
    )}
   </View>
  </View>
 </Modal>


 `;

src =
  src.replace(
    modalAnchor,
    communityModals +
    modalAnchor
  );


/* ============================================================
   O. STYLES
   ============================================================ */

const styleEnd =
  src.lastIndexOf(
    '});'
  );

if (
  styleEnd < 0
) {
  stop(
    'Stylesheet end not found.'
  );
}

const styles =
`,

 communityComposerPhotos:{
  marginTop:10,
  marginBottom:8,
  flexDirection:'row',
  flexWrap:'wrap',
  gap:5
 },

 communityComposerPhoto:{
  width:'31.8%',
  height:92,
  position:'relative',
  backgroundColor:'#E8ECE9'
 },

 communityComposerPhotoImage:{
  width:'100%',
  height:'100%'
 },

 communityComposerPhotoRemove:{
  position:'absolute',
  top:4,
  right:4,
  width:26,
  height:26,
  alignItems:'center',
  justifyContent:'center',
  borderRadius:13,
  backgroundColor:'rgba(0,0,0,.68)'
 },


 communityMediaGrid:{
  marginTop:10,
  marginHorizontal:-12,
  flexDirection:'row',
  flexWrap:'wrap',
  gap:2,
  overflow:'hidden',
  backgroundColor:'#E7EBE8'
 },

 communityMediaTile:{
  overflow:'hidden',
  backgroundColor:'#DDE4DF'
 },

 communityMediaOne:{
  width:'100%',
  height:310
 },

 communityMediaHalfTall:{
  width:'49.7%',
  height:250
 },

 communityMediaWide:{
  width:'100%',
  height:210
 },

 communityMediaHalf:{
  width:'49.7%',
  height:165
 },

 communityMediaHalfSmall:{
  width:'49.7%',
  height:140
 },

 communityMediaImage:{
  width:'100%',
  height:'100%'
 },


 communityViewerScreen:{
  flex:1,
  backgroundColor:'#000000'
 },

 communityViewerImage:{
  width:'100%',
  height:'100%'
 },

 communityViewerTop:{
  position:'absolute',
  top:0,
  left:0,
  right:0,
  paddingTop:44,
  paddingHorizontal:16,
  flexDirection:'row',
  alignItems:'center',
  justifyContent:'space-between'
 },

 communityViewerCount:{
  color:'#FFFFFF',
  fontSize:13,
  fontWeight:'900',
  textShadowColor:'rgba(0,0,0,.7)',
  textShadowRadius:4
 },

 communityViewerClose:{
  width:42,
  height:42,
  borderRadius:21,
  backgroundColor:'rgba(0,0,0,.55)',
  alignItems:'center',
  justifyContent:'center'
 },

 communityViewerHint:{
  position:'absolute',
  bottom:34,
  alignSelf:'center',
  paddingHorizontal:12,
  paddingVertical:7,
  borderRadius:16,
  backgroundColor:'rgba(0,0,0,.58)',
  color:'#FFFFFF',
  fontSize:10,
  fontWeight:'800'
 },


 communityCommentOverlay:{
  flex:1,
  justifyContent:'flex-end',
  backgroundColor:'rgba(0,0,0,.30)'
 },

 communityCommentDrawer:{
  height:'82%',
  backgroundColor:colors.background,
  borderTopLeftRadius:18,
  borderTopRightRadius:18,
  overflow:'hidden'
 },

 communityDrawerHandle:{
  width:42,
  height:4,
  marginTop:8,
  marginBottom:6,
  borderRadius:2,
  alignSelf:'center',
  backgroundColor:'#BAC4BD'
 },

 communityCommentHeader:{
  minHeight:58,
  paddingHorizontal:13,
  paddingBottom:9,
  flexDirection:'row',
  alignItems:'center',
  borderBottomWidth:
   StyleSheet.hairlineWidth,
  borderBottomColor:
   colors.line,
  backgroundColor:
   colors.white
 },

 communityCommentTitle:{
  fontSize:17,
  fontWeight:'900',
  color:colors.text
 },

 communityCommentPostMeta:{
  marginTop:2,
  fontSize:9.5,
  color:colors.muted
 },

 communityDrawerClose:{
  width:38,
  height:38,
  alignItems:'center',
  justifyContent:'center'
 },

 communityCommentList:{
  paddingHorizontal:10,
  paddingTop:10,
  paddingBottom:18,
  gap:8
 },

 communityCommentEmpty:{
  paddingVertical:32,
  textAlign:'center',
  fontSize:11,
  color:colors.muted
 },

 communityCommentItem:{
  flexDirection:'row',
  alignItems:'flex-start',
  gap:7
 },

 communityReplyItem:{
  marginLeft:22
 },

 communityCommentBubble:{
  paddingHorizontal:10,
  paddingVertical:8,
  backgroundColor:'#F0F3F1',
  borderRadius:10
 },

 communityCommentName:{
  fontSize:11,
  fontWeight:'900',
  color:colors.text
 },

 communityCommentMeta:{
  marginTop:1,
  fontSize:8.5,
  color:colors.muted
 },

 communityReplyingTo:{
  marginTop:5,
  fontSize:9,
  fontWeight:'800',
  color:colors.greenDark
 },

 communityCommentBody:{
  marginTop:4,
  fontSize:12.5,
  lineHeight:18,
  color:colors.text
 },

 communityCommentActions:{
  marginTop:3,
  paddingLeft:5,
  flexDirection:'row',
  alignItems:'center',
  gap:14
 },

 communityCommentReactButton:{
  flexDirection:'row',
  alignItems:'center',
  gap:3
 },

 communityCommentActionText:{
  fontSize:9.5,
  fontWeight:'800',
  color:colors.muted
 },

 communityCommentActionActive:{
  color:colors.greenDark
 },

 communityReplyBanner:{
  paddingHorizontal:12,
  paddingVertical:7,
  flexDirection:'row',
  alignItems:'center',
  borderTopWidth:
   StyleSheet.hairlineWidth,
  borderTopColor:
   colors.line,
  backgroundColor:'#EDF5EF'
 },

 communityReplyBannerLabel:{
  fontSize:8,
  color:colors.muted
 },

 communityReplyBannerName:{
  marginTop:1,
  fontSize:10,
  fontWeight:'900',
  color:colors.greenDark
 },

 communityCommentComposer:{
  minHeight:62,
  paddingHorizontal:9,
  paddingTop:7,
  paddingBottom:10,
  flexDirection:'row',
  alignItems:'flex-end',
  gap:7,
  borderTopWidth:
   StyleSheet.hairlineWidth,
  borderTopColor:
   colors.line,
  backgroundColor:
   colors.white
 },

 communityCommentInput:{
  flex:1,
  minHeight:42,
  maxHeight:105,
  paddingHorizontal:10,
  paddingVertical:8,
  borderWidth:1,
  borderColor:colors.line,
  borderRadius:12,
  textAlignVertical:'top',
  backgroundColor:
   colors.background
 },

 communityCommentSend:{
  width:42,
  height:42,
  borderRadius:21,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:
   colors.green
 },


 communityReactionOverlay:{
  flex:1,
  justifyContent:'flex-end',
  backgroundColor:
   'rgba(0,0,0,.20)'
 },

 communityReactionPicker:{
  marginHorizontal:10,
  marginBottom:24,
  padding:8,
  flexDirection:'row',
  justifyContent:'space-between',
  gap:3,
  borderRadius:18,
  backgroundColor:
   colors.white,
  borderWidth:1,
  borderColor:
   colors.line
 },

 communityReactionChoice:{
  flex:1,
  minHeight:57,
  alignItems:'center',
  justifyContent:'center',
  gap:3,
  borderRadius:12
 },

 communityReactionChoiceActive:{
  backgroundColor:
   colors.greenSoft
 },

 communityReactionChoiceText:{
  fontSize:7.5,
  fontWeight:'800',
  textAlign:'center',
  color:colors.text
 }`;

src =
  src.slice(
    0,
    styleEnd
  ) +
  styles +
  '\n' +
  src.slice(
    styleEnd
  );


/* ============================================================
   P. VERIFY NO OLD PHOTO STATE
   ============================================================ */

/*
 * PATCH_161H_B1_STALE_PHOTO_RESET
 * Old single-photo reset compatibility.
 */
src =
  src.replace(
    /\bsetPhoto\(\s*null\s*\)/g,
    'setPhotos([])'
  );


/*
 * PATCH_161H_B2_CAMERA_MULTI_PHOTO
 *
 * Existing camera / photo preparation helpers may still use:
 *
 *   setPhoto({
 *     uri: ...,
 *     base64: ...,
 *     sizeBytes: ...
 *   });
 *
 * Convert those to append into the new photos[] state.
 */
src =
  src.replace(
    /\bsetPhoto\(\s*\{([\s\S]*?)\}\s*\)\s*;?/g,
    (
      _match,
      objectBody
    ) =>
      `setPhotos(current=>
       current.length>=5
        ? current
        : [
           ...current,
           {
            ${objectBody}
           }
          ].slice(0,5)
      );`
  );

const staleSetPhoto =
  [...src.matchAll(
    /\bsetPhoto\(/g
  )];


if (
  staleSetPhoto.length
) {
  console.error('');
  console.error(
    'REMAINING setPhoto REFERENCES:'
  );

  for (
    const match
    of staleSetPhoto
  ) {
    const at =
      match.index ?? 0;

    console.error(
      src.slice(
        Math.max(
          0,
          at - 140
        ),
        Math.min(
          src.length,
          at + 220
        )
      )
    );

    console.error(
      '-----------------------------'
    );
  }

  stop(
    'Unsupported old setPhoto(...) reference remains.'
  );
}

if (
  /\bphoto\?/.test(src)
) {
  console.warn(
    'NOTE: a possible old photo conditional remains; TypeScript will verify it.'
  );
}


/* ============================================================
   WRITE
   ============================================================ */

fs.writeFileSync(
  path,
  src,
  'utf8'
);

console.log('');
console.log(
  'PATCH 161H-B FRONTEND APPLIED'
);

console.log(
  '✓ Whole post card no longer navigates'
);

console.log(
  '✓ Up to 5 photos'
);

console.log(
  '✓ Collage media card'
);

console.log(
  '✓ Full-screen vertical photo viewer'
);

console.log(
  '✓ Same-screen comments drawer'
);

console.log(
  '✓ Replies inside drawer'
);

console.log(
  '✓ Comment/reply reactions'
);
