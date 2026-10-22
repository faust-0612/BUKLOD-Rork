const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const registry = require('../release/android-native-runtime.json').active;
function liveManifest() {
  const raw = execFileSync('curl', ['--fail', '--silent', '--show-error', '--max-time', '30', '-H', 'expo-platform: android', '-H', 'expo-runtime-version: 1.3.2', '-H', 'expo-channel-name: production', '-H', 'expo-protocol-version: 0', 'https://u.expo.dev/' + registry.easProjectId], {encoding:'utf8'});
  for (const part of raw.split(/\r?\n\r?\n/)) {
    try { const data = JSON.parse(part.split(/\r?\n--/)[0].trim()); if (data.runtimeVersion && data.id) return data; } catch {}
  }
  throw new Error('Production manifest response could not be verified');
}
const actual = liveManifest();
if (actual.runtimeVersion !== registry.embeddedRuntime) throw new Error('Live runtime mismatch');
if (process.argv[2] === 'baseline') {
  if (actual.id !== process.env.EXPECTED_PRODUCTION_UPDATE_ID) throw new Error('Production changed since baseline verification; stop to reconcile');
  console.log('Expected production baseline confirmed.');
} else if (process.argv[2] === 'published') {
  const result = JSON.parse(fs.readFileSync('.buklod-temp/android-update-result.json', 'utf8'));
  const rows = Array.isArray(result) ? result : result.updates;
  const android = rows?.filter(x => x.platform === 'android');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
  if (android?.length !== 1 || android[0].id !== actual.id || android[0].runtimeVersion !== registry.embeddedRuntime || android[0].gitCommitHash !== head) throw new Error('Published update, source or production assignment is not verified');
  const metadata = JSON.parse(fs.readFileSync('.buklod-temp/android-rc/metadata.json', 'utf8'));
  const exported = JSON.parse(fs.readFileSync('.buklod-temp/android-export-manifest.json', 'utf8'));
  const bundle = exported.files.find(file => file.path === metadata.fileMetadata?.android?.bundle);
  if (exported.sourceCommit !== head || !bundle) throw new Error('Exact-RC export evidence missing');
  const bytes = fs.readFileSync('.buklod-temp/android-rc/' + bundle.path);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== bundle.sha256 ||
      crypto.createHash('sha256').update(bytes).digest('base64url') !== actual.launchAsset?.hash) throw new Error('Live launch bundle hash does not match the verified RC export');
  fs.writeFileSync('.buklod-temp/android-production-verification.json', JSON.stringify({ sourceCommit: head, updateId: actual.id, group: android[0].group, platform:'android', channel:'production', runtime:actual.runtimeVersion, createdAt:actual.createdAt }, null, 2));
  console.log('Production manifest confirms the published exact-RC Android update.');
} else throw new Error('Expected baseline or published verification mode');
