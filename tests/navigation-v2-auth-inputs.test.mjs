import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url),'utf8');
const screens = [
  ['src/app/(auth)/login.tsx',2],
  ['src/app/(auth)/register.tsx',14],
  ['src/app/account/security.tsx',2],
  ['src/app/account/personal-information.tsx',1],
  ['src/app/account/recovery-pin.tsx',2],
  ['src/app/support/live.tsx',3],
  ['src/app/feedback/index.tsx',2],
  ['src/app/drawer/quick-note.tsx',1],
  ['src/app/drawer/index.tsx',1],
];
test('28 important editable controls honor Android font scaling without touching submission logic', () => {
  let count = 0;
  for (const [path, minimum] of screens) {
    const source = read(path);
    const inputs = (source.match(/<TextInput\b/g)||[]).length;
    const scaled = (source.match(/<TextInput allowFontScaling\b/g)||[]).length;
    assert.ok(inputs >= minimum,path + ' lost editable controls');
    assert.equal(scaled,inputs,path + ' has a non-scaled input');
    count += scaled;
  }
  assert.ok(count >= 28);
});
test('login, registration, recovery, support, feedback, and Drawer inputs have readable baseline glyphs', () => {
  const login = read('src/app/(auth)/login.tsx');
  const register = read('src/app/(auth)/register.tsx');
  assert.match(login,/input: \{\s*fontSize: 16,/);
  assert.match(login,/passwordInput: \{\s*fontSize: 16,/);
  assert.match(register,/input: \{\s*fontSize: 16,/);
  assert.match(register,/searchInput: \{\s*fontSize: 16,/);
  assert.match(read('src/app/account/security.tsx'),/input: \{ fontSize: 16, minHeight: 47/);
  assert.match(read('src/app/account/personal-information.tsx'),/input: \{\s*fontSize: 16,/);
  assert.match(read('src/app/account/recovery-pin.tsx'),/fontSize: 18, letterSpacing: 3/);
  assert.match(read('src/app/support/live.tsx'),/input:\{fontSize:16,/);
  assert.match(read('src/app/feedback/index.tsx'),/area:\{fontSize:16,/);
  assert.match(read('src/app/drawer/quick-note.tsx'),/fontSize: 16,\s*lineHeight: 24/);
  assert.match(read('src/app/drawer/index.tsx'),/searchInput: \{\s*flex: 1,\s*color: '#183E63',\s*fontSize: 16,/);
});
