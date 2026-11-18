import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

const screens = [
  'src/app/life/index.tsx',
  'src/app/life/topic.tsx',
  'src/app/life/guide.tsx',
  'src/app/life/support.tsx',
  'src/app/life/invite.tsx',
  'src/app/life/share.tsx',
  'src/app/life/impact.tsx',
  'src/components/BuklodLifeWallCard.tsx',
];

test('all LIFE routes and public Wall entry use the shared language source', () => {
  for (const path of screens) {
    const src = read(path);
    assert.match(src, /useBuklodLifeLanguage\(\)/, path);
    assert.doesNotMatch(src, /normalizeBuklodLifeLanguage\(|detectBuklodPublicLanguage\(/, path);
  }
});

test('LIFE route hydrates saved language before rendering any nested screen', () => {
  const layout = read('src/app/life/_layout.tsx');
  const provider = read('src/providers/BuklodLifeLanguageProvider.tsx');
  assert.match(layout, /<BuklodLifeLanguageProvider>/);
  assert.match(provider, /AsyncStorage\.getItem\(storageKey\)/);
  assert.match(provider, /loadedKey !== storageKey/);
  assert.match(provider, /authLoading \|\| !appReady/);
  assert.match(provider, /@buklod\/life-language-v1:/);
  assert.match(provider, /AsyncStorage\.setItem\(storageKey, next\)/);
  assert.doesNotMatch(provider, /from\('profiles'\)|\.rpc\(/);
});

test('user-controlled choice remains LIFE-specific and is not inferred from a route parameter', () => {
  const index = read('src/app/life/index.tsx');
  const topic = read('src/app/life/topic.tsx');
  const resolver = read('src/lib/buklodLifeLanguage.ts');
  assert.match(index, /setLifeLanguage\(language === 'fil' \? 'en' : 'fil'\)/);
  assert.match(index, /lang: language/);
  assert.match(topic, /const language = useBuklodLifeLanguage\(\)/);
  assert.doesNotMatch(topic, /safeLanguage\(params\.lang\)/);
  assert.match(topic, /const translatedQuestions = getBuklodLifeCopy/);
  assert.match(resolver, /const app = explicitLanguage\(input\.appPreference\)/);
  assert.match(resolver, /const profile = explicitLanguage\(input\.profileLanguage\)/);
  assert.ok(resolver.indexOf('const app =') < resolver.indexOf('const profile ='));
});

test('LIFE keeps optional profile language and saved choices without modifying deferred authentication source', () => {
  const provider = read('src/providers/BuklodLifeLanguageProvider.tsx');
  assert.match(provider, /\(profile as any\)\?\.preferred_language/);
  const auth = read('src/providers/AuthProvider.tsx');
  assert.doesNotMatch(auth, /username,preferred_language,login_method/);
  const hook = read('src/hooks/useBuklodLifeLanguage.ts');
  assert.match(hook, /savedChoice\?\.storageKey === storageKey/);
});

test('LIFE localization leaves private spiritual checkpoints, monetization and ad code untouched', () => {
  const tab = read('src/components/BuklodLifeTabs.tsx');
  assert.match(tab, /'Buhay Ko'/);
  assert.match(tab, /'Epekto'/);
  assert.match(read('src/app/life/impact.tsx'), /'Puno ng Buhay'/);
  assert.match(read('src/lib/buklodLifePrivateProgress.ts'), /SecureStore\.setItemAsync/);
  assert.match(read('src/lib/buklodLifePrivateProgress.ts'), /Do not fall back to plaintext|do not fall back to plaintext/i);
});
