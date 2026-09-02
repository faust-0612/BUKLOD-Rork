const fs =
  require("fs");

const path =
  "./src/app/reels/index.tsx";


function stop(message) {
  console.error("");
  console.error(
    "PATCH 161B STOPPED:"
  );
  console.error(
    message
  );
  process.exit(1);
}


let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "PATCH 161B\n     FULL-SCREEN REELS"
  )
) {
  stop(
    "PATCH 161B is already applied."
  );
}


/* ============================================================
   IMPORTS
   ============================================================ */

if (
  !src.includes(
    "useRef,"
  )
) {

  src =
    src.replace(
      "  useEffect,\n  useState,",
      "  useEffect,\n  useRef,\n  useState,"
    );

}


/*
 * Remove RefreshControl.
 */
src =
  src.replace(
    "  RefreshControl,\n",
    ""
  );


if (
  !src.includes(
    "  Dimensions,"
  )
) {

  src =
    src.replace(
      "  Alert,\n",
`  Alert,
  Dimensions,
  FlatList,
  Modal,
`
    );

}


if (
  !src.includes(
    "  Share,"
  )
) {

  src =
    src.replace(
      "  ScrollView,\n",
`  ScrollView,
  Share,
`
    );

}


/*
 * Old UI imports are no longer needed.
 */
src =
  src.replace(
`import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

`,
    ""
  );


const extraImports =
`import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  ProfileAvatar,
} from '@/components/ProfileAvatar';

import {
  formatSpecificDateTime,
} from '@/lib/dateTime';

`;


if (
  !src.includes(
    "buklod.reels.autoplay.v1"
  )
) {

  src =
    extraImports +
    src;

}


/* ============================================================
   REACTION OPTIONS
   Love / Haha / Praying only
   ============================================================ */

const rxStart =
  src.indexOf(
    "const RX = ["
  );

const rxEndMarker =
  "] as const;";

const rxEnd =
  src.indexOf(
    rxEndMarker,
    rxStart
  );


if (
  rxStart < 0 ||
  rxEnd < 0
) {
  stop(
    "RX block not found."
  );
}


const newRx =
`const RX = [
  {
    key: 'love',
    icon: 'heart',
    label: 'Love',
  },
  {
    key: 'haha',
    icon: 'emoticon-happy-outline',
    label: 'Haha',
  },
  {
    key: 'praying',
    icon: 'hands-pray',
    label: 'Praying',
  },
] as const;`;


src =
  src.slice(
    0,
    rxStart
  ) +
  newRx +
  src.slice(
    rxEnd +
    rxEndMarker.length
  );


/* ============================================================
   PLAYER
   ============================================================ */

const playerStart =
  src.indexOf(
    "function ReelVideo({"
  );

const inferStart =
  src.indexOf(
    "function inferMime(",
    playerStart
  );


if (
  playerStart < 0 ||
  inferStart < 0
) {
  stop(
    "ReelVideo/inferMime anchors not found."
  );
}


const player =
  fs.readFileSync(
    "./patch_161b_reel_player.txt",
    "utf8"
  );


src =
  src.slice(
    0,
    playerStart
  ) +
  player +
  "\n\n" +
  src.slice(
    inferStart
  );


/* ============================================================
   REPLACE OLD REACTION + OLD SCROLLVIEW UI + OLD STYLES
   ============================================================ */

const reactStart =
  src.indexOf(
    "  const react = async ("
  );


const stylesStart =
  src.indexOf(
    "const styles = StyleSheet.create",
    reactStart
  );


if (
  reactStart < 0 ||
  stylesStart < 0
) {
  stop(
    "Old react/UI/styles anchors not found."
  );
}


const tail =
  fs.readFileSync(
    "./patch_161b_reels_tail.txt",
    "utf8"
  );


const styles =
  fs.readFileSync(
    "./patch_161b_reels_styles.txt",
    "utf8"
  );


src =
  src.slice(
    0,
    reactStart
  ) +
  tail +
  "\n\n" +
  styles +
  "\n";


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "REELS FULL-SCREEN VIEWER INSTALLED"
);

console.log(
  "HORIZONTAL PAGING INSTALLED"
);

console.log(
  "AUTOPLAY PREFERENCE INSTALLED"
);

console.log(
  "ONE ACTIVE + ADJACENT PLAYERS INSTALLED"
);

console.log(
  "DOUBLE-TAP LOVE INSTALLED"
);

console.log(
  "LOVE / HAHA / PRAYING INSTALLED"
);

console.log(
  "COMMENTS + REPLIES UI INSTALLED"
);

console.log(
  "EXTERNAL VIDEO SHARE INSTALLED"
);

console.log("");
console.log(
  "PATCH 161B FRONTEND COMPLETE"
);
