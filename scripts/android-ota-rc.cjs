const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const project = '23dad7d0-389a-406e-8dec-08965dab85d8';
const runtime = '1.3.2';
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
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Production requires main');
  assert.equal(sha, process.env.GITHUB_SHA, 'Exact event checkout required');
  git('diff', '--exit-code');
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
    // This release was reconciled against this independently observed source/update pair.
    assert.equal(before.id, '01a1682a-cfee-77ba-a1cc-f46b5674deff', 'Production advanced: reconcile before releasing');
    git('merge-base', '--is-ancestor', '2f26645e50e8e079ebf09f3999aacfc506ae7651', sha);
    assert.equal(git('diff', '--name-only', '2f26645e50e8e079ebf09f3999aacfc506ae7651', sha, '--', 'package.json', 'package-lock.json', 'app.config.js', 'android', 'plugins'), '', 'Native baseline changed');
    write('ota-evidence/baseline.json', {id:before.id, runtime, source:sha, launchAssetHash:before.launchAsset.hash});
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
    assert.equal((await manifest()).id, rc.baseline, 'Production advanced while building RC');
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
    write('ota-evidence/verified.json', {updateId:live.id, source:sha, runtime, channel:'production', launchAssetHash:bundleHash, verifiedAt:new Date().toISOString()});
    console.log('VERIFIED ANDROID PRODUCTION OTA', live.id, runtime, sha);
  } else throw new Error('Unknown RC command');
}
run().catch(error => {console.error(error.message); process.exitCode=1;});
