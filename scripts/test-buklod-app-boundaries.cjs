'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const sourceRoot = path.resolve(__dirname, '..');
const verifier = path.join(sourceRoot, 'scripts', 'verify-buklod-app-boundaries.cjs');
const basePolicy = JSON.parse(fs.readFileSync(path.join(sourceRoot, '.buklod', 'app-boundaries.json'), 'utf8'));

function fixture(workflowName, workflowText, mutatePolicy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buklod-boundary-'));
  fs.mkdirSync(path.join(dir, '.buklod'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  const policy = JSON.parse(JSON.stringify(basePolicy));
  if (mutatePolicy) mutatePolicy(policy);
  fs.writeFileSync(path.join(dir, '.buklod', 'app-boundaries.json'), JSON.stringify(policy, null, 2));
  fs.writeFileSync(path.join(dir, '.github', 'workflows', workflowName), workflowText);
  return dir;
}

function runCase(name, dir, shouldPass) {
  const result = spawnSync(process.execPath, [verifier], {
    cwd: dir,
    env: { ...process.env, GITHUB_REPOSITORY: 'faust-0612/BUKLOD-Rork' },
    encoding: 'utf8'
  });
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    console.error(`FAILED CASE: ${name}`);
    console.error(result.stdout || '');
    console.error(result.stderr || '');
    process.exit(1);
  }
  console.log(`${shouldPass ? 'ALLOW' : 'BLOCK'} OK: ${name}`);
}

runCase(
  'Main-side Report QA/export is allowed',
  fixture('buklod_report_pr_qa.yml', `name: BUKLOD Main - Report Door QA\njobs:\n  qa:\n    steps:\n      - run: npx expo export --platform web\n`),
  true
);

runCase(
  'Report cannot deploy through BUKLOD Main',
  fixture('buklod_report_web_deploy.yml', `name: BUKLOD Report Web Deploy\njobs:\n  release:\n    steps:\n      - run: npx eas-cli@latest deploy --prod --non-interactive\n      - run: echo 'Production URL https://buklod.expo.app'\n`),
  false
);

runCase(
  'Classroom cannot OTA/update through BUKLOD Main',
  fixture('buklod_classroom_production.yml', `name: BUKLOD Classroom Production\njobs:\n  release:\n    steps:\n      - run: npx eas-cli@latest update --channel production --non-interactive\n`),
  false
);

runCase(
  'Report cannot register the Main production URL as its dedicated target',
  fixture('neutral_qa.yml', `name: Neutral QA\njobs:\n  qa:\n    steps:\n      - run: echo qa\n`, (policy) => {
    const report = policy.standaloneFocusApps.find((app) => app.appId === 'buklod-report');
    report.dedicatedRepository = 'faust-0612/BUKLOD-Report';
    report.dedicatedExpoProjectId = 'report-project-example';
    report.dedicatedProductionWeb = policy.rootApp.productionWeb;
    report.deploymentState = 'DEDICATED_TARGET_REGISTERED';
  }),
  false
);

console.log('BUKLOD_APP_BOUNDARY_SELF_TEST_OK');
