import fs from 'node:fs';
import crypto from 'node:crypto';

const dir = new URL('../supabase/migrations/', import.meta.url);
const files = fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort();

if (files.length === 0) {
  console.error('No migrations found.');
  process.exit(1);
}

const versions = files.map(name => name.match(/^(\d{14})_/)?.[1] ?? '');
const duplicateVersions = versions.filter(
  (version, index) => version && versions.indexOf(version) !== index
);

if (versions.some(version => !version)) {
  console.error('Every migration filename must begin with a 14-digit timestamp.');
  process.exit(1);
}

if (duplicateVersions.length) {
  console.error(
    `Duplicate migration versions: ${[...new Set(duplicateVersions)].join(', ')}`
  );
  process.exit(1);
}

const rows = files.map(name => {
  const body = fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url));
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  return { name, sha256, bytes: body.length };
});

console.log(JSON.stringify({
  migration_count: rows.length,
  migrations: rows,
}, null, 2));

