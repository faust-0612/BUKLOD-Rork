const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/(tabs)/buklod.tsx'
);

if(!fs.existsSync(file)){
  throw new Error(
    'buklod.tsx not found'
  );
}

let t=fs.readFileSync(
  file,
  'utf8'
);

const backup=
  file+'.bak154s';

if(!fs.existsSync(backup)){
  fs.copyFileSync(
    file,
    backup
  );
}

/* ============================================================
   FIND ONLY pickPhoto FUNCTION
============================================================ */

const start=
  t.indexOf(
    'const pickPhoto'
  );

if(start<0){
  throw new Error(
    'Community pickPhoto not found'
  );
}

const arrow=
  t.indexOf(
    '=>',
    start
  );

if(
  arrow<0 ||
  arrow-start>500
){
  throw new Error(
    'Community pickPhoto format not recognized'
  );
}

const open=
  t.indexOf(
    '{',
    arrow
  );

if(open<0){
  throw new Error(
    'pickPhoto opening brace not found'
  );
}

let depth=0;
let close=-1;

for(
  let i=open;
  i<t.length;
  i++
){
  if(t[i]==='{'){
    depth++;
  }

  if(t[i]==='}'){
    depth--;

    if(depth===0){
      close=i;
      break;
    }
  }
}

if(close<0){
  throw new Error(
    'pickPhoto closing brace not found'
  );
}

let end=close+1;

while(
  end<t.length &&
  /\s/.test(t[end])
){
  end++;
}

if(t[end]===';'){
  end++;
}

/* ============================================================
   CAMERA + GALLERY
============================================================ */

const replacement=`
 const prepareCommunityPhoto =
  async(asset:any)=>{
   const M=
    await import(
     'expo-image-manipulator'
    );

   const actions:any[]=[];

   if(
    Number(asset.width??0)>
    1400
   ){
    actions.push({
     resize:{width:1400}
    });
   }

   const x=
    await M.manipulateAsync(
     asset.uri,
     actions,
     {
      compress:.78,
      format:
       M.SaveFormat.JPEG,
      base64:true
     }
    );

   if(!x.base64){
    throw new Error(
     'Could not prepare image.'
    );
   }

   const sizeBytes=
    Math.ceil(
     x.base64.length*.75
    );

   if(
    sizeBytes >
    5*1024*1024
   ){
    throw new Error(
     'Photo is too large.'
    );
   }

   setPhoto({
    uri:x.uri,
    base64:x.base64,
    sizeBytes
   });
  };


 /* PATCH_154S_COMMUNITY_CAMERA */
 const takeCommunityPhoto=
  async()=>{
   try{
    setPhotoBusy(true);

    const P=
     await import(
      'expo-image-picker'
     );

    const perm=
     await P
      .requestCameraPermissionsAsync();

    if(!perm.granted){
     Alert.alert(
      'Camera Permission',
      'Allow BUKLOD to use your camera to take a photo.'
     );

     return;
    }

    const r=
     await P.launchCameraAsync({
      mediaTypes:
       ['images'] as any,
      allowsEditing:false,
      quality:1
     });

    if(
     r.canceled ||
     !r.assets?.[0]
    ){
     return;
    }

    await prepareCommunityPhoto(
     r.assets[0]
    );

   }catch(e:any){

    Alert.alert(
     'Camera',
     e?.message ??
     'Could not take photo.'
    );

   }finally{
    setPhotoBusy(false);
   }
  };


 const chooseCommunityPhoto=
  async()=>{
   try{
    setPhotoBusy(true);

    const P=
     await import(
      'expo-image-picker'
     );

    const perm=
     await P
      .requestMediaLibraryPermissionsAsync();

    if(!perm.granted){
     Alert.alert(
      'Photo Permission',
      'Allow BUKLOD to access your photos.'
     );

     return;
    }

    const r=
     await P
      .launchImageLibraryAsync({
       mediaTypes:
        ['images'] as any,
       allowsEditing:false,
       allowsMultipleSelection:false,
       quality:1
      });

    if(
     r.canceled ||
     !r.assets?.[0]
    ){
     return;
    }

    await prepareCommunityPhoto(
     r.assets[0]
    );

   }catch(e:any){

    Alert.alert(
     'Photo',
     e?.message ??
     'Could not select photo.'
    );

   }finally{
    setPhotoBusy(false);
   }
  };


 const pickPhoto=()=>{
  if(photoBusy)return;

  Alert.alert(
   'Add Photo',
   'Choose photo source.',
   [
    {
     text:'CAMERA',
     onPress:()=>{
      void takeCommunityPhoto();
     }
    },
    {
     text:'GALLERY',
     onPress:()=>{
      void chooseCommunityPhoto();
     }
    },
    {
     text:'CANCEL',
     style:'cancel'
    }
   ]
  );
 };`;

const next=
  t.slice(0,start)+
  replacement+
  t.slice(end);

/* safety */
if(
  !next.includes(
    'searchMentions'
  )
){
  throw new Error(
    'SAFETY STOP: code after pickPhoto was affected.'
  );
}

fs.writeFileSync(
  file,
  next,
  'utf8'
);

console.log('');
console.log(
 'PATCH 154S WRITTEN'
);
console.log(
 '✓ Community Camera'
);
console.log(
 '✓ Community Gallery'
);
console.log(
 '✓ existing post upload preserved'
);
console.log('');

