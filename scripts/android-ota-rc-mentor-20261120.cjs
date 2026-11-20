const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {resolveExpoConfigFromSource, assertNativeRuntimeCompatible} = require('./native-expo-config-compat.cjs');
const {assertApprovedCompactScriptOnly} = require('./buklod-native-package-script-gate.cjs');
const pinnedV28 = '2f26645e50e8e079ebf09f3999aacfc506ae7651';
const project = '23dad7d0-389a-406e-8dec-08965dab85d8';
const runtime = '1.3.2';
const pinnedProductionUpdateId = '01a1f3f0-11f0-7ba7-a0d2-8dbebdf97ae3';
const pinnedProductionBundleHash = 'unFUenZWw5gY5LAIPwwtyn8dlSV8j_NhAWoXbyCzQII';
const isolatedBranch = 'release/mentor-submit-pinned-baseline-20261120';
const verifiedBaseline = '0a4f0b2b849f24b46b4a0643a6cc55ae539d5cdf';
const allowedChanges = [
  '.buklod/releases/mentor-submit-only-prod-20261120.json',
  '.buklod/scopes/mentor-submit-hotfix-isolated-20261120.json',
  '.github/workflows/mentor-hotfix-live-baseline-check-20261120.yml',
  '.github/workflows/mentor-submit-only-prod-ota-20261120.yml',
  'scripts/android-ota-rc-mentor-20261120.cjs',
  'scripts/mentor-hotfix-release-guard-20261120.cjs',
  'src/app/faith/mentor-evidence.tsx',
  'tests/mentor-isolated-prod-release-gates-20261120.test.mjs',
  'tests/mentor-report-submit-feedback-20261120.test.mjs',
].sort();
const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
const sha = git('rev-parse', 'HEAD');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2)+'\n');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function inventory(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? inventory(file) : [{file, sha256: hash(file)}];
  }).sort((a,b) => a.file.localeCompare(b.file));
}
async function manifest() {
  const response = await fetch(`https://u.expo.dev/${project}`, {
    headers: {'expo-platform':'android','expo-runtime-version':runtime,'expo-channel-name':'production'},
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'Production manifest unavailable');
  const body = await response.text();
  let data;
  try { data = JSON.parse(body); } catch {
    const line = body.split(/\r?\n/).find(line => line.startsWith('{"id"'));
    assert.ok(line, 'Missing production manifest'); data = JSON.parse(line);
  }
  assert.equal(data.runtimeVersion, runtime);
  assert.match(response.headers.get('expo-manifest-filters') || '', /branchname="production"/);
  return data;
}
function sourceGate() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/' + isolatedBranch,
    'Isolated production OTA requires exact approved non-main branch');
  assert.equal(sha, process.env.GITHUB_SHA, 'Exact event checkout required');
  git('diff', '--exit-code');
  git('merge-base','--is-ancestor',verifiedBaseline,sha);
  assert.deepEqual(
    git('diff','--name-only',verifiedBaseline,sha,'--').split(/\r?\n/).filter(Boolean).sort(),
    allowedChanges,
    'Release must contain only exact isolated mentoring hotfix, tests and release machinery'
  );
  assert.equal(git('rev-parse','HEAD:src/app/faith/mentor-evidence.tsx'),
    '06451c37b8072b224ef4da900d7ea62e6fc7ddd4',
    'The reviewed mentoring-screen blob must not change');
  assert.equal(git('show','-s','--format=%s',sha).startsWith('BUKLOD_MENTOR_SUBMIT_ONLY_PROD_20261120:'), true,
    'Production release requires owner-authorized marker commit');
  assert.deepEqual(git('diff','--name-only','HEAD^','HEAD','--').split(/\r?\n/).filter(Boolean),
    ['.buklod/releases/mentor-submit-only-prod-20261120.json'],
    'Release marker commit must change only the metadata receipt');
  const releaseRecord = read('.buklod/releases/mentor-submit-only-prod-20261120.json');
  assert.equal(releaseRecord.expectedBaselineUpdateId,pinnedProductionUpdateId);
  assert.equal(releaseRecord.expectedBaselineBundleHash,pinnedProductionBundleHash);
  assert.equal(releaseRecord.preReleaseSourceSha, git('rev-parse','HEAD^'),
    'Release marker must have the last reviewed branch source as its sole parent');
  assert.equal(releaseRecord.verifiedMainSourceSha,verifiedBaseline);
  assert.equal(releaseRecord.productionAuthorized,true);
  assert.equal(releaseRecord.season2ProductionAuthorized,false);
  const config = require('../app.config.js')({config:{}});
  assert.equal(config.runtimeVersion, runtime);
  assert.equal(config.extra.eas.projectId, project);
  assert.equal(config.android.package, 'org.mzbministry.buklod');
}
async function run() {
  fs.mkdirSync('ota-evidence', {recursive:true});
  const mode = process.argv[2];
  sourceGate();
  if (mode === 'baseline') {
    const before = await manifest();
    // Runtime/native compatibility is checked below. Capture the actual live
    // production update at release start; never pin an old update ID.
    // The verify gate still aborts if production changes during RC preparation.
    assert.match(before.id || '', /^[0-9a-f-]{36}$/i, 'Invalid live production update ID');
    assert.ok(before.launchAsset?.hash, 'Missing live production bundle fingerprint');
    assert.equal(before.id,pinnedProductionUpdateId,
      'Live production update changed since latest verified baseline, stop before release');
    assert.equal(before.launchAsset.hash,pinnedProductionBundleHash,
      'Live production bundle changed since read-only verified baseline, stop');
    git('merge-base', '--is-ancestor', pinnedV28, sha);
    // V30 removes only the unused connectedDevice foreground-service manifest
    // permission. The plugin is compared byte-for-byte against a single removal;
    // every other native/dependency drift remains a hard stop for V28 OTA clients.
    const changedNative = git('diff', '--name-only', pinnedV28, sha, '--', 'package.json', 'package-lock.json', 'android', 'plugins').split(/\r?\n/).filter(Boolean);
    // Only the known compact source-QA script addition in package.json and
    // approved connectedDevice manifest-plugin deletion can differ from V28.
    // Every other package key, lockfile, plugin and native path remains pinned.
    assert.deepEqual(changedNative, ['package.json','plugins/withBuklodPttHardwareFoundation.js'],
      'Unapproved native/dependency drift since V28');
    assertApprovedCompactScriptOnly(
      fs.readFileSync('package.json','utf8'),
      // Use byte-exact git show: the shared git() helper calls .trim(),
      // which strips the pinned blob's trailing newline and falsely blocks RC.
      execFileSync('git',['show',pinnedV28+':package.json'],{encoding:'utf8'})
    );
    const oldPlugin = git('show', pinnedV28 + ':plugins/withBuklodPttHardwareFoundation.js');
    const currentPlugin = fs.readFileSync('plugins/withBuklodPttHardwareFoundation.js', 'utf8').trimEnd();
    const expectedPlugin = oldPlugin.replace("  ['android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE', null],", "  // No connectedDevice foreground service: PTT uses Stream VoIP transport.").trimEnd();
    assert.equal(currentPlugin, expectedPlugin, 'Only the approved connectedDevice permission deletion is allowed');
    const currentConfig = require('../app.config.js')({config:{}});
    const removedPermission = 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE';
    assert.equal(currentConfig.android.versionCode, 30, 'V30 production identity required');
    assert.equal(currentConfig.android.blockedPermissions.filter(p => p === removedPermission).length, 1,
      'V30 must block the unused foreground-service permission');
    // Native V28 cannot gain new APIs through OTA. Ignore only the approved
    // V30 manifest permission BLOCK; all other Expo ABI/config must match V28.
    currentConfig.android.blockedPermissions = currentConfig.android.blockedPermissions.filter(p => p !== removedPermission);
    assertNativeRuntimeCompatible(currentConfig, resolveExpoConfigFromSource(git('show', pinnedV28 + ':app.config.js')));
    write('ota-evidence/baseline.json', {id:before.id, runtime, source:sha, launchAssetHash:before.launchAsset.hash, verifiedBaseline});
    console.log('PASS: production baseline, exact main source, unchanged native runtime');
  } else if (mode === 'freeze') {
    const metadata = read('rc/metadata.json');
    assert.ok(metadata.fileMetadata?.android?.bundle, 'Missing Android export');
    assert.equal(metadata.fileMetadata?.ios, undefined, 'Android-only RC required');
    const bundle = path.join('rc', metadata.fileMetadata.android.bundle);
    assert.ok(fs.statSync(bundle).size > 0);
    const baseline = read('ota-evidence/baseline.json');
    write('ota-evidence/rc.json', {source:sha, tree:git('rev-parse','HEAD^{tree}'), runtime, channel:'production', baseline:baseline.id, bundle, files:inventory('rc')});
    console.log('FROZEN RC', sha, hash(bundle));
  } else if (mode === 'verify') {
    const rc = read('ota-evidence/rc.json');
    assert.equal(rc.source, sha);
    assert.deepEqual(inventory('rc'), rc.files, 'Frozen RC changed');
    const current = await manifest();
    assert.equal(current.id, rc.baseline, 'Production advanced while building RC');
    assert.equal(current.launchAsset.hash,pinnedProductionBundleHash,
      'Production launch bundle advanced while building RC');
    console.log('PASS: exact RC hashes and unchanged production baseline');
  } else if (mode === 'published') {
    const rc = read('ota-evidence/rc.json');
    assert.deepEqual(inventory('rc'), rc.files);
    const result = read('ota-evidence/published.json');
    const records = [];
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      if (value.platform === 'android' && value.id) records.push(value);
      Object.values(value).forEach(visit);
    }
    visit(result);
    assert.equal(records.length, 1, 'Expected exactly one Android update');
    const update = records[0];
    assert.equal(update.runtimeVersion, runtime);
    let live;
    for (let attempt=0; attempt<6; attempt++) {
      live = await manifest();
      if (live.id === update.id) break;
      if (attempt<5) await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.equal(live.id, update.id, 'Production did not serve published update');
    const bundleHash = crypto.createHash('sha256').update(fs.readFileSync(rc.bundle)).digest('base64url');
    assert.equal(live.launchAsset.hash, bundleHash, 'Served bundle differs from frozen RC');
    assert.notEqual(live.id, pinnedProductionUpdateId,
      'Publication must create a fresh uniquely identified Android update');
    write('ota-evidence/verified.json', {updateId:live.id, source:sha, runtime, channel:'production', launchAssetHash:bundleHash, verifiedAt:new Date().toISOString()});
    console.log('VERIFIED ANDROID PRODUCTION OTA', live.id, runtime, sha);
  } else throw new Error('Unknown RC command');
}
run().catch(error => {console.error(error.message); process.exitCode=1;});
