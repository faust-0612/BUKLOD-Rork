import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('BUKLOD Main Expo web production deploy keeps protected source, environment and embargo gates', () => {
  const workflow = read('.github/workflows/production_web_deploy.yml');
  assert.match(workflow, /name: BUKLOD Production Web Deploy/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /github\.event\.head_commit\.message/);
  assert.match(workflow, /BUKLOD_DZAS_WEB_ONLY_PROD_20261122:/);
  assert.match(workflow, /node scripts\/buklod-season2-production-embargo\.cjs --production/);
  assert.match(workflow, /Expo credential preflight/);
  assert.match(workflow, /EXPECTED_MAIN_URL=/);
  assert.match(workflow, /DZAS browser radio recovery regression gate/);
  assert.match(workflow, /node --test tests\/dzas-signal-deck-implementation\.test\.mjs tests\/dzas-web-production-deploy\.test\.mjs/);
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /Verify exact production source SHA/);
  const android = read('.github/workflows/production_android_ota.yml');
  assert.doesNotMatch(android, /BUKLOD_DZAS_WEB_ONLY_PROD_20261122/);

});

test('Web-only DZAS fallback is isolated from existing native player and real AdMob', () => {
  const web = read('src/app/personal-home/radio.web.tsx');
  const native = read('src/app/personal-home/radio.tsx');
  const player = read('src/lib/buklodDzasRadio.ts');
  assert.match(web, /DZAS_STREAM_URLS/);
  assert.match(web, /START_TIMEOUT_MS = 12000/);
  assert.match(web, /audio\.addEventListener\('playing', onPlaying\)/);
  assert.match(web, /cancelStartupRef\.current/);
  assert.doesNotMatch(web, /^import .*?(?:expo-audio|react-native-google-mobile-ads)/m);
  assert.match(native, /format="mediumRectangle"/);
  assert.match(native, /useAudioPlayerStatus\(player\)/);
  assert.doesNotMatch(native, /DZAS_STREAM_URLS/);
  assert.match(player, /shouldPlayInBackground: true/);
  assert.match(player, /requestBuklodAudioFocus\('dzas'\)/);
});

test('DZAS web RC runs inside existing compile workflow without publishing or native OTA', () => {
  const workflow = read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
  const job = workflow.slice(workflow.indexOf('  dzas-web-compile:'));
  assert.match(workflow, /name: BUKLOD Unified RC Android and Expo Web Compile QA/);
  assert.match(job, /github\.head_ref == 'fix\/dzas-web-audio-fallback-20261122'/);
  assert.match(job, /node --test tests\/dzas-signal-deck-implementation\.test\.mjs/);
  assert.match(job, /node --test tests\/dzas-web-production-deploy\.test\.mjs/);
  assert.match(job, /npx tsc --noEmit/);
  assert.match(job, /npx expo export --platform web --output-dir dist --clear/);
  assert.match(job, /git rev-parse HEAD/);
  assert.doesNotMatch(job, /eas-cli|eas deploy|eas update|--prod|vercel deploy|expo publish/);
  assert.doesNotMatch(job, /EXPO_TOKEN|SUPABASE_SERVICE_ROLE|AD_MOB/);
});
