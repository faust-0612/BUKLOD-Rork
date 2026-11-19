import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = readFileSync('src/app/_layout.tsx','utf8');
const store = readFileSync('src/lib/buklodRememberedLoginSecrets.ts','utf8');

test('BUKLOD root navigation boot migrates old credentials off the critical path', () => {
  assert.match(root, /import \{ secureBuklodRememberedLoginOnStartup \} from '@\/lib\/buklodRememberedLoginSecrets'/);
  assert.match(root, /useEffect\(\(\) => \{\s*void secureBuklodRememberedLoginOnStartup\(\)\.catch\(\(\) => undefined\);\s*\}, \[\]\)/);
  assert.match(root, /<AuthProvider>/);
  assert.match(root, /<BuklodNavSafeShell>/);
  assert.match(root, /<Stack\b/);
  assert.doesNotMatch(root, /await secureBuklodRememberedLoginOnStartup/);
});

test('boot cleanup reads only local storage, never changes sessions, routes, ads or tokens', () => {
  const start = store.indexOf('export async function secureBuklodRememberedLoginOnStartup');
  const end = store.indexOf('export async function writeBuklodRememberedLogin', start);
  assert.ok(start >= 0 && end > start);
  const body = store.slice(start,end);
  assert.match(body, /await readBuklodRememberedLogin\(\)/);
  assert.match(body, /Platform\.OS === 'web'/);
  assert.match(body, /AsyncStorage\.getAllKeys\(\)/);
  assert.doesNotMatch(body, /fetch\(|supabase\.|router\.|signOut\(|signIn\(|updateSession\(/);
});
