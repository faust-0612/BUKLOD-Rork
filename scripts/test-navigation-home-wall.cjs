const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nav = fs.readFileSync('src/components/BuklodPersistentBottomNav.tsx', 'utf8');
const home = fs.readFileSync('src/app/(tabs)/hub.tsx', 'utf8');
const root = fs.readFileSync('src/app/_layout.tsx', 'utf8');
const profile = fs.readFileSync('src/app/(tabs)/me.tsx', 'utf8');
const entry = fs.readFileSync('src/app/index.tsx', 'utf8');
const layout = fs.readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
const start = nav.indexOf('  const openGlobalDestination =');
const end = nav.indexOf('\n\n  if (', start);
assert(start >= 0 && end > start, 'navigation handler must be inspectable');
const source = nav.slice(start, end).replace("(route: NavItem['route'])", '(route)');
function handler({ type = 'CLUSTER', publicAvailable = true, fail = false, wait } = {}) {
  const events = [];
  const context = {
    navigationInFlight: { current: false },
    activeScope: { scope_type: type },
    scopes: publicAvailable ? [{ scope_type: 'PUBLIC', scope_id: 'public' }] : [],
    normalizedPath: '/me',
    isOnGlobalNavDestination: (path, route) => path === route,
    setPendingRoute: route => events.push(['pending', route]),
    selectScope: async id => { events.push(['scope', id]); if (wait) await wait; if (fail) throw new Error('failed'); },
    buklodInstantReplace: route => events.push(['route', route]),
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
  const first = h.open('/messages'); await h.open('/buklod'); release(); await first;
  assert.equal(h.events.filter(x => x[0] === 'route').length, 1, 'duplicate taps are suppressed');
  h = handler({ type: 'PUBLIC' }); await h.open('/me');
  assert.equal(h.events.length, 0, 'same global destination is a no-op');
  h = handler(); await h.open('/me');
  assert(h.events.some(x => x[0] === 'scope'), 'same route still exits managed scope');
  assert.deepEqual([...nav.matchAll(/label: '(Home|Cluster|Wall|Connect|Profile)'/g)].map(x => x[1]), ['Home','Cluster','Wall','Connect','Profile']);
  assert(home.includes("route: '/personal-home/ptt'"));
  assert(home.includes('focused && foreground && tool'), 'tools must unmount offscreen and in background');
  assert(home.includes("const Today = lazy(") && home.includes("const Help = lazy(") && home.includes("const Map = lazy("));
  assert(!home.includes('not available'));
  assert(!root.includes('BuklodGuideAvatarDeferred'));
  assert(root.includes('BuklodCharacterEventProvider') && root.includes('RorkAvatarOnboardingGate'));
  assert(profile.includes('<BuklodProfileCharacterCard'));
  assert(entry.includes('href="/(tabs)/buklod"') && layout.includes("initialRouteName: 'buklod'"));
  console.log('PASS navigation: scope ordering, scope failure, missing Public, duplicate taps, same route, tab order, lazy Home, Character preservation, Wall landing');
})().catch(error => { console.error(error); process.exitCode = 1; });
