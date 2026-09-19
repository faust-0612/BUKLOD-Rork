import { spawnSync } from 'node:child_process';

const target = String(process.argv[2] ?? '').trim().toLowerCase();
if (target !== 'home' && target !== 'kingdom') {
  console.error('Usage: node scripts/export-standalone-web.mjs <home|kingdom>');
  process.exit(2);
}

const outputDir =
  String(process.argv[3] ?? '').trim() || `dist-${target}`;

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  BUKLOD_APP_TARGET: target,
  BUKLOD_WEB_OUTPUT: 'single',
  EXPO_NO_TELEMETRY: '1',
};

console.log(`BUKLOD_STANDALONE_TARGET=${target}`);
console.log(`BUKLOD_STANDALONE_OUTPUT=${outputDir}`);

const result = spawnSync(
  command,
  ['expo', 'export', '--platform', 'web', '--output-dir', outputDir],
  {
    stdio: 'inherit',
    env,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
