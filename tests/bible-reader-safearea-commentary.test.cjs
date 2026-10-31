const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

test('Bible reader gets top status-bar safe area and independent bottom scroll clearance',()=>{
  const shell=read('src/components/BuklodNavSafeShell.tsx');
  const bible=read('src/app/bible/read.tsx');
  assert.match(shell, /normalizeBuklodPathname\(pathname\) === '\/bible\/read'/);
  assert.match(shell, /paddingTop: contentTopInset/);
  assert.match(shell, /paddingBottom: contentBottomInset/);
  assert.match(bible, /useBuklodScrollBottomInset\(\{ extra: 38 \}\)/);
  assert.match(bible, /paddingBottom: readerScrollBottom/);
  assert.match(bible, /<MyBibleQuickNavigator/);
});

test('Matthew Henry doors are only shown for actual source verse entries, no invented commentary',()=>{
  const bible=read('src/app/bible/read.tsx');
  const provider=read('src/lib/buklodBibleStudy.ts');
  assert.match(bible, /!!bibleStudy.commentary\[Number\(verse.verse_no\)\]/);
  assert.match(bible, /setHenryVerse\(Number\(verse.verse_no\)\)/);
  assert.match(bible, /MATTHEW HENRY • COMMENTARY/);
  assert.match(bible, /modal|Modal/);
  assert.match(provider, /translation === 'KJV'/);
  assert.match(provider, /readJson\(commentaryUrl, abort.signal\)/);
  assert.match(provider, /getOfflineCache/);
  assert.match(provider, /setOfflineCache/);
});

test('KJV words are highlighted only when source matches and link goes to Strong number',()=>{
  const bible=read('src/app/bible/read.tsx');
  const strong=read('src/components/bible/BuklodKjvStrongText.tsx');
  assert.match(bible, /translation === 'KJV'/);
  assert.match(bible, /<BuklodKjvStrongText/);
  assert.match(strong, /alignKjvStrongWords\(text, tags\)/);
  assert.match(strong, /strongLexiconUrl\(first\)/);
  assert.match(strong, /Linking.openURL\(target\)/);
  assert.match(strong, /event.stopPropagation\(\)/);
});

test('Bible study is additive and never touches daily completion or narration',()=>{
  const bible=read('src/app/bible/read.tsx');
  assert.match(bible, /enabled: isMyBibleMode/);
  assert.match(bible, /if \(source === 'daily_plan'\)/);
  assert.match(bible, /<BuklodBibleNarrationBar/);
  assert.match(bible, /bibleAnnotations/);
});
