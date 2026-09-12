import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_BRANCH = 'fix/continuous-use-stability-r1-20260912';
const HOME_PATH = path.join('src', 'app', '(tabs)', 'home.tsx');
const BIBLE_PATH = path.join('src', 'app', 'bible', 'index.tsx');
const ALLOWED_RUNTIME_FILES = [
  HOME_PATH.replaceAll('\\', '/'),
  BIBLE_PATH.replaceAll('\\', '/'),
];

function fail(message) {
  console.error(`\nFAIL: ${message}`);
  process.exit(1);
}

function run(command, args = [], options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.error) {
    fail(`${command} could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`${command} exited with code ${result.status}. Runtime edits were NOT committed.`);
  }
}

function capture(command, args = []) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed.`);
  }

  return String(result.stdout ?? '').trim();
}

function assertOnce(text, needle, label) {
  const first = text.indexOf(needle);
  if (first < 0) fail(`${label}: expected source marker not found.`);
  if (text.indexOf(needle, first + needle.length) >= 0) {
    fail(`${label}: source marker is not unique; refusing unsafe edit.`);
  }
  return first;
}

function replaceExactOnce(text, oldText, newText, label) {
  const pos = assertOnce(text, oldText, label);
  return text.slice(0, pos) + newText + text.slice(pos + oldText.length);
}

function patchHome(original) {
  let text = original;

  const spinnerPattern = /\{loading \? \(\s*<View style=\{\{ paddingVertical: 8, alignItems: 'center' \}\}>\s*<ActivityIndicator color=\{colors\.green\} \/>\s*<\/View>\s*\) : null\}/m;
  const spinnerMatches = text.match(new RegExp(spinnerPattern.source, 'gm')) ?? [];
  if (spinnerMatches.length !== 1) {
    fail(`Home loading spinner: expected exactly 1 match, found ${spinnerMatches.length}.`);
  }
  text = text.replace(
    spinnerPattern,
    "{/* CONTINUOUS_USE_STABILITY_R1: Home data refreshes quietly; no blocking spinner/layout jump. */}",
  );

  const pairStartMarker = 'function HomeDailyBayanihanPair({';
  const pairEndMarker = 'function HomeDailyBibleStrip()';
  const pairStart = assertOnce(text, pairStartMarker, 'HomeDailyBayanihanPair');
  const pairEnd = assertOnce(text, pairEndMarker, 'HomeDailyBibleStrip boundary');
  if (pairEnd <= pairStart) fail('Home Daily/Bayanihan function boundaries are invalid.');

  let beforePair = text.slice(0, pairStart);
  let pair = text.slice(pairStart, pairEnd);
  const afterPair = text.slice(pairEnd);

  const splitMarker = '  /* MY_BIBLE_HOME_SPLIT_V2 */';
  const splitPos = assertOnce(pair, splitMarker, 'MY_BIBLE_HOME_SPLIT_V2');
  const returnToken = '\n\n  return(';
  const returnPos = pair.indexOf(returnToken, splitPos + splitMarker.length);
  if (returnPos < 0) fail('HomeDailyBayanihanPair: return() boundary not found.');

  const removedLoader = pair.slice(splitPos + splitMarker.length, returnPos);
  if (!removedLoader.includes("get_automatic_bible_today")) {
    fail('HomeDailyBayanihanPair: expected Daily Bible mount RPC not found in removable loader block.');
  }
  if (!removedLoader.includes('readingLoading') || !removedLoader.includes('setReading')) {
    fail('HomeDailyBayanihanPair: expected reading loader state not found; refusing edit.');
  }

  pair =
    pair.slice(0, splitPos + splitMarker.length) +
    "\n  /* CONTINUOUS_USE_STABILITY_R1: no mount-time Daily Bible RPC here. */" +
    pair.slice(returnPos);

  const devotionStartMarker = '        {/* DAILY DEVOTION */}';
  const myBibleMarker = '        {/* MY BIBLE */}';
  const devotionStart = assertOnce(pair, devotionStartMarker, 'Daily Devotion duplicate tile start');
  const myBiblePos = assertOnce(pair, myBibleMarker, 'MY BIBLE tile boundary');
  if (myBiblePos <= devotionStart) fail('Daily Bible/MY BIBLE tile boundaries are invalid.');

  const oldTile = pair.slice(devotionStart, myBiblePos);
  if (!oldTile.includes("pathname: '/bible/read'")) {
    fail('Duplicate Home Daily tile no longer matches expected direct-reader behavior.');
  }
  if (!oldTile.includes('readingLoading')) {
    fail('Duplicate Home Daily tile no longer contains expected loading state.');
  }

  const newTile = `        {/* DAILY BIBLE — canonical landing doorway */}\n        <HomePressable\n          haptic={false}\n          wrapStyle={{\n            flex:1,\n            minHeight:44,\n          }}\n          onPress={() =>\n            router.push('/bible' as any)\n          }\n          accessibilityRole="button"\n          accessibilityLabel="Open Daily Bible"\n          style={({pressed})=>({\n            flex:1,\n            minHeight:44,\n            opacity:pressed ? 0.82 : 1\n          })}\n        >\n          <View\n            style={{\n              flex:1,\n              minHeight:44,\n              borderWidth:1,\n              borderColor:colors.line,\n              borderRadius:15,\n              backgroundColor:colors.white,\n              paddingHorizontal:9,\n              paddingVertical:7\n            }}\n          >\n            <View\n              style={{\n                flexDirection:'row',\n                alignItems:'center',\n                gap:5\n              }}\n            >\n              <MaterialCommunityIcons\n                name="book-open-page-variant-outline"\n                size={16}\n                color={colors.greenDark}\n              />\n\n              <Text\n                numberOfLines={1}\n                style={{\n                  flex:1,\n                  fontSize:9,\n                  fontWeight:'900',\n                  color:colors.greenDark,\n                  letterSpacing:.35\n                }}\n              >\n                DAILY BIBLE\n              </Text>\n            </View>\n\n            <Text\n              numberOfLines={1}\n              style={{\n                marginTop:4,\n                fontSize:11,\n                lineHeight:14,\n                fontWeight:'900',\n                color:colors.text\n              }}\n            >\n              Daily Bible Reading\n            </Text>\n\n            <Text\n              numberOfLines={2}\n              style={{\n                marginTop:2,\n                fontSize:8.5,\n                lineHeight:11,\n                color:colors.muted\n              }}\n            >\n              Choose a date, read Scripture, reflect, and complete.\n            </Text>\n          </View>\n        </HomePressable>\n\n\n`;

  pair = pair.slice(0, devotionStart) + newTile + pair.slice(myBiblePos);
  text = beforePair + pair + afterPair;

  const patchedPair = text.slice(pairStart, text.indexOf(pairEndMarker, pairStart));
  if (patchedPair.includes('get_automatic_bible_today')) {
    fail('HomeDailyBayanihanPair still calls get_automatic_bible_today after patch.');
  }
  if (patchedPair.includes('readingLoading')) {
    fail('HomeDailyBayanihanPair still contains readingLoading after patch.');
  }
  if (!patchedPair.includes('DAILY BIBLE')) {
    fail('Canonical DAILY BIBLE tile missing after patch.');
  }
  if (!patchedPair.includes("router.push('/bible' as any)")) {
    fail('Canonical DAILY BIBLE tile does not route to /bible landing.');
  }
  if (!patchedPair.includes('{/* MY BIBLE */}')) {
    fail('MY BIBLE tile was lost during patch.');
  }
  if (!patchedPair.includes('BUKLOD BAYANIHAN')) {
    fail('BUKLOD BAYANIHAN tile was lost during patch.');
  }

  return text;
}

function patchBible(original) {
  let text = original;
  const scriptureText = "TODAY'S SCRIPTURE";
  const scripturePos = assertOnce(text, scriptureText, "duplicate TODAY'S SCRIPTURE button");

  const pressableStart = text.lastIndexOf('<Pressable', scripturePos);
  const pressableEndStart = text.indexOf('</Pressable>', scripturePos);
  if (pressableStart < 0 || pressableEndStart < 0) {
    fail("Duplicate TODAY'S SCRIPTURE Pressable boundaries not found.");
  }
  const pressableEnd = pressableEndStart + '</Pressable>'.length;
  const duplicateBlock = text.slice(pressableStart, pressableEnd);

  for (const expected of [
    'onPress={openAssignedReading}',
    'styles.readBibleButton',
    'styles.readBibleEyebrow',
    "READ {selected.bible_reference}",
  ]) {
    if (!duplicateBlock.includes(expected)) {
      fail(`Duplicate TODAY'S SCRIPTURE block missing expected marker: ${expected}`);
    }
  }

  text =
    text.slice(0, pressableStart) +
    '{/* CONTINUOUS_USE_STABILITY_R1: duplicate TODAY\'S SCRIPTURE doorway removed. Use the selected-reference OPEN IN BIBLE action above. */}' +
    text.slice(pressableEnd);

  if (text.includes(scriptureText)) {
    fail("TODAY'S SCRIPTURE rendered label still exists after patch.");
  }
  if (!text.includes('OPEN IN BIBLE')) {
    fail('Canonical OPEN IN BIBLE action was lost during duplicate removal.');
  }

  const openAssignedCount = (text.match(/onPress=\{openAssignedReading\}/g) ?? []).length;
  if (openAssignedCount !== 1) {
    fail(`Expected exactly 1 rendered openAssignedReading action after patch; found ${openAssignedCount}.`);
  }

  return text;
}

const root = process.cwd();
if (!fs.existsSync(path.join(root, 'package.json'))) {
  fail('Run this script from the BUKLOD-MAIN repository root.');
}

const branch = capture('git', ['branch', '--show-current']);
if (branch !== EXPECTED_BRANCH) {
  fail(`Expected branch ${EXPECTED_BRANCH}, found ${branch || '(detached)'}.`);
}

const statusBefore = capture('git', ['status', '--porcelain']);
if (statusBefore) {
  fail('Working tree is not clean. Commit/stash unrelated work before running this guarded patcher.');
}

const homeFile = path.join(root, HOME_PATH);
const bibleFile = path.join(root, BIBLE_PATH);
if (!fs.existsSync(homeFile) || !fs.existsSync(bibleFile)) {
  fail('Expected Home/Bible runtime files are missing.');
}

const homeOriginal = fs.readFileSync(homeFile, 'utf8');
const bibleOriginal = fs.readFileSync(bibleFile, 'utf8');
const homePatched = patchHome(homeOriginal);
const biblePatched = patchBible(bibleOriginal);

if (homePatched === homeOriginal) fail('Home patch produced no change.');
if (biblePatched === bibleOriginal) fail('Bible patch produced no change.');

fs.writeFileSync(homeFile, homePatched, 'utf8');
fs.writeFileSync(bibleFile, biblePatched, 'utf8');

const changed = capture('git', ['diff', '--name-only'])
  .split(/\r?\n/)
  .map((value) => value.trim().replaceAll('\\', '/'))
  .filter(Boolean)
  .sort();
const expected = [...ALLOWED_RUNTIME_FILES].sort();
if (JSON.stringify(changed) !== JSON.stringify(expected)) {
  fail(`Unexpected changed files: ${changed.join(', ') || '(none)'}`);
}

run('git', ['diff', '--check']);
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit']);
run('npm', ['run', 'game:contract']);

run('git', ['add', '--', HOME_PATH, BIBLE_PATH]);
run('git', ['commit', '-m', 'fix(stability): remove duplicate daily door and loading churn']);
run('git', ['push', '-u', 'origin', EXPECTED_BRANCH]);

console.log('\nPASS: continuous-use stability runtime patch committed and pushed.');
console.log('Changed runtime files only:');
for (const file of ALLOWED_RUNTIME_FILES) console.log(`- ${file}`);
console.log('No native files or native dependencies were changed.');
