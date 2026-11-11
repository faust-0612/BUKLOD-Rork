import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('new exact-main RC compiles via the protected Expo Android/web release identity gate',()=>{
 const yaml=read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
 assert.ok(yaml.includes("github.head_ref == 'integration/buklod-nov11-current-main-verified-rc'"));
 assert.match(yaml,/Verify production EAS public build environment without publishing/);
 assert.match(yaml,/1\.3\.2/);
});
test('canonical main contains deployed KL and mutual engagement rewards',()=>{
 const chapter=read('supabase/migrations/20261111085702_kl_verified_reading_10_series_50.sql');
 const mutual=read('supabase/migrations/20261111085727_buklod_mutual_engagement_r4.sql');
 const guide=read('src/components/points/BuklodPointsR2Guide.tsx');
 assert.ok(chapter.includes("v_user,10,'kl_episode_completion'"));
 assert.ok(chapter.includes("v_user,50,'kl_season_completion'"));
 assert.ok(mutual.includes('buklod_engagement_r4_post_bonus_v1'));
 assert.ok(mutual.includes('buklod_engagement_r4_settle_support_chain_v1'));
 assert.ok(mutual.includes('buklod_engagement_r4_settle_helpful_comment_v1'));
 assert.match(guide,/\+10 BP.*\+50 BP/);
});
