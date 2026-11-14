#!/usr/bin/env node
// Separate owner-authorized OTA-only staging policy. The installed-device and
// production gates in navigation-v2-staging-gate.mjs are deliberately unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const APK_SOURCE = 'c6804e5b6b72e6bb7658f5b13e32dd8a5d1de9fd';
export const BUILD_ID = 'bc4be208-bfb0-42f3-95cb-358353d0600f';
export const PROJECT = '23dad7d0-389a-406e-8dec-08965dab85d8';
export const OWNER_EXCLUSIONS = Object.freeze({
  physicalDeviceAcceptance: 'SKIPPED BY OWNER',
  nativeImeCommitContent: 'DEFERRED BY OWNER; existing GIF share fallback retained',
});
export function channelBranch(raw, expected) {
  const c = raw.currentPage ?? raw;
  assert.equal(c.name, expected, 'Wrong channel');
  assert.notEqual(c.isPaused, true, 'Channel paused');
  const m = typeof c.branchMapping === 'string' ? JSON.parse(c.branchMapping) : c.branchMapping;
  assert.equal(m?.data?.length, 1, 'Missing mapping or active channel rollout');
  const branches = c.updateBranches;
  assert.ok(Array.isArray(branches), 'Missing branch identities');
  const b = branches.find(b => b.id === m.data[0].branchId);
  assert.ok(b?.id && b?.name, 'Unresolved channel mapping');
  return { id: b.id, name: b.name };
}
export function verifyChannels(stage, production) {
  const s = channelBranch(stage, 'staging-user');
  const p = channelBranch(production, 'production');
  assert.equal(s.name, 'staging-user', 'Unexpected staging EAS branch');
  assert.notEqual(s.id, p.id, 'Shared production branch');
  assert.notEqual(s.name, p.name, 'Shared production branch name');
  return s;
}
export function verifyBuild(b) {
  assert.equal(b.id, BUILD_ID);
  assert.equal(b.status.toLowerCase(), 'finished');
  assert.equal(b.platform.toLowerCase(), 'android');
  assert.equal(b.gitCommitHash, APK_SOURCE);
  assert.equal(b.buildProfile, 'staging-user');
  assert.equal(b.updateChannel?.name, 'staging-user');
  assert.equal(b.appIdentifier, 'org.mzbministry.buklod.staging');
  assert.equal(b.appVersion, '1.3.6');
  assert.equal(b.distribution, 'INTERNAL');
  assert.equal(b.runtime?.version, '1.3.2');
  assert.equal(String(b.appBuildVersion), '10');
  assert.equal(b.app?.id, PROJECT);
  return true;
}
export function verifyUpdate(updates, source, branch) {
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.ok(Array.isArray(updates) && updates.length === 1, 'Exactly one Android update required');
  const u = updates[0];
  assert.equal(u.platform, 'android');
  assert.equal(u.runtimeVersion, '1.3.2');
  assert.equal(u.gitCommitHash, source);
  assert.equal(u.branch, branch);
  assert.ok(u.id && u.group && Number.isFinite(Date.parse(u.createdAt)));
  assert.notEqual(u.isRollBackToEmbedded, true);
  return u;
}
export function parseManifest(body, contentType) {
  if (contentType.includes('multipart/')) {
    const boundary = /boundary="?([^";\s]+)/i.exec(contentType)?.[1];
    assert.ok(boundary, 'Missing manifest boundary');
    for (const part of body.split('--' + boundary)) {
      const at = part.indexOf('\r\n\r\n');
      if (at < 0) continue;
      try { const m = JSON.parse(part.slice(at + 4).trim()); if (m.id && m.launchAsset) return m; } catch {}
    }
    throw Error('No update manifest in multipart response');
  }
  return JSON.parse(body);
}
export async function manifest(channel) {
  const r = await fetch('https://u.expo.dev/' + PROJECT, { headers: {
    'expo-platform': 'android', 'expo-runtime-version': '1.3.2',
    'expo-channel-name': channel, 'expo-protocol-version': '1',
    accept: 'multipart/mixed,application/expo+json,application/json',
    'cache-control': 'no-cache',
  }, signal: AbortSignal.timeout(30000) });
  assert.equal(r.status, 200, 'Update endpoint did not return a manifest');
  const m = parseManifest(await r.text(), r.headers.get('content-type') ?? '');
  assert.equal(m.runtimeVersion, '1.3.2');
  assert.ok(m.id && m.launchAsset?.url);
  return m;
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
export function verifySource(source) {
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse', 'HEAD'), source);
  assert.equal(git('merge-base', APK_SOURCE, source), APK_SOURCE);
  // No product, dependency, native, backend, plugin, config or asset changes
  // since the compatible signed binary; allow only release/test/docs metadata.
  const paths = git('diff', '--name-only', APK_SOURCE, source).split('\n').filter(Boolean);
  for (const p of paths) assert.match(p, /^(?:\.github\/workflows\/|\.buklod\/scopes\/|scripts\/navigation-v2-owner-staging-policy\.mjs$|tests\/navigation-v2-owner-staging-ota\.test\.mjs$|docs\/|release\/)/, 'Unexpected APK-source delta: ' + p);
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Tracked source is dirty');
}
async function main() {
  const [mode, source, dir] = process.argv.slice(2);
  assert.ok(dir?.startsWith('/tmp/'));
  verifySource(source);
  if (mode === 'preflight') {
    const b = read(dir + '/build.json'); verifyBuild(b);
    const branch = verifyChannels(read(dir + '/staging-channel.json'), read(dir + '/production-channel.json'));
    const live = await manifest('production');
    assert.equal(live.extra?.expoClient?.android?.package, 'org.mzbministry.buklod');
    write(dir + '/preflight.json', { source, branch, buildId: b.id, apkSource: APK_SOURCE,
      liveUpdateId: live.id, exclusions: OWNER_EXCLUSIONS, nativeCompatibility: 'unchanged signed-binary source',
      verifiedAt: new Date().toISOString(), published: false });
  } else if (mode === 'postpublish') {
    const pre = read(dir + '/preflight.json');
    assert.equal(pre.source, source);
    const u = verifyUpdate(read(dir + '/update-view.json'), source, pre.branch.name);
    const stage = await manifest('staging-user');
    assert.equal(stage.id.toLowerCase(), u.id.toLowerCase());
    assert.equal(stage.extra?.expoClient?.android?.package, 'org.mzbministry.buklod.staging');
    assert.equal(stage.extra?.expoClient?.extra?.appEnvironment, 'staging');
    const production = await manifest('production');
    assert.equal(production.id, pre.liveUpdateId, 'Production update changed during staging release');
    verifyChannels(read(dir + '/staging-channel-after.json'), read(dir + '/production-channel-after.json'));
    write(dir + '/verification.json', { status: 'VERIFIED SERVER-SIDE STAGING OTA', sourceSha: source,
      updateId: u.id, groupId: u.group, branch: u.branch, channel: 'staging-user', environment: 'preview',
      package: 'org.mzbministry.buklod.staging', runtimeVersion: u.runtimeVersion, platform: u.platform,
      publishedAt: u.createdAt, verifiedAt: new Date().toISOString(), buildId: BUILD_ID,
      exclusions: OWNER_EXCLUSIONS, productionUpdateIdUnchanged: production.id,
      githubRunUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      physicalDeviceAccepted: false, full21ItemAcceptance: false });
  } else throw Error('Unknown policy mode');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  main().catch(e => { console.error('STAGING POLICY BLOCK:', e.message); process.exitCode = 1; });
