import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Preserve latest 144-story offline bilingual Bible library, theological reference and exact voice engine',()=>{
 const catalog=read('src/features/childrenStories/catalog.ts');
 const expansion=read('src/features/childrenStories/bibleExpansion.ts');
 const old=read('src/features/childrenStories/bibleExpansionOld.ts');
 const modern=read('src/features/childrenStories/bibleExpansionNew.ts');
 const narration=read('src/features/childrenStories/storyNarration.ts');
 assert.match(catalog,/\.\.\.BIBLE_EXPANSION_STORIES/);
 assert.match(expansion,/\.\.\.BIBLE_OLD_RECORDS,\s*\.\.\.BIBLE_NEW_RECORDS/);
 assert.match(expansion,/BIBLE_EXPANSION_LESSONS/);
 assert.match(old,/habakkuk-tiwala/);
 assert.match(modern,/bagong-langit-lupa/);
 assert.match(narration,/findNarrationVoice/);
 assert.match(narration,/getAvailableVoicesAsync/);
 assert.match(narration,/pause\(/);
 assert.match(narration,/resume\(/);
});
test('Dark contrast changes do not modify the enrolled Bible story IDs, audio engine or other protected modules',()=>{
 const bible=read('src/app/bible/index.tsx');
 const notification=read('src/app/notifications/index.tsx');
 assert.match(bible,/DailyReadingAudioPreview/);
 assert.match(bible,/const \{ theme \} = useBuklodTheme\(\)/);
 assert.match(bible,/themedShared\.screen/);
 assert.match(notification,/color:theme\.textPrimary/);
 assert.match(notification,/color:theme\.textSecondary/);
 assert.match(notification,/const shared = useThemedShared\(\)/);
});
