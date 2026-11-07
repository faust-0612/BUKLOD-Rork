#!/usr/bin/env node
/**
 * BUKLOD Kingdom — staging-user release preflight, NOT a publisher.
 * Usage: node scripts/kingdom-staging-preflight.mjs [--release --artifact=path --commit=sha]
 * Config-only mode is suitable for CI and checks source invariants.
 * Release mode checks an operator-provided EAS build evidence file but does NOT
 * claim that an APK was independently tested or trigger an OTA.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const RUNTIME = '1.3.2';
const CHANNEL = 'staging-user';
const PACKAGE = 'org.mzbministry.buklod.staging';
const ENVIRONMENT = 'preview';
const TARGET = 'main';
const MAX_AGE_DAYS = 30;

function loadAppConfig() {
  const previous = {
    APP_VARIANT: process.env.APP_VARIANT,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    BUKLOD_APP_TARGET: process.env.BUKLOD_APP_TARGET,
  };
  try {
    process.env.APP_VARIANT = 'staging';
    process.env.EXPO_PUBLIC_APP_ENV = 'staging';
    process.env.BUKLOD_APP_TARGET = TARGET;
    return require('../app.config.js')({ config: { extra: {} } });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
export function inspectKingdomStagingSource() {
  const failures = [];
  const eas = JSON.parse(fs.readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(
    new URL('../src/features/games/kingdom/platform/game-catalog.json', import.meta.url), 'utf8',
  ));
  const profile = eas.build?.['staging-user'];
  const app = loadAppConfig();

  if (profile?.channel !== CHANNEL) failures.push('staging-user EAS channel mismatch');
  if (profile?.environment !== ENVIRONMENT) failures.push('staging-user must use the preview EAS environment');
  if (profile?.android?.buildType !== 'apk') failures.push('staging-user must be an APK build');
  if (profile?.env?.APP_VARIANT !== 'staging' ||
      profile?.env?.EXPO_PUBLIC_APP_ENV !== 'staging') failures.push('staging-user app variant mismatch');
  if (app.runtimeVersion !== RUNTIME) failures.push('runtimeVersion mismatch');
  if (app.android?.package !== PACKAGE) failures.push('staging Android package mismatch');
  if (app.extra?.appTarget !== TARGET) failures.push('BUKLOD Kingdom must target the main app');
  if (app.extra?.appEnvironment !== 'staging') failures.push('app-config staging environment mismatch');
  if (!app.extra?.eas?.projectId ||
      app.updates?.url !== 'https://u.expo.dev/' + app.extra.eas.projectId) failures.push('EAS project/update URL mismatch');

  const games = catalog.characters?.flatMap(c => c.games) ?? [];
  if (catalog.characters?.length !== 13 || games.length !== 39 ||
      games.filter(g => g.status === 'existing').length !== 13 ||
      games.filter(g => g.status === 'pilot').length !== 26 ||
      games.some(g => g.status === 'planned') ||
      new Set(games.map(g => g.id)).size !== 39) failures.push('game catalog is not 13 existing + 26 pilot with unique game IDs');
  const entry = fs.readFileSync(new URL('../src/app/games/index.tsx', import.meta.url), 'utf8');
  if (!entry.includes('BuklodKingdomMapPremium')) failures.push('premium in-app Kingdom map is not the route entry');

  return { ok: failures.length === 0, failures,
    target: { channel: CHANNEL, environment: ENVIRONMENT, runtimeVersion: RUNTIME,
      package: PACKAGE, easProjectId: app.extra?.eas?.projectId, platform: 'android',
      target: TARGET },
    catalog: { centers: catalog.characters?.length ?? 0, games: games.length },
  };
}
export function verifyKingdomStagingArtifact(evidence, expectedCommit, source = inspectKingdomStagingSource()) {
  const failures = [...source.failures];
  if (!/^[0-9a-f]{40}$/i.test(String(expectedCommit))) failures.push('RC commit must be a full Git SHA');
  const fields = ['artifactId', 'easProjectId', 'channel', 'environment', 'runtimeVersion',
    'package', 'platform', 'sourceCommit', 'buildCreatedAt', 'evidenceUrl'];
  for (const field of fields) if (!evidence || !evidence[field]) failures.push('Missing EAS build evidence: ' + field);
  if (evidence?.easProjectId !== source.target.easProjectId) failures.push('Installed EAS project ID mismatch');
  if (evidence?.channel !== CHANNEL) failures.push('Installed APK channel is not staging-user');
  if (evidence?.environment !== ENVIRONMENT) failures.push('Installed APK environment is not preview');
  if (evidence?.runtimeVersion !== RUNTIME) failures.push('Installed APK runtime is not 1.3.2');
  if (evidence?.package !== PACKAGE) failures.push('Installed APK package is not the BUKLOD staging package');
  if (evidence?.platform !== 'android') failures.push('EAS build is not Android');
  if (evidence?.sourceCommit !== expectedCommit) failures.push('Installed APK source provenance differs from RC');
  if (!/^https:\/\/(expo\.dev|eas\.expo\.dev)\//.test(String(evidence?.evidenceUrl ?? '')))
    failures.push('EAS build evidence URL must point to a verified EAS record');
  const created = new Date(String(evidence?.buildCreatedAt ?? '')).getTime();
  if (!Number.isFinite(created) || created > Date.now() + 300000 ||
      Date.now() - created > MAX_AGE_DAYS * 86400000) failures.push('EAS build evidence is stale or has invalid timestamp');
  return { ok: failures.length === 0, failures, source };
}

if (process.argv[1]?.endsWith('kingdom-staging-preflight.mjs')) {
  const src = inspectKingdomStagingSource();
  const release = process.argv.includes('--release');
  const path = process.argv.find(x => x.startsWith('--artifact='))?.slice('--artifact='.length);
  const commit = process.argv.find(x => x.startsWith('--commit='))?.slice('--commit='.length);
  let result = src;
  if (release) {
    if (!path || !commit) {
      result = { ok: false, failures: [...src.failures, 'Release requires --artifact and --commit: missing exact APK attestation'] };
    } else {
      try {
        const content = JSON.parse(fs.readFileSync(path, 'utf8'));
        result = verifyKingdomStagingArtifact(content, commit, src);
      } catch (error) {
        result = { ok: false, failures: [...src.failures, 'Cannot inspect EAS build evidence: ' + String(error)] };
      }
    }
  }
  console.log(JSON.stringify({ schema: 'buklod-kingdom-staging-ota-preflight-v1', mode: release ? 'release-evidence' : 'source-only',
    ...result, published: false,
    warning: 'Source or metadata checks are not proof of physical device behavior. No OTA is sent by this script.' }, null, 2));
  if (!result.ok) process.exitCode = 1;
}
