import fs from 'node:fs';
import crypto from 'node:crypto';

const dir = new URL('../supabase/migrations/', import.meta.url);
const files = fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort();

if (files.length !== 44) {
  console.error(`Expected 44 migrations, found ${files.length}`);
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

