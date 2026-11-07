import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const trigger=read('.github/workflows/buklod-authorized-production-20261107.yml');
const android=read('.github/workflows/production_android_ota.yml');
const web=read('.github/workflows/production_web_deploy.yml');
const app=read('src/app/advertise/index.tsx');
const admin=read('src/app/admin/sponsors.tsx');
const migration=read('supabase/migrations/20261107222500_buklod_paid_ad_admin_review_v1.sql');
const config=read('app.config.js');

test('final Advertise release requires exact authenticated main push marker, not every commit',()=>{
 assert.match(trigger,/branches: \[main\]/);
 assert.match(trigger,/paths: \[\.github\/workflows\/buklod-authorized-production-20261107\.yml\]/);
 assert.match(trigger,/if: >-\s*\n\s+github\.event_name == 'push'/);
 assert.match(trigger,/startsWith\(github\.event\.head_commit\.message, 'release\(buklod\): Advertise submit-admin prod 2026-11-07'\)/);
 assert.match(trigger,/test "\$GITHUB_REF" = "refs\/heads\/main"/);
 assert.match(trigger,/test "\$head" = "\$GITHUB_SHA"/);
 assert.doesNotMatch(trigger,/npx eas-cli|npx eas update|npx eas deploy/);
});
test('one-time marker dispatches original Android RC and Expo web source gates',()=>{
 const title="'release(buklod): Advertise submit-admin prod 2026-11-07')";
 const targets='targets=("production_android_ota.yml|BUKLOD/Android production OTA" "production_web_deploy.yml|BUKLOD/Expo Hosting production web")';
 assert.ok(trigger.includes(title+'\n              '+targets));
 assert.match(trigger,/for entry in "\$\{targets\[@\]\}"; do/);
 assert.match(trigger,/\$api\/actions\/workflows\/\$workflow\/dispatches/);
 assert.match(trigger,/if \[ "\$code" != 204 \]/);
 assert.match(android,/workflow_dispatch:/);
 assert.match(web,/workflow_dispatch:/);
 assert.match(android,/node scripts\/android-ota-rc\.cjs published/);
 assert.match(web,/npx eas-cli@latest deploy --prod/);
});
test('exact source contains both submit fixes and separate two-stage admin review',()=>{
 assert.match(app,/testID="advertise-submit"/);
 assert.match(app,/Submitted for Review/);
 assert.match(admin,/<BuklodPaidAdsReview \/>/);
 assert.match(migration,/buklod_admin_review_paid_ad_v1/);
 assert.match(migration,/verify_payment/);
 assert.match(migration,/p_action='approve'/);
 assert.match(migration,/public\.is_system_admin\(\)/);
 assert.match(config,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
});
test('release requires exact publication gate results; unpaid campaigns not activated',()=>{
 assert.match(trigger,/workflow_run:/);
 assert.match(trigger,/final_step="Publish exact frozen Android RC"/);
 assert.match(trigger,/final_step="Deployment status"/);
 assert.match(trigger,/\[ "\$conclusion" = success \] && \[ "\$final_result" = success \]/);
 assert.match(trigger,/state=failure/);
 assert.match(migration,/v_ad\.payment_status NOT IN \('paid','waived'\)/);
 assert.match(migration,/v_ad\.amount_paid<v_ad\.monthly_price/);
});
