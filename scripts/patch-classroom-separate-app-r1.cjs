const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, value) => {
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, value);
};

function replaceExact(file, from, to, expected = 1) {
  const source = read(file);
  const count = source.split(from).length - 1;
  if (count !== expected) {
    throw new Error(`${file}: expected ${expected} occurrence(s) of anchor, found ${count}`);
  }
  write(file, source.replace(from, to));
}

function replaceAllChecked(file, from, to, minimum = 1) {
  const source = read(file);
  const count = source.split(from).length - 1;
  if (count < minimum) {
    throw new Error(`${file}: expected at least ${minimum} occurrence(s) of ${JSON.stringify(from)}, found ${count}`);
  }
  write(file, source.split(from).join(to));
}

// ---------------------------------------------------------------------------
// 1) Fail-closed Classroom config. This branch must never silently resolve Main.
// ---------------------------------------------------------------------------
replaceExact(
  'app.config.js',
  "const googleMapsAndroidApiKey =\n",
  "const fs = require('fs');\nconst path = require('path');\n\nconst googleMapsAndroidApiKey =\n",
);

replaceExact(
  'app.config.js',
  "  const appTarget = (process.env.BUKLOD_APP_TARGET || 'main').trim().toLowerCase();\n  const isClassroom = appTarget === 'classroom';\n  const classroomProjectId = '14100ed1-7f25-4551-9627-09d280498241';\n  const classroomGoogleServicesFile = (process.env.CLASSROOM_GOOGLE_SERVICES_FILE || '').trim();\n",
  "  /* BUKLOD_CLASSROOM_SEPARATE_APP_R1 — fail closed on the Classroom source branch. */\n  const appTarget = (process.env.BUKLOD_APP_TARGET || '').trim().toLowerCase();\n  if (appTarget !== 'classroom') {\n    throw new Error(\n      '[BUKLOD Classroom identity guard] This Classroom source requires BUKLOD_APP_TARGET=classroom. ' +\n      'Refusing to resolve a BUKLOD Main build/export from the Classroom branch.'\n    );\n  }\n  const isClassroom = true;\n  const classroomProjectId = '14100ed1-7f25-4551-9627-09d280498241';\n  const classroomGoogleServicesFile = './google-services.classroom.json';\n  const classroomFirebasePath = path.resolve(__dirname, classroomGoogleServicesFile);\n  if (!fs.existsSync(classroomFirebasePath)) {\n    throw new Error('[BUKLOD Classroom identity guard] Missing google-services.classroom.json.');\n  }\n  const classroomFirebase = JSON.parse(fs.readFileSync(classroomFirebasePath, 'utf8'));\n  const classroomFirebasePackages = (classroomFirebase.client || [])\n    .map(client => client?.client_info?.android_client_info?.package_name)\n    .filter(Boolean);\n  if (!classroomFirebasePackages.includes('org.mzbministry.buklod.classroom')) {\n    throw new Error(\n      '[BUKLOD Classroom identity guard] Firebase config has no org.mzbministry.buklod.classroom Android client.'\n    );\n  }\n",
);

replaceExact(
  'app.config.js',
  "      versionCode: isStaging ? undefined : 20,",
  "      versionCode: isStaging ? undefined : 21,",
);

replaceAllChecked('app.config.js', 'Allow BUKLOD to ', 'Allow BUKLOD Classroom to ', 8);

// ---------------------------------------------------------------------------
// 2) Runtime identity helper. Runtime uses Expo extra.appTarget, never a private
//    build-time env variable that may not exist after bundling.
// ---------------------------------------------------------------------------
write(
  'src/lib/classroomAppIdentity.ts',
`import Constants from 'expo-constants';

export type BuklodRuntimeAppTarget =
  | 'classroom'
  | 'main'
  | 'unknown';

const rawTarget = String(
  Constants.expoConfig?.extra?.appTarget ?? ''
)
  .trim()
  .toLowerCase();

export const runtimeAppTarget: BuklodRuntimeAppTarget =
  rawTarget === 'classroom'
    ? 'classroom'
    : rawTarget === 'main'
      ? 'main'
      : 'unknown';

export const isClassroomApp =
  runtimeAppTarget === 'classroom';

export const appDisplayName =
  isClassroomApp
    ? 'BUKLOD Classroom'
    : 'BUKLOD';

export const classroomHomeHref =
  '/classroom' as const;
`,
);

// ---------------------------------------------------------------------------
// 3) Dedicated Classroom home. Existing Classroom student/faculty modules are
//    reused; nothing is copied from Main and no backend contract is changed.
// ---------------------------------------------------------------------------
write(
  'src/app/classroom/index.tsx',
`import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';

export default function ClassroomHomeScreen() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading && !session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1f7a3f" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const displayName =
    profile?.full_name?.trim() ||
    session.user.user_metadata?.full_name ||
    'Classroom user';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../../assets/classroom/app-icon.png')}
            style={styles.logo}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SEPARATE CLASSROOM APP</Text>
            <Text style={styles.title}>BUKLOD Classroom</Text>
            <Text style={styles.subtitle}>
              Learning, teaching, live class, submissions, attendance and academic records.
            </Text>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>SIGNED IN</Text>
          <Text style={styles.welcomeName}>{displayName}</Text>
          <Text style={styles.welcomeText}>
            Your BUKLOD account is shared, but this app stays inside the Classroom workspace.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Classroom</Text>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => router.push('/profile/buklod-classrooms' as any)}
        >
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="account-school-outline" size={28} color="#1f7a3f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>My Classes</Text>
            <Text style={styles.cardText}>
              Student classes, discussions, activities, files, live sessions, attendance and grades.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#7b887f" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => router.push('/profile/buklod-faculty' as any)}
        >
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="teach" size={28} color="#1f7a3f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Faculty Workspace</Text>
            <Text style={styles.cardText}>
              Classes, roster, attendance, assessments, grading, materials and live-class review.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#7b887f" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          onPress={() => void signOut()}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#6f2c2c" />
          <Text style={styles.signOutText}>Sign out of BUKLOD Classroom</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f6f1' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f6f1' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 20 },
  logo: { width: 72, height: 72, borderRadius: 18 },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68736b', lineHeight: 19, marginTop: 4 },
  welcomeCard: { backgroundColor: '#17311f', borderRadius: 22, padding: 20, marginBottom: 22 },
  welcomeLabel: { color: '#9fd5ad', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  welcomeName: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 },
  welcomeText: { color: '#dbe7dd', lineHeight: 19, marginTop: 6 },
  sectionTitle: { color: '#17311f', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 11, borderWidth: 1, borderColor: '#e3ebe4' },
  cardIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#203328', fontSize: 17, fontWeight: '900' },
  cardText: { color: '#69766d', lineHeight: 18, marginTop: 3 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 15, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#eadede' },
  signOutText: { color: '#6f2c2c', fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
`,
);

// ---------------------------------------------------------------------------
// 4) Root boot goes to Classroom, not Main PUBLIC scope / Main tabs.
// ---------------------------------------------------------------------------
replaceExact(
  'src/app/index.tsx',
  "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';\n",
  "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';\nimport { isClassroomApp } from '@/lib/classroomAppIdentity';\n",
);

replaceExact(
  'src/app/index.tsx',
  "  useEffect(() => {\n    if (\n      !session?.user?.id ||",
  "  useEffect(() => {\n    if (isClassroomApp) {\n      publicResetInFlight.current = false;\n      setBootReady(true);\n      return;\n    }\n\n    if (\n      !session?.user?.id ||",
);

replaceExact(
  'src/app/index.tsx',
  "    <Redirect\n      href=\"/(tabs)/messages\"\n    />",
  "    <Redirect\n      href={isClassroomApp ? '/classroom' : '/(tabs)/messages'}\n    />",
);

// ---------------------------------------------------------------------------
// 5) Login keeps shared auth, but Classroom branding and successful route are
//    target-aware. Legitimate wider BUKLOD-account wording is preserved.
// ---------------------------------------------------------------------------
replaceExact(
  'src/app/(auth)/login.tsx',
  "import { colors } from '@/lib/theme';\n",
  "import { colors } from '@/lib/theme';\nimport { appDisplayName, isClassroomApp } from '@/lib/classroomAppIdentity';\n",
);

replaceExact(
  'src/app/(auth)/login.tsx',
  "const SUGGESTED_LOGIN_BUKLOD_LOGO =\n  require('../../../assets/release/buklod-generic.png');",
  "const SUGGESTED_LOGIN_BUKLOD_LOGO =\n  isClassroomApp\n    ? require('../../../assets/classroom/app-icon.png')\n    : require('../../../assets/release/buklod-generic.png');",
);

replaceExact(
  'src/app/(auth)/login.tsx',
  "    router.replace(\n      '/(tabs)/home'\n    );",
  "    router.replace(\n      (isClassroomApp ? '/classroom' : '/(tabs)/home') as any\n    );",
);

replaceExact(
  'src/app/(auth)/login.tsx',
  "              source={require('../../../assets/release/buklod-generic-photo.jpg')}\n",
  "              source={\n                isClassroomApp\n                  ? require('../../../assets/classroom/app-icon.png')\n                  : require('../../../assets/release/buklod-generic-photo.jpg')\n              }\n",
);

replaceExact(
  'src/app/(auth)/login.tsx',
  "            <Text style={styles.title}>BUKLOD</Text>",
  "            <Text style={styles.title}>{appDisplayName}</Text>",
);

replaceExact(
  'src/app/(auth)/login.tsx',
  "              Samahang Binuklod ng Pag-ibig",
  "              {isClassroomApp\n                ? 'Learning • Teaching • Classroom Operations'\n                : 'Samahang Binuklod ng Pag-ibig'}",
);

replaceAllChecked(
  'src/app/(auth)/login.tsx',
  "return Alert.alert(\n        'BUKLOD',",
  "return Alert.alert(\n        appDisplayName,",
  1,
);

// ---------------------------------------------------------------------------
// 6) Keep shared root providers, but remove Main's persistent nav and global
//    Main-only overlays/guards from Classroom runtime.
// ---------------------------------------------------------------------------
replaceExact(
  'src/components/BuklodNavSafeShell.tsx',
  "import BuklodFocusAppAdStrip from '@/components/BuklodFocusAppAdStrip';\n",
  "import BuklodFocusAppAdStrip from '@/components/BuklodFocusAppAdStrip';\nimport { isClassroomApp } from '@/lib/classroomAppIdentity';\n",
);

replaceExact(
  'src/components/BuklodNavSafeShell.tsx',
  "  const contentTopInset =\n",
  "  if (isClassroomApp) {\n    return (\n      <View style={styles.root}>\n        <View style={styles.routedContent}>\n          {children}\n        </View>\n      </View>\n    );\n  }\n\n  const contentTopInset =\n",
);

replaceExact(
  'src/app/_layout.tsx',
  "import RorkAvatarOnboardingGate from '@/components/character/RorkAvatarOnboardingGate';\n",
  "import RorkAvatarOnboardingGate from '@/components/character/RorkAvatarOnboardingGate';\nimport { isClassroomApp } from '@/lib/classroomAppIdentity';\n",
);
replaceExact('src/app/_layout.tsx', '        <RorkAvatarOnboardingGate />', '        {!isClassroomApp && <RorkAvatarOnboardingGate />}');
replaceExact('src/app/_layout.tsx', '        <BuklodFormationEntryScopeTracker />', '        {!isClassroomApp && <BuklodFormationEntryScopeTracker />}');
replaceExact('src/app/_layout.tsx', '              <BuklodPublishBanner />', '              {!isClassroomApp && <BuklodPublishBanner />}');
replaceExact('src/app/_layout.tsx', '              <BuklodEntitlementRouteGuard />', '              {!isClassroomApp && <BuklodEntitlementRouteGuard />}');
replaceExact('src/app/_layout.tsx', '              <BuklodFocusAppRouteGuard />', '              {!isClassroomApp && <BuklodFocusAppRouteGuard />}');
replaceExact('src/app/_layout.tsx', '              <BuklodCanonicalNavigationGuard />', '              {!isClassroomApp && <BuklodCanonicalNavigationGuard />}');
replaceExact('src/app/_layout.tsx', '              <BuklodClusterInviteDeepLinkHandler />', '              {!isClassroomApp && <BuklodClusterInviteDeepLinkHandler />}');
replaceExact('src/app/_layout.tsx', '              <BuklodAttendanceDeepLinkHandler />', '              {!isClassroomApp && <BuklodAttendanceDeepLinkHandler />}');
replaceExact('src/app/_layout.tsx', '                <Stack.Screen name="index" />', '                <Stack.Screen name="index" />\n                <Stack.Screen name="classroom/index" />');
replaceExact('src/app/_layout.tsx', '            <BuklodGuideAvatar />', '            {!isClassroomApp && <BuklodGuideAvatar />}');

// ---------------------------------------------------------------------------
// 7) Classroom doors return to Classroom home and remove accidental Main copy.
// ---------------------------------------------------------------------------
replaceExact(
  'src/app/profile/buklod-classrooms.tsx',
  "import BuklodQuizStudentEntry from '@/components/classroom/BuklodQuizStudentEntry';\n",
  "import BuklodQuizStudentEntry from '@/components/classroom/BuklodQuizStudentEntry';\nimport { isClassroomApp } from '@/lib/classroomAppIdentity';\n",
);
replaceExact(
  'src/app/profile/buklod-classrooms.tsx',
  '<Pressable style={styles.back} onPress={() => router.back()}>',
  "<Pressable\n        style={styles.back}\n        onPress={() =>\n          isClassroomApp\n            ? router.replace('/classroom' as any)\n            : router.back()\n        }\n      >",
);
replaceExact(
  'src/app/profile/buklod-classrooms.tsx',
  '<Text style={styles.backText}>BUKLOD</Text>',
  "<Text style={styles.backText}>{isClassroomApp ? 'BUKLOD Classroom' : 'BUKLOD'}</Text>",
);

replaceExact(
  'src/app/profile/buklod-faculty.tsx',
  "import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';\n",
  "import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';\nimport { isClassroomApp } from '@/lib/classroomAppIdentity';\n",
);
replaceExact(
  'src/app/profile/buklod-faculty.tsx',
  "        <View style={styles.header}>\n",
  "        {isClassroomApp && (\n          <Pressable\n            onPress={() => router.replace('/classroom' as any)}\n            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }}\n          >\n            <MaterialCommunityIcons name=\"arrow-left\" size={22} color=\"#17311f\" />\n            <Text style={{ color: '#17311f', fontWeight: '900' }}>BUKLOD Classroom</Text>\n          </Pressable>\n        )}\n        <View style={styles.header}>\n",
);

replaceAllChecked(
  'src/app/profile/buklod-classroom.tsx',
  'Your BUKLOD Main session is not available. Sign in to BUKLOD Main again, then press ENTER BUKLOD QUIZ.',
  'Your BUKLOD session is not available. Sign in to BUKLOD Classroom again, then press ENTER BUKLOD QUIZ.',
  1,
);

// ---------------------------------------------------------------------------
// 8) Repeatable identity guard used by CI and release jobs.
// ---------------------------------------------------------------------------
write(
  'scripts/verify-classroom-identity.cjs',
`const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const mustExist = [
  'app.config.js',
  'eas.json',
  'google-services.classroom.json',
  'assets/classroom/app-icon.png',
  'assets/classroom/adaptive-icon.png',
  'assets/classroom/splash-icon.png',
  'src/app/classroom/index.tsx',
  'src/app/profile/buklod-classrooms.tsx',
  'src/app/profile/buklod-faculty.tsx',
];
for (const rel of mustExist) {
  assert.ok(fs.existsSync(path.join(root, rel)), 'Missing Classroom source marker: ' + rel);
}

const noTargetEnv = { ...process.env };
delete noTargetEnv.BUKLOD_APP_TARGET;
const failClosed = spawnSync(
  npx,
  ['expo', 'config', '--type', 'public', '--json'],
  { cwd: root, env: noTargetEnv, encoding: 'utf8' },
);
assert.notEqual(
  failClosed.status,
  0,
  'Classroom source must FAIL CLOSED when BUKLOD_APP_TARGET is absent.',
);

const env = {
  ...process.env,
  BUKLOD_APP_TARGET: 'classroom',
  APP_VARIANT: 'production',
  EXPO_PUBLIC_APP_ENV: 'production',
  CLASSROOM_GOOGLE_SERVICES_FILE: './google-services.classroom.json',
};
const resolved = spawnSync(
  npx,
  ['expo', 'config', '--type', 'public', '--json'],
  { cwd: root, env, encoding: 'utf8' },
);
if (resolved.status !== 0) {
  process.stderr.write(resolved.stderr || 'Expo config failed.\n');
  process.exit(resolved.status || 1);
}
const config = JSON.parse(resolved.stdout);
assert.equal(config.name, 'BUKLOD Classroom');
assert.equal(config.slug, 'buklod-classroom');
assert.equal(config.scheme, 'buklod-classroom');
assert.equal(config.android?.package, 'org.mzbministry.buklod.classroom');
assert.equal(config.android?.versionCode, 21);
assert.equal(config.extra?.appTarget, 'classroom');
assert.equal(config.extra?.eas?.projectId, '14100ed1-7f25-4551-9627-09d280498241');
assert.equal(config.android?.googleServicesFile, './google-services.classroom.json');
assert.equal(config.icon, './assets/classroom/app-icon.png');
assert.equal(config.android?.adaptiveIcon?.foregroundImage, './assets/classroom/adaptive-icon.png');
assert.equal(config.web?.favicon, './assets/classroom/favicon.png');
assert.match(config.updates?.url || '', /14100ed1-7f25-4551-9627-09d280498241/);

assert.notEqual(config.name, 'BUKLOD');
assert.notEqual(config.slug, 'buklod');
assert.notEqual(config.android?.package, 'org.mzbministry.buklod');
assert.notEqual(config.extra?.eas?.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');

const firebase = JSON.parse(
  fs.readFileSync(path.join(root, 'google-services.classroom.json'), 'utf8')
);
const packages = (firebase.client || [])
  .map(client => client?.client_info?.android_client_info?.package_name)
  .filter(Boolean);
assert.ok(packages.includes('org.mzbministry.buklod.classroom'));

const rootIndex = fs.readFileSync(path.join(root, 'src/app/index.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/app/(auth)/login.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/components/BuklodNavSafeShell.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
assert.match(rootIndex, /isClassroomApp \? '\/classroom'/);
assert.match(login, /isClassroomApp \? '\/classroom' : '\/\(tabs\)\/home'/);
assert.match(login, /<Text style=\{styles\.title\}>\{appDisplayName\}<\/Text>/);
assert.match(shell, /if \(isClassroomApp\)/);
assert.match(layout, /!isClassroomApp && <BuklodCanonicalNavigationGuard/);
assert.match(layout, /<Stack\.Screen name="classroom\/index"/);

console.log('CLASSROOM_IDENTITY_GUARD=PASS');
console.log('APP=BUKLOD Classroom');
console.log('PACKAGE=org.mzbministry.buklod.classroom');
console.log('EXPO_PROJECT=14100ed1-7f25-4551-9627-09d280498241');
console.log('FIREBASE_CLASSROOM_CLIENT=VERIFIED');
console.log('MAIN_IDENTITY_LEAK=NONE_IN_RESOLVED_CLASSROOM_CONFIG');
`,
);

// Add a human/local repeatable command without renaming the shared package.
replaceExact(
  'package.json',
  '    "doctor": "npx expo-doctor@latest",\n',
  '    "doctor": "npx expo-doctor@latest",\n    "classroom:identity": "node scripts/verify-classroom-identity.cjs",\n',
);

console.log('BUKLOD_CLASSROOM_SEPARATION_PATCH_R1=APPLIED');
