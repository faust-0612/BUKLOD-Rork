import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const study = read('src/lib/buklodBibleStudy.ts');
const reader = read('src/app/bible/read.tsx');
const childScreen = read('src/app/children-stories/[id].tsx');
const childSource = read('src/features/childrenStories/sundaySchool.ts');
const manifest = JSON.parse(read('release/nov16-henry-verse-accurate-stage132-prep.json'));

test('staging release is fail-closed and based on the newer published dialogue/dark source', () => {
  assert.equal(manifest.baseSha, 'f340829775c904aecc9162937bc011fb16c5a34e');
  assert.equal(manifest.target.channel, 'staging-user');
  assert.equal(manifest.target.androidPackage, 'org.mzbministry.buklod.staging');
  assert.equal(manifest.target.runtimeVersion, '1.3.2');
  assert.equal(manifest.validationState.allowOtaPublish, false);
  assert.equal(manifest.validationState.stagingOtaPublished, false);
  assert.equal(manifest.validationState.productionOtaPublished, false);
  assert.ok(!manifest.allowedPaths.some(p => /^(?:supabase\/|android\/|ios\/|package|app\.config)/.test(p)));
});

test('commentary doors require a directly source-covered verse or explicit range', () => {
  assert.match(study, /function getMatthewHenryPassage\([\s\S]*options: \{ allowContext\?: boolean \} = \{\}/);
  assert.match(study, /if \(!options\.allowContext\) return null;/);
  assert.match(reader, /getMatthewHenryPassage\(bibleStudy, Number\(verse\.verse_no\)\)/);
  assert.match(reader, /henryVerse === null \? null : getMatthewHenryPassage\(bibleStudy, henryVerse\)/);
  assert.doesNotMatch(reader, /getMatthewHenryPassage\(bibleStudy,\s*(?:Number\(verse\.verse_no\)|henryVerse),\s*\{\s*allowContext:\s*true/);
});

test('Filipino machine translation has pre-text limitations, source English and official Google attribution', () => {
  const warning = reader.indexOf('Awtomatikong salin lamang: maaaring literal o mali');
  const content = reader.indexOf('? henryTranslation.text : henryPassage?.text');
  assert.ok(warning > 0 && content > warning, 'Warning must precede machine translation');
  assert.match(reader, /flex:\s*1, minWidth:\s*0, alignItems:\s*'center'/);
  assert.match(reader, /Original English/);
  assert.match(reader, /Powered by Google Translate/);
  assert.match(reader, /THIS SERVICE MAY CONTAIN TRANSLATIONS POWERED BY GOOGLE/);
  assert.match(reader, /henryShowOriginal \? 'en' : henryReaderLanguage/);
});

test('newer staged Children dialogue/narration and dark My Bible styles are still present', () => {
  assert.match(reader, /styles\.verseText,\s*\{color:theme\.textPrimary\}/);
  assert.match(reader, /styles\.verseText,\s*\{color:annotation\?\.highlight_color\?'#26372F':theme\.textPrimary\}/);
  assert.match(reader, /<BuklodBibleNarrationBar/);
  assert.match(reader, /enabled: isMyBibleMode/);
  assert.match(childScreen, /StoryNarrator/);
  assert.match(childSource, /withStorytellingDialogue\(id, lesson\)/);
  assert.match(childSource, /BIBLE_EXPANSION_LESSONS/);
});

test('Bible commentary fix has no production, native, AdMob or navigation source writes', () => {
  const allow = manifest.allowedPaths;
  for (const path of allow) {
    assert.doesNotMatch(path,/\b(?:Ads?|admob|bottomNav|PersistentBottomNav|supabase|production)\b/i);
  }
  assert.equal(manifest.target.platform,'android');
  assert.equal(manifest.target.expoEnvironment,'preview');
});
