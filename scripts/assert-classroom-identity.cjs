const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const fail = (message) => {
  console.error(`CLASSROOM_IDENTITY_GUARD=FAIL: ${message}`);
  process.exit(1);
};

try {
  assert.equal(process.env.BUKLOD_APP_TARGET, 'classroom', 'BUKLOD_APP_TARGET must be classroom');

  const requiredRootFiles = [
    'app.config.js',
    'eas.json',
    'src/lib/appIdentity.ts',
    'src/app/classroom/index.tsx',
    'src/app/profile/buklod-classrooms.tsx',
    'src/app/profile/buklod-faculty.tsx',
    'src/components/classroom/ClassroomAppRouteGuard.tsx',
  ];
  for (const file of requiredRootFiles) {
    assert.ok(exists(file), `missing Classroom root fingerprint: ${file}`);
  }

  const factory = require(path.join(root, 'app.config.js'));
  const config = factory({ config: { extra: {} } });

  assert.equal(config.name, 'BUKLOD Classroom');
  assert.equal(config.slug, 'buklod-classroom');
  assert.equal(config.scheme, 'buklod-classroom');
  assert.equal(config.android?.package, 'org.mzbministry.buklod.classroom');
  assert.equal(config.ios?.bundleIdentifier, 'org.mzbministry.buklod.classroom');
  assert.equal(config.extra?.appTarget, 'classroom');
  assert.equal(config.extra?.eas?.projectId, '14100ed1-7f25-4551-9627-09d280498241');
  assert.equal(config.icon, './assets/classroom/app-icon.png');
  assert.equal(config.android?.adaptiveIcon?.foregroundImage, './assets/classroom/adaptive-icon.png');
  assert.equal(config.web?.favicon, './assets/classroom/favicon.png');

  assert.notEqual(config.android?.package, 'org.mzbministry.buklod');
  assert.notEqual(config.extra?.eas?.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.notEqual(config.slug, 'buklod');

  const firebaseRel = String(process.env.CLASSROOM_GOOGLE_SERVICES_FILE || '').trim();
  assert.ok(firebaseRel, 'CLASSROOM_GOOGLE_SERVICES_FILE is required');
  const firebasePath = path.resolve(root, firebaseRel);
  assert.ok(fs.existsSync(firebasePath), 'Classroom Firebase config file is missing');
  const firebase = JSON.parse(fs.readFileSync(firebasePath, 'utf8'));
  const packages = (firebase.client || [])
    .map((client) => client?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
  assert.ok(packages.includes('org.mzbministry.buklod.classroom'), 'Firebase config has no exact Classroom Android client');

  const eas = JSON.parse(read('eas.json'));
  for (const profileName of ['classroom-preview', 'classroom-production']) {
    const profile = eas.build?.[profileName];
    assert.equal(profile?.env?.BUKLOD_APP_TARGET, 'classroom', `${profileName} target leaked`);
    assert.equal(profile?.env?.CLASSROOM_GOOGLE_SERVICES_FILE, './google-services.classroom.json', `${profileName} Firebase file leaked`);
  }
  assert.equal(eas.build?.['classroom-production-apk']?.extends, 'classroom-production');

  const indexSource = read('src/app/index.tsx');
  assert.match(indexSource, /isClassroomApp\s*\?\s*<ClassroomIndex\s*\/>\s*:\s*<MainIndex\s*\/>/);
  assert.match(indexSource, /href="\/classroom"/);

  const homeSource = read('src/app/classroom/index.tsx');
  assert.match(homeSource, /BUKLOD_APP_IDENTITY\.displayName/);
  assert.match(homeSource, /\/profile\/buklod-classrooms/);
  assert.match(homeSource, /\/profile\/buklod-faculty/);

  const safeShell = read('src/components/BuklodNavSafeShell.tsx');
  assert.match(safeShell, /if \(isClassroomApp\)/);
  assert.match(safeShell, /BuklodPersistentBottomNav/);

  const routeGuard = read('src/components/classroom/ClassroomAppRouteGuard.tsx');
  assert.match(routeGuard, /router\.replace\('\/classroom'/);
  assert.match(routeGuard, /'\/home'/);
  assert.match(routeGuard, /'\/messages'/);

  const loginSource = read('src/app/(auth)/login.tsx');
  assert.match(loginSource, /isClassroomApp/);
  assert.match(loginSource, /BUKLOD Classroom/);
  assert.match(loginSource, /\/classroom/);

  // Prove that the shared config still resolves to canonical Main when the
  // Classroom target is intentionally absent. Restore env afterward.
  const savedTarget = process.env.BUKLOD_APP_TARGET;
  const savedFirebase = process.env.CLASSROOM_GOOGLE_SERVICES_FILE;
  delete process.env.BUKLOD_APP_TARGET;
  delete process.env.CLASSROOM_GOOGLE_SERVICES_FILE;
  const mainConfig = factory({ config: { extra: {} } });
  process.env.BUKLOD_APP_TARGET = savedTarget;
  if (savedFirebase !== undefined) process.env.CLASSROOM_GOOGLE_SERVICES_FILE = savedFirebase;

  assert.equal(mainConfig.name, 'BUKLOD');
  assert.equal(mainConfig.slug, 'buklod');
  assert.equal(mainConfig.scheme, 'buklod');
  assert.equal(mainConfig.android?.package, 'org.mzbministry.buklod');
  assert.equal(mainConfig.extra?.eas?.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.equal(mainConfig.extra?.appTarget, 'main');

  console.log('CLASSROOM_PROJECT_ROOT=PASS');
  console.log('CLASSROOM_EXPO_IDENTITY=PASS');
  console.log('CLASSROOM_FIREBASE_PACKAGE=PASS');
  console.log('CLASSROOM_RUNTIME_ROUTE_ISOLATION=PASS');
  console.log('MAIN_CONFIG_REGRESSION=PASS');
  console.log('CLASSROOM_IDENTITY_GUARD=PASS');
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
