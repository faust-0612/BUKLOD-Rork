import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const cfg=require('../app.config.js');
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Genesis release identity is real staging, not separate QA app nor production package',()=>{
  const names=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA'];
  const env=Object.fromEntries(names.map(x=>[x,process.env[x]]));
  try {
    Object.assign(process.env,{APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA:'true'});
    const review=cfg({config:{}});
    assert.equal(review.android.package,'org.mzbministry.buklod.staging');
    assert.equal(review.scheme,'buklod-staging');
    assert.equal(review.runtimeVersion,'2.0.0-genesis-preview');
    assert.equal(review.name,'BUKLOD Genesis Staging');
    assert.equal(review.updates.enabled,false);
    assert.ok(review.android.blockedPermissions.includes('android.permission.INTERNET'));
    delete process.env.EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA;
    const stage=cfg({config:{}});
    assert.equal(stage.android.package,'org.mzbministry.buklod.staging');
    assert.notEqual(stage.updates?.enabled,false);
    process.env.APP_VARIANT='production';
    process.env.EXPO_PUBLIC_APP_ENV='production';
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA='true';
    const production=cfg({config:{}});
    assert.equal(production.android.package,'org.mzbministry.buklod');
    assert.equal(production.runtimeVersion,'1.3.2');
    assert.equal(production.android.blockedPermissions.includes('android.permission.INTERNET'),false);
  } finally {
    names.forEach(x=>{if(env[x]===undefined)delete process.env[x];else process.env[x]=env[x];});
  }
});
test('staging visual preview contains original Genesis components, skips live bootstrap and does not push OTA',()=>{
  const workflow=src('.github/workflows/genesis-render-qa-apk-20261120.yml');
  const entry=src('index.js');
  assert.match(workflow,/org\.mzbministry\.buklod\.staging/);
  assert.match(workflow,/BUKLOD_GENESIS_RENDER_QA_BUILD/);
  assert.match(workflow,/assembleRelease/);
  assert.match(workflow,/android\.permission\.INTERNET/);
  assert.match(workflow,/actions\/upload-artifact@v4/);
  assert.match(entry,/GenesisRenderQaEntry/);
  assert.match(entry,/require\('expo-router\/entry'\)/);
  const body=entry.slice(entry.indexOf('if (process.env.EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA'),entry.indexOf('} else {'));
  assert.doesNotMatch(body,/setFirebaseListeners|setPushConfig|buklodPttBootstrap/);
  assert.doesNotMatch(workflow,/eas update|eas build|supabase db|--profile production/);
});
