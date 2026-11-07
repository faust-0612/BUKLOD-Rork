#!/usr/bin/env node
'use strict';

/**
 * BUKLOD Quiz CLOUD-ONLY RESTORE VERIFIER R1.
 *
 * Clones the immutable private archive branch into an isolated temporary
 * directory, then validates all 636 original files against SHA-256 manifests.
 * Does NOT read your local BUKLOD project folders, write any DB data,
 * delete originals, or upload credentials.
 *
 * node scripts/verify-quiz-cloud-restore-r1.cjs
 * node scripts/verify-quiz-cloud-restore-r1.cjs --keep
 *
 * A pass proves exactly the two verified source snapshots can be re-fetched
 * from GitHub. It does NOT establish that the entire BUKLOD laptop inventory
 * is backed up, that Android signing keys are recoverable, or that the
 * app/Expo native/web build can be restored and published.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repo = 'https://github.com/faust-0612/BUKLOD-Migrated-Sources.git';
const branch = 'migration/quiz-canonical-source-20261107';
const commit = '9cef155f2378fc77a46e20325259e81136525e45';
const base = 'systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES';
const snapshots = [
  {
    dir: 'BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb',
    fingerprint: '04e596c8cfeb04bea54a618686d70ca1560628f06967a0bcc3510ad31b41a1f7',
    count: 300, bytes: 65058267,
  },
  {
    dir: 'BUKLODQ_BUILD_project_8374b517b993_481385774640',
    fingerprint: '481385774640c64813eafbb7c2451390541bbff3d63b55c9159da74fc835faad',
    count: 336, bytes: 75834778,
  },
];
const git = (cwd, args) => execFileSync('git', args, {
  cwd, encoding:'utf8', stdio: ['ignore','pipe','pipe'],
  timeout: 180000, maxBuffer: 4 * 1024 * 1024,
}).trim();

async function hashFile(file) {
  const sha = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) sha.update(chunk);
  return sha.digest('hex');
}
function safeRelative(value) {
  if (typeof value !== 'string' || !value.length ||
      value.startsWith('/') || value.includes('\\') ||
      value.split('/').some(s => !s || s === '.' || s === '..')) {
    throw new Error('Unsafe manifest relative path');
  }
  return value;
}

async function verifySnapshot(root, item) {
  const directory = path.join(root,base,item.dir);
  const manifestFile = path.join(directory,'QUIZ_RECOVERY_MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  assert.equal(manifest.kind,'BUKLOD_QUIZ_SOURCE_CANDIDATE');
  assert.equal(manifest.verified_for_release,false);
  assert.equal(manifest.file_count,item.count);
  assert.equal(manifest.total_bytes,item.bytes);
  assert.equal(manifest.file_manifest_sha256,item.fingerprint);
  assert.equal(manifest.files.length,item.count);

  const names = new Set();
  let bytes = 0;
  for(const entry of manifest.files) {
    const rel = safeRelative(entry.rel);
    if(names.has(rel))throw new Error('Duplicate manifest file path');
    names.add(rel);
    const file = path.join(directory,...rel.split('/'));
    const st = fs.lstatSync(file);
    assert.ok(st.isFile() && !st.isSymbolicLink(),'Expected regular file: '+rel);
    assert.equal(st.size,entry.bytes,'Size mismatch: '+rel);
    const actualHash = await hashFile(file);
    assert.equal(actualHash,entry.sha256,'SHA256 mismatch: '+rel);
    bytes += st.size;
  }
  assert.equal(bytes,item.bytes,'Byte count mismatch');
  console.log('SOURCE VERIFIED: '+item.dir+' files='+names.size+' bytes='+bytes);
  return { files: names.size, bytes };
}

async function main() {
  const args = process.argv.slice(2);
  if(args.length>1 || args.some(a=>a!=='--keep'))
    throw new Error('Usage: node verify-quiz-cloud-restore-r1.cjs [--keep]');
  const keep = args.includes('--keep');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'buklod-quiz-clean-restore-'));
  let succeeded = false;
  try {
    git(process.cwd(),[
      '-c','core.autocrlf=false','-c','core.safecrlf=true',
      'clone','--single-branch','--depth','1','--branch',branch,
      repo,dir
    ]);
    const hash = git(dir,['rev-parse','HEAD']);
    assert.equal(hash,commit,'Immutable archive head changed; re-audit before any deletion.');
    let all = { files:0, bytes:0 };
    for(const item of snapshots) {
      const verified = await verifySnapshot(dir,item);
      all.files += verified.files;
      all.bytes += verified.bytes;
    }
    assert.equal(all.files,636);
    assert.equal(all.bytes,140893045);
    succeeded = true;
    console.log('CLOUD-ONLY QUIZ RECOVERY VERIFIED: '+all.files+' files, '+all.bytes+' bytes, pinned commit '+commit);
    console.log('NOT A BLANKET LOCAL-DELETION CLEARANCE: separate assets, signing credentials, clean build, DB and second backup gates remain.');
  } finally {
    if(keep && succeeded)console.log('ISOLATED RESTORE RETAINED: '+dir);
    else fs.rmSync(dir,{recursive:true,force:true,maxRetries:2,retryDelay:100});
  }
}
main().catch(error=>{
  console.error('CLOUD RESTORE BLOCKED: '+String(error?.message||error));
  console.error('Original local BUKLOD folders were not touched.');
  process.exitCode=1;
});
