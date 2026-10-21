#!/usr/bin/env node
// Verification/export tooling only. Never builds native code or publishes updates.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function runHermes(args) {
  const input = args.find(arg => path.isAbsolute(arg) && arg.endsWith('/index.js'));
  if (!input || !fs.statSync(input).isFile()) throw new Error('Expected Expo temporary index.js input');
  // Hermes embeds its input filename in debug metadata. Expo passes a random
  // absolute temp path. Retain the same bytes and flags, using only the basename.
  const result = spawnSync(process.env.BUKLOD_REAL_HERMESC, args.map(arg => arg === input ? 'index.js' : arg), {
    cwd: path.dirname(input), stdio: 'inherit', timeout: 120000, killSignal: 'SIGKILL',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

function exportAndroid(output) {
  if (!output) throw new Error('Usage: node scripts/export-v28-reproducible.cjs OUTPUT_DIRECTORY');
  const platform = { linux: 'linux64-bin', darwin: 'osx-bin', win32: 'win64-bin' }[process.platform];
  if (!platform || process.platform === 'win32') throw new Error('This verified wrapper supports Linux/macOS only');
  const compilerRoot = path.dirname(require.resolve('hermes-compiler/package.json', { paths: [root] }));
  const real = path.join(compilerRoot, 'hermesc', platform, 'hermesc');
  const override = fs.mkdtempSync(path.join(os.tmpdir(), 'buklod-v28-hermes-'));
  try {
    const bin = path.join(override, 'build', 'bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'hermesc'), `#!/usr/bin/env node\nrequire(${JSON.stringify(__filename)}).runHermes(process.argv.slice(2));\n`, { mode: 0o700 });
    const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--platform', 'android', '--output-dir', path.resolve(root, output)], {
      cwd: root, stdio: 'inherit', timeout: 180000, killSignal: 'SIGKILL',
      env: { ...process.env, REACT_NATIVE_OVERRIDE_HERMES_DIR: override, BUKLOD_REAL_HERMESC: real },
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(override, { recursive: true, force: true });
  }
}

module.exports = { runHermes };
if (require.main === module) {
  if (process.argv[2] === '--hermes') runHermes(process.argv.slice(3));
  else exportAndroid(process.argv[2]);
}
