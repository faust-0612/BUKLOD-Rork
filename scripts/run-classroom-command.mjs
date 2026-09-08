import { spawnSync } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const npx = isWindows ? 'npx.cmd' : 'npx';
const node = process.execPath;

Object.assign(process.env, {
  BUKLOD_APP_TARGET: 'classroom',
  CLASSROOM_IDENTITY_REQUIRED: '1',
  APP_VARIANT: 'production',
  EXPO_PUBLIC_APP_ENV: 'production',
  EXPO_PUBLIC_SUPABASE_URL: 'https://yhanxndaqbmuzbdqlblu.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_RWvrYHzgLMvBousgwn4dTg_QawYzwRS',
  CLASSROOM_GOOGLE_SERVICES_FILE: './google-services.classroom.json',
});

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  if (process.exitCode !== 0) process.exit(process.exitCode);
}

run(node, ['scripts/assert-classroom-identity.mjs']);

const action = process.argv[2] || 'config';

if (action === 'config') {
  run(npx, ['expo', 'config', '--json']);
} else if (action === 'export-web') {
  run(npx, ['expo', 'export', '--platform', 'web']);
} else if (action === 'prebuild-android') {
  run(npx, ['expo', 'prebuild', '--platform', 'android', '--no-install']);
} else {
  throw new Error(`Unknown Classroom command: ${action}`);
}
