import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const me = read('src/app/(tabs)/me.tsx');
const lib = read('src/lib/buklodMemberProfile.ts');
const connect = read('src/app/(tabs)/messages.tsx');
const contacts = read('src/components/connect/ConnectQuickContacts.tsx');

test('BUKLOD Official authored posts are not gated out',()=>{
 assert.ok(me.includes('isBuklodOfficial && !!profile?.id && <BuklodProfilePostCards userId={profile.id} />'));
 assert.ok(me.includes('!isBuklodOfficial && !!profile?.id && <BuklodProfilePostCards userId={profile.id} />'));
 assert.ok(me.indexOf('isBuklodOfficial && !!profile?.id && <BuklodProfilePostCards') < me.indexOf('<BuklodSystemAnnouncementBoard slot="profile"'));
 assert.match(me,/MY OVERALL & MONTHLY RANK/);
 assert.match(me,/BuklodProfileActivityCards/);
});
test('filtered Marites cannot starve owner post preview and account filters remain',()=>{
 assert.match(lib,/const targetRows = Math\.max\(1, Math\.min\(40,/);
 assert.match(lib,/page < 3 && visible\.length < targetRows/);
 assert.ok(lib.includes('.range(page * pageSize, (page + 1) * pageSize - 1)'));
 assert.ok(lib.includes('if (row?.is_hidden) continue;'));
 assert.ok(lib.includes('if (row?.author_only && !isSelf) continue;'));
 assert.ok(lib.includes("includes(MARITES_POST_MARKER)"));
 assert.ok(lib.includes("audience !== 'public'"));
 assert.ok(lib.includes("visible.length >= targetRows"));
 assert.ok(lib.includes(".eq('user_id', id)"));
 assert.ok(lib.includes("if (rows.length < pageSize) break;"));
});
test('dark HIBLA header stays visible with transparent, aligned contact avatars',()=>{
 assert.ok(connect.includes('backgroundColor: HIBLA.pine'));
 assert.ok(connect.includes('color: HIBLA.gold'));
 assert.ok(connect.includes("color: '#FFFFFF',\n      fontSize: buklodVisual.type.title"));
 assert.ok(connect.includes('borderBottomLeftRadius: 25'));
 assert.match(connect, /searchDock:\s*\{[\s\S]*?marginTop:\s*4/);
 assert.ok(!connect.includes('marginTop: -12'));
 assert.ok(contacts.includes("backgroundColor: 'transparent'"));
 assert.ok(contacts.includes('height: NOTE_ZONE_HEIGHT'));
 assert.ok(contacts.includes('style={styles.editingPopover}'));
 assert.ok(!contacts.includes('minHeight: NOTE_ZONE_EDIT_HEIGHT'));
 assert.ok(contacts.includes('markConnectStatusNoteSeen'));
 assert.ok(contacts.includes('onSaveSelfNote={persistSelfNote}'));
});
test('Connect navigation tabs stay before people and ad inventory',()=>{
 const tab=connect.indexOf('<ConnectInboxTabs\n');
 const people=connect.indexOf('<ConnectSuggestedContacts\n');
 const ad=connect.indexOf('<BuklodFirstViewAd\n',connect.indexOf('const renderHiblaHeader'));
 assert.ok(tab>0 && people>tab && ad>people);
 assert.equal(connect.split('<ConnectInboxTabs\n').length-1,1);
 for(const id of ['connect_personal_first_view','connect_community_first_view','connect_personal_inline_4','connect_community_inline_4'])
  assert.ok(connect.includes(id),id);
 for(const preserved of ['onTabChange={setTab}','openPersonalThread','openCommunityRoom'])
  assert.ok(connect.includes(preserved),preserved);
});
