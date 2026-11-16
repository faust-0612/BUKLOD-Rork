import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const block=(src,name)=>src.match(new RegExp('\\b'+name+':\\s*\\{([\\s\\S]*?)\\},'))?.[1]??'';
test('shared app-wide compact tokens keep normal touch and body sizes',()=>{
 const v=read('src/lib/buklodVisual.ts'),d=read('src/lib/buklodDesignTokens.ts');
 assert.match(v,/space: \{ screen: 10, section: 8, card: 10, inline: 6, tight: 4 \}/);
 assert.match(v,/touch: 48, row: 56/);
 for(const [key,n] of [['SCREEN.PADDING_HORIZONTAL',10],['SCREEN.SECTION_GAP',8],['CARD.PADDING_HORIZONTAL',10],['CARD.PADDING_VERTICAL',8]])
  assert.ok(d.includes("'"+key+"': "+n),key);
 assert.match(d,/'BUTTON.MIN_HEIGHT': 46/);
 assert.match(d,/'INPUT.MIN_HEIGHT': 46/);
});
test('Connect notes no longer reserve blank fixed-height placeholders',()=>{
 const src=read('src/components/connect/ConnectQuickContacts.tsx');
 assert.match(block(src,'scroll'),/alignItems:\s*'flex-end'/);
 assert.doesNotMatch(block(src,'column'),/minHeight:\s*216/);
 for(const key of ['noteZone','noteZoneEditing'])assert.doesNotMatch(block(src,key),/height:\s*NOTE_ZONE_HEIGHT|height:\s*108/);
 assert.match(src,/const NOTE_MAX_LINES = 5/);
 assert.match(src,/style=\{styles\.editingPopover\}/);
 assert.match(src,/onSaveSelfNote=\{persistSelfNote\}/);
 assert.match(src,/markConnectStatusNoteSeen/);
});
test('Wall notes retain five lines and dynamically align all avatars including owner',()=>{
 const src=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
 assert.match(block(src,'row'),/alignItems:\s*'flex-end'/);
 for(const key of ['noteZone','noteZoneEditing','noteAddWrap'])assert.doesNotMatch(block(src,key),/height:\s*108/);
 assert.match(src,/const NOTE_MAX_LINES = 5/);
 assert.match(src,/return <View style=\{styles\.noteZone\} \/>;/);
 assert.match(src,/editable\s+mine/);
 assert.match(src,/>My note<\/Text>/);
});
test('Home Profile Connect and Wall are denser with bottom/ads/navigation intact',()=>{
 const h=read('src/app/(tabs)/home.tsx'),pr=read('src/app/(tabs)/me.tsx');
 const c=read('src/app/(tabs)/messages.tsx'),wall=read('src/app/(tabs)/buklodCommunityStyles.ts');
 const cards=read('src/components/BuklodProfilePostCards.tsx');
 assert.match(h,/paddingHorizontal: 10, gap: 8/);
 assert.match(pr,/paddingTop: 4,\s*paddingBottom: 12,\s*paddingHorizontal: 0/);
 assert.match(block(c,'sectionTitle'),/paddingTop:\s*6/);
 assert.match(c,/<BuklodFirstViewAd/);
 assert.match(c,/<ConnectInboxTabs/);
 assert.match(wall,/paddingBottom:50/);
 assert.match(cards,/loadMemberCommunityPosts\(userId,userId,3\)/);
 assert.match(cards,/marginTop:buklodVisual\.space\.tight/);
});
