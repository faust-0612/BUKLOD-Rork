const fs = require('node:fs');

const PUBLIC_FILE = 'src/app/(tabs)/buklod.tsx';
const SCOPED_FILE = 'src/components/BuklodExclusiveScopeCommunity.tsx';

function fail(message) {
  throw new Error(`[IGPAT COMMUNITY TS CLEANUP] ${message}`);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail(`${label}: start marker not found`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) fail(`${label}: end marker not found`);
  const count = source.split(startMarker).length - 1;
  if (count !== 1) fail(`${label}: expected exactly one start marker, found ${count}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const publicReplacement = ` const publish=async()=>{
  if(!user)return;

  if(wallVideo186O || communityGif){
   return Alert.alert(
    'Community',
    'Community accepts text and photos only. Post videos through BUKLOD IGPAT.'
   );
  }

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
   audience==='local' &&
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
    'Write a message or add photos first.'
   );
  }

  const snapshot={
   body:body.trim(),
   photos:[...photos],
   mentions:[...mentions],
   audience,
   category,
   groupId:group?.id??null,
   userId:user.id
  };

  setBody('');
  setPhotos([]);
  setWallVideo186O(null);
  setCommunityGif(null);
  setMentions([]);
  setBusy(false);

  const startNotice=
   snapshot.photos.length
    ? 'Uploading photos in the background…'
    : 'Posting in the background…';
  setPublishNotice(startNotice);

  enqueueCommunityPublish(
   startNotice,
   async(setNotice)=>{
    const uploaded:Array<{
     media_path:string;
     media_mime_type:string;
     media_size_bytes:number;
    }>=[];

    let createdPostId:string|null=null;

    const createPost=async(
     first:{
      media_path:string;
      media_mime_type:string;
      media_size_bytes:number;
     }|null
    )=>{
     const {data:created,error:createError}=
      await (supabase as any).rpc(
       'create_buklod_community_post_v3',
       {
        p_audience:snapshot.audience,
        p_group_id:
         snapshot.audience==='group'
          ? snapshot.groupId
          : null,
        p_category:snapshot.category,
        p_body:
         snapshot.body ||
         (snapshot.photos.length ? '' : 'Shared an update.'),
        p_media_path:first?.media_path??null,
        p_media_mime_type:first?.media_mime_type??null,
        p_media_size_bytes:first?.media_size_bytes??null,
        p_media_duration_seconds:null,
        p_is_reel:false,
        p_mentioned_user_ids:snapshot.mentions.map(x=>x.user_id)
       }
      );

     if(createError){
      throw createError;
     }

     createdPostId=extractCreatedRecordId(created);
     if(!createdPostId){
      throw new Error(
       'Post was created but its ID was not returned.'
      );
     }

     void load();
    };

    try{
     setNotice(startNotice);

     if(snapshot.photos.length){
      setNotice(
       \`Uploading photos in the background… 0/\${snapshot.photos.length}\`
      );
      setPublishNotice(
       \`Uploading photos in the background… 0/\${snapshot.photos.length}\`
      );

      let finished=0;
      const photoUploads=
       await mapWithConcurrency(
        snapshot.photos,
        3,
        async(photo,index)=>{
         const path=
          \`\${snapshot.userId}/post-\${Date.now()}-\${index}-\${Math.random().toString(36).slice(2)}.jpg\`;

         const uploadedPhoto=
          await uploadCommunityPhotoFile({
           path,
           uri:photo.uri,
          });

         finished+=1;
         const notice=
          \`Uploading photos in the background… \${finished}/\${snapshot.photos.length}\`;
         setNotice(notice);
         setPublishNotice(notice);

         return {
          media_path:path,
          media_mime_type:'image/jpeg',
          media_size_bytes:
           uploadedPhoto.sizeBytes ||
           photo.sizeBytes ||
           0
         };
        }
       );

      uploaded.push(...photoUploads);
     }

     await createPost(uploaded[0]??null);

     if(uploaded.length && createdPostId){
      setNotice('Finishing your post…');
      setPublishNotice('Finishing your post…');
      await attachCommunityPostMedia(
       createdPostId,
       uploaded
      );
     }

     await load();
    }
    catch(e){
     await discardIncompleteCommunityPost({
      postId:createdPostId,
      mediaPaths:uploaded.map(x=>x.media_path),
     });

     setBody(snapshot.body);
     setPhotos(snapshot.photos);
     setWallVideo186O(null);
     setCommunityGif(null);
     setMentions(snapshot.mentions);

     Alert.alert(
      'Could Not Post',
      e?.message||'Posting failed.'
     );

     await load();
     throw e;
    }
    finally{
     setBusy(false);
     setVideoUploadPercent186O(null);
     setPublishNotice(null);
    }
   }
  );
 };
`;

const scopedReplacement = `  const publish =
    async () => {
      if (!user?.id) {
        return;
      }

      if (
        !!reel ||
        !!wallVideo ||
        !!communityGif
      ) {
        Alert.alert(
          'Community',
          'Community accepts text and photos only. Post videos through BUKLOD IGPAT.'
        );
        return;
      }

      const cleanBody = body.trim();

      if (
        !cleanBody &&
        !photos.length
      ) {
        Alert.alert(
          'Nothing to Post',
          'Write a message or add photos first.'
        );
        return;
      }

      const snapshot = {
        photos: [...photos],
        cleanBody,
        userId: user.id,
        scopeId: scope.scope_id,
      };

      setBody('');
      clearMedia();
      setBusy(false);
      setPublishNotice(
        snapshot.photos.length
          ? 'Uploading photos in the background…'
          : 'Posting in the background…'
      );

      void (async () => {
        let uploadedPath:string|null=null;
        let createdPostId:string|null=null;
        let extraMedia:Array<{
          media_path:string;
          media_mime_type:string;
          media_size_bytes:number;
        }>=[];

        try {
          let mediaMime:string|null=null;
          let mediaSize:number|null=null;

          if (snapshot.photos.length) {
            const photoUploads =
              await mapWithConcurrency(
                snapshot.photos,
                3,
                async (item, index) => {
                  const path =
                    \`scope/\${snapshot.scopeId}/\${snapshot.userId}/post-\${Date.now()}-\${index}-\${Math.random().toString(36).slice(2)}.jpg\`;

                  const uploadedPhoto =
                    await uploadCommunityPhotoFile({
                      path,
                      uri: item.uri,
                    });

                  return {
                    media_path: path,
                    media_mime_type: 'image/jpeg',
                    media_size_bytes:
                      uploadedPhoto.sizeBytes ||
                      item.sizeBytes ||
                      0,
                  };
                }
              );

            uploadedPath = photoUploads[0]?.media_path ?? null;
            mediaMime = photoUploads[0]?.media_mime_type ?? null;
            mediaSize = photoUploads[0]?.media_size_bytes ?? null;
            extraMedia = photoUploads;
          }

          const fallbackBody =
            snapshot.photos.length
              ? 'Shared photos.'
              : snapshot.cleanBody;

          const {data:created,error:createError} =
            await (supabase as any).rpc(
              'buklod_scope_social_create_post_v1',
              {
                p_scope_id:snapshot.scopeId,
                p_body:snapshot.cleanBody || fallbackBody,
                p_category:'discussion',
                p_media_path:uploadedPath,
                p_media_mime_type:mediaMime,
                p_media_size_bytes:mediaSize,
                p_duration_seconds:null,
                p_is_reel:false,
              }
            );

          if (createError) {
            throw createError;
          }

          const createdId = extractCreatedRecordId(created);
          createdPostId = createdId;

          if (createdId && extraMedia.length) {
            await attachCommunityPostMedia(
              createdId,
              extraMedia
            );
          }

          await load();
        }
        catch (error) {
          if (
            uploadedPath ||
            extraMedia.length ||
            createdPostId
          ) {
            await discardIncompleteCommunityPost({
              postId:createdPostId,
              scopeId:snapshot.scopeId,
              mediaPaths:[
                ...(uploadedPath ? [uploadedPath] : []),
                ...extraMedia.map(item => item.media_path),
              ],
            });
          }

          setBody(snapshot.cleanBody);
          setPhotos(snapshot.photos);
          setWallVideo(null);
          setReel(null);
          setCommunityGif(null);

          Alert.alert(
            'Could Not Post',
            error?.message ?? 'Posting failed.'
          );
        }
        finally {
          setBusy(false);
          setVideoUploadPercent(null);
          setPublishNotice(null);
        }
      })();
    };
`;

let publicSource = fs.readFileSync(PUBLIC_FILE, 'utf8');
publicSource = replaceSection(
  publicSource,
  ' const publish=async()=>{',
  '\n }; const react=async(',
  publicReplacement,
  'Public Community publish'
);

let scopedSource = fs.readFileSync(SCOPED_FILE, 'utf8');
scopedSource = replaceSection(
  scopedSource,
  '  const publish =\n    async () => {',
  '\n  const react =',
  scopedReplacement,
  'Scoped Community publish'
);

const publicPublishStart = publicSource.indexOf(' const publish=async()=>{');
const publicPublishEnd = publicSource.indexOf('\n }; const react=async(', publicPublishStart);
const scopedPublishStart = scopedSource.indexOf('  const publish =\n    async () => {');
const scopedPublishEnd = scopedSource.indexOf('\n  const react =', scopedPublishStart);
if (publicPublishStart < 0 || publicPublishEnd < 0) fail('Public post-patch verification markers missing');
if (scopedPublishStart < 0 || scopedPublishEnd < 0) fail('Scoped post-patch verification markers missing');

const publicPublish = publicSource.slice(publicPublishStart, publicPublishEnd);
const scopedPublish = scopedSource.slice(scopedPublishStart, scopedPublishEnd);

for (const forbidden of ['snapshot.wallVideo','snapshot.communityGif']) {
  if (publicPublish.includes(forbidden)) fail(`Public publish still contains ${forbidden}`);
}
for (const forbidden of ["mode === 'reels'",'snapshot.wallVideo','snapshot.communityGif','snapshot.reel','publishingReel']) {
  if (scopedPublish.includes(forbidden)) fail(`Scoped publish still contains ${forbidden}`);
}
if (!publicPublish.includes('Write a message or add photos first.')) fail('Public text/photo-only empty-state anchor missing');
if (!scopedPublish.includes('Write a message or add photos first.')) fail('Scoped text/photo-only empty-state anchor missing');
if (!scopedSource.includes("router.push('/igpat/create' as any)")) fail('Scoped IGPAT create route disappeared');

fs.writeFileSync(PUBLIC_FILE, publicSource, 'utf8');
fs.writeFileSync(SCOPED_FILE, scopedSource, 'utf8');

console.log('IGPAT Community TypeScript cleanup applied safely.');
console.log('Changed only Public/Scoped Community publish creation paths.');
console.log('Historical media rendering/read paths were not removed.');
