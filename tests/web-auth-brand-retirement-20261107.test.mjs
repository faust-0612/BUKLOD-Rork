import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('web login brand is canonical, native legacy fallback unchanged', () => {
  const x=read('src/app/(auth)/login.tsx');
  assert.match(x,/const SUGGESTED_LOGIN_BUKLOD_LOGO[\s\S]*?Platform\.OS === 'web'[\s\S]*?buklod-main-canonical\.png[\s\S]*?buklod-generic\.png/);
  assert.match(x,/signInWithPasswordResilient/);
});

test('web register branding updated without altering native fallback or identity forms', () => {
  const x=read('src/app/(auth)/register.tsx');
  assert.match(x,/source=\{Platform\.OS === 'web'[\s\S]*?buklod-main-canonical\.png[\s\S]*?buklod-generic-photo\.jpg/);
  assert.match(x,/First Name \*/);
  assert.match(x,/supabase/);
});

test('web guide exits scope safely and native return-route path is preserved', () => {
  const g=read('src/components/BuklodGuideAvatar.tsx');
  assert.match(g,/if \(Platform\.OS === 'web'\)[\s\S]*?const publicScope = scopes\.find/);
  assert.match(g,/await selectScope\(publicScope\.scope_id\)/);
  assert.match(g,/router\.replace\('\/me' as any\)/);
  assert.match(g,/buildScopedWorkspacePath/);
});
