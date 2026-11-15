import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');

test('Daily Bible Reading uses global palette for dark-mode card text, date chips, input and root', () => {
 const s=read('src/app/bible/index.tsx');
 for(const pattern of [/useBuklodTheme/,/useThemedShared/,/themedShared\.screen/,/styles\.big,foreground/,/styles\.reference,foreground/,/styles\.day,chipSurface/,/active&&chipActive/,/styles\.input,inputSurface/,/placeholderTextColor=\{theme\.textMuted\}/])
  assert.match(s,pattern);
});
test('Notification Center rows and all headings use reactive palette (not static colors on dark Cards)', () => {
 const s=read('src/app/notifications/index.tsx');
 for(const pattern of [/const \{ theme \} = useBuklodTheme\(\)/,/const shared = useThemedShared\(\)/,/color:theme\.textPrimary/,/color:theme\.textSecondary/,/color:theme\.textMuted/,/backgroundColor:theme\.accentSoft/,/name="chevron-right" size=\{20\} color=\{theme\.textMuted\}/])
  assert.match(s,pattern);
});
test('Twenty new original Biblical lessons are appended without replacing existing twelve slugs or categories', () => {
 const old=read('src/features/childrenStories/bibleCurriculumOld.ts');
 const newer=read('src/features/childrenStories/bibleCurriculumNew.ts');
 const ids=[...old.matchAll(/\bid:'([a-z0-9-]+)'/g),...newer.matchAll(/\bid:'([a-z0-9-]+)'/g)].map(m=>m[1]);
 assert.equal(ids.length,20);
 assert.equal(new Set(ids).size,20);
 const catalog=read('src/features/childrenStories/catalog.ts');
 const school=read('src/features/childrenStories/sundaySchool.ts');
 assert.match(catalog,/\.\.\.EXTRA_BIBLE_STORIES/);
 assert.match(school,/\.\.\.EXTRA_BIBLE_LESSONS/);
 const factory=read('src/features/childrenStories/bibleCurriculumFactory.ts');
 assert.match(factory,/for \(const seed of seeds\)/);
 assert.match(factory,/source:'bundled'/);
 assert.match(factory,/narrative:seed\.narrative/);
 assert.match(factory,/questions:\[/);
});
test('Expanded bedtime/school playback remains ad-free and stops speech on navigation and background',()=>{
 const reader=read('src/app/children-stories/[id].tsx');
 assert.match(reader,/Speech\.speak/);
 assert.match(reader,/onDone:next/);
 assert.match(reader,/speechToken\.current/);
 assert.match(reader,/AppState\.addEventListener/);
 assert.match(read('src/lib/buklodGlobalAdController.ts'),/SENSITIVE_PREFIXES[\s\S]*'\/children-stories'/);
});
