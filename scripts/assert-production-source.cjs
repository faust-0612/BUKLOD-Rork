const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const EXPECTED_REPOSITORY = 'faust-0612/BUKLOD-Rork';

function git(command) {
  return execSync(`git ${command}`, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function run() {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    console.log('BUKLOD_PRODUCTION_SOURCE_GUARD: local/non-CI run; production guard not enforced.');
    return;
  }

  const repository = process.env.GITHUB_REPOSITORY || '';
  if (repository !== EXPECTED_REPOSITORY) {
    throw new Error(
      `BUKLOD production source guard refused repository ${repository || '(unknown)'}; expected ${EXPECTED_REPOSITORY}.`
    );
  }

  const headSha = git('rev-parse HEAD');
  const eventSha = process.env.GITHUB_SHA || '';
  let mainSha = '';
  try {
    mainSha = git('rev-parse refs/remotes/origin/main');
  } catch {
    mainSha = git('rev-parse main');
  }

  if (headSha !== mainSha) {
    throw new Error(
      `BUKLOD production source guard refused checkout ${headSha}; origin/main is ${mainSha}. Production must build from canonical GitHub main.`
    );
  }

  if (eventSha && headSha !== eventSha) {
    throw new Error(
      `BUKLOD production source guard refused source drift: workflow event SHA is ${eventSha}, but checkout HEAD is ${headSha}. Re-run from the intended canonical main commit instead of silently deploying a newer or older checkout.`
    );
  }

  const dirty = git('status --porcelain');
  const releaseDiff = dirty ? git('diff --binary --no-ext-diff HEAD') : '';
  const identity = {
    app: 'BUKLOD MAIN',
    canonicalRepository: EXPECTED_REPOSITORY,
    canonicalBranch: 'main',
    sourceSha: headSha,
    sourceShortSha: headSha.slice(0, 12),
    sourceTreeSha: git('rev-parse HEAD^{tree}'),
    workflowEventSha: eventSha || null,
    exactEventCheckoutMatch: !eventSha || eventSha === headSha,
    workingTreeModifiedByReleaseSteps: Boolean(dirty),
    workingTreeStatus: dirty ? dirty.split('\n') : [],
    releasePatchDiffSha256: releaseDiff ? sha256(releaseDiff) : null,
    workflow: process.env.GITHUB_WORKFLOW || null,
    runId: process.env.GITHUB_RUN_ID || null,
    runNumber: process.env.GITHUB_RUN_NUMBER || null,
    eventName: process.env.GITHUB_EVENT_NAME || null,
    eventRef: process.env.GITHUB_REF || null,
    generatedAtUtc: new Date().toISOString(),
    policy: 'Production source is canonical GitHub main at the exact workflow event SHA. ZIPs, extracted copies, compact workspaces, snapshots, and backups are reference/recovery sources only until reconciled into main.',
  };

  const publicDir = path.join(process.cwd(), 'public');
  ensureDir(publicDir);
  fs.writeFileSync(
    path.join(publicDir, 'build-identity.json'),
    `${JSON.stringify(identity, null, 2)}\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(process.cwd(), '.buklod-build-identity.json'),
    `${JSON.stringify(identity, null, 2)}\n`,
    'utf8'
  );

  console.log('BUKLOD_PRODUCTION_SOURCE_GUARD: PASS');
  console.log(`Canonical repository: ${EXPECTED_REPOSITORY}`);
  console.log('Canonical branch: main');
  console.log(`Source SHA: ${headSha}`);
  console.log(`Workflow event SHA: ${eventSha || '(unknown)'}`);
  console.log(`Source tree: ${identity.sourceTreeSha}`);
  console.log(`Exact event/checkout match: ${identity.exactEventCheckoutMatch}`);
  console.log(`Release-step modifications present: ${identity.workingTreeModifiedByReleaseSteps}`);
  if (identity.workingTreeModifiedByReleaseSteps) {
    console.log(`Release patch diff SHA-256: ${identity.releasePatchDiffSha256}`);
    console.log(`Release-step working tree status:\n${dirty}`);
  }
  console.log(`Workflow run: ${identity.runId || '(unknown)'}`);
}

run();
