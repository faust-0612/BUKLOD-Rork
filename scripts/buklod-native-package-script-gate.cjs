'use strict';
/*
 * Immutable V28 native-package guard with exactly ONE approved extension:
 * the later compact UI source QA npm script (and inclusion in release:gate).
 *
 * No dependencies, peers, Expo config, lockfile, install hooks or other
 * package keys may drift without a newly signed native runtime/build.
 */
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const V28_PINNED_PACKAGE_BLOB='44a9a945bd21449d3d3e24ee0d5905dc022280e0';
const APPROVED_COMPACT_SCRIPT='node scripts/compact-layout-gate.mjs';
const APPROVED_GATE='npm run character:contract && npm run game:contract && npm run compact:contract && npm run release:base-gate';
const V28_GATE='npm run character:contract && npm run game:contract && npm run release:base-gate';
function gitBlobSha(text){
  return createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
}
function canonicalPinnedNativePackageText(currentText){
  const current=JSON.parse(currentText);
  assert.equal(current?.scripts?.['compact:contract'],APPROVED_COMPACT_SCRIPT,
    'Only exact compact source QA script is permitted without a native build');
  assert.equal(current?.scripts?.['release:gate'],APPROVED_GATE,
    'Compact source QA must remain in complete release gate');
  const nativePackage=JSON.parse(currentText);
  delete nativePackage.scripts['compact:contract'];
  nativePackage.scripts['release:gate']=V28_GATE;
  const pinnedText=JSON.stringify(nativePackage,null,2)+'\n';
  assert.equal(gitBlobSha(pinnedText),V28_PINNED_PACKAGE_BLOB,
    'Unapproved package.json drift: dependency/runtime and scripts must match pinned V28');
  return pinnedText;
}
function assertApprovedCompactScriptOnly(currentText,pinnedText){
  assert.equal(canonicalPinnedNativePackageText(currentText),pinnedText,
    'Current native package may differ from pinned source only by exact compact QA scripts');
  return true;
}
module.exports={
  V28_PINNED_PACKAGE_BLOB,APPROVED_COMPACT_SCRIPT,APPROVED_GATE,
  gitBlobSha,canonicalPinnedNativePackageText,assertApprovedCompactScriptOnly,
};
