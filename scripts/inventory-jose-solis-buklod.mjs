#!/usr/bin/env node
/**
 * BUKLOD JOSE SOLIS -- READ-ONLY LOCAL DISCOVERY
 * No GitHub changes, deletion, Git pushes, or secret uploads.
 * Requires Node.js 18+ and (optionally) Git.
 *
 * Usage:
 *   node scripts/inventory-jose-solis-buklod.mjs
 *   node scripts/inventory-jose-solis-buklod.mjs --root "D:\OTHER_BUKLOD" --out "D:\report.json"
 *
 * Treat report as PRIVATE: paths and filenames can reveal personal information.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const explicitRoots = [];
let output = path.join(os.tmpdir(), 'buklod-jose-solis-inventory-' + new Date().toISOString().slice(0, 10) + '.json');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root' && args[i + 1]) explicitRoots.push(args[++i]);
  else if (args[i] === '--out' && args[i + 1]) output = args[++i];
  else if (args[i] === '--help') {
    console.log('Usage: node scripts/inventory-jose-solis-buklod.mjs [--root PATH]... [--out PATH]');
    process.exit(0);
  } else throw new Error('Unknown or incomplete argument: ' + args[i]);
}

const user = process.env.USERPROFILE || os.homedir();
const knownPaths = [
  path.join(user, 'BUKLOD_WORKSPACE'),
  path.join(user, 'Desktop', 'BuklodConnect'),
  path.join(user, 'Downloads', 'BUKLOD_Classroom_Standalone'),
  path.join(user, 'Downloads', 'BUKLOD_Quiz_Standalone'),
  path.join(user, 'OneDrive', 'Documents', 'ChatGPT', 'BUKLOD_Quiz_Standalone'),
  path.join(user, 'Downloads', 'BUKLOD_Production_Starter_v16'),
  'C:\\BUKLODQ_BUILD', 'C:\\BUKLODQ_BUILD_R126', 'C:\\BUKLODQ_R10_BUILD',
  'C:\\BUKLOD_V26_LOCAL_AAB', 'D:\\BUKLOD_V27_CLEAN_NO_PTT',
  'D:\\BUKLOD_V26_LOCAL_AAB_BACKUP.zip', 'D:\\Downloads\\BUKLOD_WORKSPACE'
];
const namePattern = /buklod|buklodq|rork|bsoc|kabihasnang|r31_r40/i;
const discoverySkip = new Set([
  'appdata', 'windows', 'program files', 'program files (x86)', 'programdata',
  'system volume information', '$recycle.bin', 'node_modules', '.git',
  '.gradle', '.expo', '.next', '.cache', 'build', 'dist', 'coverage', 'vendor'
]);
const regenerable = new Set([
  'node_modules', '.expo', '.gradle', '.next', '.cache', 'coverage',
  '__pycache__', '.turbo', '.parcel-cache'
]);
const dangerousName = /(^|[\\/])\.env($|[.\\\/])|service.?account|firebase.?adminsdk|credentials(\.json)?$|secret|private.?key|\.pem$|\.p12$|\.pfx$|\.jks$|\.keystore$|google-services.*\.json$/i;
const personalName = /(^|[\\/])(students?|patients?|members?|roster|grades?|attendance.?export|user.?export|production.?dump|db.?dump)([\\/._-]|$)/i;
const personalExt = /\.(csv|xlsx?|sqlite3?|db|dump|bak|mdb|accdb)$/i;
const binaryExt = /\.(apk|aab|ipa|zip|7z|rar|tar|tgz|gz|bundle|exe|msi|dmg|iso)$/i;
const errors = [], omittedGenerated = [], symlinks = [], gitRoots = new Set(), discovered = new Set();
const exists = p => { try { fs.lstatSync(p); return true; } catch { return false; } };
const canonical = p => path.resolve(p).replace(/[\\/]+$/, '');
const cleanPath = p => process.platform === 'win32' ? canonical(p).toLowerCase() : canonical(p);

function discover(base, maxDepth) {
  if (!exists(base)) return;
  const queue = [{ dir: base, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    if (namePattern.test(path.basename(dir))) { discovered.add(canonical(dir)); continue; }
    if (depth >= maxDepth) continue;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { errors.push({ path: dir, stage: 'discovery', error: e.code || e.message }); continue; }
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink() || discoverySkip.has(e.name.toLowerCase())) continue;
      queue.push({ dir: path.join(dir, e.name), depth: depth + 1 });
    }
  }
}

for (const candidate of knownPaths.concat(explicitRoots)) if (exists(candidate)) discovered.add(canonical(candidate));
for (const [base, depth] of [
  [user, 5], [path.join(user, 'OneDrive'), 5], [path.join(user, 'Downloads'), 3],
  [path.join(user, 'Desktop'), 3], ['C:\\', 2], ['D:\\', 3],
  ['D:\\Downloads', 5]
]) discover(base, depth);

const sortRoot = (a, b) => a.length - b.length || a.localeCompare(b);
const found = [...discovered].sort(sortRoot);
const roots = found.filter((r, i) =>
  !found.slice(0, i).some(a => cleanPath(r) === cleanPath(a) || cleanPath(r).startsWith(cleanPath(a) + path.sep))
);
const files = [];
const counts = { source: 0, sensitive: 0, private_review: 0, release_archive: 0, generated_folders: 0, symlinks: 0 };
function classify(p) {
  if (dangerousName.test(p)) return 'sensitive';
  if (personalName.test(p) || personalExt.test(p)) return 'private_review';
  if (binaryExt.test(p)) return 'release_archive';
  return 'source';
}
async function hashFile(p) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(p);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
async function inventory(root) {
  const stack = [root];
  while (stack.length) {
    const p = stack.pop();
    let stat;
    try { stat = await fsp.lstat(p); }
    catch (e) { errors.push({ path: p, stage: 'stat', error: e.code || e.message }); continue; }
    if (stat.isSymbolicLink()) {
      symlinks.push(p); counts.symlinks++; continue;
    }
    if (stat.isDirectory()) {
      if (path.basename(p).toLowerCase() === '.git') {
        gitRoots.add(path.dirname(p));
        omittedGenerated.push({ path: p, reason: 'Git metadata: inspect and preserve full refs via verified bundle' });
        continue;
      }
      if (p !== root && regenerable.has(path.basename(p).toLowerCase())) {
        omittedGenerated.push({ path: p, reason: 'regenerable, not included in byte-for-byte file manifest' });
        counts.generated_folders++;
        continue;
      }
      let entries;
      try { entries = await fsp.readdir(p); }
      catch (e) { errors.push({ path: p, stage: 'readdir', error: e.code || e.message }); continue; }
      for (const e of entries) stack.push(path.join(p, e));
    } else if (stat.isFile()) {
      if (path.basename(p).toLowerCase() === '.git') gitRoots.add(path.dirname(p));
      const category = classify(p);
      const record = { root, path: p, size: stat.size, modifiedUtc: stat.mtime.toISOString(), category };
      try { record.sha256 = await hashFile(p); }
      catch (e) { errors.push({ path: p, stage: 'sha256', error: e.code || e.message }); record.sha256 = null; }
      files.push(record); counts[category]++;
    } else errors.push({ path: p, stage: 'type', error: 'unhandled filesystem object' });
  }
}
for (const root of roots) await inventory(root);

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 25000, maxBuffer: 20 * 1024 * 1024 }).trim();
  } catch (e) {
    errors.push({ path: root, stage: 'git ' + args.join(' '), error: (e.code || e.message || 'failed').toString().slice(0, 250) });
    return null;
  }
}
const repositories = [];
for (const root of [...gitRoots].sort()) {
  const head = git(root, ['rev-parse', 'HEAD']);
  const branch = git(root, ['branch', '--show-current']);
  const refText = git(root, ['for-each-ref', '--format=%(refname) %(objectname)']);
  const status = git(root, ['status', '--porcelain=v1', '--untracked-files=normal']);
  const remotes = git(root, ['remote', '-v']);
  const stashes = git(root, ['stash', 'list', '--format=%gd %H']);
  const worktrees = git(root, ['worktree', 'list', '--porcelain']);
  repositories.push({
    root, head, branch,
    refs: refText ? refText.split('\n').filter(Boolean) : null,
    dirtyEntries: status === null ? null : status ? status.split('\n').length : 0,
    stashes: stashes === null ? null : stashes ? stashes.split('\n') : [],
    worktrees: worktrees === null ? null : worktrees,
    remotes: remotes === null ? null : remotes.replace(/(https?:\/\/)[^@\s/]+@/g, '$1[REDACTED]@'),
    gitBundleRequired: true
  });
}
const report = {
  format: 'buklod-local-inventory-v1',
  createdUtc: new Date().toISOString(),
  machine: os.hostname(),
  scope: 'read-only partial discovery; NOT a complete disk image or verified cloud backup',
  detectedRoots: roots,
  missingHistoricalPaths: knownPaths.filter(p => !exists(p)),
  counts, discoveredProjectPaths: found,
  gitRepositories: repositories,
  files, generatedFoldersNotHashed: omittedGenerated,
  symlinksNotFollowed: symlinks, errors,
  remoteVerified: false, transferCompleted: false, safeToDeleteLocal: false
};
await fsp.mkdir(path.dirname(path.resolve(output)), { recursive: true });
await fsp.writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log('BUKLOD inventory saved (PRIVATE): ' + path.resolve(output));
console.log(JSON.stringify({
  roots: roots.length, gitRepos: repositories.length, filesHashed: files.filter(f => f.sha256).length,
  categories: counts, errors: errors.length, omittedGeneratedFolders: omittedGenerated.length,
  symlinks: symlinks.length, safeToDeleteLocal: false
}, null, 2));
if (errors.length) process.exitCode = 2;
