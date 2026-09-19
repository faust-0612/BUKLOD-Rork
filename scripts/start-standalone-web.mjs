import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = String(process.argv[2] ?? '').trim().toLowerCase();
if (target !== 'home' && target !== 'kingdom') {
  console.error('Usage: node scripts/start-standalone-web.mjs <home|kingdom>');
  process.exit(2);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expoCli = resolve(repoRoot, 'node_modules', 'expo', 'bin', 'cli');

if (!existsSync(expoCli)) {
  console.error(`Expo CLI not found at ${expoCli}. Run npm ci first.`);
  process.exit(1);
}

const env = {
  ...process.env,
  BUKLOD_APP_TARGET: target,
  BUKLOD_WEB_OUTPUT: 'single',
  EXPO_NO_TELEMETRY: '1',
};

console.log(`BUKLOD_STANDALONE_TARGET=${target}`);
console.log(`BUKLOD_EXPO_CLI=${expoCli}`);

const result = spawnSync(
  process.execPath,
  [expoCli, 'start', '--web'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
