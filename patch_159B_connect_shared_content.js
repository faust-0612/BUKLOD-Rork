const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );

function stop(message) {
  console.error("");
  console.error(
    "PATCH 159B STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


/* ============================================================
   1. REACT NATIVE IMPORTS
   ============================================================ */

{
  const re =
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"];/;

  const match =
    src.match(re);

  if (!match) {
    stop(
      "react-native import not found."
    );
  }

  let inside =
    match[1];

  for (
    const name of [
      "Dimensions",
      "Linking",
    ]
  ) {
    const nameRe =
      new RegExp(
        `\\b${name}\\b`
      );

    if (
      !nameRe.test(inside)
    ) {
      inside =
        `\n  ${name},` +
        inside;
    }
  }

  src =
    src.replace(
      re,
      `import {${inside}} from 'react-native';`
    );
}


/* ============================================================
   2. EXPO FILE SYSTEM + MEDIA LIBRARY
   ============================================================ */

if (
  !src.includes(
    "from 'expo-file-system'"
  )
) {
  const anchor =
    "from 'react-native';";

  const pos =
    src.indexOf(anchor);

  if (pos < 0) {
    stop(
      "Could not insert FileSystem import."
    );
  }

  const end =
    pos + anchor.length;

  src =
    src.slice(0, end) +
`
import {
  File,
  Paths,
} from 'expo-file-system';

import {
  Asset,
  requestPermissionsAsync,
} from 'expo-media-library';
` +
    src.slice(end);
}


/* ============================================================
   3. SHARED CONTENT STATES
   ============================================================ */

if (
  !src.includes(
    "sharedContentOpen"
  )
) {
  const stateRe =
/const\s*\[\s*conversationMenuOpen,\s*setConversationMenuOpen,\s*\]\s*=\s*useState\(false\);/m;

  const stateMatch =
    src.match(stateRe);

  if (!stateMatch) {
    stop(
      "Conversation menu state anchor missing."
    );
  }

  src =
    src.replace(
      stateRe,
`${stateMatch[0]}

  /* PATCH_159B_SHARED_CONTENT */
  const [
    sharedContentOpen,
    setSharedContentOpen,
  ] =
    useState(false);

  const [
    sharedContentTab,
    setSharedContentTab,
  ] =
    useState<
      'media' |
      'files' |
      'links'
    >('media');

  const [
    viewerUrl,
    setViewerUrl,
  ] =
    useState<string | null>(
      null
    );

  const [
    savingMedia,
    setSavingMedia,
  ] =
    useState(false);`
    );
}


/* ============================================================
   4. SHARED CONTENT DATA + FUNCTIONS
   ============================================================ */

if (
  !src.includes(
    "PATCH_159B_SHARED_CONTENT_LOGIC"
  )
) {
  const clearAnchor =
    "  const clearConversation =";

  const clearPos =
    src.indexOf(
      clearAnchor
    );

  if (clearPos < 0) {
    stop(
      "clearConversation anchor missing."
    );
  }

  const logic =
`
  /* PATCH_159B_SHARED_CONTENT_LOGIC */

  const sharedMedia =
    messages.filter(
      (m: any) =>
        !m.is_deleted &&
        !!m.media_path &&
        !!m.media_url &&
        String(
          m.media_mime_type ||
          'image/jpeg'
        ).startsWith(
          'image/'
        )
    );


  const sharedFiles =
    messages.filter(
      (m: any) =>
        !m.is_deleted &&
        !!m.media_path &&
        !!m.media_url &&
        !String(
          m.media_mime_type ||
          'image/jpeg'
        ).startsWith(
          'image/'
        )
    );


  const sharedLinks =
    (() => {
      const seen =
        new Set<string>();

      const rows:
        {
          url: string;
          message_id: string;
        }[] = [];

      for (
        const message of messages
      ) {
        if (
          message.is_deleted ||
          !message.body
        ) {
          continue;
        }

        const matches =
          String(
            message.body
          ).match(
            /https?:\\/\\/[^\\s<>"']+/gi
          ) || [];

        for (
          const rawUrl of matches
        ) {
          const url =
            rawUrl.replace(
              /[),.!?]+$/,
              ''
            );

          if (
            !url ||
            seen.has(url)
          ) {
            continue;
          }

          seen.add(url);

          rows.push({
            url,
            message_id:
              message.message_id,
          });
        }
      }

      return rows;
    })();


  const openSharedContent =
    () => {
      setConversationMenuOpen(
        false
      );

      setSharedContentTab(
        'media'
      );

      setSharedContentOpen(
        true
      );
    };


  const openExternalUrl =
    async (
      url: string
    ) => {
      try {
        await Linking.openURL(
          url
        );
      }
      catch (error: any) {
        Alert.alert(
          'Open Link',
          error?.message ||
          'Could not open this link.'
        );
      }
    };


  const saveSharedPhoto =
    async (
      url: string
    ) => {
      if (
        !url ||
        savingMedia
      ) {
        return;
      }

      setSavingMedia(true);

      let downloaded:
        File | null =
          null;

      try {
        const destination =
          new File(
            Paths.cache,
            \`buklod-photo-\${Date.now()}.jpg\`
          );

        downloaded =
          await File
            .downloadFileAsync(
              url,
              destination
            );

        const permission =
          await requestPermissionsAsync();

        if (
          permission.status !==
          'granted'
        ) {
          Alert.alert(
            'Save Photo',
            'Please allow photo access to save this image.'
          );

          return;
        }

        await Asset.create(
          downloaded.uri
        );

        Alert.alert(
          'Saved',
          'Photo saved to your device.'
        );
      }
      catch (error: any) {
        console.error(
          'Save BUKLOD photo:',
          error
        );

        Alert.alert(
          'Save Photo',
          error?.message ||
          'Could not save this photo.'
        );
      }
      finally {
        try {
          if (
            downloaded?.exists
          ) {
            downloaded.delete();
          }
        }
        catch {}

        setSavingMedia(false);
      }
    };


`;

  src =
    src.slice(
      0,
      clearPos
    ) +
    logic +
    src.slice(
      clearPos
    );
}


/* ============================================================
   5. MAKE MESSAGE PHOTOS CLICKABLE
   ============================================================ */

if (
  !src.includes(
    'accessibilityLabel="View photo full screen"'
  )
) {
  const imageRe =
/\{\!\!m\.media_url\s*&&\s*\(\s*<Image\s+source=\{\{\s*uri:\s*m\.media_url,\s*\}\}\s+style=\{\s*s\.photo\s*\}\s+resizeMode=["']cover["']\s*\/>\s*\)\}/m;

  if (
    !imageRe.test(src)
  ) {
    stop(
      "Current message photo block not found."
    );
  }

  src =
    src.replace(
      imageRe,
`{!!m.media_url && (
                      <Pressable
                        accessibilityLabel="View photo full screen"
                        onPress={() =>
                          setViewerUrl(
                            m.media_url
                          )
                        }
                      >
                        <Image
                          source={{
                            uri:
                              m.media_url,
                          }}
                          style={
                            s.photo
                          }
                          resizeMode="cover"
                        />
                      </Pressable>
                    )}`
    );
}


/* ============================================================
   6. ADD MEDIA / FILES / LINKS TO 3 DOT MENU
   ============================================================ */

if (
  !src.includes(
    "View shared photos, files and links."
  )
) {
  const deleteRe =
/<Pressable\s+style=\{\[\s*s\.action,\s*s\.dangerAction,\s*\]\}\s+onPress=\{\s*clearConversation\s*\}/m;

  const deleteMatch =
    src.match(deleteRe);

  if (!deleteMatch) {
    stop(
      "Delete Conversation menu anchor missing."
    );
  }

  const sharedAction =
`<Pressable
              style={s.action}
              onPress={
                openSharedContent
              }
            >
              <MaterialCommunityIcons
                name="folder-multiple-outline"
                size={21}
                color={
                  colors.greenDark
                }
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    s.actionText
                  }
                >
                  Media, Files & Links
                </Text>

                <Text
                  style={
                    s.actionSub
                  }
                >
                  View shared photos, files and links.
                </Text>
              </View>
            </Pressable>


            `;

  src =
    src.replace(
      deleteRe,
      sharedAction +
      deleteMatch[0]
    );
}


/* ============================================================
   7. SHARED CONTENT + FULL SCREEN VIEWER MODALS
   ============================================================ */

if (
  !src.includes(
    "PATCH_159B_SHARED_CONTENT_MODAL"
  )
) {
  const menuAnchor =
    "      {/* CONVERSATION MENU */}";

  const menuPos =
    src.indexOf(
      menuAnchor
    );

  if (menuPos < 0) {
    stop(
      "Conversation menu JSX anchor missing."
    );
  }

  const modals =
`
      {/* PATCH_159B_SHARED_CONTENT_MODAL */}
      <Modal
        visible={
          sharedContentOpen
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setSharedContentOpen(
            false
          )
        }
      >
        <View
          style={s.modalRoot}
        >
          <Pressable
            style={s.overlay}
            onPress={() =>
              setSharedContentOpen(
                false
              )
            }
          />

          <View
            style={[
              s.drawer,
              {
                maxHeight: '84%',
              },
            ]}
          >
            <View
              style={{
                flexDirection:
                  'row',
                alignItems:
                  'center',
                marginBottom: 12,
              }}
            >
              <Text
                style={[
                  s.drawerTitle,
                  {
                    flex: 1,
                    marginBottom: 0,
                  },
                ]}
              >
                Shared Content
              </Text>

              <Pressable
                onPress={() =>
                  setSharedContentOpen(
                    false
                  )
                }
                style={{
                  width: 38,
                  height: 38,
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={
                    colors.greenDark
                  }
                />
              </Pressable>
            </View>


            <View
              style={{
                flexDirection:
                  'row',
                gap: 7,
                marginBottom: 12,
              }}
            >
              {(
                [
                  [
                    'media',
                    'MEDIA',
                  ],
                  [
                    'files',
                    'FILES',
                  ],
                  [
                    'links',
                    'LINKS',
                  ],
                ] as const
              ).map(
                ([key, label]) => (
                  <Pressable
                    key={key}
                    onPress={() =>
                      setSharedContentTab(
                        key
                      )
                    }
                    style={{
                      flex: 1,
                      minHeight: 38,
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor:
                        sharedContentTab ===
                        key
                          ? colors.green
                          : colors.line,
                      backgroundColor:
                        sharedContentTab ===
                        key
                          ? colors.greenSoft
                          : colors.white,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight:
                          '900',
                        color:
                          sharedContentTab ===
                          key
                            ? colors.greenDark
                            : colors.muted,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              )}
            </View>


            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              {sharedContentTab ===
                'media' && (
                <>
                  {sharedMedia.length ===
                  0 ? (
                    <Text
                      style={
                        shared.muted
                      }
                    >
                      No shared photos yet.
                    </Text>
                  ) : (
                    <View
                      style={{
                        flexDirection:
                          'row',
                        flexWrap:
                          'wrap',
                        gap: 7,
                      }}
                    >
                      {sharedMedia.map(
                        (
                          item: any
                        ) => (
                          <Pressable
                            key={
                              item.message_id
                            }
                            onPress={() =>
                              setViewerUrl(
                                item.media_url
                              )
                            }
                            style={{
                              width: '31%',
                              aspectRatio: 1,
                              overflow:
                                'hidden',
                              borderRadius:
                                10,
                              backgroundColor:
                                colors.greenSoft,
                            }}
                          >
                            <Image
                              source={{
                                uri:
                                  item.media_url,
                              }}
                              resizeMode="cover"
                              style={{
                                width: '100%',
                                height: '100%',
                              }}
                            />
                          </Pressable>
                        )
                      )}
                    </View>
                  )}
                </>
              )}


              {sharedContentTab ===
                'files' && (
                <>
                  {sharedFiles.length ===
                  0 ? (
                    <Text
                      style={
                        shared.muted
                      }
                    >
                      No shared files yet.
                    </Text>
                  ) : (
                    sharedFiles.map(
                      (
                        item: any
                      ) => {
                        const name =
                          String(
                            item.media_path ||
                            'Shared file'
                          )
                            .split('/')
                            .pop() ||
                          'Shared file';

                        return (
                          <Pressable
                            key={
                              item.message_id
                            }
                            style={
                              s.action
                            }
                            onPress={() =>
                              void openExternalUrl(
                                item.media_url
                              )
                            }
                          >
                            <MaterialCommunityIcons
                              name="file-document-outline"
                              size={22}
                              color={
                                colors.greenDark
                              }
                            />

                            <View
                              style={{
                                flex: 1,
                              }}
                            >
                              <Text
                                numberOfLines={
                                  1
                                }
                                style={
                                  s.actionText
                                }
                              >
                                {name}
                              </Text>

                              <Text
                                style={
                                  s.actionSub
                                }
                              >
                                {item.media_mime_type ||
                                  'File'}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      }
                    )
                  )}
                </>
              )}


              {sharedContentTab ===
                'links' && (
                <>
                  {sharedLinks.length ===
                  0 ? (
                    <Text
                      style={
                        shared.muted
                      }
                    >
                      No shared links yet.
                    </Text>
                  ) : (
                    sharedLinks.map(
                      (
                        item
                      ) => (
                        <Pressable
                          key={
                            item.message_id +
                            item.url
                          }
                          style={
                            s.action
                          }
                          onPress={() =>
                            void openExternalUrl(
                              item.url
                            )
                          }
                        >
                          <MaterialCommunityIcons
                            name="link-variant"
                            size={22}
                            color={
                              colors.greenDark
                            }
                          />

                          <Text
                            numberOfLines={
                              2
                            }
                            style={[
                              s.actionText,
                              {
                                flex: 1,
                              },
                            ]}
                          >
                            {item.url}
                          </Text>
                        </Pressable>
                      )
                    )
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* FULL SCREEN MESSAGE PHOTO */}
      <Modal
        visible={
          !!viewerUrl
        }
        animationType="fade"
        onRequestClose={() =>
          setViewerUrl(null)
        }
      >
        <View
          style={{
            flex: 1,
            backgroundColor:
              '#000',
            paddingTop:
              Math.max(
                insets.top,
                10
              ),
            paddingBottom:
              Math.max(
                insets.bottom,
                10
              ),
          }}
        >
          <View
            style={{
              minHeight: 52,
              paddingHorizontal: 12,
              flexDirection:
                'row',
              alignItems:
                'center',
              justifyContent:
                'space-between',
            }}
          >
            <Pressable
              onPress={() =>
                setViewerUrl(
                  null
                )
              }
              style={{
                width: 42,
                height: 42,
                alignItems:
                  'center',
                justifyContent:
                  'center',
              }}
            >
              <MaterialCommunityIcons
                name="close"
                size={27}
                color="#FFFFFF"
              />
            </Pressable>

            <Pressable
              disabled={
                savingMedia ||
                !viewerUrl
              }
              onPress={() => {
                if (
                  viewerUrl
                ) {
                  void saveSharedPhoto(
                    viewerUrl
                  );
                }
              }}
              style={{
                minHeight: 40,
                paddingHorizontal:
                  14,
                flexDirection:
                  'row',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                gap: 6,
                borderRadius: 20,
                backgroundColor:
                  'rgba(255,255,255,.16)',
                opacity:
                  savingMedia
                    ? 0.55
                    : 1,
              }}
            >
              <MaterialCommunityIcons
                name="download"
                size={20}
                color="#FFFFFF"
              />

              <Text
                style={{
                  color:
                    '#FFFFFF',
                  fontSize: 11,
                  fontWeight:
                    '900',
                }}
              >
                {savingMedia
                  ? 'SAVING...'
                  : 'SAVE'}
              </Text>
            </Pressable>
          </View>

          {!!viewerUrl && (
            <Image
              source={{
                uri:
                  viewerUrl,
              }}
              resizeMode="contain"
              style={{
                flex: 1,
                width: '100%',
              }}
            />
          )}
        </View>
      </Modal>


`;

  src =
    src.slice(
      0,
      menuPos
    ) +
    modals +
    src.slice(
      menuPos
    );
}


/* ============================================================
   8. SMART LONG-PRESS POSITION
   Only apply if previous patch has not yet been applied.
   ============================================================ */

if (
  !src.includes(
    "__menuAbove"
  )
) {
  const longPressRe =
/onLongPress=\{\s*m\.is_deleted\s*\?\s*undefined\s*:\s*\(\)\s*=>\s*\{\s*setSelected\(\s*m\s*\);\s*setActionOpen\(\s*true\s*\);\s*\}\s*\}/m;

  if (
    longPressRe.test(src)
  ) {
    src =
      src.replace(
        longPressRe,
`onLongPress={
                  m.is_deleted
                    ? undefined
                    : (event) => {
                        const screenHeight =
                          Dimensions
                            .get('window')
                            .height;

                        const pressY =
                          event
                            .nativeEvent
                            .pageY;

                        const menuAbove =
                          pressY >
                          screenHeight *
                            0.55;

                        setSelected({
                          ...m,
                          __menuAbove:
                            menuAbove,
                        });

                        setActionOpen(
                          true
                        );
                      }
                }`
      );
  }


  const positionRe =
/top:\s*['"]100%['"],\s*left:\s*m\.is_mine\s*\?\s*undefined\s*:\s*0,\s*right:\s*m\.is_mine\s*\?\s*0\s*:\s*undefined,\s*marginTop:\s*5,/m;

  if (
    positionRe.test(src)
  ) {
    src =
      src.replace(
        positionRe,
`top:
                        selected?.__menuAbove
                          ? undefined
                          : '100%',

                      bottom:
                        selected?.__menuAbove
                          ? '100%'
                          : undefined,

                      left:
                        m.is_mine
                          ? undefined
                          : 0,

                      right:
                        m.is_mine
                          ? 0
                          : undefined,

                      marginTop:
                        selected?.__menuAbove
                          ? 0
                          : 5,

                      marginBottom:
                        selected?.__menuAbove
                          ? 5
                          : 0,`
      );
  }
}


fs.writeFileSync(
  path,
  src,
  "utf8"
);

console.log("");
console.log(
  "PATCH 159B APPLIED"
);
