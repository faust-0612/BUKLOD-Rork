import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const workflow = readFileSync('.github/workflows/buklod_fis_expo_standalone_release.yml','utf8');

test('FIS release workflow stays on isolated feature branch, never Main project or OTA', () => {
  assert.ok(workflow.includes('dev/buklod-fis-expo-20261115'));
  assert.ok(workflow.includes("BUKLOD_APP_TARGET: fis"));
  assert.ok(workflow.includes("EXPO_PUBLIC_BUKLOD_FIS: '1'"));
  assert.ok(workflow.includes('EAS_PROJECT_ID_FIS'));
  assert.ok(workflow.includes('EAS_PROJECT_ID_FIS: de578117-37fb-4c4d-8fec-d472e08b117f'));
  assert.doesNotMatch(workflow, /eas-cli@latest init/);
  assert.doesNotMatch(workflow, /eas update|buklod\.expo\.app|refs\/heads\/main/);
});

test('FIS release gates immutable preview before aliasing exact artifact to production', () => {
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /node --test tests\/buklod-fis-finance-20261115.test.mjs/);
  assert.match(workflow, /tests\/buklod-fis-read-model-runtime-20261115.test.mjs/);
  assert.match(workflow, /--dev-domain buklod-fis/);
  assert.match(workflow, /deploy:alias --prod --id/);
  assert.match(workflow, /cmp \/tmp\/fis-preview.html \/tmp\/fis-production.html/);
  assert.ok(workflow.includes('https://buklod-fis.expo.app/'));
  assert.doesNotMatch(workflow, /npx eas-cli@latest deploy --prod/);
});

test('FIS bundle uses Supabase publishable browser key, not sensitive backend secrets', () => {
  assert.match(workflow, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:/);
  assert.match(workflow, /https:\/\/yhanxndaqbmuzbdqlblu\.supabase\.co/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY/);
});
