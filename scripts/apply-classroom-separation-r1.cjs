const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(content, from, to, label) {
  if (content.includes(to)) return content;
  const first = content.indexOf(from);
  if (first < 0) throw new Error(`PATCH STOP: missing expected source for ${label}`);
  if (content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`PATCH STOP: expected source is ambiguous for ${label}`);
  }
  return content.slice(0, first) + to + content.slice(first + from.length);
}

function patchIndex() {
  const path = 'src/app/index.tsx';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';\n",
    "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';\nimport { IS_CLASSROOM_APP } from '@/lib/appIdentity';\n",
    'index app identity import'
  );
  s = replaceOnce(
    s,
    "  useEffect(() => {\n    if (\n      !session?.user?.id ||",
    "  useEffect(() => {\n    /* CLASSROOM_SEPARATION_R1: Classroom never boots through Main PUBLIC/Connect routing. */\n    if (IS_CLASSROOM_APP) {\n      publicResetInFlight.current = false;\n      setBootReady(Boolean(session?.user?.id && !(loading && !profile)));\n      return;\n    }\n\n    if (\n      !session?.user?.id ||",
    'index classroom boot isolation'
  );
  s = replaceOnce(
    s,
    "  return (\n    <Redirect\n      href=\"/(tabs)/messages\"\n    />\n  );",
    "  return (\n    <Redirect\n      href={IS_CLASSROOM_APP ? '/classroom' : '/(tabs)/messages'}\n    />\n  );",
    'index classroom landing route'
  );
  write(path, s);
}

function patchLogin() {
  const path = 'src/app/(auth)/login.tsx';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { colors } from '@/lib/theme';\n",
    "import { colors } from '@/lib/theme';\nimport { APP_DISPLAY_NAME, APP_LOGIN_TAGLINE, IS_CLASSROOM_APP } from '@/lib/appIdentity';\n",
    'login identity import'
  );
  s = replaceOnce(
    s,
    "    router.replace(\n      '/(tabs)/home'\n    );",
    "    router.replace(\n      IS_CLASSROOM_APP ? '/classroom' : '/(tabs)/home'\n    );",
    'login post-auth route'
  );
  s = replaceOnce(
    s,
    "              source={require('../../../assets/release/buklod-generic-photo.jpg')}",
    "              source={\n                IS_CLASSROOM_APP\n                  ? require('../../../assets/classroom/app-icon.png')\n                  : require('../../../assets/release/buklod-generic-photo.jpg')\n              }",
    'login brand image'
  );
  s = replaceOnce(
    s,
    "            <Text style={styles.title}>BUKLOD</Text>",
    "            <Text style={styles.title}>{APP_DISPLAY_NAME}</Text>",
    'login display name'
  );
  s = replaceOnce(
    s,
    "            <Text style={styles.tagline}>\n              Samahang Binuklod ng Pag-ibig\n            </Text>",
    "            <Text style={styles.tagline}>\n              {APP_LOGIN_TAGLINE}\n            </Text>",
    'login tagline'
  );
  write(path, s);
}

function patchLayout() {
  const path = 'src/app/_layout.tsx';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { colors } from '@/lib/theme';\n",
    "import { colors } from '@/lib/theme';\nimport { APP_DISPLAY_NAME, IS_CLASSROOM_APP } from '@/lib/appIdentity';\n",
    'root identity import'
  );
  s = replaceOnce(
    s,
    "        Loading BUKLOD...",
    "        {IS_CLASSROOM_APP ? `Loading ${APP_DISPLAY_NAME}...` : 'Loading BUKLOD...'}",
    'root loading identity'
  );
  const mainOnly = [
    ['        <RorkAvatarOnboardingGate />', '        {!IS_CLASSROOM_APP && <RorkAvatarOnboardingGate />}'],
    ['        <BuklodFormationEntryScopeTracker />', '        {!IS_CLASSROOM_APP && <BuklodFormationEntryScopeTracker />}'],
    ['              <BuklodPublishBanner />', '              {!IS_CLASSROOM_APP && <BuklodPublishBanner />}'],
    ['              <BuklodEntitlementRouteGuard />', '              {!IS_CLASSROOM_APP && <BuklodEntitlementRouteGuard />}'],
    ['              <BuklodFocusAppRouteGuard />', '              {!IS_CLASSROOM_APP && <BuklodFocusAppRouteGuard />}'],
    ['              <BuklodCanonicalNavigationGuard />', '              {!IS_CLASSROOM_APP && <BuklodCanonicalNavigationGuard />}'],
    ['              <BuklodClusterInviteDeepLinkHandler />', '              {!IS_CLASSROOM_APP && <BuklodClusterInviteDeepLinkHandler />}'],
    ['              <BuklodAttendanceDeepLinkHandler />', '              {!IS_CLASSROOM_APP && <BuklodAttendanceDeepLinkHandler />}'],
    ['            <BuklodGuideAvatar />', '            {!IS_CLASSROOM_APP && <BuklodGuideAvatar />}'],
  ];
  for (const [from, to] of mainOnly) {
    s = replaceOnce(s, from, to, `root main-only component ${from.trim()}`);
  }
  write(path, s);
}

function patchNavShell() {
  const path = 'src/components/BuklodNavSafeShell.tsx';
  let s = read(path);
  s = replaceOnce(
    s,
    "import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';\n",
    "import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';\nimport { IS_CLASSROOM_APP } from '@/lib/appIdentity';\n",
    'nav shell identity import'
  );
  s = replaceOnce(
    s,
    "  return (\n    <View style={styles.root}>",
    "  /* CLASSROOM_SEPARATION_R1: never render Main persistent nav/ad shell in Classroom. */\n  if (IS_CLASSROOM_APP) {\n    return <View style={styles.root}>{children}</View>;\n  }\n\n  return (\n    <View style={styles.root}>",
    'nav shell classroom bypass'
  );
  write(path, s);
}

patchIndex();
patchLogin();
patchLayout();
patchNavShell();
console.log('CLASSROOM_SEPARATION_R1 source patch: APPLIED/VERIFIED');
