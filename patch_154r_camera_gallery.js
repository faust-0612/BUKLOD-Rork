const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/connect/[id].tsx');
const backup=file+'.bak154r';

if(!fs.existsSync(file)){
  throw new Error('connect/[id].tsx not found');
}

let t=fs.readFileSync(file,'utf8');

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   FIND CURRENT pickPhoto FUNCTION
============================================================ */

const start=t.indexOf('const pickPhoto');

if(start<0){
  throw new Error('pickPhoto function not found');
}

/* Next function after pickPhoto */
const candidates=[
  'const startEdit',
  'const edit',
  'const send',
  'const upload',
  'const hideMessage'
];

let end=-1;

for(const anchor of candidates){
  const at=t.indexOf(anchor,start+20);

  if(
    at>start &&
    (end<0 || at<end)
  ){
    end=at;
  }
}

if(end<0){
  throw new Error(
    'Could not locate end of pickPhoto function'
  );
}

/* ============================================================
   NEW CAMERA + GALLERY PICKER
============================================================ */

const newPicker=`const prepareSelectedPhoto =
    async (
      asset: {
        uri: string;
        width?: number;
        height?: number;
      }
    ) => {
      const ImageManipulator =
        await import(
          'expo-image-manipulator'
        );

      const context =
        ImageManipulator
          .ImageManipulator
          .manipulate(
            asset.uri
          );

      if (
        Number(
          asset.width ?? 0
        ) > 1400
      ) {
        context.resize({
          width: 1400,
        });
      }

      const rendered =
        await context.renderAsync();

      const saved =
        await rendered.saveAsync({
          format:
            ImageManipulator
              .SaveFormat
              .JPEG,

          compress: 0.78,

          base64: true,
        });

      if (!saved.base64) {
        throw new Error(
          'Could not prepare photo.'
        );
      }

      const sizeBytes =
        Math.ceil(
          saved.base64.length *
          0.75
        );

      if (
        sizeBytes >
        5 * 1024 * 1024
      ) {
        throw new Error(
          'Photo is still larger than 5 MB after compression.'
        );
      }

      setPhoto({
        uri: saved.uri,
        base64:
          saved.base64,
        sizeBytes,
      });
    };


  /* PATCH_154R_CAMERA_GALLERY */
  const takePhoto =
    async () => {
      try {
        setPhotoBusy(true);

        const ImagePicker =
          await import(
            'expo-image-picker'
          );

        const permission =
          await ImagePicker
            .requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Camera Permission',
            'Please allow BUKLOD to use your camera so you can take and send a photo.'
          );

          return;
        }

        const result =
          await ImagePicker
            .launchCameraAsync({
              mediaTypes:
                ['images'] as any,

              allowsEditing:
                false,

              quality: 1,
            });

        if (
          result.canceled ||
          !result.assets?.[0]
        ) {
          return;
        }

        await prepareSelectedPhoto(
          result.assets[0]
        );

      } catch (error:any) {
        Alert.alert(
          'Camera',
          error?.message ||
            'Could not take the photo.'
        );
      } finally {
        setPhotoBusy(false);
      }
    };


  const choosePhoto =
    async () => {
      try {
        setPhotoBusy(true);

        const ImagePicker =
          await import(
            'expo-image-picker'
          );

        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Photo Permission',
            'Please allow BUKLOD to access your photos.'
          );

          return;
        }

        const result =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes:
                ['images'] as any,

              allowsEditing:
                false,

              allowsMultipleSelection:
                false,

              quality: 1,
            });

        if (
          result.canceled ||
          !result.assets?.[0]
        ) {
          return;
        }

        await prepareSelectedPhoto(
          result.assets[0]
        );

      } catch (error:any) {
        Alert.alert(
          'Photo',
          error?.message ||
            'Could not select the photo.'
        );
      } finally {
        setPhotoBusy(false);
      }
    };


  const pickPhoto =
    () => {
      Alert.alert(
        'Send Photo',
        'Choose where the photo will come from.',
        [
          {
            text:
              'CAMERA',

            onPress:
              () => {
                void takePhoto();
              },
          },

          {
            text:
              'GALLERY',

            onPress:
              () => {
                void choosePhoto();
              },
          },

          {
            text:
              'CANCEL',

            style:
              'cancel',
          },
        ]
      );
    };


  `;

t=
  t.slice(0,start)+
  newPicker+
  t.slice(end);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154R WRITTEN');
console.log('✓ Send Photo opens Camera or Gallery');
console.log('✓ Camera permission requested');
console.log('✓ Gallery permission preserved');
console.log('✓ Camera photos use same compression/upload flow');
console.log('');
