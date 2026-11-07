import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('KL chapter is +5 BP, 30 full chapters earn +30 once, app feedback matches',()=>{
 const sql=read('supabase/migrations/20261107232000_buklod_points_r3_kl_reading_rewards.sql');
 const ui=read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
 assert.match(sql,/v_user,5,'kl_episode_completion'/);
 assert.match(sql,/v_user,30,'kl_season_completion'/);
 assert.match(sql,/v_season_count=30 and v_finished=30/);
 assert.match(sql,/on conflict do nothing/);
 assert.match(ui,/result\.chapter_points/);
 assert.match(ui,/result\.series_points/);
 assert.match(ui,/showBuklodAdOpportunity\('kl_chapter_success'\)/);
});
