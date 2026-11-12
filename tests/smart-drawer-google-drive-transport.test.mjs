import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const transport = readFileSync(new URL('../src/lib/smartDrawer/googleDriveTransport.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../app.config.js', import.meta.url), 'utf8');

test('Drive uses drive.file and scoped OAuth bearer token', () => {
  assert.match(transport, /www\.googleapis\.com\/auth\/drive\.file/);
  assert.match(transport, /Authorization: 'Bearer ' \+ token/);
  assert.doesNotMatch(transport, /serviceAccount|clientSecret|refresh_token/);
  assert.match(config, /smartDrawerGoogleDriveAndroidClientId/);
});

test('transport fails closed for unencrypted or oversized archives', () => {
  assert.match(transport, /Refusing to upload unencrypted Drawer contents/);
  assert.match(transport, /parsed\.format !== 'buklod\.drawer\.encrypted\.v1'/);
  assert.match(transport, /28 \* 1024 \* 1024/);
  assert.match(transport, /Google Drive file is not an encrypted BUKLOD backup/);
});

test('Drive errors require explicit reconnection and preserve local storage', () => {
  assert.match(transport, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(transport, /response\.status === 429/);
  assert.match(transport, /AbortController/);
  assert.match(transport, /existingId \? 'PATCH' : 'POST'/);
});

test('transport never silently converts local-only default into connected storage', () => {
  assert.doesNotMatch(transport, /setInterval|setTimeout\(.*uploadEncrypted/);
  assert.match(transport, /AccessTokenProvider/);
});
