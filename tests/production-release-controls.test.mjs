import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { readdirSync, readFileSync } from 'node:fs';
const root = '.github/workflows/';
const read = f => readFileSync(root+f,'utf8');
const a = read('production_android_ota.yml');
const w = read('production_web_deploy.yml');
const n = read('production_android_apk.yml');
const names = readdirSync(root).filter(f=>f.endsWith('.yml'));
test('exactly two canonical production publisher workflows',()=>{
  const publishers = names.filter(f=> /npx eas-cli@latest (?:update|deploy)(?:\s|:)/.test(read(f))).sort();
  assert.deepEqual(publishers,['production_android_ota.yml','production_web_deploy.yml']);
});
test('no direct-to-main legacy auto-patch or Play submission',()=>{
  for(const f of names){
    assert.doesNotMatch(read(f),/^\s*git push origin HEAD:main\s*$/m,f);
    assert.doesNotMatch(read(f),/--auto-submit-with-profile google-play-internal/,f);
  }
});
test('Android release is restricted to explicit main marker and frozen RC',()=>{
  assert.doesNotMatch(a,/^  workflow_dispatch:/m);
  assert.match(a,/^  push:/m);
  assert.match(a,/github\.event_name == 'push'/);
  assert.match(a,/BUKLOD_CONSOLIDATED_PROD_20261108/);
  assert.match(a,/group: buklod-production-android-ota/);
  assert.match(a,/ref: \${{ github.sha }}/);
  assert.match(a,/--input-dir rc --skip-bundler/);
  assert.match(a,/git ls-remote origin refs\/heads\/main/);
  assert.match(readFileSync('scripts/android-ota-rc.cjs','utf8'),/const runtime = '1\.3\.2'/);
});
test('Web release is restricted to explicit main marker and frozen dist',()=>{
  assert.doesNotMatch(w,/^  workflow_dispatch:/m);
  assert.match(w,/^  push:/m);
  assert.match(w,/github\.event_name == 'push'/);
  assert.match(w,/BUKLOD_CONSOLIDATED_PROD_20261108/);
  assert.match(w,/group: buklod-production-web/);
  assert.match(w,/ref: \${{ github.sha }}/);
  assert.match(w,/sha256sum -c web-rc-sha256.txt/);
  assert.match(w,/--prod --export-dir dist --environment production/);
  assert.match(w,/git ls-remote origin refs\/heads\/main/);
});
test('native build manual-only',()=>{
  assert.match(n,/on:\n  workflow_dispatch:/);
  assert.doesNotMatch(n,/^  push:/m);
});
test('legacy workflows are inert and do not schedule jobs or release',()=>{
  const retired = ["buklod_city_web_r1_deploy.yml","character_r25c_containment_deploy.yml","character_r25d_context_viewport_deploy.yml","daily_bible_r23a_web_apk_deploy.yml","daily_devotional_r24_android_deploy.yml","daily_devotional_r24_autopatch.yml","daily_devotional_r24_web_deploy.yml","desktop_home_3col_web_deploy.yml","emergency_web_restore_known_good.yml","emergency_web_supabase_env_restore.yml","formation_ai_play_apk_release.yml","formation_r27_production_deploy.yml","home_identity_r23_autopatch.yml","igpat_production_ota.yml","igpat_production_web_deploy.yml","mzb_profile_home_door_r26_fix.yml","org_directory_home_door_r25_fix.yml","p0_r4_web_deploy.yml","patch_production_web_env_pipeline.yml","production_points_claim.yml","production_web_r21_navigation_fix.yml","profile_quiz_sso_web_deploy.yml","quiz_mobile_r22_android_ota.yml","recover_account_route_web_hotfix.yml","web_live_atmosphere_r1_deploy.yml","web_advance_r29_exact.yml","web_advance_r31_exact.yml","web_restore_r31_exact.yml","web_rollback_r27a_exact.yml"];
  for(const f of retired){
    const s=read(f);
    assert.match(s,/archived legacy workflow/,f);
    assert.match(s,/if: \${{ false }}/,f);
    assert.doesNotMatch(s,/^  push:/m,f);
    assert.doesNotMatch(s,/eas-cli@latest (?:update|deploy|build)|git push origin/,f);
  }
});

test('no EAS-native workflow bypass to production remains',()=>{
  const dir='.eas/workflows';
  const { existsSync } = fs;
  const remaining=existsSync(dir) ? readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)) : [];
  assert.deepEqual(remaining,[]);
});
