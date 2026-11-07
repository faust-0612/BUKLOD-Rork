import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const code = read('src/lib/buklodDesktopContextDock.ts');
const dock = await import('data:text/javascript,' +
  encodeURIComponent(stripTypeScriptTypes(code)));

test('Connect dock opens real personal and community threads without navigation', () => {
  const opened = [];
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'direct',threadId:'thread-1'}),false);
  const stop = dock.registerBuklodDesktopDockOpener(request => opened.push(request));
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'direct',threadId:'thread-1'}),true);
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'community',scopeId:'scope-1'}),true);
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'profile',userId:'person-1'}),true);
  assert.deepEqual(opened.map(item => item.kind),['direct','community','profile']);
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'direct',threadId:'  '}),false);
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'community',scopeId:'  '}),false);
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'profile',userId:''}),false);
  assert.equal(opened.length,3);
  stop();
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'direct',threadId:'thread-2'}),false);
});

test('replaced desktop listener survives stale cleanup and does not leak', () => {
  const first=[],second=[];
  const stopFirst=dock.registerBuklodDesktopDockOpener(req=>first.push(req));
  const stopSecond=dock.registerBuklodDesktopDockOpener(req=>second.push(req));
  stopFirst();
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'direct',threadId:'thread-x'}),true);
  assert.equal(first.length,0);
  assert.equal(second.length,1);
  stopSecond();
  assert.equal(dock.tryOpenBuklodDesktopDock({kind:'direct',threadId:'thread-y'}),false);
});

test('Connect retains existing composer, calls and in-place Back/error handling', () => {
  const engine=read('src/components/BuklodConnectThread.tsx');
  const panel=read('src/components/BuklodPublicDesktopDashboard.tsx');
  const inbox=read('src/app/(tabs)/messages.tsx');
  assert.match(panel,/<BuklodConnectThread/);
  assert.match(panel,/onBackOverride=\{\(\) => setDockRequest\(null\)\}/);
  assert.match(panel,/setDockRequest\(null\)/);
  assert.match(panel,/Expand conversation to full screen/);
  assert.match(engine,/onBack=\{leaveThread\}/);
  assert.match(engine,/const leaveThread = useCallback/);
  assert.match(engine,/onAudioCall=\{\(\) => void startDirectCall\('audio'\)\}/);
  assert.match(engine,/onVideoCall=\{\(\) => void startDirectCall\('video'\)\}/);
  assert.match(inbox,/if \(tryOpenBuklodDesktopDock\(\{/);
});

test('dock does not expose locked profile avatar or retain previous-account details', () => {
  const panel=read('src/components/BuklodPublicDesktopDashboard.tsx');
  const preview=read('src/components/BuklodDesktopMemberPreview.tsx');
  assert.match(panel,/dockRequest\?\.userId === userId/);
  assert.match(panel,/key=\{visibleDock.userId \+ ':' \+ userId\}/);
  assert.match(preview,/profile\.can_view_details \? \(/);
  assert.match(preview,/result\?\.viewerId === viewerId/);
  assert.match(preview,/loadMemberPublicProfile\(userId\)/);
});


test('docked Connect render errors close only the side panel and heavy engine loads lazily', () => {
  const boundary=read('src/components/connect/ConnectRenderBoundary.tsx');
  const shell=read('src/components/BuklodPublicDesktopDashboard.tsx');
  assert.match(boundary,/onFallbackClose\?: \(\) => void/);
  assert.match(boundary,/this\.props\.onFallbackClose\(\)/);
  assert.match(shell,/onFallbackClose=\{\(\) => setDockRequest\(null\)\}/);
  assert.match(shell,/React\.lazy\(\(\) => import\('@\/components\/BuklodConnectThread'\)\)/);
  assert.match(shell,/React\.lazy\(\(\) => import\('@\/components\/BuklodDesktopMemberPreview'\)\)/);
  assert.match(shell,/<Suspense fallback=\{<ActivityIndicator accessibilityLabel="Loading details"/);
});
