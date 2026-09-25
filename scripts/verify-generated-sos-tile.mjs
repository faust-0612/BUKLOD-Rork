import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidRoot = path.join(root, 'android');
const manifestPath = path.join(
  androidRoot,
  'app',
  'src',
  'main',
  'AndroidManifest.xml',
);
const drawablePath = path.join(
  androidRoot,
  'app',
  'src',
  'main',
  'res',
  'drawable',
  'buklod_sos_tile.xml',
);

const failures = [];

function requireFile(file, label) {
  if (!fs.existsSync(file)) {
    failures.push(`Missing generated ${label}: ${file}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.isFile() && entry.name === name) {
      return full;
    }
  }

  return null;
}

console.log('BUKLOD GENERATED SOS TILE NATIVE GATE');
console.log('=====================================');

const manifest = requireFile(
  manifestPath,
  'AndroidManifest.xml',
);

for (const marker of [
  'BuklodSosTileService',
  'android.permission.BIND_QUICK_SETTINGS_TILE',
  'android.service.quicksettings.action.QS_TILE',
  '@drawable/buklod_sos_tile',
]) {
  if (!manifest.includes(marker)) {
    failures.push(
      `Generated AndroidManifest.xml missing: ${marker}`,
    );
  }
}

const kotlinPath = findFile(
  path.join(
    androidRoot,
    'app',
    'src',
    'main',
    'java',
  ),
  'BuklodSosTileService.kt',
);

const kotlin = kotlinPath
  ? requireFile(kotlinPath, 'BuklodSosTileService.kt')
  : '';

if (!kotlinPath) {
  failures.push(
    'Generated BuklodSosTileService.kt was not found under android/app/src/main/java.',
  );
}

for (const marker of [
  'class BuklodSosTileService : TileService()',
  'buklod://buklod?sos=1',
  'unlockAndRun',
  'PendingIntent.getActivity',
  'Build.VERSION_CODES.UPSIDE_DOWN_CAKE',
  'startActivityAndCollapse',
]) {
  if (kotlin && !kotlin.includes(marker)) {
    failures.push(
      `Generated TileService missing: ${marker}`,
    );
  }
}

const drawable = requireFile(
  drawablePath,
  'buklod_sos_tile.xml',
);

if (
  drawable &&
  !drawable.includes('<vector')
) {
  failures.push(
    'Generated SOS tile icon is not an Android vector drawable.',
  );
}

if (failures.length) {
  console.error('');
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  console.error('');
  console.error('GENERATED SOS TILE NATIVE GATE FAILED.');
  process.exit(1);
}

console.log(
  `PASS: manifest service registered (${manifestPath})`,
);
console.log(
  `PASS: Kotlin TileService generated (${kotlinPath})`,
);
console.log(
  `PASS: Quick Settings permission/action present`,
);
console.log(
  `PASS: locked-device unlock flow + Android 14 PendingIntent path present`,
);
console.log(
  `PASS: tile icon generated (${drawablePath})`,
);
console.log('');
console.log('GENERATED SOS TILE NATIVE GATE PASSED.');
