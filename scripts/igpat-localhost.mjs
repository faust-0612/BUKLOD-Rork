import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const REQUIRED = [
  'src/app/igpat/index.tsx',
  'src/app/igpat/create.tsx',
  'src/app/igpat/arena.tsx',
  'src/components/igpat/IgpatExperience.tsx',
  'src/components/igpat/IgpatQuickEditPanel.tsx',
  'src/lib/igpat/igpatRuntime.ts',
  'src/lib/igpat/igpatArena.ts',
  'src/lib/igpat/igpatMetadata.ts',
  'src/lib/igpat/uploadIgpatVideoFile.ts',
  'src/lib/igpat/uploadIgpatVideoFile.web.ts',
];

function run(label, command, args, options = {}) {
  console.log(`\n[IGPAT LOCAL] ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    console.error(`\n[IGPAT LOCAL] FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const missing = REQUIRED.filter(path => !existsSync(path));
if (missing.length) {
  console.error('[IGPAT LOCAL] Missing required R7 files:');
  for (const path of missing) console.error(` - ${path}`);
  process.exit(1);
}

if (!existsSync('node_modules')) {
  console.error('[IGPAT LOCAL] node_modules is missing. Run npm ci --ignore-scripts first.');
  process.exit(1);
}

run('TypeScript check', 'npx', ['tsc', '--noEmit']);
run('Web export smoke test', 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-local']);

console.log('\n[IGPAT LOCAL] Preflight passed. Starting local Expo web host only; no production deploy will run.');
console.log('[IGPAT LOCAL] Open the URL printed by Expo, then verify /igpat, /igpat/create, and /igpat/arena.\n');

const serve = spawnSync('npx', ['expo', 'start', '--web', '--localhost', '--clear'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(serve.status ?? 0);
