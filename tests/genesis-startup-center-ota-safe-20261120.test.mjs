import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
test('native-rebuild lane replaces legacy Android splash without affecting other app targets', () => {
  const require = createRequire(import.meta.url);
  const keys = ['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    Object.assign(process.env, {APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true'});
    const config = require('../app.config.js')({config:{}});
    const splash = config.plugins.find(x => Array.isArray(x) && x[0] === 'expo-splash-screen')[1];
    const greenB = './assets/season2/genesis/genesis-green-b-transparent.png';
    assert.equal(splash.image,greenB);
    assert.equal(splash.dark.image,greenB);
    assert.equal(splash.backgroundColor,'#141A43');
    assert.equal(splash.dark.backgroundColor,'#141A43');
    assert.equal(config.android.adaptiveIcon.foregroundImage,greenB);
    assert.equal(config.runtimeVersion,'2.0.0-genesis-preview');
    const intro=src('src/components/BuklodMainBrandIntro.tsx');
    assert.ok(intro.includes('if (isGenesisPreviewBuild())'));
    assert.ok(intro.includes('<GenesisCinematicStartup>{children}</GenesisCinematicStartup>'));
    assert.ok(intro.includes('return <LegacyBrandIntro>{children}</LegacyBrandIntro>'));
  } finally {
    for(const k of keys) before[k] === undefined ? delete process.env[k] : process.env[k] = before[k];
  }
});
