import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.config.js');
const eas = JSON.parse(read('eas.json'));

test('Independent identifiers, dedicated EAS project and runtime', () => {
  assert.match(app, /org\.mzbministry\.buklod\.connect/);
  assert.match(app, /org\.mzbministry\.buklod\.connect\.staging/);
  assert.match(app, /isConnect \? 'connect-1\.0\.0'/);
  assert.match(app, /CONNECT_EAS_PROJECT_ID/);
  assert.match(app, /CONNECT_GOOGLE_SERVICES_FILE/);
  assert.match(app, /CONNECT_ADMOB_ANDROID_APP_ID/);
  assert.match(app, /isConnect\s*\? connectProjectId/);
});
test('Dedicated profiles do not replace Main staging or production OTA', () => {
  for (const name of ['connect-staging','connect-production']) {
    const p = eas.build[name];
    assert.equal(p.env.BUKLOD_APP_TARGET, 'connect');
    assert.equal(p.env.EXPO_PUBLIC_BUKLOD_APP_TARGET, 'connect');
    assert.equal(p.channel, name);
    assert.notEqual(p.channel, eas.build.production.channel);
    assert.notEqual(p.channel, eas.build['staging-user'].channel);
  }
  assert.equal(eas.build.production.env.EXPO_PUBLIC_BUKLOD_APP_TARGET, undefined);
  assert.equal(eas.build['staging-user'].env.EXPO_PUBLIC_BUKLOD_APP_TARGET, undefined);
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
