import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const web = read('.github/workflows/production_web_deploy.yml');
const android = read('.github/workflows/production_android_ota.yml');
const ptt = read('src/app/personal-home/ptt.web.tsx');

test('PTT release marker targets Expo Hosting web only, not Android OTA', () => {
  assert.match(web, /BUKLOD_PTT_WEB_20261111/);
  assert.doesNotMatch(android, /BUKLOD_PTT_WEB_20261111/);
  assert.match(ptt, /BUKLOD_PTT_WEB_LIVE_R1/);
});

test('Exact production web environment, QA, RC sha and deploy are still mandatory', () => {
  assert.match(web, /npx tsc --noEmit/);
  assert.match(web, /buklod-ptt-web-contract\.test\.mjs/);
  assert.match(web, /https:\/\/yhanxndaqbmuzbdqlblu\.supabase\.co/);
  assert.match(web, /git rev-parse HEAD/);
  assert.match(web, /git ls-remote origin refs\/heads\/main/);
  assert.match(web, /sha256sum -c web-rc-sha256\.txt/);
  assert.match(web, /npx eas-cli@latest deploy --prod --export-dir dist/);
});
