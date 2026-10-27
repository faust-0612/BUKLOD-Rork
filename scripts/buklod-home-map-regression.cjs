// Dependency-free smoke test for the Home map's generated iframe document.
// Run: node scripts/buklod-home-map-regression.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');
const ts = read('src/lib/buklodLiveSatelliteMapDocument.ts');

// Only the builder's TS annotations need stripping for this no-dependency test.
const executable = ts
  .replace('const CATEGORY_COLORS: Record<string, string>', 'const CATEGORY_COLORS')
  .replace('function safeJson(value: unknown)', 'function safeJson(value)')
  .replace(
    /export function buildBuklodLiveSatelliteMapDocument\(input: \{[\s\S]*?\n\}\) \{/,
    'function buildBuklodLiveSatelliteMapDocument(input) {',
  )
  .replace(/export const /g, 'const ');
assert(!executable.includes('input: {'), 'map builder TS signature must be stripped');

const builderContext = vm.createContext({});
new vm.Script(executable + '\nthis.build = buildBuklodLiveSatelliteMapDocument;').runInContext(builderContext);
const input = {
  points: [{ latitude: 14.6, longitude: 121.2, title: 'Test map' }],
  center: { latitude: 14.6, longitude: 121.2 },
};
const preview = builderContext.build(input);
const fullNative = builderContext.build({
  ...input, searchInitiallyVisible: true, delegateExternalLinks: true,
});
const fullWeb = builderContext.build({
  ...input, searchInitiallyVisible: true,
});

const inlineScript = doc => {
  const match = doc.match(/<script>([\s\S]*?)<\/script>/);
  assert(match, 'generated map must include an inline script');
  new vm.Script(match[1]); // Catch syntax errors that silently blank the map.
  return match[1];
};
for (const doc of [preview, fullNative, fullWeb]) inlineScript(doc);

// Exercise the user-triggered external-navigation action without Leaflet,
// geolocation or network dependencies. In particular, no GPS is required.
const inline = inlineScript(fullNative);
const actionStart = inline.indexOf('function openGoogleMaps(p){');
const actionEnd = inline.indexOf('function showGoogleMapsSearch', actionStart);
assert(actionStart > 0 && actionEnd > actionStart);
const action = inline.slice(actionStart, actionEnd);
for (const delegate of [true, false]) {
  const sent = [];
  const opened = [];
  const context = vm.createContext({
    delegateGoogleMapsToParent: delegate,
    navigationUrl: p => 'https://www.google.com/maps/dir/?api=1&destination=' + p.latitude,
    isNavigablePoint: p => p.kind !== 'PERSON',
    selectedDestination: { kind: 'SEARCH', latitude: 14.6 },
    window: {
      parent: { postMessage: value => sent.push(value) },
      open: url => opened.push(url),
    },
  });
  new vm.Script(action + '\nwindow.__buklodOpenGoogleMaps();').runInContext(context);
  assert.equal(sent.length, delegate ? 1 : 0);
  assert.equal(opened.length, delegate ? 0 : 1);
  assert((sent[0]?.url || opened[0]).startsWith('https://www.google.com/maps/'));
  new vm.Script('openGoogleMaps({kind:"PERSON",latitude:14.6})').runInContext(context);
  assert.equal(sent.length, delegate ? 1 : 0, 'privacy-protected person must not navigate');
  assert.equal(opened.length, delegate ? 0 : 1, 'privacy-protected person must not navigate');
}

assert.match(preview, /panel\.style\.display='none'/);
assert.match(fullNative, /panel\.style\.display='block'/);
assert.match(fullWeb, /panel\.style\.display='block'/);
assert.match(fullNative, /const delegateGoogleMapsToParent=true;/);
assert.match(fullWeb, /const delegateGoogleMapsToParent=false;/);
assert.match(fullNative, /min-height:56px/);
assert.match(fullNative, /font:700 16px\/22px/);
assert.match(fullNative, /id="buklod-destination-google"/);
assert.match(fullNative, /function showGoogleMapsSearch/);
assert.match(fullNative, /window\.__buklodOpenGoogleMaps/);
assert.match(fullNative, /pendingNavigationDestination=null;\s*routeLayer\.clearLayers\(\)/);
assert.match(fullNative, /if\(requestId===routeRequestSequence\) showRouteFallback/);
assert.match(fullNative, /origin\.longitude\+'\,'\+origin\.latitude\+';'/);

const home = read('src/app/(tabs)/hub.tsx');
assert.match(home, /\{focused \? \(\s*<ToolBoundary[\s\S]*?<Map \/>/);
const native = read('src/components/BuklodLiveSatelliteMap.native.tsx');
const web = read('src/components/BuklodLiveSatelliteMap.web.tsx');
assert.match(native, /searchInitiallyVisible: true/);
assert.match(native, /delegateExternalLinks: true/);
assert.match(web, /searchInitiallyVisible: true/);
assert.match(native, /Linking\.openURL/);
console.log('Home map document and Google Maps regression smoke: PASS');
