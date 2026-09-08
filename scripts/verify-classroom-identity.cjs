const fs = require('fs');
const { execFileSync } = require('child_process');

function fail(message) {
  console.error(`CLASSROOM IDENTITY STOP: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

assert(process.env.BUKLOD_APP_TARGET === 'classroom', 'BUKLOD_APP_TARGET must be classroom.');
assert(process.env.APP_VARIANT === 'production', 'APP_VARIANT must be production for production web release.');
assert(process.env.EXPO_PUBLIC_APP_ENV === 'production', 'EXPO_PUBLIC_APP_ENV must be production.');

let rawConfig;
try {
  rawConfig = execFileSync('npx', ['expo', 'config', '--json'], {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
} catch (error) {
  fail(`could not resolve Expo config: ${error?.message || error}`);
}

let config;
try {
  config = JSON.parse(rawConfig);
} catch {
  fail('Expo config output was not valid JSON.');
}

const expected = {
  name: 'BUKLOD Classroom',
  slug: 'buklod-classroom',
  scheme: 'buklod-classroom',
  packageId: 'org.mzbministry.buklod.classroom',
  projectId: '14100ed1-7f25-4551-9627-09d280498241',
  supabaseUrl: 'https://yhanxndaqbmuzbdqlblu.supabase.co',
};

assert(config.name === expected.name, `resolved Expo name is ${String(config.name)}.`);
assert(config.slug === expected.slug, `resolved Expo slug is ${String(config.slug)}.`);
assert(config.scheme === expected.scheme, `resolved scheme is ${String(config.scheme)}.`);
assert(config.android?.package === expected.packageId, `Android package is ${String(config.android?.package)}.`);
assert(config.ios?.bundleIdentifier === expected.packageId, `iOS bundle identifier is ${String(config.ios?.bundleIdentifier)}.`);
assert(config.extra?.appTarget === 'classroom', `extra.appTarget is ${String(config.extra?.appTarget)}.`);
assert(config.extra?.eas?.projectId === expected.projectId, `Expo project ID is ${String(config.extra?.eas?.projectId)}.`);
assert(config.icon === './assets/classroom/app-icon.png', `Classroom icon is not selected: ${String(config.icon)}.`);
assert(config.web?.favicon === './assets/classroom/favicon.png', `Classroom favicon is not selected: ${String(config.web?.favicon)}.`);
assert(config.android?.adaptiveIcon?.foregroundImage === './assets/classroom/adaptive-icon.png', 'Classroom adaptive icon is not selected.');
assert(config.android?.googleServicesFile === './google-services.classroom.json', `Classroom Firebase file is not selected: ${String(config.android?.googleServicesFile)}.`);

assert(config.name !== 'BUKLOD', 'Main display name leaked into resolved Classroom config.');
assert(config.slug !== 'buklod', 'Main slug leaked into resolved Classroom config.');
assert(config.scheme !== 'buklod', 'Main URL scheme leaked into resolved Classroom config.');
assert(config.android?.package !== 'org.mzbministry.buklod', 'Main Android package leaked into resolved Classroom config.');
assert(config.extra?.eas?.projectId !== '23dad7d0-389a-406e-8dec-08965dab85d8', 'Main Expo project leaked into Classroom config.');

assert(process.env.EXPO_PUBLIC_SUPABASE_URL === expected.supabaseUrl, 'Classroom release Supabase URL does not match the protected backend configuration.');
assert(Boolean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY), 'Supabase publishable key is missing.');

const firebasePath = config.android.googleServicesFile;
assert(fs.existsSync(firebasePath), 'Selected Classroom Firebase file does not exist.');
const firebase = JSON.parse(fs.readFileSync(firebasePath, 'utf8'));
const packages = (firebase.client || [])
  .map((client) => client?.client_info?.android_client_info?.package_name)
  .filter(Boolean);
assert(packages.includes(expected.packageId), 'Selected Firebase config does not contain the Classroom Android client.');

const sourceContracts = [
  ['src/app/index.tsx', "IS_CLASSROOM_APP ? '/classroom' : '/(tabs)/messages'"],
  ['src/app/(auth)/login.tsx', "IS_CLASSROOM_APP ? '/classroom' : '/(tabs)/home'"],
  ['src/components/BuklodNavSafeShell.tsx', 'never render Main persistent nav/ad shell in Classroom'],
  ['src/app/_layout.tsx', '!IS_CLASSROOM_APP && <BuklodCanonicalNavigationGuard />'],
  ['src/app/classroom/index.tsx', 'BUKLOD Classroom'],
];
for (const [path, marker] of sourceContracts) {
  assert(fs.existsSync(path), `required Classroom source is missing: ${path}`);
  assert(fs.readFileSync(path, 'utf8').includes(marker), `Classroom source contract missing in ${path}: ${marker}`);
}

console.log('CLASSROOM IDENTITY GUARD: PASS');
console.log(`name=${expected.name}`);
console.log(`slug=${expected.slug}`);
console.log(`scheme=${expected.scheme}`);
console.log(`package=${expected.packageId}`);
console.log(`expoProject=${expected.projectId}`);
console.log('firebase=Classroom client present');
console.log('supabase=protected URL verified; key present (not printed)');
