'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const policyPath = path.join(root, '.buklod', 'app-boundaries.json');
const workflowsDir = path.join(root, '.github', 'workflows');

function fail(messages) {
  console.error('\nBUKLOD APP BOUNDARY VIOLATION');
  for (const message of messages) console.error(`- ${message}`);
  console.error('\nProduction release is blocked. Resolve the app identity/target instead of falling back to BUKLOD Main.');
  process.exit(1);
}

if (!fs.existsSync(policyPath)) {
  fail(['Missing .buklod/app-boundaries.json. Product identity must be explicit before release work.']);
}

let policy;
try {
  policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
} catch (error) {
  fail([`Invalid boundary registry JSON: ${error.message}`]);
}

const rootApp = policy.rootApp || {};
const focusApps = Array.isArray(policy.standaloneFocusApps) ? policy.standaloneFocusApps : [];
const errors = [];

if (rootApp.appId !== 'buklod-main') errors.push('Root app must be registered as appId=buklod-main.');
if (rootApp.repository !== 'faust-0612/BUKLOD-Rork') errors.push('This repository must remain registered only as BUKLOD Main.');
if (rootApp.productionWeb !== 'https://buklod.expo.app') errors.push('buklod.expo.app must remain registered only to BUKLOD Main.');
if (rootApp.mayHostStandaloneFocusAppDeployment !== false) errors.push('BUKLOD Main must explicitly forbid hosting standalone Focus App deployments.');

const currentRepo = process.env.GITHUB_REPOSITORY;
if (currentRepo && currentRepo !== rootApp.repository) {
  errors.push(`Boundary registry belongs to ${rootApp.repository}, but CI is running in ${currentRepo}.`);
}

for (const app of focusApps) {
  if (app.kind !== 'STANDALONE_FOCUS_APP') {
    errors.push(`${app.appId || 'Unknown Focus App'} must be classified STANDALONE_FOCUS_APP.`);
  }
  const forbiddenRepos = app.forbiddenFallbackRepositories || [];
  const forbiddenWeb = app.forbiddenFallbackProductionWeb || [];
  if (!forbiddenRepos.includes(rootApp.repository)) {
    errors.push(`${app.appId} must explicitly forbid fallback to ${rootApp.repository}.`);
  }
  if (!forbiddenWeb.includes(rootApp.productionWeb)) {
    errors.push(`${app.appId} must explicitly forbid fallback to ${rootApp.productionWeb}.`);
  }
  const targetFields = [app.dedicatedRepository, app.dedicatedExpoProjectId, app.dedicatedProductionWeb];
  const anyTargetAssigned = targetFields.some(Boolean);
  const allTargetsAssigned = targetFields.every(Boolean);
  if (anyTargetAssigned && !allTargetsAssigned) {
    errors.push(`${app.appId} has a partial production identity. Repository, Expo project, and production web must be registered together before production release.`);
  }
  if (!allTargetsAssigned && app.deploymentState !== 'UNASSIGNED_BLOCK_PRODUCTION_DEPLOYMENT') {
    errors.push(`${app.appId} has no complete dedicated target and therefore must remain production-blocked.`);
  }
  if (app.dedicatedRepository === rootApp.repository) {
    errors.push(`${app.appId} cannot use the BUKLOD Main repository as its dedicated repository.`);
  }
  if (app.dedicatedExpoProjectId === rootApp.expoProjectId) {
    errors.push(`${app.appId} cannot use the BUKLOD Main Expo project.`);
  }
  if (app.dedicatedProductionWeb === rootApp.productionWeb) {
    errors.push(`${app.appId} cannot use the BUKLOD Main production web URL.`);
  }
}

const releasePatterns = [
  /\beas(?:-cli(?:@[^\s]+)?)?\s+deploy\b/i,
  /\beas(?:-cli(?:@[^\s]+)?)?\s+update\b/i,
  /\beas(?:-cli(?:@[^\s]+)?)?\s+build\b[^\n]*(?:--profile\s+production|--profile=production)/i,
  /\beas-cli(?:@[^\s]+)?\s+deploy\b/i,
  /\beas-cli(?:@[^\s]+)?\s+update\b/i,
  /\beas-cli(?:@[^\s]+)?\s+build\b[^\n]*(?:--profile\s+production|--profile=production)/i
];

function workflowFocusApps(fileName, text) {
  const firstName = (text.match(/^name:\s*(.+)$/mi) || [])[1] || '';
  const identityText = `${fileName}\n${firstName}`.toLowerCase();
  return focusApps.filter((app) => {
    const names = [app.appId, app.displayName]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return names.some((name) => identityText.includes(name)) ||
      (app.appId === 'buklod-report' && /(^|[_-])report([_.-]|$)/i.test(fileName)) ||
      (app.appId === 'buklod-classroom' && /classroom/i.test(fileName));
  });
}

if (fs.existsSync(workflowsDir)) {
  for (const fileName of fs.readdirSync(workflowsDir)) {
    if (!/\.ya?ml$/i.test(fileName)) continue;
    if (fileName === 'buklod_app_boundary_guard.yml' || fileName === 'buklod_app_boundary_guard.yaml') continue;

    const fullPath = path.join(workflowsDir, fileName);
    const text = fs.readFileSync(fullPath, 'utf8');
    const scopedApps = workflowFocusApps(fileName, text);
    if (!scopedApps.length) continue;

    const appNames = scopedApps.map((app) => app.appId).join(', ');
    const hasReleaseCommand = releasePatterns.some((pattern) => pattern.test(text));
    const targetsMainWeb = text.includes(rootApp.productionWeb);
    const targetsMainProject = rootApp.expoProjectId && text.includes(rootApp.expoProjectId);
    const claimsProductionPromotion = /promot(?:e|ing|ed).*production/i.test(text) || /production\s+url/i.test(text);

    if (hasReleaseCommand) {
      errors.push(`${fileName} is scoped to standalone Focus App (${appNames}) but contains an EAS production release command. Main-side Focus App workflows are QA/integration only.`);
    }
    if (targetsMainWeb && (hasReleaseCommand || claimsProductionPromotion)) {
      errors.push(`${fileName} is scoped to ${appNames} and targets BUKLOD Main production URL ${rootApp.productionWeb}.`);
    }
    if (targetsMainProject && hasReleaseCommand) {
      errors.push(`${fileName} is scoped to ${appNames} and targets the BUKLOD Main Expo project.`);
    }
  }
}

if (errors.length) fail(errors);

console.log('BUKLOD_APP_BOUNDARY_GUARD_OK');
console.log(`Root: ${rootApp.appId} -> ${rootApp.repository} -> ${rootApp.productionWeb}`);
for (const app of focusApps) {
  const status = app.dedicatedRepository && app.dedicatedProductionWeb
    ? `DEDICATED: ${app.dedicatedRepository} -> ${app.dedicatedProductionWeb}`
    : 'STANDALONE / PRODUCTION DEPLOYMENT BLOCKED UNTIL DEDICATED TARGET IS REGISTERED';
  console.log(`${app.appId}: ${status}`);
}
