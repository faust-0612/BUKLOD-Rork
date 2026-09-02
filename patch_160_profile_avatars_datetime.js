const fs =
  require("fs");


function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}


function write(
  path,
  source
) {
  fs.writeFileSync(
    path,
    source,
    "utf8"
  );
}


function stop(message) {
  console.error("");
  console.error(
    "PATCH 160 STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


function addTopImport(
  source,
  statement
) {
  if (
    source.includes(
      statement
    )
  ) {
    return source;
  }

  return (
    statement +
    "\n" +
    source
  );
}


/* ============================================================
   A. EDITABLE PROFILE PHOTO
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/me.tsx";

  let src =
    read(path);


  src =
    addTopImport(
      src,
      "import { Alert } from 'react-native';"
    );

  src =
    addTopImport(
      src,
      "import * as ImagePicker from 'expo-image-picker';"
    );

  src =
    addTopImport(
      src,
      "import * as ImageManipulator from 'expo-image-manipulator';"
    );

  src =
    addTopImport(
      src,
      "import { decode } from 'base64-arraybuffer';"
    );


  if (
    !src.includes(
      "PATCH_160_EDITABLE_AVATAR"
    )
  ) {

    const authRe =
      /const\s*\{([\s\S]*?)\}\s*=\s*useAuth\(\);/;

    const authMatch =
      src.match(
        authRe
      );

    if (!authMatch) {
      stop(
        "Me useAuth block not found."
      );
    }

    if (
      !authMatch[1]
        .includes(
          "refreshProfile"
        )
    ) {
      const nextBlock =
        authMatch[0]
          .replace(
            /signOut\s*,/,
            "signOut,\n    refreshProfile,"
          );

      src =
        src.replace(
          authMatch[0],
          nextBlock
        );
    }


    const marker =
      "  // PROFILE_CIRCLE_RANK_IDENTITY";

    if (
      !src.includes(
        marker
      )
    ) {
      stop(
        "Profile identity anchor not found."
      );
    }


    const logic =
`
  /* PATCH_160_EDITABLE_AVATAR */
  const [
    avatarBusy,
    setAvatarBusy,
  ] =
    useState(false);


  const changeProfilePhoto =
    async () => {

      if (
        !profile?.id ||
        avatarBusy
      ) {
        return;
      }

      try {
        setAvatarBusy(
          true
        );

        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (
          !permission.granted
        ) {
          Alert.alert(
            'Profile Photo',
            'Please allow photo access to change your profile picture.'
          );

          return;
        }


        const result =
          await ImagePicker
            .launchImageLibraryAsync(
              {
                mediaTypes:
                  [
                    'images',
                  ] as any,

                allowsEditing:
                  true,

                aspect:
                  [1, 1],

                quality:
                  0.82,
              }
            );


        if (
          result.canceled ||
          !result.assets?.[0]
        ) {
          return;
        }


        const prepared =
          await ImageManipulator
            .manipulateAsync(
              result.assets[0]
                .uri,

              [
                {
                  resize: {
                    width:
                      900,
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
            'Could not prepare profile photo.'
          );
        }


        const objectPath =
          \`\${profile.id}/avatar.jpg\`;


        const {
          error:
            uploadError,
        } =
          await supabase
            .storage
            .from(
              'profile-avatars'
            )
            .upload(
              objectPath,

              decode(
                prepared.base64
              ),

              {
                contentType:
                  'image/jpeg',

                upsert:
                  true,

                cacheControl:
                  '3600',
              }
            );


        if (
          uploadError
        ) {
          throw uploadError;
        }


        const {
          data:
            publicData,
        } =
          supabase
            .storage
            .from(
              'profile-avatars'
            )
            .getPublicUrl(
              objectPath
            );


        const avatarUrl =
          \`\${publicData.publicUrl}?v=\${Date.now()}\`;


        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              'profiles'
            )
            .update({
              avatar_url:
                avatarUrl,
            })
            .eq(
              'id',
              profile.id
            );


        if (
          updateError
        ) {
          throw updateError;
        }


        await refreshProfile();


        Alert.alert(
          'Profile Photo',
          'Profile picture updated.'
        );
      }
      catch (
        error
      ) {
        console.error(
          'Profile avatar:',
          error
        );

        Alert.alert(
          'Profile Photo',
          error?.message ||
          'Could not update profile picture.'
        );
      }
      finally {
        setAvatarBusy(
          false
        );
      }
    };


`;

    src =
      src.replace(
        marker,
        logic +
        marker
      );


    const avatarStart =
      src.indexOf(
        "<View style={styles.avatarRing}>"
      );

    if (
      avatarStart < 0
    ) {
      stop(
        "Profile avatar JSX anchor missing."
      );
    }

    const avatarEndStart =
      src.indexOf(
        "</View>",
        avatarStart
      );

    if (
      avatarEndStart < 0
    ) {
      stop(
        "Profile avatar closing View missing."
      );
    }

    const avatarEnd =
      avatarEndStart +
      "</View>".length;


    const avatarBlock =
`<Pressable
          style={
            styles.avatarRing
          }
          disabled={
            avatarBusy
          }
          onPress={() =>
            void changeProfilePhoto()
          }
        >
          <Image
            source={
              profile?.avatar_url
                ? {
                    uri:
                      profile.avatar_url,
                  }
                : fallbackPortrait
            }
            style={
              styles.avatar
            }
          />

          <View
            style={
              styles.avatarEditBadge
            }
          >
            <MaterialCommunityIcons
              name={
                avatarBusy
                  ? 'progress-clock'
                  : 'camera-outline'
              }
              size={17}
              color="#FFFFFF"
            />
          </View>
        </Pressable>

        <Text
          style={
            styles.avatarHint
          }
        >
          {avatarBusy
            ? 'UPLOADING...'
            : 'Tap photo to change'}
        </Text>`;


    src =
      src.slice(
        0,
        avatarStart
      ) +
      avatarBlock +
      src.slice(
        avatarEnd
      );


    const styleAnchor =
      "avatarRing: {";

    const stylePos =
      src.indexOf(
        styleAnchor
      );

    if (
      stylePos < 0
    ) {
      stop(
        "Profile avatar style anchor missing."
      );
    }


    const extraStyles =
`avatarEditBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#275D45',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  avatarHint: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '800',
    color: '#6B746F',
    textAlign: 'center',
  },

  `;


    src =
      src.slice(
        0,
        stylePos
      ) +
      extraStyles +
      src.slice(
        stylePos
      );
  }


  write(
    path,
    src
  );
}


/* ============================================================
   B. CONNECT DASHBOARD
   ============================================================ */

{
  const path =
    "./src/app/connect/index.tsx";

  let src =
    read(path);


  src =
    addTopImport(
      src,
      "import { ProfileAvatar } from '@/components/ProfileAvatar';"
    );

  src =
    addTopImport(
      src,
      "import { formatSpecificDateTime } from '@/lib/dateTime';"
    );


  if (
    !src.includes(
      "PATCH_160_CONNECT_AVATARS_TIME"
    )
  ) {
    src =
      "/* PATCH_160_CONNECT_AVATARS_TIME */\n" +
      src;


    /* Search result avatar */
    const memberNamePos =
      src.indexOf(
        "{member.full_name}"
      );

    if (
      memberNamePos < 0
    ) {
      stop(
        "Connect member name anchor missing."
      );
    }

    const memberViewPos =
      src.lastIndexOf(
        "<View style={{ flex: 1 }}>",
        memberNamePos
      );

    if (
      memberViewPos < 0
    ) {
      stop(
        "Connect member content View missing."
      );
    }

    src =
      src.slice(
        0,
        memberViewPos
      ) +
`<ProfileAvatar
                        userId={
                          member.user_id
                        }
                        name={
                          member.full_name
                        }
                        size={38}
                      />

                      ` +
      src.slice(
        memberViewPos
      );


    /* Inbox avatar */
    const otherNamePos =
      src.indexOf(
        "{item.other_name}"
      );

    if (
      otherNamePos < 0
    ) {
      stop(
        "Connect inbox name anchor missing."
      );
    }

    const inboxViewPos =
      src.lastIndexOf(
        "<View style={{ flex: 1 }}>",
        otherNamePos
      );

    if (
      inboxViewPos < 0
    ) {
      stop(
        "Connect inbox content View missing."
      );
    }

    src =
      src.slice(
        0,
        inboxViewPos
      ) +
`<ProfileAvatar
                    userId={
                      item.other_user_id
                    }
                    name={
                      item.other_name
                    }
                    size={42}
                  />

                  ` +
      src.slice(
        inboxViewPos
      );


    /* Inbox exact timestamp */
    const lastMessagePos =
      src.indexOf(
        "{item.last_message ||"
      );

    if (
      lastMessagePos < 0
    ) {
      stop(
        "Connect last-message anchor missing."
      );
    }

    const lastMessageTextEnd =
      src.indexOf(
        "</Text>",
        lastMessagePos
      );

    if (
      lastMessageTextEnd < 0
    ) {
      stop(
        "Connect last-message closing Text missing."
      );
    }

    const insertPos =
      lastMessageTextEnd +
      "</Text>".length;


    src =
      src.slice(
        0,
        insertPos
      ) +
`

                    <Text
                      style={
                        s.meta
                      }
                    >
                      {
                        formatSpecificDateTime(
                          item.last_message_at
                        )
                      }
                    </Text>` +
      src.slice(
        insertPos
      );
  }


  write(
    path,
    src
  );
}


/* ============================================================
   C. CONNECT THREAD
   ============================================================ */

{
  const path =
    "./src/app/connect/[id].tsx";

  let src =
    read(path);


  src =
    addTopImport(
      src,
      "import { ProfileAvatar, ConnectConversationAvatar } from '@/components/ProfileAvatar';"
    );

  src =
    addTopImport(
      src,
      "import { formatSpecificDateTime } from '@/lib/dateTime';"
    );


  if (
    !src.includes(
      "PATCH_160_THREAD_AVATARS_TIME"
    )
  ) {
    src =
      "/* PATCH_160_THREAD_AVATARS_TIME */\n" +
      src;


    /* Conversation header avatar */
    const headerNamePos =
      src.indexOf(
        "style={s.headerName}"
      );

    if (
      headerNamePos < 0
    ) {
      stop(
        "Thread headerName anchor missing."
      );
    }

    const headerViewStart =
      src.lastIndexOf(
        "<View",
        headerNamePos
      );

    if (
      headerViewStart < 0
    ) {
      stop(
        "Thread header name View missing."
      );
    }

    src =
      src.slice(
        0,
        headerViewStart
      ) +
`<ConnectConversationAvatar
          conversationId={
            id
          }
          name={
            otherName
          }
          size={40}
        />

        ` +
      src.slice(
        headerViewStart
      );


    /* Sender avatar before incoming sender name */
    const senderRe =
      /\{\!m\.is_mine\s*&&\s*\(\s*<Text[\s\S]{0,250}?s\.sender[\s\S]{0,250}?m\.sender_name[\s\S]{0,150}?<\/Text>\s*\)\}/m;


    if (
      senderRe.test(src)
    ) {
      src =
        src.replace(
          senderRe,
`{!m.is_mine && (
                  <View
                    style={{
                      flexDirection:
                        'row',
                      alignItems:
                        'center',
                      gap: 7,
                      marginBottom:
                        4,
                    }}
                  >
                    <ProfileAvatar
                      userId={
                        m.sender_id
                      }
                      name={
                        m.sender_name
                      }
                      size={28}
                    />

                    <Text
                      style={[
                        s.sender,
                        {
                          marginBottom:
                            0,
                        },
                      ]}
                    >
                      {
                        m.sender_name
                      }
                    </Text>
                  </View>
                )}`
        );
    }
    else {
      stop(
        "Incoming sender-name block not found."
      );
    }


    /* Exact message date/time */
    src =
      src.replace(
        /new\s+Date\(\s*m\.created_at\s*\)\.toLocaleString\(\)/g,
        "formatSpecificDateTime(m.created_at)"
      );
  }


  write(
    path,
    src
  );
}


/* ============================================================
   D. COMMUNITY FEED
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let src =
    read(path);


  src =
    addTopImport(
      src,
      "import { ProfileAvatar } from '@/components/ProfileAvatar';"
    );

  src =
    addTopImport(
      src,
      "import { formatSpecificDateTime } from '@/lib/dateTime';"
    );


  if (
    !src.includes(
      "PATCH_160_COMMUNITY_AVATARS_TIME"
    )
  ) {
    src =
      "/* PATCH_160_COMMUNITY_AVATARS_TIME */\n" +
      src;


    const authorRe =
      /<Text\s+style=\{s\.author\}>\s*\{item\.author_name\|\|'BUKLOD Member'\}\s*<\/Text>/m;


    if (
      !authorRe.test(src)
    ) {
      stop(
        "Community author block not found."
      );
    }


    src =
      src.replace(
        authorRe,
`<View
     style={{
       flexDirection:
         'row',
       alignItems:
         'center',
       gap: 9,
     }}
   >
     <ProfileAvatar
       userId={
         item.user_id
       }
       name={
         item.author_name ||
         'BUKLOD Member'
       }
       size={40}
     />

     <Text
       style={[
         s.author,
         {
           flex: 1,
         },
       ]}
     >
       {
         item.author_name ||
         'BUKLOD Member'
       }
     </Text>
   </View>`
      );


    src =
      src.replace(
        /new\s+Date\(\s*item\.created_at\s*\)\.toLocaleString\(\)/g,
        "formatSpecificDateTime(item.created_at)"
      );
  }


  write(
    path,
    src
  );
}


/* ============================================================
   E. POST DETAIL + COMMENTS DATE/TIME
   ============================================================ */

{
  const path =
    "./src/app/post/[id].tsx";

  let src =
    read(path);


  src =
    addTopImport(
      src,
      "import { ProfileAvatar } from '@/components/ProfileAvatar';"
    );

  src =
    addTopImport(
      src,
      "import { formatSpecificDateTime } from '@/lib/dateTime';"
    );


  if (
    !src.includes(
      "PATCH_160_POST_AVATARS_TIME"
    )
  ) {
    src =
      "/* PATCH_160_POST_AVATARS_TIME */\n" +
      src;


    const authorRe =
      /<Text\s+style=\{s\.author\}>\s*\{post\.author_name\}\s*\|\s*\{formatClusterName\(post\.cluster_name\)\}\s*<\/Text>/m;


    if (
      !authorRe.test(src)
    ) {
      stop(
        "Post detail author block not found."
      );
    }


    src =
      src.replace(
        authorRe,
`<View
   style={{
     flexDirection:
       'row',
     alignItems:
       'center',
     gap: 9,
   }}
  >
   <ProfileAvatar
     userId={
       post.user_id
     }
     name={
       post.author_name
     }
     size={42}
   />

   <Text
     style={[
       s.author,
       {
         flex: 1,
       },
     ]}
   >
     {post.author_name}
     {' | '}
     {
       formatClusterName(
         post.cluster_name
       )
     }
   </Text>
  </View>`
      );


    src =
      src.replace(
        /new\s+Date\(\s*post\.created_at\s*\)\.toLocaleString\(\)/g,
        "formatSpecificDateTime(post.created_at)"
      );


    src =
      src.replace(
        /new\s+Date\(\s*c\.created_at\s*\)\.toLocaleString\(\)/g,
        "formatSpecificDateTime(c.created_at)"
      );
  }


  write(
    path,
    src
  );
}


console.log("");
console.log(
  "PATCH 160 FRONTEND APPLIED"
);
