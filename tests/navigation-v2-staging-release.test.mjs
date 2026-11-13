import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Navigation V2 workflow is manual staging-Android only and cannot publish to production or web', () => {
  const workflow = read('.github/workflows/navigation-v2-staging-ota.yml');
  assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$REQUESTED_RC"/);
  assert.match(workflow, /node scripts\/navigation-v2-staging-gate\.mjs --prepublish/);
  assert.match(workflow, /channel:view staging-user/);
  assert.match(workflow, /channel:view production/);
  assert.match(workflow, /assert\.notEqual\(stage,live/);
  assert.match(workflow, /eas-cli@latest update --channel staging-user --platform android --environment preview/);
  assert.doesNotMatch(workflow, /eas-cli@latest (?:deploy|submit)|--channel production|--platform all/);
});
test('release cannot start with fake live/staging identity placeholders', () => {
  const evidence = JSON.parse(read('release/navigation-v2-staging-evidence.json'));
  assert.equal(evidence.live.sourceSha, 'a43e1813d62a151e8294a52989a80fe21b36057c');
  assert.equal(evidence.live.updateId, '01a1d2d6-bae3-74df-bbf4-2bdd9df35215');
  assert.match(evidence.live.artifactEvidenceUrl, /actions\/runs\/43355306642/);
  assert.equal(evidence.staging.installedBuildId, '');
  assert.equal(evidence.staging.backendContractReviewed, false);
  assert.equal(evidence.staging.deviceAcceptance, 'pending');
});
