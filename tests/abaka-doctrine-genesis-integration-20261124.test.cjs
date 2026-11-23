const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const get=path=>fs.readFileSync(path,'utf8');
const list=get('src/app/faith/abc/index.tsx');
const admin=get('src/app/faith/abc/admin.tsx');
const detail=get('src/app/faith/abc/[lessonId].tsx');
const catalog=get('src/data/faith/abcDoctrinalCatalog.ts');
const core=get('src/data/faith/abcLessons.ts');
const sql=get('supabase/migrations/20261124005500_abaka_continuing_doctrine_rewards.sql');
const author=get('supabase/migrations/20261124020500_abaka_doctrine_admin_authoring.sql');

test('Genesis preview continues to enforce faith opt-out, authentication, startup and church home',()=>{
 for(const marker of ['isGenesisPreviewBuild','requiresAcceptance','pilot_access_required','show_faith_content','/season2/church']){
   assert.ok(list.includes(marker),marker);
 }
 assert.match(list,/new\s+Set\(current\.map\(item=>item\.id\)\)/);
 assert.match(list,/accountId/);
 assert.match(list,/get_my_abc_growth_progress_v1/);
 assert.match(list,/faith-abc-doctrine-catalog:v1/);
 assert.match(list,/onEndReached/);
 assert.match(list,/DOCTRINE_DAILY_REWARD_CAP/);
 assert.match(list,/prerequisiteId.*!progress\[item\.prerequisiteId\]/);
 assert.match(list,/entry\.points/);
 assert.match(list,/ABC_LESSONS/);
});
test('published doctrinal content is paged and details are server-validated',()=>{
 assert.match(catalog,/\.eq\('published', true\)/);
 assert.match(catalog,/\.range\(offset, offset \+ DOCTRINE_CATALOG_PAGE_SIZE - 1\)/);
 assert.match(catalog,/loadPublishedDoctrinalLesson/);
 assert.match(detail,/complete_my_abc_doctrinal_lesson_v1/);
 assert.match(detail,/p_answer:\s*String\(answers\['__quiz_option'\]/);
 assert.match(detail,/p_reflection:/);
 assert.match(detail,/if \(lesson\.assessment\) \{/);
 assert.match(detail,/setEarnedPoints\(points\)/);
 assert.match(detail,/if \(!lesson\.assessment && !pendingSync/);
 assert.ok(core.includes("seriesTitle?: string"));
 assert.ok(sql.includes("pg_advisory_xact_lock"));
 assert.ok(sql.includes("quiz_cooldown"));
 assert.ok(sql.includes("private.buklod_abc_doctrine_reflection_hashes"));
 assert.ok(detail.includes("data?.completed !== true"));
 assert.ok(sql.includes("today_points + points_for_level <= 50"));
});
test('admin editor never writes directly to tables and stays server authorized',()=>{
 for(const api of ['buklod_is_system_admin','buklod_abc_doctrine_admin_list_v1',
   'buklod_abc_doctrine_admin_save_v1','buklod_abc_doctrine_admin_publication_v1']){
   assert.ok(admin.includes(api),api);
 }
 assert.doesNotMatch(admin,/\.from\('buklod_abc_doctrinal_lessons'\)\.(?:insert|upsert|update|delete)/);
 assert.match(admin,/reviewNote\.trim\(\)\.length<30/);
 assert.match(admin,/Alert\.alert\(isPublished\?/);
 assert.match(author,/not public\.buklod_is_system_admin\(\)/);
 assert.match(author,/revoke all on function public\.buklod_abc_doctrine_admin_save_v1/);
 assert.match(author,/Published lessons are immutable/);
 assert.match(author,/private\.buklod_abc_doctrine_publication_audit/);
 assert.match(author,/Prerequisite must be published first/);
});
test('approved points stay in ledger and cannot be farmed with client values',()=>{
 for(const [tier,points] of [['foundation',8],['intermediate',12],['advanced',18],['deep',25]]){
   assert.ok(sql.includes("when '"+tier+"' then "+points),tier);
   assert.ok(catalog.includes(tier+': '+points),tier);
 }
 assert.ok(sql.includes("on conflict(user_id,source_key) do nothing"));
 assert.ok(sql.includes("private.buklod_abc_doctrinal_answers"));
 assert.ok(sql.includes("count(distinct lower(word))"));
 assert.ok(sql.includes("existing public.buklod_abc_growth_progress%rowtype"));
 assert.ok(sql.includes("case when today_points + points_for_level <= 50 then points_for_level else 0 end"));
 assert.ok(sql.includes("if public.buklod_is_system_admin() then award := 0; end if;"));
});
