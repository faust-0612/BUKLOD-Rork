import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_BRANCH = 'fix/continuous-use-stability-r1-20260912';
const HOME_PATH = path.join('src', 'app', '(tabs)', 'home.tsx');
const BIBLE_PATH = path.join('src', 'app', 'bible', 'index.tsx');
const ALLOWED_RUNTIME_FILES = [
  HOME_PATH.replaceAll('\\', '/'),
  BIBLE_PATH.replaceAll('\\', '/'),
].sort();

function stop(message) {
  throw new Error(message);
}

function spawn(command, args = [], { stdio = 'inherit', encoding } = {}) {
  const isGit = command === 'git';
  const result = spawnSync(command, args, {
    stdio,
    encoding,
    // IMPORTANT: git argument arrays must bypass cmd.exe on Windows so a
    // commit message remains ONE argument. npm.cmd/npx.cmd still need shell.
    shell: process.platform === 'win32' && !isGit,
  });

  if (result.error) {
    stop(`${command} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    stop(`${command} exited with code ${result.status}.`);
  }
  return result;
}

function capture(command, args = []) {
  const result = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  return String(result.stdout ?? '').trim();
}

function run(command, args = []) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  spawn(command, args);
}

function runGit(args = []) {
  console.log(`\n> git ${args.join(' ')}`);
  spawn('git', args);
}

function indexOnce(text, needle, label) {
  const first = text.indexOf(needle);
  if (first < 0) stop(`${label}: expected source marker not found.`);
  if (text.indexOf(needle, first + needle.length) >= 0) {
    stop(`${label}: expected marker is not unique.`);
  }
  return first;
}

function patchHome(original) {
  let text = original;

  const spinnerPattern = /\{loading \? \(\s*<View style=\{\{ paddingVertical: 8, alignItems: 'center' \}\}>\s*<ActivityIndicator color=\{colors\.green\} \/>\s*<\/View>\s*\) : null\}/m;
  const spinnerMatches = text.match(new RegExp(spinnerPattern.source, 'gm')) ?? [];
  if (spinnerMatches.length !== 1) {
    stop(`Home loading spinner: expected 1 match, found ${spinnerMatches.length}.`);
  }
  text = text.replace(
    spinnerPattern,
    "{/* CONTINUOUS_USE_STABILITY_R1: Home refreshes quietly; no blocking spinner/layout jump. */}",
  );

  const pairStartMarker = 'function HomeDailyBayanihanPair({';
  const pairEndMarker = 'function HomeDailyBibleStrip()';
  const pairStart = indexOnce(text, pairStartMarker, 'HomeDailyBayanihanPair');
  const pairEnd = indexOnce(text, pairEndMarker, 'HomeDailyBibleStrip boundary');
  if (pairEnd <= pairStart) stop('Home Daily/Bayanihan function boundaries are invalid.');

  const beforePair = text.slice(0, pairStart);
  let pair = text.slice(pairStart, pairEnd);
  const afterPair = text.slice(pairEnd);

  const splitMarker = '  /* MY_BIBLE_HOME_SPLIT_V2 */';
  const splitPos = indexOnce(pair, splitMarker, 'MY_BIBLE_HOME_SPLIT_V2');

  const returnPattern = /\n  return\s*\(/g;
  returnPattern.lastIndex = splitPos + splitMarker.length;
  const returnMatch = returnPattern.exec(pair);
  if (!returnMatch) {
    stop('HomeDailyBayanihanPair: component return boundary not found.');
  }
  const returnPos = returnMatch.index;

  const loaderBlock = pair.slice(splitPos + splitMarker.length, returnPos);
  for (const marker of [
    'get_automatic_bible_today',
    'readingLoading',
    'setReading',
  ]) {
    if (!loaderBlock.includes(marker)) {
      stop(`HomeDailyBayanihanPair: expected loader marker missing: ${marker}`);
    }
  }

  pair =
    pair.slice(0, splitPos + splitMarker.length) +
    "\n  /* CONTINUOUS_USE_STABILITY_R1: no mount-time Daily Bible RPC here. */" +
    pair.slice(returnPos);

  const dailyStartMarker = '        {/* DAILY DEVOTION */}';
  const myBibleMarker = '        {/* MY BIBLE */}';
  const dailyStart = indexOnce(pair, dailyStartMarker, 'duplicate Home Daily tile');
  const myBiblePos = indexOnce(pair, myBibleMarker, 'MY BIBLE tile');
  if (myBiblePos <= dailyStart) stop('Home Daily/MY BIBLE tile boundaries are invalid.');

  const oldDailyTile = pair.slice(dailyStart, myBiblePos);
  for (const marker of [
    "pathname: '/bible/read'",
    'readingLoading',
    'DAILY DEVOTION',
  ]) {
    if (!oldDailyTile.includes(marker)) {
      stop(`Duplicate Home Daily tile no longer matches expected source: ${marker}`);
    }
  }

  const canonicalDailyTile = `        {/* DAILY BIBLE — canonical landing doorway */}\n        <HomePressable\n          haptic={false}\n          wrapStyle={{\n            flex:1,\n            minHeight:44,\n          }}\n          onPress={() => router.push('/bible' as any)}\n          accessibilityRole="button"\n          accessibilityLabel="Open Daily Bible"\n          style={({pressed})=>({\n            flex:1,\n            minHeight:44,\n            opacity:pressed ? 0.82 : 1\n          })}\n        >\n          <View\n            style={{\n              flex:1,\n              minHeight:44,\n              borderWidth:1,\n              borderColor:colors.line,\n              borderRadius:15,\n              backgroundColor:colors.white,\n              paddingHorizontal:9,\n              paddingVertical:7\n            }}\n          >\n            <View\n              style={{\n                flexDirection:'row',\n                alignItems:'center',\n                gap:5\n              }}\n            >\n              <MaterialCommunityIcons\n                name="book-open-page-variant-outline"\n                size={16}\n                color={colors.greenDark}\n              />\n              <Text\n                numberOfLines={1}\n                style={{\n                  flex:1,\n                  fontSize:9,\n                  fontWeight:'900',\n                  color:colors.greenDark,\n                  letterSpacing:.35\n                }}\n              >\n                DAILY BIBLE\n              </Text>\n            </View>\n\n            <Text\n              numberOfLines={1}\n              style={{\n                marginTop:4,\n                fontSize:11,\n                lineHeight:14,\n                fontWeight:'900',\n                color:colors.text\n              }}\n            >\n              Daily Bible Reading\n            </Text>\n\n            <Text\n              numberOfLines={2}\n              style={{\n                marginTop:2,\n                fontSize:8.5,\n                lineHeight:11,\n                color:colors.muted\n              }}\n            >\n              Choose a date, read Scripture, reflect, and complete.\n            </Text>\n          </View>\n        </HomePressable>\n\n\n`;

  pair = pair.slice(0, dailyStart) + canonicalDailyTile + pair.slice(myBiblePos);
  text = beforePair + pair + afterPair;

  const patchedPairEnd = text.indexOf(pairEndMarker, pairStart);
  const patchedPair = text.slice(pairStart, patchedPairEnd);
  for (const marker of [
    'get_automatic_bible_today',
    'readingLoading',
    "pathname: '/bible/read'",
  ]) {
    if (patchedPair.includes(marker)) {
      stop(`HomeDailyBayanihanPair still contains removed behavior: ${marker}`);
    }
  }

  for (const required of [
    'DAILY BIBLE',
    "router.push('/bible' as any)",
    '{/* MY BIBLE */}',
    'BUKLOD BAYANIHAN',
  ]) {
    if (!patchedPair.includes(required)) {
      stop(`HomeDailyBayanihanPair lost required behavior: ${required}`);
    }
  }

  return text;
}

function findScriptureReadButtonLabel(text) {
  const needle = "TODAY'S SCRIPTURE";
  const positions = [];
  let cursor = 0;
  while (true) {
    const pos = text.indexOf(needle, cursor);
    if (pos < 0) break;
    positions.push(pos);
    cursor = pos + needle.length;
  }

  const candidates = positions.filter((pos) =>
    text.slice(Math.max(0, pos - 180), pos).includes('styles.readBibleEyebrow')
  );

  if (candidates.length !== 1) {
    stop(`Bible duplicate doorway: expected 1 read-button label, found ${candidates.length}.`);
  }

  return candidates[0];
}

function patchBible(original) {
  let text = original;
  const scripturePos = findScriptureReadButtonLabel(text);

  const pressableStart = text.lastIndexOf('<Pressable', scripturePos);
  const pressableEndStart = text.indexOf('</Pressable>', scripturePos);
  if (pressableStart < 0 || pressableEndStart < 0) {
    stop("Duplicate TODAY'S SCRIPTURE Pressable boundaries not found.");
  }
  const pressableEnd = pressableEndStart + '</Pressable>'.length;
  const duplicateBlock = text.slice(pressableStart, pressableEnd);

  for (const marker of [
    'onPress={openAssignedReading}',
    'styles.readBibleButton',
    'styles.readBibleEyebrow',
    "TODAY'S SCRIPTURE",
    'READ {selected.bible_reference}',
  ]) {
    if (!duplicateBlock.includes(marker)) {
      stop(`Duplicate TODAY'S SCRIPTURE block missing expected marker: ${marker}`);
    }
  }

  text =
    text.slice(0, pressableStart) +
    "{/* CONTINUOUS_USE_STABILITY_R1: duplicate read doorway removed; selected reference OPEN IN BIBLE remains canonical. */}" +
    text.slice(pressableEnd);

  if (!text.includes('OPEN IN BIBLE')) {
    stop('Canonical OPEN IN BIBLE action was lost during duplicate removal.');
  }
  if (!text.includes("QUESTIONS ABOUT TODAY'S SCRIPTURE *")) {
    stop("Legitimate QUESTIONS ABOUT TODAY'S SCRIPTURE heading was lost.");
  }

  const remainingReadButtonLabels = [];
  const needle = "TODAY'S SCRIPTURE";
  let cursor = 0;
  while (true) {
    const pos = text.indexOf(needle, cursor);
    if (pos < 0) break;
    if (text.slice(Math.max(0, pos - 180), pos).includes('styles.readBibleEyebrow')) {
      remainingReadButtonLabels.push(pos);
    }
    cursor = pos + needle.length;
  }
  if (remainingReadButtonLabels.length !== 0) {
    stop("Duplicate TODAY'S SCRIPTURE read-button label still exists after patch.");
  }

  const openAssignedCount = (text.match(/onPress=\{openAssignedReading\}/g) ?? []).length;
  if (openAssignedCount !== 1) {
    stop(`Expected exactly 1 canonical openAssignedReading action after patch; found ${openAssignedCount}.`);
  }

  return text;
}

function restoreRuntimeAndIndex(homeOriginal, bibleOriginal) {
  try {
    fs.writeFileSync(HOME_PATH, homeOriginal, 'utf8');
    fs.writeFileSync(BIBLE_PATH, bibleOriginal, 'utf8');
  } catch (restoreError) {
    console.error(`ROLLBACK WARNING (files): ${restoreError?.message ?? restoreError}`);
  }

  try {
    // Reset ONLY the two runtime paths in the index; never touch unrelated work.
    spawnSync('git', ['reset', '--', HOME_PATH, BIBLE_PATH], {
      stdio: 'inherit',
      shell: false,
    });
  } catch (resetError) {
    console.error(`ROLLBACK WARNING (index): ${resetError?.message ?? resetError}`);
  }
}

let homeOriginal = null;
let bibleOriginal = null;
let wroteRuntimeFiles = false;
let committed = false;

try {
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, 'package.json'))) {
    stop('Run this script from the BUKLOD-MAIN repository root.');
  }

  const branch = capture('git', ['branch', '--show-current']);
  if (branch !== EXPECTED_BRANCH) {
    stop(`Expected branch ${EXPECTED_BRANCH}, found ${branch || '(detached)'}.`);
  }

  const statusBefore = capture('git', ['status', '--porcelain']);
  if (statusBefore) {
    stop('Working tree/index is not clean. Run the supplied recovery command before rerunning.');
  }

  const homeFile = path.join(root, HOME_PATH);
  const bibleFile = path.join(root, BIBLE_PATH);
  if (!fs.existsSync(homeFile) || !fs.existsSync(bibleFile)) {
    stop('Expected Home/Bible runtime files are missing.');
  }

  homeOriginal = fs.readFileSync(homeFile, 'utf8');
  bibleOriginal = fs.readFileSync(bibleFile, 'utf8');

  const homePatched = patchHome(homeOriginal);
  const biblePatched = patchBible(bibleOriginal);
  if (homePatched === homeOriginal) stop('Home patch produced no change.');
  if (biblePatched === bibleOriginal) stop('Bible patch produced no change.');

  fs.writeFileSync(homeFile, homePatched, 'utf8');
  fs.writeFileSync(bibleFile, biblePatched, 'utf8');
  wroteRuntimeFiles = true;

  const changed = capture('git', ['diff', '--name-only'])
    .split(/\r?\n/)
    .map((value) => value.trim().replaceAll('\\', '/'))
    .filter(Boolean)
    .sort();
  if (JSON.stringify(changed) !== JSON.stringify(ALLOWED_RUNTIME_FILES)) {
    stop(`Unexpected changed files: ${changed.join(', ') || '(none)'}`);
  }

  runGit(['diff', '--check']);
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit']);
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'game:contract']);

  runGit(['add', '--', HOME_PATH, BIBLE_PATH]);
  runGit(['commit', '-m', 'fix(stability): remove duplicate daily door and loading churn']);
  committed = true;

  runGit(['push', '-u', 'origin', EXPECTED_BRANCH]);

  console.log('\nPASS: continuous-use stability R1 V2 committed and pushed.');
  console.log('Verified runtime changes only:');
  for (const file of ALLOWED_RUNTIME_FILES) console.log(`- ${file}`);
  console.log('No native files, native config, or native dependencies changed.');
} catch (error) {
  console.error(`\nFAIL: ${error?.message ?? error}`);

  if (wroteRuntimeFiles && !committed && homeOriginal != null && bibleOriginal != null) {
    restoreRuntimeAndIndex(homeOriginal, bibleOriginal);
    console.error('ROLLBACK: restored Home/Bible runtime files AND unstaged those paths.');
  }

  process.exit(1);
}
