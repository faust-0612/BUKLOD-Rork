import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/drafts/buklod_rank_owner_notification_v1.sql');
const profile=read('src/components/points/BuklodRankCollectionProfileRow.tsx');
const nav=read('src/lib/buklodNotificationNavigation.ts');
const roadmap=read('src/app/points/progression.tsx');
const me=read('src/app/(tabs)/me.tsx');
test('owner notification reuses and guards existing dispatch function',()=>{
 assert.ok(sql.includes('p.prosrc=$expected$'));
 assert.ok(sql.includes("v_recipient=v_event.actor_id"));
 assert.ok(sql.includes("v_event.kind='rank_up'"));
 assert.ok(sql.includes("v_event.event_key='rank:'||h.id::text"));
 assert.ok(sql.includes("h.trigger_ledger_id is not null"));
 assert.ok(sql.includes('on conflict do nothing'));
 assert.ok(!/create\s+trigger|cron\.schedule\(/i.test(sql));
});
test('rank notice and reminder open only the authenticated rank roadmap',()=>{
 assert.match(nav,/normalizedKind === 'rank_visual_unlocked' \|\| normalizedKind === 'rank_bonus_reminder'[\s\S]{0,90}path: '\/points\/progression'/);
 assert.match(sql,/if v_rank_order<40 then/);
 assert.match(sql,/b\.redeemed_at is null and b\.revoked_at is null/);
});
test('profile counter is fail-closed, scoped and bounded',()=>{
 assert.ok(profile.includes('rank_bonus_collections===true'));
 assert.ok(profile.includes("eq('user_id',owner)"));
 assert.ok(profile.includes(".limit(40)"));
 assert.ok(profile.includes('snapshot?.owner===owner'));
 assert.ok(profile.includes('withBuklodTimeout'));
 assert.ok(profile.includes('if(!active)return;'));
 assert.ok(profile.includes("Open to refresh your rewards"));
 assert.ok(me.includes('!isBuklodOfficial && <BuklodRankCollectionProfileRow />'));
});
test('celebration has optional collection action and non-destructive dismissal',()=>{
 assert.ok(roadmap.includes('CONTINUE WITHOUT BONUS'));
 assert.ok(roadmap.includes('VIEW MY BONUS COLLECTIONS'));
 assert.ok(roadmap.includes('onRequestClose={closeRecognition}'));
 assert.ok(roadmap.includes("animationType={reduceMotion?'none':'fade'}"));
 assert.ok(roadmap.includes('recognitionOwner.current===owner&&!reduceMotion'));
});
