const fs = require('node:fs');
const yaml = require('js-yaml');
function checkLegacyPublisher(text) {
  if (!text.includes('--channel production') || !/(?:eas|eas-cli)(?:@\S+)?\s+update\b/.test(text) || !/--platform\s+(android|all)/.test(text)) return;
  const workflow = yaml.load(text);
  if (Object.hasOwn(workflow.on ?? {}, 'push')) throw new Error('Legacy Android production publisher still has a push trigger');
  if (Object.values(workflow.jobs ?? {}).some(job => job.if !== '${{ false }}')) throw new Error('Legacy Android production publisher bypasses the canonical RC gates');
}
function checkPolicy(text) {
  const workflow = yaml.load(text);
  const triggers = workflow.on;
  if (!triggers || Object.keys(triggers).some(x => x !== 'workflow_dispatch')) throw new Error('Android production publisher must be manual only');
  for (const name of ['rc_sha', 'confirm', 'expected_production_update_id']) {
    if (triggers.workflow_dispatch?.inputs?.[name]?.required !== true) throw new Error('Missing required authorization input ' + name);
  }
  const steps = workflow.jobs?.['qa-and-publish']?.steps ?? [];
  if (workflow.jobs?.['qa-and-publish']?.if !== "inputs.operation == 'publish'") throw new Error('Read-only inspection must not publish');
  const inspection = workflow.jobs?.inspect;
  if (inspection?.steps.find(step => step.uses?.startsWith('actions/checkout@'))?.with?.ref !== '${{ inputs.rc_sha }}') throw new Error('Inspection checkout must also use immutable RC input');
  if (inspection?.if !== "inputs.operation == 'inspect'" || inspection.steps.some(step => /eas-cli@\S+\s+update\s+--/.test(step.run ?? ''))) throw new Error('Inspection must remain read-only');
  const checkout = steps.find(x => x.uses?.startsWith('actions/checkout@'));
  if (checkout?.with?.ref !== '${{ inputs.rc_sha }}') throw new Error('Checkout must use the exact immutable RC input');
  const source = steps.map(x => x.run ?? '').join('\n');
  for (const command of ['guard-android-ota-runtime.cjs', 'character:contract', 'game:contract', 'verify-android-rc-readiness.cjs', 'verify-android-release-env.cjs', 'verify-production-android-update.cjs baseline', 'verify-production-android-update.cjs published']) {
    if (!source.includes(command)) throw new Error('Missing release gate ' + command);
  }
  if (!source.includes('--platform android') || !source.includes('--channel production') || !source.includes('--environment production') || !source.includes('--skip-bundler --input-dir dist-android-rc')) throw new Error('Publish must reuse the exact Android production export');
  if (!source.includes('exit 1') || !source.includes('EXPO_TOKEN')) throw new Error('Credentials must fail closed');
  if (source.includes('patch-home-identity-action-row')) throw new Error('Publisher must not patch frozen source');
}
if (require.main === module) {
  checkPolicy(fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8'));
  for (const name of fs.readdirSync('.github/workflows')) {
    if (name !== 'production_android_ota.yml') checkLegacyPublisher(fs.readFileSync('.github/workflows/' + name, 'utf8'));
  }
  console.log('Android release policy: manual, immutable RC, authorization, fail-closed gates.');
}
module.exports = { checkPolicy, checkLegacyPublisher };
