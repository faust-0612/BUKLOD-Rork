const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const EXPECTED_REPOSITORY = 'faust-0612/BUKLOD-Rork';
const EXPECTED_REF = 'refs/heads/main';

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
  const eventRef = process.env.GITHUB_REF || '';
  const eventSha = process.env.GITHUB_SHA || '';

  if (repository !== EXPECTED_REPOSITORY) {
    throw new Error(
      `BUKLOD production source guard refused repository ${repository || '(unknown)'}; expected ${EXPECTED_REPOSITORY}.`
    );
  }

  if (eventRef !== EXPECTED_REF) {
    throw new Error(
      `BUKLOD production source guard refused ref ${eventRef || '(unknown)'}; production releases must originate from ${EXPECTED_REF}.`
    );
  }

  const headSha = git('rev-parse HEAD');
  if (!eventSha || headSha !== eventSha) {
    throw new Error(
      `BUKLOD production source guard refused source drift: workflow event SHA is ${eventSha || '(unknown)'}, but checkout HEAD is ${headSha}. The release must build the exact triggering main commit.`
    );
  }

  let observedOriginMainSha = null;
  try {
    observedOriginMainSha = git('rev-parse refs/remotes/origin/main');
  } catch {
    observedOriginMainSha = null;
  }

  const dirty = git('status --porcelain');
  const releaseDiff = dirty ? git('diff --binary --no-ext-diff HEAD') : '';
  const identity = {
    app: 'BUKLOD MAIN',
    canonicalRepository: EXPECTED_REPOSITORY,
    canonicalBranch: 'main',
    canonicalEventRef: EXPECTED_REF,
    sourceSha: headSha,
    sourceShortSha: headSha.slice(0, 12),
    sourceTreeSha: git('rev-parse HEAD^{tree}'),
    workflowEventSha: eventSha,
    exactEventCheckoutMatch: true,
    observedOriginMainSha,
    originMainStillAtEventSha: observedOriginMainSha ? observedOriginMainSha === eventSha : null,
    workingTreeModifiedByReleaseSteps: Boolean(dirty),
    workingTreeStatus: dirty ? dirty.split('\n') : [],
    releasePatchDiffSha256: releaseDiff ? sha256(releaseDiff) : null,
    workflow: process.env.GITHUB_WORKFLOW || null,
    runId: process.env.GITHUB_RUN_ID || null,
    runNumber: process.env.GITHUB_RUN_NUMBER || null,
    eventName: process.env.GITHUB_EVENT_NAME || null,
    generatedAtUtc: new Date().toISOString(),
    policy: 'Production source is the exact GitHub main commit that triggered the workflow. ZIPs, extracted copies, compact workspaces, snapshots, backups, and other branches are reference/recovery sources only until deliberately reconciled into main.',
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
  console.log(`Canonical event ref: ${EXPECTED_REF}`);
  console.log(`Source SHA: ${headSha}`);
  console.log(`Workflow event SHA: ${eventSha}`);
  console.log(`Source tree: ${identity.sourceTreeSha}`);
  console.log('Exact event/checkout match: true');
  if (observedOriginMainSha) {
    console.log(`Observed origin/main: ${observedOriginMainSha}`);
    console.log(`origin/main still at event SHA: ${identity.originMainStillAtEventSha}`);
  }
  console.log(`Release-step modifications present: ${identity.workingTreeModifiedByReleaseSteps}`);
  if (identity.workingTreeModifiedByReleaseSteps) {
    console.log(`Release patch diff SHA-256: ${identity.releasePatchDiffSha256}`);
    console.log(`Release-step working tree status:\n${dirty}`);
  }
  console.log(`Workflow run: ${identity.runId || '(unknown)'}`);
}

run();
