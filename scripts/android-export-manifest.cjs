const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(process.argv[2]);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile()) files.push({ path: path.relative(root, file).split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
    else throw new Error('Unexpected non-regular export entry');
  }
}
walk(root);
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
if (!files.length || !fs.existsSync(path.join(root, 'metadata.json'))) throw new Error('Incomplete Android export');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
if (!metadata.fileMetadata?.android || metadata.fileMetadata?.ios || metadata.fileMetadata?.web) throw new Error('Export must contain Android only');
console.log(JSON.stringify({ sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), platform:'android', runtime:'1.3.2', files }, null, 2));
