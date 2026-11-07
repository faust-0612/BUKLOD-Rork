import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const scope = read('src/app/scope/index.tsx');
const shell = read('src/components/BuklodPublicDesktopDashboard.tsx');
const guard = read('src/components/BuklodCanonicalNavigationGuard.web.tsx');

test('Cluster/Organization Connect restores the original single full-height center room', () => {
  const component = scope.slice(scope.indexOf('function OrganizationCommunityConnect('),
    scope.indexOf('function ScopeConnect('));
  assert.match(component, /styles\.scopeConnectHost/);
  assert.match(scope, /scopeConnectHost: \{[\s\S]*?flex: 1,[\s\S]*?minHeight: 0/);
  assert.doesNotMatch(component, /compactDesktop|setExpanded|Expand|Collapse/);
  assert.doesNotMatch(scope, /scopeConnectCompact|scopeConnectExpanded|height: 340/);
  assert.doesNotMatch(component, /router\.push\(/);
});

test('restored Cluster/Org Connect uses the same authorized scope conversation', () => {
  const component = scope.slice(scope.indexOf('function OrganizationCommunityConnect('),
    scope.indexOf('function ScopeConnect('));
  assert.equal((component.match(/<BuklodConnectThread/g) ?? []).length, 1);
  assert.match(component, /mode="scope"/);
  assert.match(component, /containerId=\{scope\.scope_id\}/);
  assert.match(component, /onBackOverride=\{onBack\}/);
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

test('scope authority and desktop composer spacing preserve mobile behavior', () => {
  const engine = read('src/components/BuklodConnectThread.tsx');
  assert.match(guard, /scopedWorkspacePathForGlobalRoute\(/);
  assert.match(guard, /isManagedCommunityScope\(activeScope\)/);
  assert.match(shell, /Public workspace is not ready\. Retry the navigation\./);
  assert.match(shell, /Unable to leave Cluster\. Retry the navigation\./);
  assert.match(shell, /setDockRequest\(null\)/);
  assert.match(engine, /Platform\.OS === 'web'[\s\S]*?viewportWidth >= 1200[\s\S]*?mode === 'scope'/);
  assert.match(engine, /isBuklodScopedWorkspacePath\(pathname\)/);
  assert.match(engine, /\? 8[\s\S]*?: Math\.max\(insets\.bottom, 8\) \+ 12/);
  assert.match(engine, /connectComposerDockBottom\([\s\S]*?keyboardVisible/);
});
