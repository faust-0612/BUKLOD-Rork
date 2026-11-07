import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const scope = read('src/app/scope/index.tsx');
const shell = read('src/components/BuklodPublicDesktopDashboard.tsx');
const guard = read('src/components/BuklodCanonicalNavigationGuard.web.tsx');

test('Cluster/Organization Connect opens as compact 340px desktop panel, expandable in-place', () => {
  assert.match(scope, /function OrganizationCommunityConnect\(/);
  assert.match(scope, /compactDesktop = Platform\.OS === 'web' && width >= 1200/);
  assert.match(scope, /const \[expanded, setExpanded\] = useState\(false\)/);
  assert.match(scope, /setExpanded\(false\), \[scope\.scope_id\]/);
  assert.match(scope, /height: 340, maxWidth: 740/);
  assert.match(scope, /compactDesktop && !expanded && styles\.scopeConnectCompact/);
  assert.match(scope, /compactDesktop && expanded && styles\.scopeConnectExpanded/);
  assert.match(scope, /onPress=\{\(\) => setExpanded\(current => !current\)\}/);
  assert.match(scope, /Collapse cluster conversation/);
  assert.match(scope, /Expand cluster conversation/);
  assert.match(scope, /Expanded within this dashboard/);
  const component = scope.slice(scope.indexOf('function OrganizationCommunityConnect('),
    scope.indexOf('function ScopeConnect('));
  assert.doesNotMatch(component, /router\.push\(/);
});

test('compact and expanded Cluster Connect reuse one authorized scope chat, not duplicate messaging', () => {
  const component = scope.slice(scope.indexOf('function OrganizationCommunityConnect('),
    scope.indexOf('function ScopeConnect('));
  assert.equal((component.match(/<BuklodConnectThread/g) ?? []).length, 1);
  assert.match(component, /mode="scope"/);
  assert.match(component, /containerId=\{scope\.scope_id\}/);
  assert.match(component, /onBackOverride=\{compactDesktop && expanded/);
  assert.match(component, /scope\.scope_type !== 'ORGANIZATION'/);
  assert.match(component, /scope\.scope_type !== 'CLUSTER'/);
  assert.match(scope, /resolution\.access !== 'authorized'/);
  assert.match(scope, /useResolvedScope\(\{/);
  assert.match(scope, /requireMembership: true/);
});

test('global desktop sidebar waits for Public scope before leaving a managed Cluster', () => {
  assert.match(shell, /const \[pendingSidebarNavigation, setPendingSidebarNavigation\] = useState/);
  assert.match(shell, /const sidebarNavigationSequence = useRef\(0\)/);
  assert.match(shell, /const inManagedScope = activeScope\?\.scope_type === 'CLUSTER'/);
  assert.match(shell, /const publicScope = scopes\.find\(scope => scope\.scope_type === 'PUBLIC'\)/);
  assert.match(shell, /setPendingSidebarNavigation\(\{ path, params, ownerId: userId, sequence \}\)/);
  assert.match(shell, /await selectScope\(publicScope\.scope_id\)/);
  assert.match(shell, /if \(activeScope\?\.scope_type !== 'PUBLIC'\) return;/);
  assert.match(shell, /if \(pendingSidebarNavigation\.ownerId !== userId\)/);
  assert.match(shell, /pendingSidebarNavigation\.sequence !== sidebarNavigationSequence\.current/);
  assert.match(shell, /commitSidebarNavigation\(target\.path, target\.params\)/);
  assert.match(shell, /if \(leavingScopedPage\) router\.replace\(href\)/);
  assert.match(shell, /leavingScopedPage \|\|[\s\S]*?path === '\/hub'/);
  assert.match(shell, /onPress=\{\(\) => void navigate\(item\.path\)\}/);
  assert.match(shell, /leftRail: \{[\s\S]*?position: 'relative', zIndex: 1/);
});

test('no scope authorization bypass, no mobile UI regression, and click failures surface', () => {
  assert.match(guard, /scopedWorkspacePathForGlobalRoute\(/);
  assert.match(guard, /isManagedCommunityScope\(activeScope\)/);
  assert.match(shell, /Public workspace is not ready\. Retry the navigation\./);
  assert.match(shell, /Unable to leave Cluster\. Retry the navigation\./);
  assert.match(shell, /setDockRequest\(null\)/);
  const component=scope.slice(scope.indexOf('function OrganizationCommunityConnect('),
    scope.indexOf('function ScopeConnect('));
  assert.match(component, /compactDesktop && !expanded/);
  assert.match(component, /compactDesktop && expanded/);
  assert.match(scope, /scopeConnectThread: \{ flex: 1/);
  assert.doesNotMatch(component, /router\.replace/);
});
