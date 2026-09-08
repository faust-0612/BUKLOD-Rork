const fs = require('fs');
const path = require('path');
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

  const dirty = git('status --porcelain');
  const identity = {
    app: 'BUKLOD MAIN',
    canonicalRepository: EXPECTED_REPOSITORY,
    canonicalBranch: 'main',
    sourceSha: headSha,
    sourceShortSha: headSha.slice(0, 12),
    sourceTreeSha: git('rev-parse HEAD^{tree}'),
    workingTreeModifiedByReleaseSteps: Boolean(dirty),
    workingTreeStatus: dirty ? dirty.split('\n') : [],
    workflow: process.env.GITHUB_WORKFLOW || null,
    runId: process.env.GITHUB_RUN_ID || null,
    runNumber: process.env.GITHUB_RUN_NUMBER || null,
    eventName: process.env.GITHUB_EVENT_NAME || null,
    eventRef: process.env.GITHUB_REF || null,
    eventSha: process.env.GITHUB_SHA || null,
    generatedAtUtc: new Date().toISOString(),
    policy: 'Production source is canonical GitHub main. ZIPs, extracted copies, compact workspaces, snapshots, and backups are reference/recovery sources only until reconciled into main.',
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
  console.log(`Source tree: ${identity.sourceTreeSha}`);
  console.log(`Release-step modifications present: ${identity.workingTreeModifiedByReleaseSteps}`);
  if (identity.workingTreeModifiedByReleaseSteps) {
    console.log(`Release-step working tree status:\n${dirty}`);
  }
  console.log(`Workflow run: ${identity.runId || '(unknown)'}`);
}

run();
