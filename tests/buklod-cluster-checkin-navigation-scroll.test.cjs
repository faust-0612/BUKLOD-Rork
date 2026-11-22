const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = filename => fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
const routes = read('src/app/_layout.tsx');
const manage = read('src/app/clusters/scope-manage.tsx');
const review = read('src/app/clusters/home-checkin-review.tsx');
const canonical = read('src/lib/buklodScopeRoute.ts');
const cluster = read('src/lib/buklodCluster.ts');

test('Cluster verification screen is stack-registered and reachable through exact-scope management', () => {
  assert.match(routes, /name="clusters\/home-checkin-review"/);
  assert.match(manage, /open\('\/clusters\/home-checkin-review'\)/);
  assert.match(cluster, /clusterScopeParams/);
  assert.match(review, /readClusterScopeId/);
  assert.match(canonical, /normalized\.startsWith\('\/clusters'\)/);
});

test('Cluster verification keeps scroll and route-safe refresh, without modifying public Wall navigation', () => {
  assert.match(review, /useFocusEffect/);
  assert.match(review, /ScrollView/);
  assert.match(review, /RefreshControl/);
  assert.match(review, /keyboardShouldPersistTaps="handled"/);
  assert.match(review, /scopeId/);
  assert.doesNotMatch(review, /router\.replace\('\/buklod'\)/);
});
