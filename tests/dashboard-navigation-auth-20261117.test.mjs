import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const shell = read('src/app/(tabs)/_layout.tsx');
const nav = read('src/components/BuklodPersistentBottomNav.tsx');
const tabs = read('src/components/BuklodAndroidDashboardTabs.tsx');
const scope = read('src/providers/BuklodScopeProvider.tsx');
const guard = read('src/components/BuklodCanonicalNavigationGuard.tsx');

test('native persistent dashboards cannot mount before verified session and required policy gates', () => {
  const authenticated = shell.indexOf('if (!session)');
  const maintenance = shell.indexOf('if (config?.maintenance_mode)');
  const policy = shell.indexOf('if (requiresAcceptance)');
  const onboarding = shell.indexOf('if (!profile)');
  const navigator = shell.indexOf('const workspaceStack =');
  assert.ok(authenticated > 0 && maintenance > authenticated &&
    policy > maintenance && onboarding > policy && navigator > onboarding);
  assert.match(shell, /<Redirect href="\/(auth)\/login"/);
  assert.match(shell, /<Redirect href="\/privacy\/consent"/);
  assert.match(shell, /<Redirect href="\/onboarding"/);
  assert.match(tabs, /lazy: true/);
  assert.match(tabs, /tabBar=\{\(\) => null\}/);
});

test('global nav still exits managed Cluster/Organization using authorized Public scope before navigating', () => {
  assert.match(nav, /activeScope\?\.scope_type === 'ORGANIZATION' \|\| activeScope\?\.scope_type === 'CLUSTER'/);
  const selection = nav.indexOf('await selectScope(publicScope.scope_id)');
  const navigation = nav.indexOf('buklodInstantNavigate(lastRequestedRoute.current ?? route)');
  assert.ok(selection > 0 && navigation > selection);
  assert.match(nav, /if \(!publicScope\) throw new Error/);
  assert.match(guard, /scopedWorkspacePathForGlobalRoute/);
  assert.match(guard, /if \(loading \|\|\s*!activeScope/);
  assert.match(scope, /activeScopeRef\.current = target;\s*setActiveScope\(target\)/);
  assert.match(scope, /void setBuklodActiveScope\(/);
});

test('five native bottom destinations remain global and release-only, without auth bypass', () => {
  for (const route of ['/hub', '/clusters', '/buklod', '/messages', '/me']) {
    assert.ok(nav.includes("route: '" + route + "'"), route);
  }
  assert.match(nav, /onPressIn=\{\(\) => \{/);
  assert.match(nav, /onPress=\{\(\) => \{/);
  assert.match(nav, /void openGlobalDestination\(item\.route\)/);
  assert.match(tabs, /<Tabs.Screen name="hub"/);
  assert.match(tabs, /<Tabs.Screen name="buklod"/);
  assert.match(tabs, /<Tabs.Screen name="messages"/);
  assert.match(tabs, /<Tabs.Screen name="me"/);
});
