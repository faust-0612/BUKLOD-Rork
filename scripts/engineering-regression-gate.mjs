#!/usr/bin/env node
// Dependency-free change-impact gate. Test-file changes are evidence, not proof of live behavior.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const areas = [
  { id: 'wall-media', source: /^(?:src\/components\/(?:BuklodCachedMediaImage|BuklodCommunityPhotoCollage|BuklodMarites|BuklodCommunityPost|BuklodCachedMedia|Buklod.*Video)|src\/lib\/(?:buklodMediaUrl|communityWall|buklodMarites|buklod.*Media))/i, proof: /(?:wall|photo|media|marites|video)/i },
  { id: 'navigation-scroll', source: /^(?:src\/app\/(?:\(tabs\)\/buklod|_layout|index|clusters\/index)|src\/lib\/(?:buklodTouch|buklodNotificationNavigation)|src\/components\/.*(?:Navigation|BottomNav|Scroll))/i, proof: /(?:navigation|scroll|touch|router|bottom-nav|boot)/i },
  { id: 'connect', source: /^(?:src\/components\/.*Connect|src\/lib\/(?:connect|buklodConnect)|src\/app\/connect)/i, proof: /(?:connect|chat|unread|message|call)/i },
  { id: 'faith-cluster', source: /^(?:src\/app\/scope\/|src\/app\/clusters\/|src\/components\/BuklodCluster|src\/lib\/(?:buklodScope|buklodClusters|buklodDailyEngagement))/i, proof: /(?:faith|scope|cluster|formation|daily-reading)/i },
  { id: 'auth-privacy', source: /^(?:src\/providers\/AuthProvider|src\/app\/\(auth\)\/|src\/lib\/(?:buklodAuth|legal|buklodAccess))/i, proof: /(?:auth|login|register|privacy|access|security|recovery)/i },
  { id: 'classroom-quiz', source: /^(?:src\/.*(?:classroom|quiz|faculty|student|(?<!up)grade|attendance))/i, proof: /(?:classroom|quiz|faculty|student|grade|attendance|roster)/i },
  { id: 'story', source: /^(?:src\/.*(?:kabihasnang|Kl[A-Z]|kl-))/, proof: /(?:kl-|kabihasnang|scene|story|media-placement)/i },
  { id: 'ads-monetization', source: /^(?:src\/(?:components\/(?:BuklodAdMobBanner|BuklodCommunityInlineAd|BuklodFirstViewAd|BuklodAdSafetyRouteBridge|BuklodScopedHeaderBanner|BuklodHeaderSponsor|BuklodReelsInlineAd|BuklodVideoCompanionAd|BuklodFocusAppAdStrip|BuklodNativeSponsoredCard|BuklodWebAdSlot)|providers\/AdsProvider|lib\/(?:adMob|buklodAd|buklodAds|buklodGlobalAdController|buklodAdViewport|buklodAdMonetizationPolicy|buklodAdOperationalTelemetry|buklodAdDiagnostics|buklodAdUnits|buklodAdPlacements|buklodAdOpportunities)|hooks\/useBuklodCommunityAdViewability))/i, proof: /(?:ad|ads|admob|monetization|banner|fill|placement|gate|viewport|telemetry)/i },
  { id: 'release-identity', source: /^(?:app\.config\.[cm]?[jt]s|eas\.json|\.github\/workflows\/.*(?:production|deploy|ota)|scripts\/.*(?:production|deploy|release|ota))/i, proof: /(?:release|deploy|ota|production|identity|boundary)/i },
];
// Every functional source, workflow, dependency, asset or script is scope-controlled.
const productPath = p => /^(?:src\/|supabase\/|assets\/|scripts\/|\.github\/workflows\/|package(?:-lock)?\.json$|app\.config\.|eas\.json$)/i.test(p);
const nodeTest = p => /^(?:tests\/|__tests__\/).+\.test\.(?:cjs|mjs)$/i.test(p);
const tsTest = p => /^(?:tests\/|__tests__\/).+\.test\.[jt]sx?$/i.test(p);
const dbTest = p => /^supabase\/tests\/.+\.sql$/i.test(p);
const testPath = p => nodeTest(p) || tsTest(p) || dbTest(p);
const safe = p => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('..') && !p.includes('\\');

export function assessChanges(changedPaths, manifest = null, { consolidatedRc = false, requireScope = false } = {}) {
  const failures = [];
  const paths = [...new Set(changedPaths)];
  if (paths.some(p => !safe(p))) failures.push('Unsafe changed path detected.');
  const modifiedProduct = paths.filter(productPath);
  const modifiedTests = paths.filter(testPath);
  const requiredAreas = areas.filter(a => modifiedProduct.some(p => a.source.test(p)));
  if (modifiedProduct.length && !modifiedTests.length) failures.push('Product/release code changed without an accompanying regression test change.');
  for (const area of requiredAreas) {
    if (!modifiedTests.some(p => area.id === 'release-identity' ? nodeTest(p) && area.proof.test(p) : (nodeTest(p) || tsTest(p)) && area.proof.test(p))) {
      failures.push('Missing focused regression test for ' + area.id + '.');
    }
  }
  if (modifiedProduct.some(p => /^supabase\/(?:migrations\/|functions\/)/.test(p)) && !modifiedTests.some(dbTest)) {
    failures.push('Supabase migration/function change requires a focused supabase/tests/*.sql regression test.');
  }
  if (modifiedProduct.length && modifiedTests.length && !modifiedTests.some(nodeTest) && !modifiedTests.some(dbTest)) {
    failures.push('Source change has only Jest tests; provide a runnable Node or DB contract test in this low-cost gate (Jest may run separately).');
  }
  const scopeChanges = paths.filter(p => /^\.buklod\/scopes\/[^/]+\.json$/.test(p));
  // The CI entrypoint always enables this option: no hidden legacy/no-manifest PR escape.
  // The pure helper defaults off only for old classifier unit-test fixtures.
  if (requireScope && (modifiedProduct.length || modifiedTests.length) && !scopeChanges.length) {
    failures.push('Product, CI, release or test changes require a new .buklod/scopes/*.json change manifest.');
  }
  const cumulativeScope = consolidatedRc && manifest?.releaseMode === 'consolidated-main-rc';
  if (scopeChanges.length) {
    if (scopeChanges.length !== 1 && !cumulativeScope) failures.push('Only one new scope manifest is permitted per isolated PR.');
    if (cumulativeScope) {
      const included = scopeChanges.filter(p => p !== manifest.scopeManifestPath).sort();
      const declared = manifest.componentScopePaths;
      if (!scopeChanges.includes(manifest.scopeManifestPath) || !Array.isArray(declared) ||
          new Set(declared).size !== included.length ||
          declared.length !== included.length || included.some((p, i) => p !== [...declared].sort()[i])) {
        failures.push('Consolidated RC must enumerate every changed component scope manifest exactly.');
      }
    }
    if (!manifest || manifest.contractVersion !== 2) failures.push('A changed scope manifest must use engineering contractVersion 2.');
    else {
      for (const key of ['objective', 'baseRef', 'productionBaselineEvidence', 'chosenApproach', 'selectionRationale']) {
        if (typeof manifest[key] !== 'string' || !manifest[key].trim()) failures.push('Scope manifest requires ' + key + '.');
      }
      for (const key of ['acceptanceChecks', 'preserveBehaviors', 'alternativeApproaches', 'riskAreas', 'regressionTests', 'allowedPaths']) {
        if (!Array.isArray(manifest[key]) || !manifest[key].length) failures.push('Scope manifest requires nonempty ' + key + '.');
      }
      if (Array.isArray(manifest.alternativeApproaches) && manifest.alternativeApproaches.length < 2) failures.push('Compare at least two alternative approaches.');
      if (Array.isArray(manifest.allowedPaths)) {
        const allowed = new Set(manifest.allowedPaths.filter(safe));
        for (const p of paths) {
          if (!cumulativeScope && p === scopeChanges[0]) continue;
          if (!allowed.has(p)) failures.push('Changed path is outside the declared scope allowlist: ' + p);
        }
      }
      if (Array.isArray(manifest.regressionTests)) for (const p of manifest.regressionTests) {
        if (!safe(p) || !testPath(p)) failures.push('Invalid declared regression test: ' + String(p));
        else if (!paths.includes(p)) failures.push('Declared regression test was not changed: ' + p);
      }
      if (Array.isArray(manifest.riskAreas)) for (const area of requiredAreas) {
        if (!manifest.riskAreas.includes(area.id)) failures.push('Scope manifest omits impacted area ' + area.id + '.');
      }
    }
  }
  return { failures, requiredAreas: requiredAreas.map(a => a.id), modifiedProduct, modifiedTests };
}

export function changedPathsSince(baseRef) {
  if (!baseRef || !/^[\w./-]+$/.test(baseRef) || baseRef.startsWith('-')) throw new Error('Explicit safe baseline reference required.');
  const raw = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRD', baseRef + '...HEAD', '--'], { encoding: 'utf8' });
  return raw.trim().split('\n').filter(Boolean);
}

function runCli() {
  const base = process.env.BUKLOD_BASE_REF || process.env.GITHUB_BASE_REF || 'main';
  let paths;
  try { paths = changedPathsSince(base); } catch (err) { console.error('REGRESSION BLOCK: cannot compare verified baseline:', err.message); process.exitCode = 1; return; }
  let manifest = null;
  const changedScope = paths.filter(p => /^\.buklod\/scopes\/[^/]+\.json$/.test(p));
  // Production main remains protected. This opt-in is only for the named
  // cumulative RC pull request; all ordinary PRs keep one-scope isolation.
  const cumulativeRc =
    process.env.BUKLOD_CONSOLIDATED_RC_GATE === 'true' &&
    base === 'main' &&
    ['integration/buklod-nov10-single-source-ota', 'integration/buklod-nov11-postprod-conso-ota'].includes(process.env.GITHUB_HEAD_REF);
  const manifestPath = process.env.BUKLOD_SCOPE_MANIFEST;
  if (changedScope.length === 1 || (cumulativeRc && changedScope.includes(manifestPath))) {
    const selected = changedScope.length === 1 ? changedScope[0] : manifestPath;
    try { manifest = JSON.parse(fs.readFileSync(selected, 'utf8')); }
    catch { console.error('REGRESSION BLOCK: invalid selected scope JSON'); process.exitCode = 1; return; }
  }
  if (cumulativeRc && changedScope.length > 1) {
    if (manifest?.releaseMode !== 'consolidated-main-rc' || manifest?.scopeManifestPath !== manifestPath) {
      console.error('REGRESSION BLOCK: invalid consolidated release manifest selection'); process.exitCode = 1; return;
    }
    for (const scopedPath of changedScope.filter(p => p !== manifestPath)) {
      let component;
      try { component = JSON.parse(fs.readFileSync(scopedPath, 'utf8')); }
      catch { console.error('REGRESSION BLOCK: invalid component manifest ' + scopedPath); process.exitCode = 1; return; }
      if (component.contractVersion !== 2) {
        console.error('REGRESSION BLOCK: component scope must be v2: ' + scopedPath); process.exitCode = 1; return;
      }
    }
  }
  const result = assessChanges(paths, manifest, { consolidatedRc: cumulativeRc, requireScope: true });
  for (const failure of result.failures) console.error('REGRESSION BLOCK:', failure);
  if (result.failures.length) { process.exitCode = 1; return; }
  if (process.argv.includes('--run-focused-node-tests')) {
    const runnable = result.modifiedTests.filter(nodeTest);
    if (runnable.length) {
      const run = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...runnable], { stdio: 'inherit' });
      if (run.status !== 0) { console.error('REGRESSION BLOCK: focused Node tests failed'); process.exitCode = 1; return; }
    }
  }
  console.log('ENGINEERING REGRESSION PASS:', JSON.stringify({ base, riskAreas: result.requiredAreas, regressionTests: result.modifiedTests }));
  console.log('NOTE: device, DB runtime, Expo and production behavior still need independent verification.');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
