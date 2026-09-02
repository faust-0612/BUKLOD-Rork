const fs = require("fs");
const ts = require("typescript");

const path =
  "./src/app/admin/mission-bulletins.tsx";

let src =
  fs.readFileSync(path, "utf8")
    .replace(/^\uFEFF/, "");


if (
  src.includes(
    "PATCH_161C1_MISSION_BULLETIN_PHOTO"
  )
) {
  console.log(
    "PATCH 161C-1 already installed."
  );
  process.exit(0);
}


/* ============================================================
   HELPERS
============================================================ */

function parse(code) {
  return ts.createSourceFile(
    path,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}


function findFunction(
  code,
  functionName
) {

  const sf =
    parse(code);

  const fn =
    sf.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        node.name?.text ===
          functionName
    );

  if (
    !fn ||
    !fn.body
  ) {
    throw new Error(
      "Function not found: " +
      functionName
    );
  }

  return {
    sf,
    fn,
  };
}


function insertAtFunctionStart(
  code,
  functionName,
  block
) {

  const {
    fn,
  } =
    findFunction(
      code,
      functionName
    );

  const position =
    fn.body.getStart() + 1;

  return (
    code.slice(
      0,
      position
    ) +
    "\n" +
    block +
    "\n" +
    code.slice(
      position
    )
  );
}


function insertAfterBodyTextInput(
  code,
  functionName,
  jsxBlock
) {

  const {
    sf,
    fn,
  } =
    findFunction(
      code,
      functionName
    );


  let target =
    null;


  function visit(node) {

    if (target) {
      return;
    }


    if (
      ts.isJsxSelfClosingElement(
        node
      )
    ) {

      const tag =
        node.tagName.getText(
          sf
        );


      if (
        tag ===
        "TextInput"
      ) {

        const valueAttribute =
          node.attributes.properties.find(
            (property) =>
              ts.isJsxAttribute(
                property
              ) &&
              property.name.getText(
                sf
              ) ===
                "value"
          );


        if (
          valueAttribute &&
          valueAttribute.initializer &&
          ts.isJsxExpression(
            valueAttribute.initializer
          ) &&
          valueAttribute.initializer.expression &&
          ts.isIdentifier(
            valueAttribute.initializer.expression
          ) &&
          valueAttribute.initializer.expression.text ===
            "body"
        ) {

          target =
            node;

          return;
        }
      }
    }


    ts.forEachChild(
      node,
      visit
    );
  }


  visit(
    fn.body
  );


  if (!target) {
    throw new Error(
      "Body TextInput not found."
    );
  }


  return (
    code.slice(
      0,
      target.end
    ) +
    "\n" +
    jsxBlock +
    "\n" +
    code.slice(
      target.end
    )
  );
}


/* ============================================================
   IMPORTS
============================================================ */

src =
`/* PATCH_161C1_MISSION_BULLETIN_PHOTO */
import {
  decode as decodeBulletinMedia,
} from 'base64-arraybuffer';

import {
  Image as AdminBulletinImage,
} from 'expo-image';

import {
  Pressable as BulletinPhotoPressable,
} from 'react-native';

` + src;


/* ============================================================
   BULLETIN TYPE
============================================================ */

const typeAnchor =
`  body: string;
  priority: number;`;

if (
  !src.includes(
    typeAnchor
  )
) {
  throw new Error(
    "Bulletin type anchor not found."
  );
}

src =
  src.replace(
    typeAnchor,
`  body: string;
  media_path: string | null;
  priority: number;`
  );


/* ============================================================
   LOAD MEDIA_PATH IN ADMIN LIST
============================================================ */

src =
  src.replace(
    /id,church_id,author_id,title,body,priority,is_pinned,is_published,starts_at,expires_at,created_at,church:church_id\(name\)/,
    "id,church_id,author_id,title,body,media_path,priority,is_pinned,is_published,starts_at,expires_at,created_at,church:church_id(name)"
  );


/* ============================================================
   PHOTO STATE + PICKER
============================================================ */

src =
  insertAtFunctionStart(
    src,
    "MissionBulletinsScreen",
String.raw`
  const [
    bulletinPhoto,
    setBulletinPhoto,
  ] =
    useState<{
      uri: string;
      base64: string;
    } | null>(
      null
    );


  const [
    bulletinPhotoBusy,
    setBulletinPhotoBusy,
  ] =
    useState(false);


  const [
    bulletinRemovePhoto,
    setBulletinRemovePhoto,
  ] =
    useState(false);


  const pickBulletinPhoto =
    async () => {

      try {

        setBulletinPhotoBusy(
          true
        );


        const ImagePicker =
          await import(
            'expo-image-picker'
          );


        const ImageManipulator =
          await import(
            'expo-image-manipulator'
          );


        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();


        if (
          !permission.granted
        ) {

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
                true,
              quality:
                0.9,
              base64:
                true,
            });


        if (
          result.canceled ||
          !result.assets?.[0]
        ) {
          return;
        }


        const prepared =
          await ImageManipulator
            .manipulateAsync(
              result.assets[0].uri,
              [
                {
                  resize: {
                    width:
                      1600,
                  },
                },
              ],
              {
                compress:
                  0.8,
                format:
                  ImageManipulator
                    .SaveFormat
                    .JPEG,
                base64:
                  true,
              }
            );


        if (
          !prepared.base64
        ) {

          throw new Error(
            'Could not prepare the selected photo.'
          );
        }


        setBulletinPhoto({
          uri:
            prepared.uri,
          base64:
            prepared.base64,
        });


        setBulletinRemovePhoto(
          false
        );

      } catch (
        error: any
      ) {

        Alert.alert(
          'Mission Bulletin Photo',
          error?.message ||
            'Could not select the photo.'
        );

      } finally {

        setBulletinPhotoBusy(
          false
        );

      }

    };
`
  );


/* ============================================================
   CLEAR SELECTED PHOTO WHEN EDIT TARGET CHANGES
============================================================ */

src =
  src.replace(
    /setEditingId\(([^;\n]+)\);/g,
    (match) =>
`${match}
    setBulletinPhoto(null);
    setBulletinRemovePhoto(false);`
  );


/* ============================================================
   SAVE: LOAD EXISTING PHOTO + UPLOAD NEW PHOTO
============================================================ */

const savePattern =
  /setBusy\(true\);\s*\n\s*try\s*\{\s*\n\s*const values = \{/;


if (
  !savePattern.test(
    src
  )
) {
  throw new Error(
    "Mission Bulletin save anchor not found."
  );
}


src =
  src.replace(
    savePattern,
String.raw`setBusy(true);

    let previousMediaPath:
      string | null =
      null;

    let uploadedMediaPath:
      string | null =
      null;

    try {

      if (
        editingId
      ) {

        const {
          data:
            currentMedia,
          error:
            currentMediaError,
        } =
          await db
            .from(
              'mission_bulletins'
            )
            .select(
              'media_path'
            )
            .eq(
              'id',
              editingId
            )
            .maybeSingle();


        if (
          currentMediaError
        ) {
          throw currentMediaError;
        }


        previousMediaPath =
          currentMedia
            ?.media_path ??
          null;

      }


      let nextMediaPath:
        string | null =
        bulletinRemovePhoto
          ? null
          : previousMediaPath;


      if (
        bulletinPhoto
      ) {

        if (
          !profile?.id
        ) {
          throw new Error(
            'Your profile is unavailable.'
          );
        }


        uploadedMediaPath =
          'mission/' +
          profile.id +
          '/' +
          Date.now() +
          '-' +
          Math.random()
            .toString(36)
            .slice(2) +
          '.jpg';


        const {
          error:
            uploadError,
        } =
          await supabase
            .storage
            .from(
              'bulletin-media'
            )
            .upload(
              uploadedMediaPath,
              decodeBulletinMedia(
                bulletinPhoto.base64
              ),
              {
                contentType:
                  'image/jpeg',
                cacheControl:
                  '3600',
                upsert:
                  false,
              }
            );


        if (
          uploadError
        ) {
          throw uploadError;
        }


        nextMediaPath =
          uploadedMediaPath;

      }


      const values = {
        media_path:
          nextMediaPath,`
  );


/* ============================================================
   AFTER SUCCESSFUL DB WRITE, REMOVE REPLACED PHOTO
============================================================ */

const successAnchor =
`      Alert.alert(
        'Mission Bulletin',`;


if (
  !src.includes(
    successAnchor
  )
) {
  throw new Error(
    "Mission Bulletin success anchor not found."
  );
}


src =
  src.replace(
    successAnchor,
String.raw`      if (
        previousMediaPath &&
        previousMediaPath !==
          nextMediaPath
      ) {

        await supabase
          .storage
          .from(
            'bulletin-media'
          )
          .remove([
            previousMediaPath,
          ]);

      }


      Alert.alert(
        'Mission Bulletin',`
  );


/* ============================================================
   CLEAN NEW UPLOAD IF DB SAVE FAILS
============================================================ */

const catchAnchor =
`    } catch (error: any) {
      Alert.alert(
        'Could not save bulletin',`;


if (
  !src.includes(
    catchAnchor
  )
) {
  throw new Error(
    "Mission Bulletin catch anchor not found."
  );
}


src =
  src.replace(
    catchAnchor,
String.raw`    } catch (error: any) {

      if (
        uploadedMediaPath
      ) {

        await supabase
          .storage
          .from(
            'bulletin-media'
          )
          .remove([
            uploadedMediaPath,
          ]);

      }


      Alert.alert(
        'Could not save bulletin',`
  );


/* ============================================================
   CLEAR PHOTO STATE AFTER SAVE
============================================================ */

const resetAnchor =
`      resetForm();
      await load();`;


if (
  !src.includes(
    resetAnchor
  )
) {
  throw new Error(
    "Mission Bulletin reset anchor not found."
  );
}


src =
  src.replace(
    resetAnchor,
`      resetForm();

      setBulletinPhoto(
        null
      );

      setBulletinRemovePhoto(
        false
      );

      await load();`
  );


/* ============================================================
   PHOTO CONTROLS AFTER BULLETIN BODY FIELD
============================================================ */

src =
  insertAfterBodyTextInput(
    src,
    "MissionBulletinsScreen",
String.raw`
            {/* PATCH_161C1_BULLETIN_PHOTO_CONTROLS */}

            <View
              style={{
                marginTop: 12,
                marginBottom: 6,
              }}
            >

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: colors.green,
                  marginBottom: 7,
                }}
              >
                BULLETIN PHOTO
              </Text>


              {!!bulletinPhoto && (

                <AdminBulletinImage
                  source={{
                    uri:
                      bulletinPhoto.uri,
                  }}
                  style={{
                    width: '100%',
                    aspectRatio: 16 / 9,
                    borderRadius: 14,
                    marginBottom: 9,
                  }}
                  contentFit="cover"
                />

              )}


              {!bulletinPhoto &&
                editingId &&
                rows.find(
                  (row) =>
                    row.id ===
                    editingId
                )?.media_path &&
                !bulletinRemovePhoto && (

                <View
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: '#F0FDF4',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.greenDark,
                      fontWeight: '700',
                    }}
                  >
                    Current bulletin has a photo attached.
                  </Text>
                </View>

              )}


              {bulletinRemovePhoto && (

                <View
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: '#FEF2F2',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#B91C1C',
                      fontWeight: '800',
                    }}
                  >
                    The current photo will be removed when you save.
                  </Text>
                </View>

              )}


              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >

                <BulletinPhotoPressable
                  disabled={
                    bulletinPhotoBusy
                  }
                  onPress={() =>
                    void pickBulletinPhoto()
                  }
                  style={{
                    backgroundColor:
                      colors.green,
                    paddingHorizontal: 13,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '900',
                      fontSize: 12,
                    }}
                  >
                    {bulletinPhotoBusy
                      ? 'PREPARING...'
                      : bulletinPhoto
                        ? 'CHANGE PHOTO'
                        : 'ADD PHOTO'}
                  </Text>
                </BulletinPhotoPressable>


                {(bulletinPhoto ||
                  (
                    editingId &&
                    rows.find(
                      (row) =>
                        row.id ===
                        editingId
                    )?.media_path
                  )) && (

                  <BulletinPhotoPressable
                    onPress={() => {

                      setBulletinPhoto(
                        null
                      );

                      setBulletinRemovePhoto(
                        true
                      );

                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: '#DC2626',
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: '#B91C1C',
                        fontWeight: '900',
                        fontSize: 12,
                      }}
                    >
                      REMOVE PHOTO
                    </Text>
                  </BulletinPhotoPressable>

                )}


                {bulletinRemovePhoto && (

                  <BulletinPhotoPressable
                    onPress={() =>
                      setBulletinRemovePhoto(
                        false
                      )
                    }
                    style={{
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: '#6B7280',
                        fontWeight: '800',
                        fontSize: 12,
                      }}
                    >
                      KEEP CURRENT PHOTO
                    </Text>
                  </BulletinPhotoPressable>

                )}

              </View>

            </View>
`
  );


/* ============================================================
   WRITE UTF-8 WITHOUT BOM
============================================================ */

fs.writeFileSync(
  path,
  Buffer.from(
    src,
    "utf8"
  )
);


console.log(
  "PATCH 161C-1 INSTALLED"
);
