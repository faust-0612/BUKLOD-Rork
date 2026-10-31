const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('KL chapter natural-break ad can occur only after new server-verified completion', () => {
  const source = readFileSync('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx', 'utf8');
  const rpc = source.indexOf("p_action:'complete'");
  const guard = source.indexOf("if(!error && result?.new_completion)");
  const show = source.indexOf("await showBuklodAdOpportunity('kl_chapter_success')");
  assert.ok(rpc > 0 && guard > rpc && show > guard);
  assert.match(source, /result\?\.completed===false/);
  assert.doesNotMatch(source, /claimBuklodRewardGroup\(|grant.*point/i);
});
