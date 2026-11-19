import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Drawer manual native provider import preserves local-only privacy',()=>{
 const v=file('src/app/drawer/import.tsx');
 for (const x of ['expo-document-picker','copyToCacheDirectory: true','isSupportedSmartDrawerImport','commitSmartDrawerItem',"syncState: 'LOCAL_ONLY'"]) assert.ok(v.includes(x),x);
 assert.ok(!v.includes('googleDriveTransport'));
});
test('approved MIME, local storage and bounded import sizes',()=>{
 const a=file('src/lib/smartDrawer/assets.ts');
 for (const x of ['application/pdf','15 * 1024 * 1024','FileSystem.copyAsync','originalName']) assert.ok(a.includes(x),x);
 assert.doesNotMatch(a,/getInfoAsync\(input\.uri,\s*\{\s*size:/);
 const importer=file('src/app/drawer/import.tsx');
 assert.match(importer,/deleteSmartDrawerAsset\(asset\)/);
 const d=file('src/app/drawer/item/[id].tsx');
 assert.match(d,/expo-sharing/);assert.match(d,/file-pdf-box/);
});
test('Genesis native effects only on exact Android preview runtime, no device claim',()=>{
 const n=file('src/features/season2/genesis/genesisNativeFoundation.ts');
 assert.match(n,/runtime === GENESIS_NATIVE_RUNTIME/);assert.match(n,/platform === 'android'/);
 assert.match(n,/deviceVerified: false/);
 const h=file('src/features/season2/genesis/genesisNativeFeedback.ts');
 assert.match(h,/isReduceMotionEnabled/);assert.match(h,/AppState.currentState !== 'active'/);
});
test('preserve Drawer sqlite user scoping and unapproved rig/audio lock',()=>{
 assert.match(file('src/lib/smartDrawer/localStore.ts'),/expo-sqlite/);
 assert.match(file('src/lib/smartDrawer/localStore.ts'),/user_id/);
 assert.match(file('src/features/season2/genesis/genesisAssetRegistry.ts'),/Object.freeze\(\{\}\)/);
});
