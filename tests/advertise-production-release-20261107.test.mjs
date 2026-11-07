import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const workflow = read('.github/workflows/buklod-authorized-production-20261107.yml');
const android = read('.github/workflows/production_android_ota.yml');
const web = read('.github/workflows/production_web_deploy.yml');
const config = read('app.config.js');
const route = read('src/app/_layout.tsx');
const profile = read('src/app/(tabs)/me.tsx');
const sponsor = read('src/components/BuklodSponsorSlot.tsx');

test('Advertise-only production promotion is one explicit main merge, never a generic push', () => {
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /paths: \[\.github\/workflows\/buklod-authorized-production-20261107\.yml\]/);
  assert.match(workflow, /if: >-\s*\n\s+github\.event_name == 'push'/);
  assert.match(workflow, /startsWith\(github\.event\.head_commit\.message, 'release\(buklod\): Advertise E2E production 2026-11-07'\)/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /test "\$head" = "\$GITHUB_SHA"/);
  assert.match(workflow, /case "\$commit_title" in/);
  assert.doesNotMatch(workflow, /npx eas-cli|npx eas update|npx eas deploy/);
});

test('Advertise promotion dispatches original gated Android and Expo web workflows exactly once', () => {
  const expected = "'release(buklod): Advertise E2E production 2026-11-07')\n" +
    '              targets=("production_android_ota.yml|BUKLOD/Android production OTA" "production_web_deploy.yml|BUKLOD/Expo Hosting production web") ;;';
  assert.ok(workflow.includes(expected), 'The exact Advertise marker must select BOTH existing workflows');
  assert.match(workflow, /for entry in "\$\{targets\[@\]\}"; do/);
  assert.match(workflow, /if \[ "\$code" != 204 \]/);
  assert.match(workflow, /\$api\/actions\/workflows\/\$workflow\/dispatches/);
  assert.match(android, /workflow_dispatch:/);
  assert.match(web, /workflow_dispatch:/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs baseline/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs published/);
  assert.match(web, /sha256sum -c web-rc-sha256\.txt/);
  assert.match(web, /npx eas-cli@latest deploy --prod/);
});

test('Advertise patch is present and targets the already-installed BUKLOD V28 runtime', () => {
  assert.match(route, /<Stack\.Screen name="advertise\/index" \/>/);
  assert.match(profile, /testID=\{\x60profile-quick-\$\{item\.key\}\x60\}/);
  assert.doesNotMatch(profile.slice(profile.indexOf('function ProfileQuickActionsStrip('), profile.indexOf('function roleLabel(')), /disabled=\{horizontalDragging\}/);
  assert.match(sponsor, /testID="buklod-sponsor-advertise"/);
  assert.match(config, /runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
  assert.match(android, /EXPO_PUBLIC_APP_ENV: production/);
  assert.match(web, /EXPECTED_MAIN_URL='https:\/\/yhanxndaqbmuzbdqlblu\.supabase\.co'/);
  assert.doesNotMatch(workflow, /staging-user/);
});

test('Post-publish status must demand exact final Android and web publication steps', () => {
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /final_step="Publish exact frozen Android RC"/);
  assert.match(workflow, /final_step="Deployment status"/);
  assert.match(workflow, /\[ "\$conclusion" = success \] && \[ "\$final_result" = success \]/);
  assert.match(workflow, /state=failure/);
});
