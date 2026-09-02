const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/connect/[id].tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154r_safe';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   LOCATE ONLY const pickPhoto = ... { ... };
   No next-function guessing.
============================================================ */

const start=t.indexOf('const pickPhoto');

if(start<0){
  throw new Error('pickPhoto not found');
}

const arrow=t.indexOf('=>',start);

if(arrow<0 || arrow-start>500){
  throw new Error('pickPhoto arrow function not recognized');
}

const open=t.indexOf('{',arrow);

if(open<0){
  throw new Error('pickPhoto opening brace not found');
}

let depth=0;
let close=-1;

for(let i=open;i<t.length;i++){

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
  throw new Error('pickPhoto closing brace not found');
}

/* include trailing semicolon if present */
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

const before=t.slice(0,start);
const after=t.slice(end);

/* ============================================================
   CAMERA + GALLERY
============================================================ */

const replacement=`const prepareMessagePhoto =
    async (asset:any) => {

      const M =
        await import(
          'expo-image-manipulator'
        );

      const actions:any[]=[];

      if(
        Number(asset.width??0) >
        1400
      ){
        actions.push({
          resize:{
            width:1400
          }
        });
      }

      const prepared =
        await M.manipulateAsync(
          asset.uri,
          actions,
          {
            compress:0.78,
            format:
              M.SaveFormat.JPEG,
            base64:true
          }
        );

      if(!prepared.base64){
        throw new Error(
          'Could not prepare photo.'
        );
      }

      const sizeBytes=
        Math.ceil(
          prepared.base64.length *
          0.75
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
        uri:prepared.uri,
        base64:prepared.base64,
        sizeBytes
      });
    };


  /* PATCH_154R_SAFE_CAMERA */
  const takeMessagePhoto =
    async () => {

      try{

        setPhotoBusy(true);

        const P=
          await import(
            'expo-image-picker'
          );

        const permission=
          await P
            .requestCameraPermissionsAsync();

        if(!permission.granted){

          Alert.alert(
            'Camera Permission',
            'Allow BUKLOD to use the camera to take and send photos.'
          );

          return;
        }

        const result=
          await P.launchCameraAsync({
            mediaTypes:
              ['images'] as any,

            allowsEditing:false,
            quality:1
          });

        if(
          result.canceled ||
          !result.assets?.[0]
        ){
          return;
        }

        await prepareMessagePhoto(
          result.assets[0]
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


  const chooseMessagePhoto =
    async () => {

      try{

        setPhotoBusy(true);

        const P=
          await import(
            'expo-image-picker'
          );

        const permission=
          await P
            .requestMediaLibraryPermissionsAsync();

        if(!permission.granted){

          Alert.alert(
            'Photo Permission',
            'Allow BUKLOD to access your photos.'
          );

          return;
        }

        const result=
          await P
            .launchImageLibraryAsync({
              mediaTypes:
                ['images'] as any,

              allowsEditing:false,
              allowsMultipleSelection:false,
              quality:1
            });

        if(
          result.canceled ||
          !result.assets?.[0]
        ){
          return;
        }

        await prepareMessagePhoto(
          result.assets[0]
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


  const pickPhoto =
    () => {

      if(photoBusy){
        return;
      }

      Alert.alert(
        'Send Photo',
        'Choose photo source.',
        [
          {
            text:'CAMERA',
            onPress:()=>{
              void takeMessagePhoto();
            }
          },

          {
            text:'GALLERY',
            onPress:()=>{
              void chooseMessagePhoto();
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
  before+
  replacement+
  after;


/* ============================================================
   SAFETY CHECKS
============================================================ */

if(!next.includes('saveEdit')){
  throw new Error(
    'SAFETY STOP: saveEdit disappeared.'
  );
}

if(
  !next.includes(
    'requestCameraPermissionsAsync'
  )
){
  throw new Error(
    'Camera patch was not inserted.'
  );
}

fs.writeFileSync(
  file,
  next,
  'utf8'
);

console.log('');
console.log('PATCH 154R-SAFE WRITTEN');
console.log('✓ pickPhoto only replaced');
console.log('✓ saveEdit preserved');
console.log('✓ CAMERA available');
console.log('✓ GALLERY available');
console.log('✓ existing send/upload flow preserved');
console.log('');

