import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const read = (rel) => {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required Kingdom native file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
};

const pkg = JSON.parse(read('package.json') || '{}');
const deps = pkg.dependencies || {};
const requiredDependencies = [
  '@shopify/react-native-skia',
  'react-native-reanimated',
  'react-native-gesture-handler',
  '@rive-app/react-native',
  'lottie-react-native',
  'expo-image',
  'expo-linear-gradient',
  'expo-blur',
  'expo-audio',
  'expo-haptics',
  'react-native-svg',
];

for (const dep of requiredDependencies) {
  if (!deps[dep]) failures.push(`Missing native-quality dependency: ${dep}`);
}

const nativeStage = read('src/features/games/runtime/BuklodGameStage.native.tsx');
for (const token of ['@shopify/react-native-skia', 'BuklodGameChrome', 'BuklodGameVisualFX', 'setBuklodKingdomProgressOwner']) {
  if (!nativeStage.includes(token)) failures.push(`Native Game Stage missing: ${token}`);
}

const nativeFeedback = read('src/features/games/runtime/BuklodGameFeedback.native.ts');
for (const token of ['expo-audio', 'expo-haptics', 'createAudioPlayer', "case 'success'", "case 'failure'", "case 'unlock'"]) {
  if (!nativeFeedback.includes(token)) failures.push(`Native game feedback missing: ${token}`);
}

const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
for (const token of ['BuklodKingdomAtmosphere', 'BuklodKingdomAdminQa', 'useSafeAreaInsets', 'playBuklodGameFeedback']) {
  if (!map.includes(token)) failures.push(`Kingdom Map native readiness missing: ${token}`);
}

const adminQa = read('src/features/games/kingdom/BuklodKingdomAdminQa.tsx');
for (const token of ["hasRole('system_admin')", 'SYSTEM ADMIN QA', 'resetBuklodKingdomPreviewProgress']) {
  if (!adminQa.includes(token)) failures.push(`System Admin QA gate missing: ${token}`);
}

const chrome = read('src/features/games/runtime/BuklodGameChrome.tsx');
for (const token of ['MISSION COMPLETE', 'VIEW KINGDOM', 'KEEP PLAYING', 'KINGDOM XP']) {
  if (!chrome.includes(token)) failures.push(`Premium game result chrome missing: ${token}`);
}

console.log('BUKLOD KINGDOM NATIVE READINESS');
console.log('===============================');
for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nKINGDOM NATIVE READINESS FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}
console.log('\nKINGDOM NATIVE READINESS PASSED.');
