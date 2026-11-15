import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAGING_BASE, STAGING_BRANCH, TARGET_CHANNEL, TARGET_PACKAGE, TARGET_RUNTIME,
  PREVIOUS_MARKER, RELEASE_MARKER, validateSourcePaths, validateExistingRelease
} from '../scripts/children-stories-staging-ota-20261115.mjs';

const read = p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('target is only inspected EAS staging-user Android with Expo runtime 1.3.2',()=>{
  assert.equal(STAGING_BASE,'ec1ae3e729990928bfe97c0b01fbdf4ddef11ced');
  assert.equal(STAGING_BRANCH,'integration/children-story-staging-132-20261115');
  assert.equal(TARGET_CHANNEL,'staging-user');
  assert.equal(TARGET_PACKAGE,'org.mzbministry.buklod.staging');
  assert.equal(TARGET_RUNTIME,'1.3.2');
  assert.ok(PREVIOUS_MARKER.includes(STAGING_BASE));
  assert.match(RELEASE_MARKER,/CHILD_STORY_STAGING_132/);
});
test('exact allowlist protects native, auth, production and unrelated media paths',()=>{
  const allowed=[
    'src/app/children-stories/index.tsx','src/app/children-stories/[id].tsx',
    'src/components/home/BuklodHomeUtilityCards.tsx','src/lib/buklodGlobalAdController.ts',
    'supabase/migrations/20261115090000_buklod_children_stories_v1.sql',
    'supabase/tests/buklod_children_stories_rls_contract_20261115.sql',
    'tests/children-stories-staging-ota-20261115.test.mjs',
    '.github/workflows/buklod-children-story-staging-ota-20261115.yml',
    ...Array.from({length:11},(_,i)=>'src/features/childrenStories/example'+i+'.ts')
  ].sort();
  assert.doesNotThrow(()=>validateSourcePaths(allowed,allowed));
  assert.throws(()=>validateSourcePaths([...allowed,'app.config.js'],[...allowed,'app.config.js']),/Native\/protected/);
  assert.throws(()=>validateSourcePaths([...allowed,'src/components/CommunityVideo.tsx'],[...allowed,'src/components/CommunityVideo.tsx']),/Native\/protected/);
  assert.throws(()=>validateSourcePaths(allowed,[...allowed,'src/app/(tabs)/me.tsx']),/Unapproved/);
});
test('staging release fails closed for concurrent newer update',()=>{
  const id='01a1dc49-05e7-73ec-9a61-c7eae9d1bdd9';
  const rows=[{message:PREVIOUS_MARKER,runtimeVersion:'1.3.2',group:'f58acdd7-d800-4ae5-b9de-7d29640e04bb'}];
  assert.equal(validateExistingRelease({currentPage:rows},{id}).id,id);
  assert.throws(()=>validateExistingRelease({currentPage:[{...rows[0],message:'newer'}]},{id}),/advanced/);
  assert.throws(()=>validateExistingRelease({currentPage:rows},{id:'missing'}),/not the inspected baseline/);
  assert.throws(()=>validateExistingRelease({currentPage:[{...rows[0],group:'changed'}]},{id}),/group differs/);
});
test('publish workflow cannot target production and validates remote manifest after publish',()=>{
  const wf=read('.github/workflows/buklod-children-story-staging-ota-20261115.yml');
  assert.match(wf,/--channel staging-user --platform android --environment preview/);
  assert.match(wf,/--skip-bundler --input-dir/);
  assert.match(wf,/BUILD_ID|build:view bc4be208-bfb0-42f3-95cb-358353d0600f/);
  assert.match(wf,/postpublish/);
  assert.doesNotMatch(wf,/update --channel production|eas build --platform|eas submit/);
  assert.match(wf,/EXPO_TOKEN/);
});
test('child-directed route is ad-free without disabling existing home ads',()=>{
  const controller=read('src/lib/buklodGlobalAdController.ts');
  const home=read('src/components/home/BuklodHomeUtilityCards.tsx');
  assert.match(controller,/SENSITIVE_PREFIXES[\s\S]*'\/children-stories'/);
  assert.match(home,/Children's Story World/);
  assert.match(home,/Online Consultation/);
});
