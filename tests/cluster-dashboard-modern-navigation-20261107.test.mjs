import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = readFileSync('src/app/clusters/index.tsx','utf8');
const nav = readFileSync('src/components/BuklodPersistentBottomNav.tsx','utf8');
const clusterAPI = readFileSync('src/lib/buklodClusters.ts','utf8');

test('Cluster dashboard preserves the canonical global navigation and creates workspaces correctly', () => {
  assert.match(nav, /route: '\/clusters'/);
  assert.match(src, /export default function ClustersScreen\(\)/);
  assert.match(src, /enterScopedWorkspace\(selectScope, id, \{ section: 'home', navigation: 'replace' \}\)/);
  assert.match(src, /clusterScopeManageRoute\(item\.scope_id, item\.name\)/);
  assert.match(src, /router\.push\('\/clusters\/create' as any\)/);
  assert.match(src, /router\.replace\('\/\(tabs\)\/buklod' as any\)/);
  assert.match(src, /<BuklodFirstViewAd placement="cluster" placementId="cluster_directory_first_view"/);
});

test('Quick dashboard navigation shows My, Explore, Invites and Requests without losing counts', () => {
  assert.match(src, /type ClusterDirectorySection = 'mine' \| 'discover' \| 'invitations' \| 'pending'/);
  for (const tab of ["key: 'mine'", "key: 'discover'", "key: 'invitations'", "key: 'pending'"]) {
    assert.ok(src.includes(tab), 'Missing dashboard tab ' + tab);
  }
  assert.match(src, /<DashboardMetric count=\{activeClusters\.length\}/);
  assert.match(src, /<DashboardMetric count=\{invitations\.length\}/);
  assert.match(src, /<DashboardMetric count=\{pending\.length\}/);
  assert.match(src, /accessibilityRole="tab"/);
  assert.match(src, /accessibilityState=\{\{ selected \}\}/);
  assert.match(src, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\}/);
  assert.match(src, /onPress=\{\(\) => setSection\(tab\.key\)\}/);
});

test('Compact cards have isolated Open and Manage actions so a management tap cannot open another screen', () => {
  const card = src.slice(src.indexOf('function ClusterCard('),src.indexOf('function DashboardMetric('));
  assert.match(card, /return \(\s*<View style=\{styles\.card\}>/);
  assert.match(card, /<Pressable[\s\S]*?disabled=\{!canOpen\}/);
  assert.match(card, /onPress=\{\(\) => onOpen\?\.\(item\.scope_id\)\}/);
  assert.match(card, /\{children \? <View style=\{styles\.actions\}>\{children\}<\/View> : null\}/);
  assert.match(src, /<ActionButton title="Open"/);
  assert.match(src, /<ActionButton title="Manage" outline/);
  assert.match(src, /<StatusBadge text=\{item\.visibility\.replace\('_', ' '\)\} \/>/);
  assert.match(src, /numberOfLines=\{2\} style=\{styles\.cardTitle\}/);
  assert.match(src, /description\}\<\/Text\>/);
});

test('My Clusters search runs locally and shows first eight until user expands', () => {
  assert.match(src, /const \[myQuery, setMyQuery\] = useState\(''\)/);
  assert.match(src, /const \[showAllMyClusters, setShowAllMyClusters\] = useState\(false\)/);
  assert.match(src, /filteredMyClusters = useMemo\(\(\) =>/);
  assert.match(src, /item\.name \+ ' ' \+ \(item\.category \|\| ''\)/);
  assert.match(src, /filteredMyClusters\.slice\(0, showAllMyClusters \|\| myQuery\.trim\(\) \? 100 : 8\)/);
  assert.match(src, /accessibilityLabel="Search my clusters"/);
  assert.match(src, /View all ' \+ filteredMyClusters\.length/);
});

test('Discovery does not list existing members and keeps server-backed join/requests', () => {
  assert.match(src, /discover\.filter\(item =>[\s\S]*?!\['ACTIVE','PENDING','INVITED'\]\.includes/);
  assert.match(src, /getMyClusters\(\)/);
  assert.match(src, /discoverClusters\(searchValue\)/);
  assert.match(src, /await joinCluster\(item\.scope_id\)/);
  assert.match(src, /if \(status === 'PENDING'\)/);
  assert.match(src, /if \(status === 'ACTIVE'\)/);
  assert.match(src, /item\.visibility === 'PRIVATE' \? 'Request to join' : 'Join cluster'/);
  assert.match(src, /onSubmitEditing=\{\(\) => void load\(query, true\)\}/);
  assert.match(clusterAPI, /export async function joinCluster\(/);
  assert.match(src, /disabled=\{!online \|\| busyId === item\.scope_id\}/);
});

test('Invitation handling and pending state preserve permissions and mutation feedback', () => {
  assert.match(src, /respondClusterInvite\(/);
  assert.match(src, /await respondClusterInvite\(/);
  assert.match(src, /title="Accept" disabled=\{busyId === item\.scope_id\}/);
  assert.match(src, /title="Decline" outline disabled=\{busyId === item\.scope_id\}/);
  assert.match(src, /section === 'pending'/);
  assert.match(src, /Waiting for an admin to approve membership/);
  assert.match(src, /clusterMemory\.at = 0/);
});

test('Weak network reuses owner-scoped membership cache and does not leak across accounts', () => {
  assert.match(src, /if \(clusterMemory\.owner !== owner\)/);
  assert.match(src, /key=\{owner \|\| 'signed-out'\}/);
  assert.match(src, /CLUSTER_CACHE_TTL_MS = 60_000/);
  assert.match(src, /const usingSavedClusters = !online \|\| Boolean\(loadError\) \|\| loading/);
  assert.match(src, /savedScopeClusters/);
  assert.match(src, /Promise\.allSettled\(/);
  assert.match(src, /if \(!online\) \{/);
  assert.match(src, /Offline · saved memberships are available/);
  assert.match(src, /<RefreshControl/);
});

test('Compact touch targets, header and controls do not replace the global bottom nav', () => {
  assert.match(src, /paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32/);
  assert.match(src, /minHeight: 44/);
  assert.match(src, /minHeight: 42/);
  assert.match(src, /borderRadius: 16/);
  assert.match(src, /backgroundColor: '#FFFFFF'/);
  assert.doesNotMatch(src, /<BuklodPersistentBottomNav/);
  assert.match(nav, /label: 'Cluster'/);
});
