import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const queue = readFileSync('src/lib/buklodInstantPublishQueue.ts','utf8');
const create = readFileSync('src/app/igpat/create.tsx','utf8');
const igpat = readFileSync('src/app/igpat/index.tsx','utf8');
const marites = readFileSync('src/components/BuklodMaritesBoard.tsx','utf8');
const publish = readFileSync('src/lib/buklodMaritesBoard.ts','utf8');

test('instant jobs are account-scoped, in-memory and not claimed as server posts',()=>{
  assert.match(queue,/job\.ownerId === ownerId && job\.kind === kind/);
  assert.match(queue,/job\.status === 'uploading'/);
  assert.match(queue,/status: 'uploading'/);
  assert.match(queue,/status !== 'failed'/);
  assert.match(queue,/status !== 'failed'/);
  assert.match(queue,/export class InstantPublishUncertainError/);
  assert.match(queue,/status: uncertain \? 'uncertain' : 'failed'/);
  assert.doesNotMatch(queue,/AsyncStorage|setItem|Storage\.upload/);
});

test('IGPAT shows a playable pending reel before upload completes',()=>{
  const entry = create.slice(create.indexOf('  const publish = async () => {'),create.indexOf('  return (\n    <ScrollView'));
  assert.match(entry,/enqueueInstantPublish\(/);
  assert.match(entry,/router\.replace\('\/igpat'/);
  assert.match(entry,/onProgress: value => reportProgress/);
  assert.match(entry,/create_buklod_reel_v1/);
  assert.match(entry,/authData\.user\?\.id!==snapshot\.userId/);
  assert.match(entry,/InstantPublishUncertainError/);
  assert.match(igpat,/const pendingRows:PendingIgpatRow\[\]/);
  assert.match(igpat,/buildReelsFeedWithInlineAds\(\[\.\.\.pendingRows,\.\.\.rows\]\)/);
  assert.match(igpat,/if \('pendingUpload' in item\)/);
  assert.match(igpat,/<IgpatVideo uri=\{job\.mediaUri\}/);
  assert.match(igpat,/Only you can see it|ONLY YOU CAN SEE THIS/);
  assert.match(igpat,/retryInstantPublish\(job\.id,job\.ownerId\)/);
  assert.match(igpat,/dismissInstantPublish\(job\.id,job\.ownerId\)/);
  assert.match(igpat,/row\.media_path===job\.remoteMediaPath/);
});

test('IGPAT provisional reel has no likes, comments or share actions',()=>{
  const start=igpat.indexOf("if ('pendingUpload' in item)");
  const end=igpat.indexOf('const creatorId = item.user_id',start);
  assert.ok(start>=0&&end>start);
  const local=igpat.slice(start,end);
  assert.doesNotMatch(local,/pulse\(|shareIgpat\(|<ActionButton|toggleSaved/);
  assert.match(local,/job\.status==='uncertain'/);
});

test('Marites keeps upload separate from server list and uses true bounded parallel media upload',()=>{
  assert.match(marites,/getInstantPublishes\(user\?\.id,'marites'\)/);
  assert.match(marites,/pendingMaritesStories/);
  assert.match(marites,/displayStories\.map\(\(story, index\)/);
  assert.match(marites,/story\.id\.startsWith\('pending-marites-'\)/);
  assert.match(marites,/resetComposer\(\);/);
  assert.match(marites,/enqueueInstantPublish\(\{/);
  assert.match(marites,/activeAccountIdRef\.current===snapshot\.userId/);
  assert.match(publish,/mapWithConcurrency\(/);
  assert.match(publish,/Platform\.OS === 'web' \? 2 : 3/);
  assert.match(publish,/result\.ok \? \[result\.data\.media_path\] : \[\]/);
  assert.match(publish,/discardIncompleteCommunityPost\(\{/);
  assert.match(publish,/authData\.user\?\.id !== input\.userId/);
  assert.match(publish,/createAttempted = true/);
  assert.match(publish,/if \(createAttempted && !createdPostId\)/);
  assert.match(publish,/throw new InstantPublishUncertainError/);
  assert.match(publish,/return \{ story: saved, shared: false \}/);
});

test('successful Marites publish preserves server status and offline-only fallback stays labeled',()=>{
  assert.match(marites,/return shared\?'posted':'device_only'/);
  assert.match(queue,/Saved on this device only\. Not shared yet\./);
  assert.match(marites,/status!=='posted'&&job\.status!=='device_only'/);
  assert.match(marites,/maritesMemory\.set\(cacheKey/);
});
