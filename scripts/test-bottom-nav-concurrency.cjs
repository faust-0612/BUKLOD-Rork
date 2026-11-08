const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nav = fs.readFileSync('src/components/BuklodPersistentBottomNav.tsx', 'utf8');
const start = nav.indexOf('  const openGlobalDestination =');
const end = nav.indexOf('\n\n  if (', start);
assert(start >= 0 && end > start, 'navigation handler must be inspectable');
const source = nav.slice(start, end).replace("(route: NavItem['route'])", '(route)');
function handler({ platform = 'android', type = 'CLUSTER', publicAvailable = true, fail = false, wait } = {}) {
  const events = [];
  const context = {
    Platform: { OS: platform },
    lastRequestedRoute: { current: null },
    navigationInFlight: { current: false },
    activeScope: { scope_type: type },
    scopes: publicAvailable ? [{ scope_type: 'PUBLIC', scope_id: 'public' }] : [],
    normalizedPath: '/me',
    isOnGlobalNavDestination: (path, route) => path === route,
    setPendingRoute: route => events.push(['pending', route]),
    selectScope: async id => { events.push(['scope', id]); if (wait) await wait; if (fail) throw new Error('failed'); },
    buklodInstantNavigate: route => events.push(['route', route]),
    Alert: { alert: (...args) => events.push(['alert', ...args]) },
    Error,
  };
  return { events, open: vm.runInNewContext(source + '\nopenGlobalDestination;', context) };
}
(async () => {
  let h = handler();
  await h.open('/buklod');
  assert.deepEqual(h.events.filter(x => ['scope', 'route'].includes(x[0])), [['scope', 'public'], ['route', '/buklod']]);
  h = handler({ publicAvailable: false }); await h.open('/buklod');
  assert(!h.events.some(x => x[0] === 'route'), 'missing Public scope must not open scoped global content');
  assert(h.events.some(x => x[0] === 'alert'));
  h = handler({ fail: true }); await h.open('/messages');
  assert(!h.events.some(x => x[0] === 'route'), 'scope failure must not navigate');
  let release;
  h = handler({ wait: new Promise(resolve => { release = resolve; }) });
  const first = h.open('/messages'); const second = h.open('/buklod'); release(); await Promise.all([first, second]);
  assert.equal(h.events.filter(x => x[0] === 'route').length, 1, 'duplicate taps are suppressed');
  h = handler({ type: 'PUBLIC' }); await h.open('/me');
  assert.equal(h.events.length, 0, 'same global destination is a no-op');
  h = handler(); await h.open('/me');
  assert(h.events.some(x => x[0] === 'scope'), 'same route still exits managed scope');
  h = handler({ platform: 'web', wait: new Promise(resolve => { release = resolve; }) });
  const webFirst = h.open('/messages');
  await h.open('/buklod');
  release(); await webFirst;
  assert.deepEqual(h.events.filter(x => x[0] === 'route'), [['route', '/buklod']], 'web preserves latest request');
  console.log('PASS: native duplicate taps, web latest request, scope ordering, failure, missing Public, same destination');
})().catch(error => { console.error(error); process.exitCode = 1; });
