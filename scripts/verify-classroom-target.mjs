import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const CLASSROOM_PROJECT_ID = '14100ed1-7f25-4551-9627-09d280498241';
const MAIN_PROJECT_ID = '23dad7d0-389a-406e-8dec-08965dab85d8';
const CLASSROOM_PACKAGE = 'org.mzbministry.buklod.classroom';
const MAIN_PACKAGE = 'org.mzbministry.buklod';

function expoConfig(extraEnv) {
  const output = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['expo', 'config', '--type', 'public', '--json'],
    {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return JSON.parse(output);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

assert.equal(
  String(process.env.BUKLOD_APP_TARGET || '').trim().toLowerCase(),
  'classroom',
  'Classroom gate requires BUKLOD_APP_TARGET=classroom. Refusing a Main-target export/build.',
);

const classroom = expoConfig({ BUKLOD_APP_TARGET: 'classroom' });
assert.equal(classroom.name, 'BUKLOD Classroom');
assert.equal(classroom.slug, 'buklod-classroom');
assert.equal(classroom.scheme, 'buklod-classroom');
assert.equal(classroom.android?.package, CLASSROOM_PACKAGE);
assert.equal(classroom.ios?.bundleIdentifier, CLASSROOM_PACKAGE);
assert.equal(classroom.extra?.appTarget, 'classroom');
assert.equal(classroom.extra?.eas?.projectId, CLASSROOM_PROJECT_ID);
assert.equal(classroom.icon, './assets/classroom/app-icon.png');
assert.equal(classroom.android?.adaptiveIcon?.foregroundImage, './assets/classroom/adaptive-icon.png');
assert.equal(classroom.web?.favicon, './assets/classroom/favicon.png');
assert.equal(
  classroom.android?.googleServicesFile,
  './google-services.classroom.json',
  'Classroom must use only the Classroom-bound Firebase file.',
);

const firebasePath = path.join(ROOT, 'google-services.classroom.json');
assert.ok(fs.existsSync(firebasePath), 'Missing google-services.classroom.json');
const firebase = JSON.parse(fs.readFileSync(firebasePath, 'utf8'));
const firebasePackages = (firebase.client ?? [])
  .map((client) => client?.client_info?.android_client_info?.package_name)
  .filter(Boolean);
assert.ok(
  firebasePackages.includes(CLASSROOM_PACKAGE),
  `Firebase config has no Android client for ${CLASSROOM_PACKAGE}`,
);

const indexSource = read('src/app/index.tsx');
const shellSource = read('src/components/BuklodNavSafeShell.tsx');
const rootSource = read('src/app/_layout.tsx');
const classroomHome = read('src/app/classroom/index.tsx');
const launcherAccess = read('src/lib/classroomLauncherAccess.ts');
assert.match(indexSource, /isBuklodClassroomApp/);
assert.match(indexSource, /Redirect href="\/classroom"/);
assert.match(shellSource, /if \(classroomApp\)/);
assert.match(shellSource, /BuklodPersistentBottomNav/);
assert.match(rootSource, /ClassroomExtensionRouteGuard/);
assert.match(classroomHome, /BUKLOD Classroom/);
assert.match(classroomHome, /getBuklodClassroomLauncherAccess/);
assert.match(launcherAccess, /buklod_classroom_launcher_access_v1/);

// Prove that shared source still resolves to BUKLOD Main when Main is the
// explicit target. This guards separation without cloning or rewriting Main.
const main = expoConfig({
  BUKLOD_APP_TARGET: 'main',
  APP_VARIANT: 'production',
  EXPO_PUBLIC_APP_ENV: 'production',
});
assert.equal(main.name, 'BUKLOD');
assert.equal(main.slug, 'buklod');
assert.equal(main.scheme, 'buklod');
assert.equal(main.android?.package, MAIN_PACKAGE);
assert.equal(main.extra?.appTarget, 'main');
assert.equal(main.extra?.eas?.projectId, MAIN_PROJECT_ID);

console.log('CLASSROOM_IDENTITY_GATE=PASS');
console.log('CLASSROOM_RUNTIME_CONTAINMENT=PASS');
console.log('CLASSROOM_LAUNCHER_AUTHORITY=PASS');
console.log('MAIN_CONFIG_REGRESSION_GUARD=PASS');
