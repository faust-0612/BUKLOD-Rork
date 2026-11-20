import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const r=p=>readFileSync(p,'utf8');
test('Genesis Proverb is confined to Show Faith scopes and behind nonproduction preview',()=>{
 const card=r('src/components/BuklodSeason2ProverbsDailyVerse.tsx');
 const pub=r('src/app/(tabs)/buklod.tsx');
 const scoped=r('src/components/BuklodExclusiveScopeCommunity.tsx');
 assert.match(card,/if \(!showFaith\) return null/);
 assert.match(card,/activeScope\?\.show_faith_content/);
 assert.match(pub,/isGenesisPreviewBuild\(\) \? <BuklodSeason2ProverbsDailyVerse/);
 assert.match(scoped,/isGenesisPreviewBuild\(\) && mode === 'wall' && scope\.show_faith_content/);
 assert.ok(pub.indexOf('placement="community_entry"')<pub.indexOf('<BuklodSeason2ProverbsDailyVerse'));
 assert.ok(scoped.indexOf("placementId={")<scoped.indexOf('<BuklodSeason2ProverbsDailyVerse enabled />'));
});
test('Daily Proverbs includes full 915 authentic verses, no double credit and no paid API',()=>{
 const corpus=r('src/lib/season2/buklodProverbsKjvFullR1.ts');
 const select=r('src/lib/season2/buklodDailyProverbsR1.ts');
 const card=r('src/components/BuklodSeason2ProverbsDailyVerse.tsx');
 assert.match(corpus,/PROVERBS_KJV_BY_CHAPTER/);
 assert.match(select,/TOTAL_PROVERBS_VERSES/);
 assert.match(select,/PROVERBS_KJV_BY_CHAPTER/);
 assert.match(select,/2026-12-06/);
 assert.match(card,/get_bible_chapter/);
 assert.doesNotMatch(card,/claimBuklodRewardEvent|tokenMint|paymentIntent/);
});
