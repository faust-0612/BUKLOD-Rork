const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const file = path.resolve('src/app/(tabs)/home.tsx');
const backup = file + '.bak154k';

let t = fs.readFileSync(file, 'utf8');

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

/* PATCH 154K-A
   Tighten Daily Bible bottom spacing */
const s = t.indexOf('function HomeDailyBibleStrip()');
const e = t.indexOf('function HomeMissionBulletins()', s);

if (s >= 0 && e > s) {
  let block = t.slice(s, e);

  block = block
    .replace(
      /marginTop:\s*8,\s*marginBottom:\s*10,/,
      `marginTop: 6,
        marginBottom: 2,`
    )
    .replace(
      /minHeight:\s*64,/,
      'minHeight: 60,'
    )
    .replace(
      /paddingVertical:\s*9,/,
      'paddingVertical: 8,'
    );

  t = t.slice(0, s) + block + t.slice(e);
}

/* PATCH 154K-B
   Replace large SectionTitle spacing with compact
   Mission Bulletin heading */
t = t.replace(
  /<SectionTitle>\s*MISSION BULLETIN\s*<\/SectionTitle>/,
`{/* PATCH_154K_COMPACT_BULLETIN_HEADING */}
      <Text
        style={{
          marginTop: 3,
          marginBottom: 7,
          fontSize: 11,
          fontWeight: '900',
          letterSpacing: 0.8,
          color: colors.greenDark,
        }}
      >
        MISSION BULLETIN
      </Text>`
);

fs.writeFileSync(file, t, 'utf8');

console.log('');
console.log('PATCH 154K WRITTEN');
console.log('✓ Daily Bible card slightly shorter');
console.log('✓ Bottom gap reduced');
console.log('✓ Mission Bulletin moved visually upward');
console.log('');

const result = cp.spawnSync(
  path.resolve('node_modules/.bin/tsc.cmd'),
  ['--noEmit'],
  { stdio: 'inherit', shell: true }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('');
console.log('PATCH 154K - TYPESCRIPT PASS');
