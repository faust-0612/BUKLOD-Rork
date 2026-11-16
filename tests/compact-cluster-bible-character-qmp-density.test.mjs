import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('cluster directory is compact and its first-view ad stays after first card',()=>{
 const s=read('src/app/clusters/index.tsx');
 assert.ok(s.includes('paddingTop: 6, paddingBottom: 16, gap: 6'));
 assert.ok(s.includes('directorySection: { gap: 6 }'));
 assert.ok(s.includes('index === 0 ? <BuklodFirstViewAd placement="cluster"'));
 assert.ok(s.includes("minHeight: 44, justifyContent: 'center'"));
});
test('private QMP report is compact with financial presentation unchanged',()=>{
 const s=read('src/app/community-contribution.tsx');
 assert.ok(s.includes('content:{paddingHorizontal:10,paddingTop:8,paddingBottom:80,gap:8}'));
 assert.ok(s.includes("metric:{width:'48%',minHeight:64"));
 assert.ok(s.includes("backgroundColor:'#FFF',padding:10"));
 assert.ok(s.includes('monthly.withdrawal_enabled'));
 assert.ok(s.includes('history.lifetime_qmp.toLocaleString()'));
});
test('Bible reading screen retains audio, selection, and complete flows',()=>{
 const s=read('src/app/bible/index.tsx');
 assert.ok(s.includes('content:{paddingBottom:40,gap:8}'));
 assert.ok(s.includes('day:{flex:1,paddingVertical:7'));
 assert.ok(s.includes('minHeight:72,'));
 assert.ok(s.includes('<BuklodBibleNarrationBar'));
 assert.ok(s.includes('<SectionTitle>WEEKLY PLAN</SectionTitle>'));
 assert.ok(s.includes('const canSubmit'));
});
test('referral invite keeps copy and share hit targets and identity',()=>{
 const s=read('src/components/BuklodReferralInviteCard.tsx');
 assert.ok(s.includes('minHeight: 44,'));
 assert.ok(s.includes('onPress={() => void copyCode()}'));
 assert.ok(s.includes('onPress={() => void shareInvite()}'));
 assert.ok(s.includes('summary?.qualified_count'));
});
test('character panel and roster keep art and state while becoming denser',()=>{
 const sheet=read('src/components/points/BuklodCharacterCustomizeSheet.tsx');
 const selector=read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
 assert.ok(sheet.includes('bodyContent: { paddingBottom: 12 }'));
 assert.ok(sheet.includes('paddingBottom: drawerBottomInset'));
 assert.ok(sheet.includes('BuklodProgressiveCharacterSelector'));
 assert.ok(selector.includes('roster: { marginTop: 8, marginHorizontal: 10, gap: 6 }'));
 assert.ok(selector.includes('shownCollectiblePins'));
 assert.ok(selector.includes('characterLevel'));
});
