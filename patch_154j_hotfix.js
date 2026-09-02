const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const file = path.resolve('src/app/(tabs)/home.tsx');
const backup = file + '.bak154j_hotfix';

let t = fs.readFileSync(file, 'utf8');

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

/* 1. FIX useRouter crash.
   home.tsx already imports router from expo-router. */
t = t.replace(
  /\s*const router\s*=\s*useRouter\(\);\s*/g,
  '\n'
);

/* 2. Remove Daily Bible from wrong/current position. */
t = t.replace(
  /\s*\{\/\*\s*PATCH_154J_HOME_DAILY_BIBLE_POSITION\s*\*\/\}\s*<HomeDailyBibleStrip\s*\/>\s*/g,
  '\n'
);

/* 3. Find the actual Home header row after EnvironmentBadge. */
const env = t.indexOf('<EnvironmentBadge />');

if (env < 0) {
  throw new Error('EnvironmentBadge anchor not found');
}

const rowStart = t.indexOf(
  '<View style={shared.row}>',
  env
);

if (rowStart < 0) {
  throw new Error('Home shared.row header not found');
}

/* Find matching closing </View> safely, including nested Views. */
const tokenRx = /<View\b[^>]*>|<\/View>/g;
tokenRx.lastIndex = rowStart;

let depth = 0;
let rowEnd = -1;
let m;

while ((m = tokenRx.exec(t))) {
  if (m[0].startsWith('</View')) {
    depth--;

    if (depth === 0) {
      rowEnd = tokenRx.lastIndex;
      break;
    }
  } else {
    depth++;
  }
}

if (rowEnd < 0) {
  throw new Error('Could not locate end of Home header row');
}

const daily = `

      {/* PATCH_154J_HOME_DAILY_BIBLE_POSITION */}
      <HomeDailyBibleStrip />
`;

t =
  t.slice(0, rowEnd) +
  daily +
  t.slice(rowEnd);

/* 4. Remove old DAILY DEVOTION copy if still present. */
t = t.replace(
  /\s*<SectionTitle>\s*DAILY DEVOTION\s*<\/SectionTitle>\s*<HomeDailyBibleReminder\s*\/>\s*/g,
  '\n'
);

/* 5. Ensure no useRouter reference remains. */
if (/\buseRouter\b/.test(t)) {
  throw new Error(
    'Unexpected useRouter reference remains in home.tsx'
  );
}

fs.writeFileSync(file, t, 'utf8');

console.log('');
console.log('PATCH 154J HOTFIX WRITTEN');
console.log('✓ useRouter crash removed');
console.log('✓ Existing Expo Router singleton retained');
console.log('✓ Daily Bible moved BELOW full Name/Rank header');
console.log('✓ Old Daily Devotion copy removed');
console.log('');

const tsc = path.resolve(
  'node_modules/.bin/tsc.cmd'
);

const result = cp.spawnSync(
  tsc,
  ['--noEmit'],
  {
    stdio: 'inherit',
    shell: true,
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('');
console.log('PATCH 154J HOTFIX - TYPESCRIPT PASS');
