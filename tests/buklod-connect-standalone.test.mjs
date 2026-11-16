import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.config.js');
const eas = JSON.parse(read('eas.json'));

test('Independent identifiers, dedicated EAS project and runtime', () => {
  assert.match(app, /org\.mzbministry\.buklod\.connect/);
  assert.doesNotMatch(app, /org\.mzbministry\.buklod\.connect\.staging/);
  assert.match(app, /isConnect \? 'connect-1\.0\.0'/);
  assert.match(app, /CONNECT_EAS_PROJECT_ID/);
  assert.match(app, /CONNECT_GOOGLE_SERVICES_FILE/);
  assert.match(app, /verified independent project/);
  assert.match(app, /isConnect\s*\? connectProjectId/);
});
test('Dedicated profiles do not replace Main staging or production OTA', () => {
  for (const name of ['connect-qa-apk','connect-production']) {
    const p = eas.build[name];
    assert.equal(p.env.BUKLOD_APP_TARGET, 'connect');
    assert.equal(p.env.EXPO_PUBLIC_BUKLOD_APP_TARGET, 'connect');
    assert.equal(p.channel, name === 'connect-qa-apk' ? 'connect-qa' : name);
    assert.notEqual(p.channel, eas.build.production.channel);
    assert.notEqual(p.channel, eas.build['staging-user'].channel);
  }
  assert.equal(eas.build.production.env.EXPO_PUBLIC_BUKLOD_APP_TARGET, undefined);
  assert.equal(eas.build['staging-user'].env.EXPO_PUBLIC_BUKLOD_APP_TARGET, undefined);
  assert.equal(eas.build['connect-qa-apk'].android.buildType, 'apk');
  assert.equal(eas.build['connect-production'].android.buildType, 'app-bundle');
  assert.equal(eas.build['connect-staging'], undefined);
});
test('Standalone shell reuses original Connect/Stream/PTT rather than copying them', () => {
  const root = read('src/app/_layout.tsx');
  const home = read('src/components/BuklodConnectStandaloneHome.tsx');
  const shell = read('src/components/BuklodConnectStandaloneRoot.tsx');
  assert.match(root, /isBuklodConnectStandalone \? <BuklodConnectStandaloneRoot \/> : <RootLayout \/>/);
  assert.match(home, /import ConnectScreen from '@\/app\/\(tabs\)\/messages'/);
  assert.match(home, /\/personal-home\/ptt/);
  assert.match(shell, /StreamVideoProvider/);
  assert.match(shell, /NotificationProvider/);
});
test('Apple green is isolated to Connect default and Main home route remains intact', () => {
  assert.match(read('src/lib/buklodTheme.ts'), /appleGreen: \{/);
  assert.match(read('src/providers/BuklodThemeProvider.tsx'), /isBuklodConnectStandalone \? 'appleGreen' : DEFAULT_BUKLOD_THEME_PREFERENCE/);
  assert.match(read('src/app/index.tsx'), /isBuklodConnectStandalone \? '\/connect' : '\/\(tabs\)\/buklod'/);
  assert.match(read('src/app/(auth)/login.tsx'), /isBuklodConnectStandalone \? '\/connect'/);
});

test('Actual Expo config resolves independent Connect IDs and fails closed without its credentials', () => {
  const build = createRequire(import.meta.url)('../app.config.js');
  const relevant = [
    'BUKLOD_APP_TARGET', 'APP_VARIANT', 'EAS_PROJECT_ID',
    'CONNECT_EAS_PROJECT_ID', 'CONNECT_GOOGLE_SERVICES_FILE',
    'CONNECT_ADMOB_ANDROID_APP_ID', 'EXPO_PUBLIC_BUKLOD_APP_TARGET', 'EAS_BUILD',
  ];
  const original = Object.fromEntries(relevant.map(key => [key, process.env[key]]));
  function config(variables) {
    for (const key of relevant) delete process.env[key];
    Object.assign(process.env, variables);
    return build({ config: { extra: { eas: { projectId: 'main-placeholder' } } } });
  }
  try {
    const main = config({ EAS_PROJECT_ID: 'main-eas' });
    assert.equal(main.android.package, 'org.mzbministry.buklod');
    assert.equal(main.runtimeVersion, '1.3.2');
    const staging = config({
      BUKLOD_APP_TARGET: 'connect',
      APP_VARIANT: 'staging',
      CONNECT_EAS_PROJECT_ID: 'fbc71093-6abb-43e6-9493-14b2c8117df8',
      CONNECT_GOOGLE_SERVICES_FILE: './connect-staging-firebase.json',
      EXPO_PUBLIC_BUKLOD_APP_TARGET: 'connect',
      EAS_BUILD: 'true',
    });
    assert.equal(staging.android.package, 'org.mzbministry.buklod.connect');
    assert.equal(staging.name, 'BUKLOD Connect');
    assert.equal(staging.runtimeVersion, 'connect-1.0.0');
    assert.equal(staging.extra.eas.projectId, 'fbc71093-6abb-43e6-9493-14b2c8117df8');
    assert.equal(staging.scheme, 'buklod-connect');
    const standalone = config({ BUKLOD_APP_TARGET: 'connect', EAS_PROJECT_ID: 'main-eas' });
    assert.equal(standalone.extra.eas.projectId, 'fbc71093-6abb-43e6-9493-14b2c8117df8');
    assert.equal(standalone.updates.url, 'https://u.expo.dev/fbc71093-6abb-43e6-9493-14b2c8117df8');
    assert.throws(() => config({
      BUKLOD_APP_TARGET: 'connect',
      EAS_BUILD: 'true',
      EAS_PROJECT_ID: 'main-eas',
    }), /Connect requires its own/);
    assert.throws(() => config({
      BUKLOD_APP_TARGET: 'connect',
      CONNECT_EAS_PROJECT_ID: '23dad7d0-389a-406e-8dec-08965dab85d8',
    }), /verified independent project/);
    assert.throws(() => config({
      BUKLOD_APP_TARGET: 'connect',
      CONNECT_GOOGLE_SERVICES_FILE: './google-services.production.json',
    }), /Connect cannot use Main/);
    const production = config({
      BUKLOD_APP_TARGET: 'connect',
      EAS_BUILD: 'true',
      EXPO_PUBLIC_BUKLOD_APP_TARGET: 'connect',
      CONNECT_EAS_PROJECT_ID: 'fbc71093-6abb-43e6-9493-14b2c8117df8',
      CONNECT_GOOGLE_SERVICES_FILE: './connect-firebase.json',
    });
    assert.equal(production.android.package, 'org.mzbministry.buklod.connect');
    assert.equal(production.name, 'BUKLOD Connect');
    assert.equal(production.extra.appTarget, 'connect');
    assert.equal(production.runtimeVersion, 'connect-1.0.0');
    const ads = production.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
    assert.equal(ads[1].androidAppId, 'ca-app-pub-3940256099942544~3347511713');
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('Standalone Connect shows compact apple-green unread status without the Main hero', () => {
  const inbox = read('src/app/(tabs)/messages.tsx');
  assert.match(inbox, /isBuklodConnectStandalone \? \(/);
  assert.equal(inbox.split('import { isBuklodConnectStandalone } from').length - 1, 1);
  assert.match(inbox, /styles\.standaloneUnread/);
  assert.match(inbox, /marginTop: isBuklodConnectStandalone \? 2 : -12/);
  assert.match(inbox, /<View style=\{styles\.hero\}>/);
});

test('Connect has independently branded launcher, adaptive and splash icons', () => {
  const build = createRequire(import.meta.url)('../app.config.js');
  const old = process.env.BUKLOD_APP_TARGET;
  try {
    process.env.BUKLOD_APP_TARGET = 'connect';
    const cfg = build({ config: {} });
    assert.equal(cfg.icon, './assets/connect/app-icon.png');
    assert.equal(cfg.android.adaptiveIcon.foregroundImage, './assets/connect/app-icon.png');
    const splash = cfg.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen');
    assert.equal(splash[1].image, './assets/connect/app-icon.png');
    assert.equal(splash[1].backgroundColor, '#E9F8D5');
  } finally {
    if (old === undefined) delete process.env.BUKLOD_APP_TARGET;
    else process.env.BUKLOD_APP_TARGET = old;
  }
});

test('Independent Connect APK does not inherit Main version cutoff or Main update download UI', () => {
  const helper = read('src/lib/buklodConnectStandalone.ts');
  const boot = read('src/app/index.tsx');
  const boundary = read('src/components/BuklodMandatoryUpdateBoundary.tsx');
  const home = read('src/components/BuklodConnectStandaloneHome.tsx');
  assert.match(helper, /config\.features\?\.connect_standalone_update_required === true/);
  assert.match(helper, /: config\.update_required === true/);
  assert.match(boot, /shouldRequireBuklodNativeUpdate\(config\)/);
  assert.match(boundary, /isBuklodConnectStandalone \? \(/);
  assert.match(boundary, /BUKLOD Connect update required/);
  assert.match(home, /shouldRequireBuklodNativeUpdate\(config\)/);
});

test('QA workflow exports the Firebase config path to local Expo config and gates APK build', () => {
  const workflow = read('.github/workflows/buklod-connect-standalone-apk.yml');
  assert.match(workflow, /CONNECT_FIREBASE_JSON_B64: \$\{\{ secrets\.CONNECT_FIREBASE_JSON_B64 \}\}/);
  assert.match(workflow, /CONNECT_GOOGLE_SERVICES_FILE: \.\/google-services\.connect\.json/);
  assert.match(workflow, /test -s \.\/google-services\.connect\.json/);
  assert.match(workflow, /profile connect-qa-apk/);
  assert.match(workflow, /assert\.equal\(c\.android\.package, 'org\.mzbministry\.buklod\.connect'\)/);
  assert.equal(eas.build['connect-qa-apk'].channel, 'connect-qa');
});
