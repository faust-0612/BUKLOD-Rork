#!/usr/bin/env node
/** BUKLOD Navigation V2: nonpublishing fail-closed staging readiness gate. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const REQUIRED_NAV_V2_IDS = Object.freeze([
  'staging-parity','feature-inventory','technical-guard','profile-settings','home-finder',
  'compact-home','compact-profile','naming','contextual-menus','gesture-shortcuts','motion',
  'responsive-font','ime-media','back-state','action-feedback','offline-recovery',
  'favorites','first-use-help','scope-accessibility','regression-suite','verified-staging-release',
]);

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
const proofUrl = value => typeof value === 'string' && /^https:\/\//i.test(value);
const fresh = (value, now) => {
  const date = new Date(value).getTime();
  return Number.isFinite(date) && date <= now + 300000 && now - date <= 6 * 60 * 60 * 1000;
};

/**
 * A checklist item cannot count as complete just because its source exists.
 * Each acceptance item must have a real evidence reference and VERIFIED state.
 */
export function inspectNavV2Checklist(data) {
  const failures = [];
  const requirements = Array.isArray(data?.requirements) ? data.requirements : [];
  if (data?.schema !== 'buklod-navigation-v2-completion-v1')
    failures.push('Unsupported or missing navigation-v2 checklist schema');
  if (!sha(data?.sourceBaseSha)) failures.push('Missing pinned source baseline SHA');
  const ids = requirements.map(item => item?.id);
  if (new Set(ids).size !== ids.length) failures.push('Duplicate requirement IDs');
  for (const id of REQUIRED_NAV_V2_IDS) {
    if (!ids.includes(id)) failures.push('Missing mandatory requirement: ' + id);
  }
  for (const item of requirements) {
    if (!REQUIRED_NAV_V2_IDS.includes(item?.id)) failures.push('Unknown requirement: ' + item?.id);
    if (!['pending','in_progress','implemented','verified'].includes(item?.status))
      failures.push('Invalid status for ' + item?.id);
    if (item?.blockRelease !== true) failures.push('Release block disabled for ' + item?.id);
    if (item?.status === 'verified' &&
        (!Array.isArray(item.evidence) || !item.evidence.some(proofUrl))) {
      failures.push('VERIFIED item lacks real evidence URL: ' + item.id);
    }
  }
  const completed = requirements.filter(x => x.status === 'verified').length;
  const started = requirements.filter(x => x.status !== 'pending').length;
  const unfinished = requirements.filter(x => x.status !== 'verified').map(x => x.id);
  return {
    failures, unfinished, completed, started, total: REQUIRED_NAV_V2_IDS.length,
    implementedCoveragePercent: Math.round(started * 100 / REQUIRED_NAV_V2_IDS.length),
    verifiedPercent: Math.round(completed * 100 / REQUIRED_NAV_V2_IDS.length),
    ready: failures.length === 0 && requirements.length === REQUIRED_NAV_V2_IDS.length && unfinished.length === 0,
  };
}

/** Evidence is about actual deployed identities, not simply source or workflow labels. */
export function inspectNavV2StagingRelease(checklist, evidence, expectedRcSha, now = Date.now()) {
  const check = inspectNavV2Checklist(checklist);
  const failures = [...check.failures];
  if (check.unfinished.length) failures.push('Unverified requirements: ' + check.unfinished.join(', '));
  if (!sha(expectedRcSha)) failures.push('An exact frozen RC SHA is required');
  const live = evidence?.live ?? {};
  const stage = evidence?.staging ?? {};
  if (!sha(live.sourceSha) || !sha(stage.mirroredLiveSourceSha) ||
      live.sourceSha !== stage.mirroredLiveSourceSha)
    failures.push('No verified source parity between live and staging baseline');
  if (!sha(stage.rcSourceSha) || stage.rcSourceSha !== expectedRcSha)
    failures.push('Staging build source differs from exact frozen RC SHA');
  if (!live.updateId || !proofUrl(live.artifactEvidenceUrl) || !fresh(live.verifiedAt, now))
    failures.push('Missing recent independent live OTA/update verification');
  if (live.package !== 'org.mzbministry.buklod' ||
      live.channel !== 'production' || live.runtimeVersion !== '1.3.2')
    failures.push('Live production package/channel/runtime identity mismatch');
  if (stage.package !== 'org.mzbministry.buklod.staging' ||
      stage.channel !== 'staging-user' || stage.runtimeVersion !== '1.3.2' ||
      stage.environment !== 'preview')
    failures.push('Staging-user package/channel/runtime/environment mismatch');
  if (!stage.buildId || !stage.installedBuildId ||
      stage.buildId !== stage.installedBuildId ||
      !stage.otaUpdateId || !proofUrl(stage.artifactEvidenceUrl) ||
      !fresh(stage.verifiedAt, now))
    failures.push('Missing recent exact installed staging APK/OTA verification');
  if (stage.backendContractReviewed !== true ||
      !proofUrl(stage.backendEvidenceUrl))
    failures.push('Staging backend behavior/feature-flag parity not reviewed');
  if (stage.securityAndRegressionQA !== 'passed' ||
      !proofUrl(stage.qaEvidenceUrl))
    failures.push('No passing exact-source staging security/regression QA evidence');
  if (stage.deviceAcceptance !== 'passed' ||
      !proofUrl(stage.deviceEvidenceUrl))
    failures.push('Missing staging-user device acceptance evidence');
  return { ready: check.ready && failures.length === 0, failures, checklist: check };
}

function main() {
  const args = process.argv.slice(2);
  const release = args.includes('--release');
  const checklistPath = args.find(x => x.startsWith('--checklist='))?.slice(12) ??
    'docs/navigation-v2-completion.json';
  const checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
  const expectedRcSha = args.find(x => x.startsWith('--commit='))?.slice(9) ?? '';
  const evidencePath = args.find(x => x.startsWith('--evidence='))?.slice(11);
  let result;
  if (release) {
    let evidence = null;
    if (evidencePath) evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    result = inspectNavV2StagingRelease(checklist, evidence, expectedRcSha);
  } else {
    const check = inspectNavV2Checklist(checklist);
    result = { ...check, failures: check.failures, ready: false };
  }
  console.log(JSON.stringify({
    mode: release ? 'staging-release' : 'implementation-inventory',
    published: false, ...result,
    warning: 'Source/CI attestation cannot substitute for real installed-client verification.',
  }, null, 2));
  if (release && !result.ready) process.exitCode = 1;
  else if (result.failures.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
