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
  'PATCH 161H-C STOPPED:'
 );
 console.error(message);
 process.exit(1);
}


if(
 !src.includes(
  'PATCH_161H_SINGLE_SCREEN_COMMUNITY'
 )
){
 stop(
  '161H single-screen Community is not installed.'
 );
}


if(
 src.includes(
  'PATCH_161H_C_PHOTO_VIEWER_PLUS'
 )
){
 stop(
  '161H-C already appears to be installed.'
 );
}



/* ============================================================
   A. B3 BASE64 TYPESCRIPT FIX
   ============================================================ */

src =
 src.replace(
  /base64:\s*x\.base64\s*,/g,
  'base64:x.base64!,'
 );



/* ============================================================
   B. ZOOM IMPORTS
   ============================================================ */

const decodeImport =
 "import {decode} from 'base64-arraybuffer';";


if(
 !src.includes(
  decodeImport
 )
){
 stop(
  'base64 import anchor not found.'
 );
}


if(
 !src.includes(
  "from 'react-native-gesture-handler'"
 )
){
 src =
  src.replace(
   decodeImport,
`${decodeImport}

import {
 Gesture,
 GestureDetector
} from 'react-native-gesture-handler';

import Animated,{
 useAnimatedStyle,
 useSharedValue,
 withTiming
} from 'react-native-reanimated';`
  );
}



/* ============================================================
   C. ZOOMABLE FULLSCREEN PHOTO COMPONENT
   ============================================================ */

const viewerConst =
 'const COMMUNITY_VIEWER_HEIGHT=';


if(
 !src.includes(
  viewerConst
 )
){
 stop(
  'Community viewer constant not found.'
 );
}


const zoomComponent =
`// PATCH_161H_C_PHOTO_VIEWER_PLUS

function CommunityZoomPhoto({
 uri
}:{
 uri:string
}){
 const scale=
  useSharedValue(1);

 const startScale=
  useSharedValue(1);


 const pinch=
  Gesture.Pinch()

   .onStart(()=>{
    startScale.value=
     scale.value;
   })

   .onUpdate(event=>{
    scale.value=
     Math.max(
      1,
      Math.min(
       4,
       startScale.value*
       event.scale
      )
     );
   })

   .onEnd(()=>{
    if(scale.value<1.05){
     scale.value=
      withTiming(1);
    }
   });


 const doubleTap=
  Gesture.Tap()

   .numberOfTaps(2)

   .maxDuration(280)

   .onEnd(
    (_event,success)=>{
     if(!success){
      return;
     }

     scale.value=
      withTiming(
       scale.value>1.1
        ? 1
        : 2.5
      );
    }
   );


 const gesture=
  Gesture.Simultaneous(
   pinch,
   doubleTap
  );


 const animatedStyle=
  useAnimatedStyle(
   ()=>({
    transform:[
     {
      scale:
       scale.value
     }
    ]
   })
  );


 return (
  <GestureDetector
   gesture={gesture}
  >
   <Animated.Image
    source={{uri}}
    style={[
     s.communityViewerImage,
     animatedStyle
    ]}
    resizeMode="contain"
   />
  </GestureDetector>
 );
}


`;

src =
 src.replace(
  viewerConst,
  zoomComponent+
  viewerConst
 );



/* ============================================================
   D. SAVE STATE
   ============================================================ */

const viewerIndexRx =
 /const \[viewerIndex,setViewerIndex\]=\s*useState\(0\);/;


if(
 !viewerIndexRx.test(src)
){
 stop(
  'viewerIndex state not found.'
 );
}


src =
 src.replace(
  viewerIndexRx,
`const [viewerIndex,setViewerIndex]=
  useState(0);

 const [
  savingPhotoKey,
  setSavingPhotoKey
 ]=useState<string|null>(null);`
 );



/* ============================================================
   E. PHOTO REACTION + SAVE FUNCTIONS
   ============================================================ */

const openViewerAnchor =
 'const openPhotoViewer=';


if(
 !src.includes(
  openViewerAnchor
 )
){
 stop(
  'openPhotoViewer anchor not found.'
 );
}


const photoFunctions =
`// PATCH_161H_C_PHOTO_ACTIONS

 const photoReactionTotal=
  (photo:any)=>{
   return Object
    .values(
     photo?.reaction_counts??
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


 const reactToCommunityPhoto=
  async(
   photo:any,
   reaction:Reaction
  )=>{

   const postId=
    String(
     photo?.post_id??
     ''
    );

   const mediaPosition=
    Number(
     photo?.media_position??
     0
    );


   if(!postId){
    return;
   }


   const previous=
    (
     photo?.my_reaction??
     null
    ) as Reaction|null;


   const {
    data,
    error
   }=
    await (
     supabase as any
    ).rpc(
     'set_buklod_photo_reaction_v1',
     {
      p_post_id:
       postId,

      p_media_position:
       mediaPosition,

      p_reaction:
       reaction
     }
    );


   if(error){
    return Alert.alert(
     'Photo Reaction',
     error.message
    );
   }


   const nextReaction=
    (
     data??
     null
    ) as Reaction|null;


   const updatePhoto=
    (item:any)=>{

     if(
      String(
       item?.post_id??
       ''
      )!==postId
      ||
      Number(
       item?.media_position??
       0
      )!==mediaPosition
     ){
      return item;
     }


     const counts={
      ...(
       item?.reaction_counts??
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

      reaction_counts:
       counts,

      my_reaction:
       nextReaction
     };
    };


   setViewerItems(
    current=>
     current.map(
      updatePhoto
     )
   );


   setPosts(
    current=>
     current.map(
      post=>{

       if(
        String(post.id)!==
        postId
       ){
        return post;
       }

       return {
        ...post,

        media_items:
         Array.isArray(
          post.media_items
         )
          ? post.media_items
             .map(
              updatePhoto
             )
          : []
       };
      }
     )
   );
  };


 const saveCommunityPhoto=
  async(
   photo:any
  )=>{

   const url=
    String(
     photo?.media_url??
     ''
    );


   if(!url){
    return;
   }


   const key=
    String(
     photo?.post_id??
     ''
    )+
    ':'+
    String(
     photo?.media_position??
     0
    );


   try{
    setSavingPhotoKey(
     key
    );


    const FS=
     await import(
      'expo-file-system'
     );


    const ML=
     await import(
      'expo-media-library'
     );


    const permission=
     await ML
      .requestPermissionsAsync(
       true,
       ['photo']
      );


    if(!permission.granted){
     return Alert.alert(
      'Save Photo',
      'Please allow BUKLOD to save photos to your device.'
     );
    }


    const mime=
     String(
      photo?.media_mime_type??
      'image/jpeg'
     )
      .toLowerCase();


    const extension=
     mime.includes(
      'png'
     )
      ? 'png'
      : mime.includes(
         'webp'
        )
      ? 'webp'
      : 'jpg';


    const destination=
     new FS.File(
      FS.Paths.cache,
      'buklod-'+
       Date.now()+
       '-'+
       Math.random()
        .toString(36)
        .slice(2)+
       '.'+
       extension
     );


    const downloaded=
     await FS.File
      .downloadFileAsync(
       url,
       destination
      );


    await ML.Asset.create(
     downloaded.uri
    );


    Alert.alert(
     'Saved',
     'Photo saved to your gallery.'
    );
   }
   catch(e:any){
    Alert.alert(
     'Save Photo',
     e?.message||
     'Could not save this photo.'
    );
   }
   finally{
    setSavingPhotoKey(
     null
    );
   }
  };


 const renderViewerPhotoActions=
  ()=>{

   const photo=
    viewerItems[
     viewerIndex
    ];


   if(!photo){
    return null;
   }


   const counts=
    photo.reaction_counts??
    {};


   const saveKey=
    String(
     photo?.post_id??
     ''
    )+
    ':'+
    String(
     photo?.media_position??
     0
    );


   return (
    <View style={s.communityViewerActions}>

     <Text style={s.communityViewerActionTitle}>
      React to this photo
     </Text>


     <View style={s.communityViewerReactionRow}>

      {RX.map(r=>{

       const active=
        photo.my_reaction===
        r.key;

       const count=
        Number(
         counts[r.key]??
         0
        );


       return (
        <Pressable
         key={r.key}

         accessibilityRole="button"

         accessibilityLabel={
          r.label+
          (
           count
            ? ', '+
              count
            : ''
          )
         }

         onPress={()=>
          void reactToCommunityPhoto(
           photo,
           r.key
          )
         }

         style={[
          s.communityViewerReactionButton,
          active&&
           s.communityViewerReactionButtonActive
         ]}
        >

         <MaterialCommunityIcons
          name={r.icon}
          size={20}
          color={
           active
            ? '#FFFFFF'
            : '#FFFFFF'
          }
         />

         {count>0&&(
          <Text style={s.communityViewerReactionCount}>
           {count}
          </Text>
         )}

        </Pressable>
       );
      })}


      <Pressable
       disabled={
        savingPhotoKey===
        saveKey
       }

       onPress={()=>
        void saveCommunityPhoto(
         photo
        )
       }

       style={s.communityViewerSaveButton}
      >

       <MaterialCommunityIcons
        name={
         savingPhotoKey===
         saveKey
          ? 'progress-download'
          : 'download'
        }
        size={20}
        color="#FFFFFF"
       />

       <Text style={s.communityViewerSaveText}>
        {savingPhotoKey===
         saveKey
          ? 'Saving'
          : 'Save'}
       </Text>

      </Pressable>

     </View>


     {photoReactionTotal(photo)>0&&(
      <Text style={s.communityViewerReactionSummary}>
       {photoReactionTotal(photo)}
       {' '}
       {photoReactionTotal(photo)===1
        ? 'reaction'
        : 'reactions'}
       {' on this photo'}
      </Text>
     )}

    </View>
   );
  };


 `;


src =
 src.replace(
  openViewerAnchor,
  photoFunctions+
  openViewerAnchor
 );



/* ============================================================
   F. FULLSCREEN IMAGE -> ZOOMABLE IMAGE
   ============================================================ */

const oldViewerImage =
`<Image
       source={{
        uri:item.media_url
       }}
       style={s.communityViewerImage}
       resizeMode="contain"
      />`;


if(
 !src.includes(
  oldViewerImage
 )
){
 stop(
  'Fullscreen Image anchor not found.'
 );
}


src =
 src.replace(
  oldViewerImage,
`<CommunityZoomPhoto
       uri={item.media_url}
      />`
 );



/* ============================================================
   G. INSERT REACTION/SAVE TOOLBAR
   ============================================================ */

const hintAnchor =
 `{viewerItems.length>1&&(`;


if(
 !src.includes(
  hintAnchor
 )
){
 stop(
  'Viewer hint anchor not found.'
 );
}


src =
 src.replace(
  hintAnchor,
`{renderViewerPhotoActions()}

   ${hintAnchor}`
 );



/* ============================================================
   H. MOVE SWIPE HINT HIGHER
   ============================================================ */

src =
 src.replace(
  /communityViewerHint:\{\s*position:'absolute',\s*bottom:34,/,
`communityViewerHint:{
  position:'absolute',
  bottom:132,`
 );



/* ============================================================
   I. ADD VIEWER ACTION STYLES
   ============================================================ */

const styleEnd=
 src.lastIndexOf(
  '});'
 );


if(styleEnd<0){
 stop(
  'StyleSheet end not found.'
 );
}


const extraStyles =
`,

 communityViewerActions:{
  position:'absolute',
  left:8,
  right:8,
  bottom:22,
  paddingHorizontal:8,
  paddingVertical:8,
  borderRadius:16,
  backgroundColor:'rgba(0,0,0,.60)'
 },

 communityViewerActionTitle:{
  marginBottom:6,
  paddingLeft:3,
  color:'#FFFFFF',
  fontSize:9,
  fontWeight:'800'
 },

 communityViewerReactionRow:{
  flexDirection:'row',
  alignItems:'center',
  gap:4
 },

 communityViewerReactionButton:{
  flex:1,
  minWidth:35,
  height:40,
  borderRadius:20,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:'rgba(255,255,255,.14)'
 },

 communityViewerReactionButtonActive:{
  backgroundColor:colors.green
 },

 communityViewerReactionCount:{
  position:'absolute',
  top:1,
  right:3,
  minWidth:15,
  height:15,
  paddingHorizontal:3,
  borderRadius:8,
  overflow:'hidden',
  textAlign:'center',
  color:'#FFFFFF',
  backgroundColor:colors.greenDark,
  fontSize:8,
  fontWeight:'900'
 },

 communityViewerSaveButton:{
  minWidth:52,
  height:40,
  paddingHorizontal:6,
  borderRadius:20,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:'rgba(255,255,255,.16)'
 },

 communityViewerSaveText:{
  marginTop:1,
  color:'#FFFFFF',
  fontSize:7.5,
  fontWeight:'800'
 },

 communityViewerReactionSummary:{
  marginTop:5,
  paddingLeft:3,
  color:'#E7EFEA',
  fontSize:8.5
 }`;


src =
 src.slice(
  0,
  styleEnd
 )+
 extraStyles+
 '\n'+
 src.slice(
  styleEnd
 );



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
 'PATCH 161H-C FRONTEND APPLIED'
);

console.log(
 '✓ Pinch zoom up to 4x'
);

console.log(
 '✓ Double-tap zoom/reset'
);

console.log(
 '✓ Vertical photo swipe preserved'
);

console.log(
 '✓ Individual reactions per photo'
);

console.log(
 '✓ Save to Gallery'
);

console.log(
 '✓ B3 base64 TypeScript fix included'
);
