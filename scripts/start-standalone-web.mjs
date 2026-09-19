import { spawnSync } from 'node:child_process';

const target = String(process.argv[2] ?? '').trim().toLowerCase();
if (target !== 'home' && target !== 'kingdom') {
  console.error('Usage: node scripts/start-standalone-web.mjs <home|kingdom>');
  process.exit(2);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  BUKLOD_APP_TARGET: target,
  BUKLOD_WEB_OUTPUT: 'single',
  EXPO_NO_TELEMETRY: '1',
};

console.log(`BUKLOD_STANDALONE_TARGET=${target}`);

const result = spawnSync(
  command,
  ['expo', 'start', '--web'],
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
