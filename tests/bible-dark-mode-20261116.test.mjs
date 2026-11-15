import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');

test('Daily Reading preserves date selection, offline cache, reflection, validation and saved progress',()=>{
 const s=read('src/app/bible/index.tsx');
 for(const re of [/setSelectedDate\(date\)/,/persistCurrentDraft\(\)/,/chapterQuestions/,/questionAnswers/,/reflectionDraft/,/const canSubmit/,/onPress=\{complete\}/,/getOfflineCache/,/setOfflineCache/])assert.match(s,re);
});
test('Daily Reading and notification cards use semantic colors for nightPine and graphite',()=>{
 const bible=read('src/app/bible/index.tsx');
 const notices=read('src/app/notifications/index.tsx');
 assert.match(bible,/const \{ theme \} = useBuklodTheme\(\)/);
 for(const name of ['foreground','secondary','muted','chipSurface','chipActive','inputSurface'])
   assert.match(bible,new RegExp('const '+name+' ='));
 assert.match(bible,/themedShared\.screen/);
 // The nested audio title/translation/loading/error states share the same dark surface.
 const audio=bible.slice(bible.indexOf('function DailyReadingAudioPreview({'),bible.indexOf('export default function DailyBibleScreen()'));
 assert.match(audio,/const \{ theme \} = useBuklodTheme\(\)/);
 for(const color of ['theme.accent','theme.textSecondary','theme.textMuted','theme.surfaceElevated','theme.surfaceMuted'])assert.ok(audio.includes(color));
 assert.match(notices,/const themedShared = useThemedShared\(\)/);
 assert.match(notices,/color:theme\.textPrimary/);
 assert.match(notices,/color:theme\.textSecondary/);
 assert.match(notices,/color:theme\.textMuted/);
});
