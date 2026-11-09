import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const breaks=read('src/lib/buklodAdOpportunities.ts');
const events=read('src/app/faith/bible-events.tsx');
const mastery=read('src/features/games/kingdom/platform/KingdomMasteryCheck.tsx');
const sql=read('supabase/migrations/20261109143403_buklod_bible_v4_live_events_20261109.sql');
test('Ads are natural post-completion opportunities and not BP eligibility gates',()=>{
 for(const key of ['bible_flash_submission_success','bible_arena_round_complete','kingdom_mastery_verified'])assert.match(breaks,new RegExp(key));
 assert.match(breaks,/No credit, reward mutation or re-submission/);
 assert.match(events,/if\(data\?\.submitted\)/);
 assert.match(mastery,/if \(\(result\.points_awarded \?\? 0\)>0\) void showBuklodAdOpportunity/);
 assert.doesNotMatch(sql,/(?:admob|qmp|cash_credited|pf_withdraw)/i);
});
test('Official AdMob QMP sharing and real money ledger are not changed by quiz',()=>{
 assert.doesNotMatch(sql,/insert into (?:public\.)?(?:buklod_pf_|buklod_economy|buklod_cash)/i);
 assert.match(sql,/buklod_points_ledger/);
});
