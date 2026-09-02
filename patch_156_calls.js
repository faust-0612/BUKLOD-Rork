const fs = require("fs");

function stop(message) {
  console.error("");
  console.error("PATCH 156 STOPPED:");
  console.error(message);
  process.exit(1);
}

/* ==========================================================
   ROOT LAYOUT
   ========================================================== */

const rootPath =
  "./src/app/_layout.tsx";

let root =
  fs.readFileSync(
    rootPath,
    "utf8"
  );

if (
  !root.includes(
    "StreamVideoProvider"
  )
) {
  const importAnchor =
    "import { colors } from '@/lib/theme';";

  if (
    !root.includes(
      importAnchor
    )
  ) {
    stop(
      "Root layout import anchor not found."
    );
  }

  root =
    root.replace(
      importAnchor,
      importAnchor +
      "\nimport { StreamVideoProvider } from '@/providers/StreamVideoProvider';"
    );

  const openAnchor =
    "<NotificationProvider>\n            <KeyboardAvoidingView";

  if (
    !root.includes(
      openAnchor
    )
  ) {
    stop(
      "NotificationProvider opening anchor not found."
    );
  }

  root =
    root.replace(
      openAnchor,
      "<NotificationProvider>\n            <StreamVideoProvider>\n            <KeyboardAvoidingView"
    );

  const closeAnchor =
    "</KeyboardAvoidingView>\n          </NotificationProvider>";

  if (
    !root.includes(
      closeAnchor
    )
  ) {
    stop(
      "NotificationProvider closing anchor not found."
    );
  }

  root =
    root.replace(
      closeAnchor,
      "</KeyboardAvoidingView>\n            </StreamVideoProvider>\n          </NotificationProvider>"
    );
}

fs.writeFileSync(
  rootPath,
  root,
  "utf8"
);


/* ==========================================================
   CONNECT THREAD
   ========================================================== */

const connectPath =
  "./src/app/connect/[id].tsx";

let connect =
  fs.readFileSync(
    connectPath,
    "utf8"
  );


/* ---------- SDK IMPORT ---------- */

if (
  !connect.includes(
    "useStreamVideoClient"
  )
) {
  const importAnchor =
`import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';`;

  if (
    !connect.includes(
      importAnchor
    )
  ) {
    stop(
      "Connect SDK import anchor not found."
    );
  }

  connect =
    connect.replace(
      importAnchor,
`${importAnchor}

import {
  useStreamVideoClient,
} from '@stream-io/video-react-native-sdk';`
    );
}


/* ---------- CLIENT + BUSY STATE ---------- */

if (
  !connect.includes(
    "const streamVideoClient ="
  )
) {
  const authAnchor =
`  const {
    user,
  } = useAuth();`;

  if (
    !connect.includes(
      authAnchor
    )
  ) {
    stop(
      "Connect auth anchor not found."
    );
  }

  connect =
    connect.replace(
      authAnchor,
`${authAnchor}

  const streamVideoClient =
    useStreamVideoClient();

  const [
    callBusy,
    setCallBusy,
  ] =
    useState(false);`
    );
}


/* ---------- START CALL FUNCTION ---------- */

if (
  !connect.includes(
    "const startConnectCall ="
  )
) {
  const functionAnchor =
    "  const canSend =";

  const pos =
    connect.indexOf(
      functionAnchor
    );

  if (
    pos < 0
  ) {
    stop(
      "Connect canSend anchor not found."
    );
  }

  const callFunction =
`
  /* PATCH_156_BUKLOD_STREAM_CALLING */
  const startConnectCall =
    async (
      mode:
        | 'voice'
        | 'video'
    ) => {
      if (callBusy) {
        return;
      }

      if (
        !id ||
        !user?.id
      ) {
        Alert.alert(
          'BUKLOD Call',
          'Your account or conversation is not ready.'
        );

        return;
      }

      if (
        !streamVideoClient
      ) {
        Alert.alert(
          'BUKLOD Call',
          'Calling service is still connecting. Please try again in a few seconds.'
        );

        return;
      }

      setCallBusy(true);

      try {
        const {
          data:
            conversationInfo,

          error:
            conversationError,
        } =
          await (
            supabase as any
          ).rpc(
            'get_connect_conversation_info_v2',
            {
              p_conversation_id:
                id,
            }
          );

        if (
          conversationError
        ) {
          throw conversationError;
        }

        const info =
          Array.isArray(
            conversationInfo
          )
            ? conversationInfo[0]
            : conversationInfo;

        const otherUserId =
          info?.other_user_id;

        if (
          !otherUserId
        ) {
          throw new Error(
            'The other BUKLOD member could not be found.'
          );
        }

        const isVideo =
          mode === 'video';

        const callId =
          [
            'buklod',
            Date.now(),
            Math.random()
              .toString(36)
              .slice(2, 10),
          ].join('-');

        const call =
          streamVideoClient
            .call(
              'default',
              callId
            );

        await call.getOrCreate({
          ring:
            true,

          video:
            isVideo,

          data: {
            members: [
              {
                user_id:
                  user.id,
              },

              {
                user_id:
                  otherUserId,
              },
            ],

            custom: {
              buklod_conversation_id:
                id,

              buklod_call_mode:
                mode,
            },

            settings_override: {
              audio: {
                mic_default_on:
                  true,
              },

              video: {
                camera_default_on:
                  isVideo,
              },
            },
          },
        });
      }
      catch (
        error: any
      ) {
        console.error(
          'BUKLOD call error:',
          error
        );

        Alert.alert(
          mode === 'video'
            ? 'Video Call'
            : 'Voice Call',

          error?.message
          ||
          'Could not start the call.'
        );
      }
      finally {
        setCallBusy(false);
      }
    };


`;

  connect =
    connect.slice(
      0,
      pos
    ) +
    callFunction +
    connect.slice(
      pos
    );
}


/* ---------- HEADER BUTTONS ---------- */

if (
  !connect.includes(
    'accessibilityLabel="Start voice call"'
  )
) {
  const menuAnchor =
`        <Pressable
          onPress={() =>
            setConversationMenuOpen(
              true
            )
          }
          style={s.headerMenu}
        >`;

  if (
    !connect.includes(
      menuAnchor
    )
  ) {
    stop(
      "Connect header menu anchor not found."
    );
  }

  const buttons =
`        <Pressable
          accessibilityLabel="Start voice call"
          disabled={callBusy}
          onPress={() =>
            void startConnectCall(
              'voice'
            )
          }
          style={[
            s.headerMenu,
            {
              opacity:
                callBusy
                  ? 0.45
                  : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="phone"
            size={21}
            color={
              colors.greenDark
            }
          />
        </Pressable>

        <Pressable
          accessibilityLabel="Start video call"
          disabled={callBusy}
          onPress={() =>
            void startConnectCall(
              'video'
            )
          }
          style={[
            s.headerMenu,
            {
              opacity:
                callBusy
                  ? 0.45
                  : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="video-outline"
            size={23}
            color={
              colors.greenDark
            }
          />
        </Pressable>

`;

  connect =
    connect.replace(
      menuAnchor,
      buttons +
      menuAnchor
    );
}

fs.writeFileSync(
  connectPath,
  connect,
  "utf8"
);

console.log("");
console.log(
  "PATCH 156 APPLIED SUCCESSFULLY"
);
