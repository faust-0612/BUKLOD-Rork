#!/usr/bin/env node
// Exact-source staging Android JS OTA, never a binary, backend, web or production release.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { APK_SOURCE, BUILD_ID, verifyBuild, verifyChannels, verifyUpdate, manifest } from './navigation-v2-owner-staging-policy.mjs';
import { verifyMetroChange } from './buklod-nov14-scoped-staging-ota-policy.mjs';

export const BASE = '2e7dc3aa69d2362b7b360013ccaac9917c353e2b';
export const TARGET_PACKAGE = 'org.mzbministry.buklod.staging';
export const RELEASE_FILE = 'release/nov15-staging-consolidated-video-ads.json';
export const SOURCE_FILES = Object.freeze([
  'src/app/(tabs)/buklod.tsx',
  'src/app/(tabs)/hub.tsx',
  'src/app/(tabs)/messages.tsx',
  'src/app/(tabs)/me.tsx',
  'src/components/BuklodCommunityInlineAd.android.tsx',
  'src/components/BuklodCommunityInlineAd.tsx',
  'src/components/BuklodCommunitySponsoredAd.tsx',
  'src/components/BuklodExclusiveScopeCommunity.tsx',
  'src/components/BuklodMaritesBoard.tsx',
  'src/components/BuklodNativeSponsoredCard.android.tsx',
  'src/components/BuklodNativeSponsoredCard.tsx',
  'src/components/BuklodProfileTopTenRankings.tsx',
  'src/hooks/useBuklodCommunityAdViewability.ts',
  'src/lib/buklodMaritesPlayback.ts',
  'src/lib/buklodProfileRankings.ts',
  'src/lib/buklodVideoFrameVisibility.ts',
  'src/lib/buklodVideoScrollSignal.ts',
]);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');

export function verifyReleaseScope(r) {
  assert.equal(r.baselineSourceSha, BASE);
  assert.equal(r.stageBeforeProduction, true);
  assert.equal(r.readyForOta, false, 'Source cannot claim release finished before server readback');
  assert.equal(r.otaPublished, false, 'Source is not a publish receipt');
  assert.equal(r.target.platform, 'android');
  assert.equal(r.target.channel, 'staging-user');
  assert.equal(r.target.runtime, '1.3.2');
  assert.equal(r.target.package, TARGET_PACKAGE);
  assert.equal(r.target.environment, 'preview');
  assert.ok(r.excluded.some(s => /health center/i.test(s)));
  assert.ok(r.excluded.some(s => /saliksik/i.test(s)));
  assert.ok(r.excluded.some(s => /native.?lab/i.test(s)));
}
export function verifyNativeCreativeGate(code) {
  for (const key of [
    'const canPrefetchNative', 'reserveBuklodPassiveAdRequest(placementId, requestKey)',
    'const { ref, eligible } = useBuklodAdViewportGate()',
    'if (nativeAd && !nativeFailed && canShowNativeCreative)',
    'NativeAdEventType.IMPRESSION', 'createdAd?.destroy()',
  ]) assert.ok(code.includes(key), 'Missing Android NativeAd safety anchor: ' + key);
  assert.ok(code.includes('const canStartNativeRef = useRef(canPrefetchNative)'));
}
export function verifySource(source) {
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse', 'HEAD'), source);
  assert.equal(git('merge-base', BASE, source), BASE, 'Not descendant of reviewed staging source');
  assert.equal(git('merge-base', APK_SOURCE, source), APK_SOURCE, 'Signed staging client lineage diverged');
  const forbidden = git('diff', '--name-only', APK_SOURCE, source, '--',
    'package.json', 'package-lock.json', 'app.config.js', 'eas.json', 'babel.config.js',
    'android/', 'ios/', 'plugins/', 'supabase/', 'src/providers/AuthProvider.tsx',
    'src/providers/AdsProvider.tsx');
  assert.equal(forbidden, '', 'Signed APK ABI, auth, backend or Ads provider changed');
  const changed = git('diff', '--name-only', BASE, source, '--', 'src/', 'assets/', 'app/',
    'android/', 'ios/', 'plugins/', 'supabase/', 'package.json', 'package-lock.json',
    'app.config.js', 'eas.json', 'metro.config.js').split('\n').filter(Boolean).sort();
  assert.deepEqual(changed, [...SOURCE_FILES].sort(), 'Unexpected non-reviewed runtime source change');
  verifyMetroChange(git('show', APK_SOURCE + ':metro.config.js'),
    fs.readFileSync('metro.config.js', 'utf8').trim());
  verifyNativeCreativeGate(fs.readFileSync('src/components/BuklodCommunityInlineAd.android.tsx', 'utf8'));
  verifyReleaseScope(read(RELEASE_FILE));
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Tracked source dirty');
}
async function main() {
  const [mode, source, dir] = process.argv.slice(2);
  assert.ok(dir && dir.startsWith('/tmp/'), 'Evidence path must be under /tmp');
  verifySource(source);
  if (mode === 'verify-source') {
    console.log('NOV15 CONSO STAGING SOURCE VERIFIED; NOT YET PUBLISHED');
    return;
  }
  if (mode === 'preflight') {
    verifyBuild(read(dir + '/build.json'));
    const branch = verifyChannels(read(dir + '/staging-channel.json'), read(dir + '/production-channel.json'));
    const prod = await manifest('production');
    const stage = await manifest('staging-user');
    assert.equal(prod.extra?.expoClient?.android?.package, 'org.mzbministry.buklod');
    assert.equal(stage.extra?.expoClient?.android?.package, TARGET_PACKAGE);
    write(dir + '/preflight.json', {
      source, buildId: BUILD_ID, apkSource: APK_SOURCE, branch,
      previousStagingUpdateId: stage.id, productionUpdateId: prod.id,
      target: 'staging-user', runtimeVersion: '1.3.2',
      physicalDeviceAcceptance: 'WAIVED/NOT TESTED',
    });
    return;
  }
  if (mode === 'postpublish') {
    const pre = read(dir + '/preflight.json');
    assert.equal(pre.source, source);
    const update = verifyUpdate(read(dir + '/update-view.json'), source, pre.branch.name);
    const stage = await manifest('staging-user');
    const prod = await manifest('production');
    assert.equal(stage.id.toLowerCase(), update.id.toLowerCase(), 'Staging manifest did not match publish receipt');
    assert.equal(stage.extra?.expoClient?.android?.package, TARGET_PACKAGE);
    assert.equal(stage.extra?.expoClient?.extra?.appEnvironment, 'staging');
    assert.equal(prod.id, pre.productionUpdateId, 'Production mutated before staging was validated');
    verifyChannels(read(dir + '/staging-channel-after.json'), read(dir + '/production-channel-after.json'));
    write(dir + '/verification.json', {
      status: 'VERIFIED ANDROID STAGING OTA SERVER-SIDE', sourceSha: source,
      updateId: update.id, groupId: update.group, channel: 'staging-user',
      platform: update.platform, runtimeVersion: update.runtimeVersion,
      appPackage: TARGET_PACKAGE, buildId: BUILD_ID, createdAt: update.createdAt,
      previousStagingUpdateId: pre.previousStagingUpdateId,
      productionUpdateIdUnchanged: prod.id, physicalDeviceAcceptance: 'WAIVED/NOT TESTED',
      excluded: read(RELEASE_FILE).excluded,
      githubRunUrl: 'https://github.com/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID,
    });
    return;
  }
  throw Error('Unsupported release mode');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(e => { console.error('NOV15 CONSOLIDATED STAGING BLOCK:', e.message); process.exitCode = 1; });
}
