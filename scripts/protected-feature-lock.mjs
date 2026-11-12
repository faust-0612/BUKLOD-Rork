#!/usr/bin/env node
// BUKLOD anti-regression governance: additive to the required objective-scope-gate.
// Deliberately checks declared intent; existing regression tests verify behavior.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const LOCKS = [
  { id: 'app-runtime', paths: [/^(?:src\/|assets\/|supabase\/)/], proof: /^(?:tests\/|__tests__\/).+\.test\.(?:mjs|cjs)$|^supabase\/tests\/.+\.sql$/i },
  { id: 'wall-media', paths: [/^src\/components\/(?:Buklod(?:CachedMedia|CommunityWall|CommunityPhoto|Marites|Reels|PostMusic|PostMotion)|CommunityVideo)/i, /^src\/lib\/(?:communityWall|communityVideo|buklodMedia|buklodMarites)/i, /^src\/app\/(?:reels|igpat|post|community)\//], proof: /(?:wall|photo|video|media|marites|reels|igpat)/i },
  { id: 'navigation-auth', paths: [/^src\/app\/(?:_layout|index(?:\.web)?\.tsx|\(auth\)\/|\(tabs\)\/)/, /^src\/providers\/(?:Auth|Notification|RuntimeConfig)Provider/, /^src\/components\/Buklod(?:PersistentBottomNav|CanonicalNavigationGuard|NavSafeShell|MandatoryUpdate)/, /^src\/lib\/buklodNotificationNavigation/], proof: /(?:nav|auth|register|login|privacy|route|notification|session|update|bottom)/i },
  { id: 'connect-ptt-calls', paths: [/^src\/app\/connect\//, /^src\/components\/Buklod(?:Connect|AcceptedCall|Call|.*PTT)/i, /^src\/(?:lib|utils)\/.*(?:connect|chat|ptt|call)/i], proof: /(?:connect|chat|call|ptt|unread|message)/i },
  { id: 'ads-finance-points', paths: [/^src\/providers\/AdsProvider/, /^src\/components\/Buklod.*(?:Ad|Economy|Contribution|Points|Reward)/i, /^src\/lib\/.*(?:admob|adunit|ads|finance|earning|points|qmp|economy)/i, /^src\/app\/(?:points|advertise)\//], proof: /(?:ads?|admob|finance|economy|revenue|qmp|point|earning|reward)/i },
  { id: 'cluster-faith', paths: [/^src\/app\/(?:scope|clusters|bible|word|prayer|devotional)\//, /^src\/components\/Buklod(?:Cluster|ExclusiveScope|Bible|HomeFaith|Faith|Daily|LivingGreetings)/], proof: /(?:cluster|scope|faith|bible|devotion|prayer|daily|greeting)/i },
  { id: 'quiz-classroom', paths: [/^src\/.*(?:classroom|quiz|gradebook|student|attendance|faculty)/i], proof: /(?:classroom|quiz|grade|student|attendance|faculty)/i },
  { id: 'kingdom-character', paths: [/^src\/app\/(?:games|character|kingdom)\//, /^src\/(?:components|lib)\/.*(?:kingdom|character|trudice|wonderpath)/i], proof: /(?:kingdom|character|game|wonder|trudice)/i },
  { id: 'backend-security', paths: [/^supabase\/(?:migrations|functions)\//, /^src\/(?:lib|providers)\/.*(?:supabase|security|permission|auth)/i], proof: /(?:^supabase\/tests\/.*\.sql$|security|rls|database|migration|supabase|auth|permission)/i },
  { id: 'production-release', paths: [/^\.github\/workflows\/.*(?:production|deploy|ota|release)/i, /^scripts\/.*(?:production|deploy|ota|release|cutover)/i, /^(?:app\.config\..+|eas\.json)$/], proof: /(?:release|ota|production|deploy|identity|runtime)/i },
  { id: 'governance-lock', paths: [/^scripts\/protected-feature-lock\.mjs$/, /^tests\/protected-feature-lock\.test\.mjs$/, /^\.github\/workflows\/engineering-accountability\.yml$/, /^\.buklod\/protected-feature-source-snapshot-20261112\.json$/, /^AGENTS\.md$/], proof: /protected-feature-lock/i },
];

const safePath = p => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('..') && !p.includes('\\');
const isTest = p => /^(?:tests\/|__tests__\/).+\.test\.(?:mjs|cjs)$|^supabase\/tests\/.+\.sql$/i.test(p);
const isGoverned = p => /^(?:src\/|assets\/|supabase\/|scripts\/|\.github\/workflows\/|app\.config\.|eas\.json$|package(?:-lock)?\.json$)/.test(p);

export function parseNameStatusZ(output) {
  const fields = output.split('\0');
  const entries = [];
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++];
    if (!/^[ACDMRTU][0-9]*$/.test(status)) throw new Error('Unsupported git change status: ' + status);
    if (/^[RC]/.test(status)) {
      const from = fields[i++], to = fields[i++];
      if (!from || !to) throw new Error('Incomplete rename/copy entry');
      entries.push({ status, path: from }, { status, path: to });
    } else {
      const path = fields[i++];
      if (!path) throw new Error('Incomplete git change entry');
      entries.push({ status, path });
    }
  }
  return entries;
}

export function assessProtectedFeatureLock(entries, manifest) {
  const failures = [];
  const paths = [...new Set(entries.map(e => e.path))];
  if (entries.some(e => !safePath(e.path) || !/^[ACDMRTU][0-9]*$/.test(e.status))) {
    failures.push('Invalid changed path or status.');
  }
  const deletedTests = entries.filter(e => e.status === 'D' && isTest(e.path));
  if (deletedTests.length) failures.push('Protected regression tests cannot be deleted: ' + deletedTests.map(e => e.path).join(', '));
  const impacted = LOCKS.filter(g => paths.some(p => g.paths.some(re => re.test(p))));
  if (!impacted.length && !paths.some(isGoverned)) return { failures, impacted: [] };
  if (!manifest || manifest.contractVersion !== 2 || !Array.isArray(manifest.lockedFeatureChanges)) {
    failures.push('Governed changes require a V2 scope manifest with lockedFeatureChanges.');
    return { failures, impacted: impacted.map(g => g.id) };
  }
  const declared = manifest.lockedFeatureChanges;
  const ids = declared.map(d => d?.id);
  if (new Set(ids).size !== ids.length) failures.push('Duplicate protected-feature declarations.');
  const proofChanged = paths.filter(isTest);
  for (const group of impacted) {
    const d = declared.find(d => d?.id === group.id);
    if (!d) { failures.push('Undeclared protected feature change: ' + group.id); continue; }
    if (typeof d.reason !== 'string' || d.reason.trim().length < 15) failures.push('Missing meaningful change reason: ' + group.id);
    if (!Array.isArray(d.preservedBehaviors) || !d.preservedBehaviors.some(s => typeof s === 'string' && s.trim().length >= 10)) {
      failures.push('Missing preserved functional behavior: ' + group.id);
    }
    if (!Array.isArray(d.tests) || !d.tests.length) { failures.push('Missing changed regression proof: ' + group.id); continue; }
    for (const p of d.tests) {
      if (!safePath(p) || !isTest(p) || !proofChanged.includes(p) || !(manifest.regressionTests ?? []).includes(p)) {
        failures.push('Test not changed and declared in scope: ' + group.id + ' / ' + p);
      }
    }
    if (!d.tests.some(p => typeof p === 'string' && group.proof.test(p))) {
      failures.push('Missing feature-specific regression proof: ' + group.id);
    }
  }
  const validIds = new Set(impacted.map(g => g.id));
  for (const id of ids) if (!validIds.has(id)) failures.push('Unexpected protected-feature declaration: ' + String(id));
  if (paths.some(isGoverned) && !Array.isArray(manifest.allowedPaths)) failures.push('Missing exact path allowlist.');
  else if (paths.some(isGoverned)) {
    const allowed = new Set(manifest.allowedPaths);
    const scopeFile = paths.find(p => /^\.buklod\/scopes\/[^/]+\.json$/.test(p));
    for (const p of paths) if (p !== scopeFile && !allowed.has(p)) failures.push('Changed file outside work scope: ' + p);
  }
  return { failures, impacted: impacted.map(g => g.id) };
}

function main() {
  const base = process.env.BUKLOD_BASE_REF || process.env.GITHUB_BASE_REF || 'main';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(base) || base.includes('..')) throw new Error('Unsafe comparison baseline');
  const raw = execFileSync('git', ['diff', '--name-status', '--find-renames', '-z', base + '...HEAD', '--'], { encoding: 'utf8' });
  const changes = parseNameStatusZ(raw);
  const manifestPath = process.env.BUKLOD_SCOPE_MANIFEST;
  let manifest = null;
  if (manifestPath && /^\.buklod\/scopes\/[^/]+\.json$/.test(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const result = assessProtectedFeatureLock(changes, manifest);
  const workflow = fs.readFileSync('.github/workflows/engineering-accountability.yml', 'utf8');
  if (!workflow.includes('node scripts/protected-feature-lock.mjs') || !workflow.includes('node --test tests/protected-feature-lock.test.mjs')) {
    result.failures.push('Required objective-scope-gate must execute the protected-feature lock and adversarial tests.');
  }
  for (const failure of result.failures) console.error('PROTECTED FEATURE BLOCK:', failure);
  if (result.failures.length) { process.exitCode = 1; return; }
  console.log('PROTECTED FEATURE LOCK PASS', JSON.stringify({ base, impacted: result.impacted, changedPaths: changes.length }));
  console.log('Source-only gate; no claim of runtime or production verification.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  try { main(); } catch (err) { console.error('PROTECTED FEATURE BLOCK:', err.message); process.exitCode = 1; }
}
