import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const failures = [];

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    failures.push(`Missing Main release scope file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

console.log('BUKLOD MAIN RELEASE SCOPE CONTRACT');
console.log('==================================');

const gamesIndex = read('src/app/games/index.tsx');
const excludedRedirect = read(
  'src/components/BuklodMainExcludedSurfaceRedirect.tsx',
);
const profileFocus = read(
  'src/components/BuklodFoundationWorkspaceNav.tsx',
);
const homeShortcut = read(
  'src/components/BuklodPublicWordShortcut.tsx',
);

if (
  !gamesIndex.includes(
    'BuklodMainExcludedSurfaceRedirect',
  )
) {
  failures.push(
    'Main /games route is not redirected through the excluded-surface guard.',
  );
}

if (
  !excludedRedirect.includes(
    'KINGDOM and IGPAT are outside this BUKLOD MAIN release',
  )
) {
  failures.push(
    'Main excluded-surface contract marker is missing.',
  );
}

for (const [rel, text] of [
  ['src/components/BuklodFoundationWorkspaceNav.tsx', profileFocus],
  ['src/components/BuklodPublicWordShortcut.tsx', homeShortcut],
]) {
  if (
    text.includes('title="BUKLOD Kingdom"') ||
    text.includes("router.push('/games'") ||
    text.includes("router.replace('/games'")
  ) {
    failures.push(
      `${rel} reintroduced the excluded BUKLOD Kingdom door into Main.`,
    );
  }
}

for (const failure of failures) {
  console.error(`FAIL: ${failure}`);
}

if (failures.length) {
  console.error(
    `\nMAIN RELEASE SCOPE LOCK FAILED with ${failures.length} blocker(s).`,
  );
  console.error(
    'DEPLOYMENT MUST STOP. Keep Kingdom excluded from the current BUKLOD Main release.',
  );
  process.exit(1);
}

console.log(
  '\nMAIN RELEASE SCOPE LOCK PASSED — Kingdom remains excluded from current Main while dedicated game source stays preserved.',
);
