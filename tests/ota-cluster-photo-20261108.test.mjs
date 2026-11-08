import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('uploaded scope photo broadcasts immediate refresh and never makes private bucket public',()=>{
 const uploader=read('src/components/BuklodScopeProfilePhoto.tsx');
 const hook=read('src/hooks/useBuklodScopePhoto.ts');
 const assets=read('src/lib/buklodScopeHomeAssets.ts');
 assert.match(uploader,/notifyBuklodScopePhotoUpdated\(scopeId\)/);
 assert.match(hook,/const key=user\?\.id&&scopeId/);
 assert.match(hook,/createSignedUrl|signedBuklodScopeHomeAsset/);
 assert.match(hook,/pending\.has\(key\)/);
 assert.match(assets,/createSignedUrl\(path,1800\)/);
});
test('Cluster directory and scope chat listings/header use one canonical scope photo',()=>{
 const cluster=read('src/app/clusters/index.tsx');
 const inbox=read('src/app/(tabs)/messages.tsx');
 const row=read('src/components/connect/ConnectCommunityRow.tsx');
 const thread=read('src/components/BuklodConnectThread.tsx');
 const header=read('src/components/connect/ConnectThreadHeader.tsx');
 assert.match(cluster,/useBuklodScopePhoto\(item\.scope_id\)/);
 assert.match(inbox,/scopeId=\{item\.scope_id\}/);
 assert.match(row,/useBuklodScopePhoto\(scopeId\)/);
 assert.match(thread,/scopeId=\{mode === 'scope' \? effectiveContainerId : null\}/);
 assert.match(header,/useBuklodScopePhoto\(scopeId\)/);
});
