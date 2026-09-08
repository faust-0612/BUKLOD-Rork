import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const easJson = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const configFactory = require(path.join(root, 'app.config.js'));

const EXPECTED = Object.freeze({
  classroom: {
    name: 'BUKLOD Classroom',
    slug: 'buklod-classroom',
    scheme: 'buklod-classroom',
    androidPackage: 'org.mzbministry.buklod.classroom',
    expoProjectId: '14100ed1-7f25-4551-9627-09d280498241',
    supabaseUrl: 'https://yhanxndaqbmuzbdqlblu.supabase.co',
    icon: './assets/classroom/app-icon.png',
    adaptiveIcon: './assets/classroom/adaptive-icon.png',
    splashIcon: './assets/classroom/splash-icon.png',
    favicon: './assets/classroom/favicon.png',
  },
  main: {
    name: 'BUKLOD',
    slug: 'buklod',
    scheme: 'buklod',
    androidPackage: 'org.mzbministry.buklod',
    expoProjectId: '23dad7d0-389a-406e-8dec-08965dab85d8',
  },
});

function fail(message) {
  console.error(`CLASSROOM_IDENTITY_GUARD=FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(value, label) {
  if (!value) fail(`${label}: missing`);
}

function withEnv(patch, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(patch)) {
    previous[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = String(value);
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function renderConfig(env) {
  return withEnv(env, () => configFactory({ config: appJson.expo }));
}

function firebasePackages(fileValue) {
  const file = String(fileValue || '').trim();
  assertTruthy(file, 'Classroom googleServicesFile');
  const absolute = path.resolve(root, file);
  if (!fs.existsSync(absolute)) fail(`Firebase config not found at ${file}`);

  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  return (parsed.client || [])
    .map(client => client?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
}

function verifyFirebase(fileValue) {
  const packages = firebasePackages(fileValue);
  if (!packages.includes(EXPECTED.classroom.androidPackage)) {
    fail('Selected Firebase config does not contain the exact Classroom Android client');
  }
}

function verifyClassroomRendered(config) {
  assertEqual(config.name, EXPECTED.classroom.name, 'Classroom app name');
  assertEqual(config.slug, EXPECTED.classroom.slug, 'Classroom slug');
  assertEqual(config.scheme, EXPECTED.classroom.scheme, 'Classroom scheme');
  assertEqual(config.android?.package, EXPECTED.classroom.androidPackage, 'Classroom Android package');
  assertEqual(config.extra?.appTarget, 'classroom', 'Classroom runtime appTarget');
  assertEqual(config.extra?.eas?.projectId, EXPECTED.classroom.expoProjectId, 'Classroom Expo project ID');
  assertEqual(config.icon, EXPECTED.classroom.icon, 'Classroom icon');
  assertEqual(config.android?.adaptiveIcon?.foregroundImage, EXPECTED.classroom.adaptiveIcon, 'Classroom adaptive icon');
  assertEqual(config.web?.favicon, EXPECTED.classroom.favicon, 'Classroom favicon');

  const splashPlugin = (config.plugins || []).find(
    item => Array.isArray(item) && item[0] === 'expo-splash-screen'
  );
  assertEqual(splashPlugin?.[1]?.image, EXPECTED.classroom.splashIcon, 'Classroom splash icon');
  verifyFirebase(config.android?.googleServicesFile);
}

function verifyMainRendered(config) {
  assertEqual(config.name, EXPECTED.main.name, 'Main app name');
  assertEqual(config.slug, EXPECTED.main.slug, 'Main slug');
  assertEqual(config.scheme, EXPECTED.main.scheme, 'Main scheme');
  assertEqual(config.android?.package, EXPECTED.main.androidPackage, 'Main Android package');
  assertEqual(config.extra?.appTarget, 'main', 'Main runtime appTarget');
  assertEqual(config.extra?.eas?.projectId, EXPECTED.main.expoProjectId, 'Main Expo project ID');
}

const profile = easJson.build?.['classroom-production'];
const profileEnv = profile?.env || {};
assertTruthy(profile, 'eas.json classroom-production profile');
assertEqual(profileEnv.BUKLOD_APP_TARGET, 'classroom', 'Classroom EAS target');
assertEqual(profileEnv.CLASSROOM_IDENTITY_REQUIRED, '1', 'Classroom fail-closed EAS marker');
assertEqual(profileEnv.EXPO_PUBLIC_SUPABASE_URL, EXPECTED.classroom.supabaseUrl, 'Classroom EAS Supabase URL');
assertTruthy(profileEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Classroom EAS Supabase publishable key');
assertTruthy(profileEnv.CLASSROOM_GOOGLE_SERVICES_FILE, 'Classroom EAS Firebase file');
verifyFirebase(profileEnv.CLASSROOM_GOOGLE_SERVICES_FILE);

const classroomConfig = renderConfig({
  ...profileEnv,
  BUKLOD_APP_TARGET: 'classroom',
  APP_VARIANT: 'production',
  EXPO_PUBLIC_APP_ENV: 'production',
  CLASSROOM_IDENTITY_REQUIRED: '1',
});
verifyClassroomRendered(classroomConfig);

const mainConfig = renderConfig({
  BUKLOD_APP_TARGET: 'main',
  APP_VARIANT: 'production',
  EXPO_PUBLIC_APP_ENV: 'production',
  CLASSROOM_IDENTITY_REQUIRED: null,
  EAS_PROJECT_ID: EXPECTED.main.expoProjectId,
});
verifyMainRendered(mainConfig);

if (process.env.CLASSROOM_IDENTITY_REQUIRED === '1') {
  assertEqual(process.env.BUKLOD_APP_TARGET, 'classroom', 'Active build target');
  assertEqual(process.env.EXPO_PUBLIC_SUPABASE_URL, EXPECTED.classroom.supabaseUrl, 'Active build Supabase URL');
  assertTruthy(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Active build Supabase publishable key');
  assertTruthy(process.env.CLASSROOM_GOOGLE_SERVICES_FILE, 'Active build Firebase path');
  verifyFirebase(process.env.CLASSROOM_GOOGLE_SERVICES_FILE);

  const activeConfig = renderConfig(process.env);
  verifyClassroomRendered(activeConfig);

  const activeProfile = String(process.env.EAS_BUILD_PROFILE || '').trim();
  if (activeProfile && !activeProfile.startsWith('classroom-')) {
    fail(`Classroom-required build is using non-Classroom EAS profile ${activeProfile}`);
  }
}

console.log('CLASSROOM_IDENTITY_GUARD=PASS');
console.log('CLASSROOM_IDENTITY=BUKLOD Classroom');
console.log('CLASSROOM_ANDROID_PACKAGE=org.mzbministry.buklod.classroom');
console.log('CLASSROOM_EXPO_PROJECT=14100ed1-7f25-4551-9627-09d280498241');
console.log('MAIN_REGRESSION_IDENTITY=PASS');
