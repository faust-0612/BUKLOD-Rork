import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

function collect(node, out = new Map()) {
  if (!node || typeof node !== 'object') return out;
  const deps = node.dependencies && typeof node.dependencies === 'object' ? node.dependencies : {};
  for (const [name, meta] of Object.entries(deps)) {
    if (!meta || typeof meta !== 'object') continue;
    const version = typeof meta.version === 'string' ? meta.version : '';
    if (version) {
      if (!out.has(name)) out.set(name, new Set());
      out.get(name).add(version);
    }
    collect(meta, out);
  }
  return out;
}

let tree;
try {
  const raw = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ls', '--omit=dev', '--all', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  tree = JSON.parse(raw);
} catch (error) {
  const stdout = error?.stdout ? String(error.stdout) : '';
  const stderr = error?.stderr ? String(error.stderr) : '';
  throw new Error('Production dependency tree validation failed before advisory lookup.\n' + stdout + '\n' + stderr);
}

const versions = collect(tree);
const payload = Object.fromEntries(
  [...versions.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([name,set]) => [name, [...set].sort()])
);

if (!Object.keys(payload).length) {
  throw new Error('Production dependency tree was unexpectedly empty.');
}

async function fetchBulk(attempt) {
  const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'accept-encoding': 'identity',
      'user-agent': 'buklod-quickcheck-security-audit/1.0',
    },
    body: JSON.stringify(payload),
  });

  const bytes = Buffer.from(await response.arrayBuffer());
  let decoded = bytes;
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    decoded = gunzipSync(bytes);
  }
  const text = decoded.toString('utf8');

  if (!response.ok) {
    throw new Error('Bulk advisory endpoint HTTP ' + response.status + ': ' + text.slice(0, 1000));
  }

  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Bulk advisory endpoint returned invalid JSON: ' + text.slice(0, 1000));
  }
}

let report;
let lastError;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    report = await fetchBulk(attempt);
    break;
  } catch (error) {
    lastError = error;
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
if (!report) throw lastError || new Error('Bulk advisory lookup failed.');

const advisories = [];
for (const [pkg, items] of Object.entries(report)) {
  if (!Array.isArray(items)) continue;
  for (const item of items) advisories.push({ package: pkg, ...item });
}

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const blocking = advisories.filter(a => (severityRank[String(a.severity || '').toLowerCase()] ?? 0) >= 3);

console.log(JSON.stringify({
  audited_packages: Object.keys(payload).length,
  advisory_count: advisories.length,
  blocking_high_or_critical: blocking.length,
}, null, 2));

if (advisories.length) {
  for (const a of advisories) {
    console.log(`${String(a.severity || 'unknown').toUpperCase()} ${a.package}: ${a.title || 'advisory'} ${a.url || ''}`);
  }
}

if (blocking.length) {
  throw new Error('Production security audit blocked by high/critical advisories.');
}

console.log('QUICKCHECK_PRODUCTION_SECURITY_AUDIT_PASS');
