const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

test('My Bible scenic header and four functional study actions use existing reader state',()=>{
 const source=read('src/app/bible/read.tsx');
 const hero=read('src/components/bible/BuklodBibleScenicHeader.tsx');
 assert.ok(source.includes('<BuklodBibleScenicHeader'));
 assert.ok(source.includes('Buod ng Kabanata'));
 assert.ok(source.includes('Mga Aral at Aplikasyon'));
 assert.ok(source.includes('Progress sa Kabanata'));
 assert.ok(source.includes('setHenryVerse(first)'));
 assert.ok(source.includes('changeTranslation(\'KJV\')'));
 assert.ok(source.includes('setShowBibleAudio(value => !value)'));
 assert.ok(source.includes('setShowBibleTextSettings(value => !value)'));
 assert.ok(source.includes('onLongPress={isMyBibleMode ? () => openBibleAnnotation(Number(verse.verse_no), cleanText)'));
 assert.ok(source.includes('accessibilityLabel="I-share ang napiling talata"'));
 assert.ok(hero.includes('LinearGradient'));
 assert.ok(hero.includes('Svg'));
});

test('The study redesign does not invent completed verse progress or modify daily plan',()=>{
 const source=read('src/app/bible/read.tsx');
 assert.ok(source.includes('completed ? \'100%\' : \'0%\''));
 assert.ok(source.includes('if (source === \'daily_plan\')'));
 assert.ok(source.includes('enabled: isMyBibleMode'));
 assert.ok(source.includes('!!bibleStudy.commentary[Number(verse.verse_no)]'));
 const nav=read('src/components/BuklodPersistentBottomNav.tsx');
 assert.ok(nav.includes("key: 'connect', route: '/messages'"));
 assert.ok(!nav.includes("key: 'bible', route: '/bible/read"));
});

test('DZAS retains supplied images, real ad, radio behavior, and native/web shared layout',()=>{
 const source=read('src/app/personal-home/radio.tsx');
 const web=read('src/app/personal-home/radio.web.tsx');
 const deck=read('src/components/dzas/DzasSignalDeck.tsx');
 const images=read('src/assets/dzasImages.ts');
 const shell=read('src/components/BuklodNavSafeShell.tsx');
 assert.ok(shell.includes("normalizeBuklodPathname(pathname) === '/personal-home/radio'"));
 assert.ok(source.includes('<DzasSignalDeck'));
 assert.ok(web.includes('<DzasSignalDeck'));
 assert.ok(deck.includes('source={DZAS_LOGO_IMAGE}'));
 assert.ok(deck.includes('source={DZAS_PORTRAIT_IMAGE}'));
 assert.ok(source.includes('format="mediumRectangle"'));
 assert.ok(deck.includes('minHeight: 289'));
 assert.ok(deck.includes('<ScrollView'));
 assert.ok(deck.includes('</ScrollView>'));
 assert.ok(source.includes('playDzasRadio(forceReload)'));
 assert.ok(source.includes('pauseDzasRadio()'));
 assert.ok(web.includes("audio.addEventListener('playing'"));
 const matches=[...images.matchAll(/base64,([A-Za-z0-9+/=]+)/g)];
 assert.equal(matches.length,2);
 assert.equal(matches[0][1].length,1728);
 assert.equal(matches[1][1].length,3472);
});
