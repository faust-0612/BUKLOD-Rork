import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');

test('login avatar prefers freshly fetched public canonical file and preserves version identity', () => {
  const x = read('src/app/(auth)/login.tsx');
  assert.match(x, /function suggestedAvatarVersion\(/);
  assert.match(x, /function freshSuggestedAvatarUrl\(/);
  assert.match(x, /freshSuggestedAvatarUrl\(canonicalUrl, refreshVersion\)/);
  assert.match(x, /freshSuggestedAvatarUrl\(savedUrl, refreshVersion\)/);
  assert.match(x, /key=\{\`\$\{userId\}:\$\{remoteUrl \?\? 'green-b'\}\`\}/);
  assert.match(x, /setCandidateIndex\(/);
  assert.match(x, /const \[refreshVersion\] = useState\(\(\) => String\(Date\.now\(\)\)\)/);
  const picker = x.slice(x.indexOf('function SuggestedLoginAvatar('), x.indexOf('export default function LoginScreen()'));
  assert.doesNotMatch(picker, /\.from\('profiles'\)/, 'pre-auth account picker must not read private profiles');
});

test('confirmed profile avatar save mirrors only own account locally', () => {
  const me = read('src/app/(tabs)/me.tsx');
  const storage = read('src/lib/buklodSuggestedLoginStorage.ts');
  assert.match(me, /publishBuklodLiveAvatar\(\{ userId: profile\.id, url: avatarUrl \}\);[\s\S]{0,440}updateSavedSuggestedLoginAvatar\(profile\.id, avatarUrl\)/);
  assert.match(storage, /export async function updateSavedSuggestedLoginAvatar\(/);
  assert.match(storage, /normalize\(item\.userId\) !== target/);
  assert.match(storage, /return \{ \.\.\.item, avatarUrl: cleanUrl \}/);
  assert.match(storage, /if \(changed\) \{[\s\S]*?AsyncStorage\.setItem/);
  assert.doesNotMatch(storage, /updateSavedSuggestedLoginAvatar[\s\S]{0,1100}SecureStore\.setItem/);
});

test('remembered login authentication and explicit removal remain unchanged', () => {
  const x=read('src/app/(auth)/login.tsx');
  assert.match(x, /suggestedLoginPasswordKey\(/);
  assert.match(x, /clearSavedSuggestedLoginPassword\(/);
  assert.match(x, /deleteLoginSecret\(/);
  assert.match(x, /loginInFlightRef\.current/);
  assert.match(x, /signInWithPasswordResilient/);
  assert.match(x, /withBuklodTimeout\(/);
  assert.match(x, /\.eq\('id', userId\)/);
  assert.match(x, /router\.replace\(/);
});
