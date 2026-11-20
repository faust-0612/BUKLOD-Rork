import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const scene = src('src/features/season2/genesis/GenesisCinematicStartup.tsx');
test('center logo, creation burst and complete Genesis copy as one native-screen-sized unit', () => {
  const marker = '<View pointerEvents="none" style={styles.composition}>\n            <View style={styles.centeredBrandGroup}>';
  assert.ok(scene.includes(marker), 'Only the full logo + title group should be centered');
  const start = scene.indexOf(marker);
  const end = scene.indexOf('          </View>\n        </Animated.View>', start);
  const group = scene.slice(start,end);
  for (const element of [
    '<View style={[styles.markFrame, { width: MARK_SIZE, height: MARK_SIZE }]}>',
    '<FirstLightBurst phase={reveal}/>',
    '<Image source={TRANSPARENT_GREEN_B}',
    '<Text style={styles.season}>BUKLOD · SEASON 2</Text>',
    '<Text style={styles.title}>{GENESIS_IDENTITY.title}</Text>',
    '<Text style={styles.verse}>',
  ]) assert.ok(group.includes(element), 'Missing centered element: ' + element);
  assert.ok(scene.includes("composition:{position:'absolute',top:0,left:0,width:LOCKED_SCREEN.width,height:LOCKED_SCREEN.height,alignItems:'center',justifyContent:'center'}"));
  assert.ok(scene.includes("centeredBrandGroup:{width:'100%',alignItems:'center',justifyContent:'center',paddingHorizontal:12}"));
  assert.ok(scene.includes("stage:{position:'absolute',top:0,left:0,zIndex:99999"));
});
test('keep timed single-shot cinematic, accessibility and chrome/biometric gate unchanged', () => {
  for (const token of [
    'useNativeDriver: true',
    'isReduceMotionEnabled()',
    "AppState.addEventListener('change'",
    'subscribeBuklodStartupChromeReady',
    'markBuklodStartupChromeReady',
    'SplashScreen.hideAsync()',
    'if (!splashGone || !visible || !foreground || holdDone) return;',
    'if (!splashGone || !holdDone || !chromeReady || !visible || !foreground) return;',
    'duration: motionReduced ? 110 : 870',
    'duration: motionReduced ? 100 : 260',
  ]) assert.ok(scene.includes(token), 'Broken launch safeguard: ' + token);
});
test('existing APK-native configuration is byte-for-byte unchanged; this OTA cannot remove the OS thorn splash', () => {
  const expected = execFileSync('git', ['show', '5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0:app.config.js'], {encoding:'utf8'});
  const actual = src('app.config.js');
  assert.equal(actual, expected, 'Native config differs from signed Genesis staging baseline: APK rebuild needed');
  assert.ok(actual.includes(": './assets/release/splash-icon.png'"), 'Existing native splash remains pinned');
  assert.ok(!actual.includes("genesisNativePreview ? './assets/season2/genesis/genesis-green-b-transparent.png'"), 'Native splash edit was accidentally included in OTA');
  const preview = src('src/components/BuklodMainBrandIntro.tsx');
  assert.ok(preview.includes('if (isGenesisPreviewBuild())'));
  assert.ok(preview.includes('<GenesisCinematicStartup>{children}</GenesisCinematicStartup>'));
  assert.ok(preview.includes('return <LegacyBrandIntro>{children}</LegacyBrandIntro>'));
});
