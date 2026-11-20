import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function expoConfig(env) {
  const keys=['BUKLOD_APP_TARGET','APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW'];
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    keys.forEach(k=>delete process.env[k]);
    Object.assign(process.env,env);
    return require('../app.config.js')({config:{}});
  } finally {
    for(const k of keys) before[k] === undefined ? delete process.env[k] : process.env[k]=before[k];
  }
}
const splash=cfg=>cfg.plugins.find(x=>Array.isArray(x)&&x[0]==='expo-splash-screen')[1];
const mark='./assets/season2/genesis/genesis-green-b-transparent.png';
test('native staging Genesis uses only the existing transparent B as the immediate splash/launcher mark',()=>{
  const cfg=expoConfig({APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true'});
  assert.equal(cfg.android.package,'org.mzbministry.buklod.staging');
  assert.equal(cfg.runtimeVersion,'2.0.0-genesis-preview');
  assert.equal(cfg.icon,mark);
  assert.equal(cfg.android.adaptiveIcon.foregroundImage,mark);
  assert.equal(cfg.android.adaptiveIcon.backgroundColor,'#141A43');
  assert.equal(splash(cfg).backgroundColor,'#141A43');
  assert.equal(splash(cfg).dark.backgroundColor,'#141A43');
  assert.equal(splash(cfg).image,mark);
  assert.equal(splash(cfg).dark.image,mark);
});
test('staging-only native branding cannot change production, classroom, or normal staging splash',()=>{
  const prod=expoConfig({APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true'});
  const other=expoConfig({APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging'});
  const classroom=expoConfig({BUKLOD_APP_TARGET:'classroom',APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true'});
  assert.equal(prod.runtimeVersion,'1.3.2');
  assert.equal(prod.icon,'./assets/release/app-icon.png');
  assert.equal(splash(prod).image,'./assets/release/splash-icon.png');
  assert.equal(splash(prod).backgroundColor,'#FFFFFF');
  assert.equal(splash(prod).dark.backgroundColor,'#0E4F20');
  assert.equal(other.icon,'./assets/release/buklod-main-canonical.png');
  assert.equal(splash(other).image,'./assets/release/splash-icon.png');
  assert.equal(classroom.icon,'./assets/classroom/app-icon.png');
  assert.equal(splash(classroom).image,'./assets/classroom/splash-icon.png');
});
test('existing Genesis animation is preserved and its logo + text occupy one centered screen frame',()=>{
  const s=source('src/features/season2/genesis/GenesisCinematicStartup.tsx');
  assert.ok(s.includes('style={styles.composition}>\n            <View style={styles.centeredBrandGroup}>'));
  assert.ok(s.includes("composition:{position:'absolute',top:0,left:0,width:LOCKED_SCREEN.width,height:LOCKED_SCREEN.height,alignItems:'center',justifyContent:'center'}"));
  assert.ok(s.includes("centeredBrandGroup:{width:'100%',alignItems:'center',justifyContent:'center'"));
  for(const token of ['<FirstLightBurst phase={reveal}/>','<Image source={TRANSPARENT_GREEN_B}','<Text style={styles.title}>{GENESIS_IDENTITY.title}</Text>','isReduceMotionEnabled','subscribeBuklodStartupChromeReady','markBuklodStartupChromeReady']) assert.ok(s.includes(token),token);
  assert.ok(!s.includes('splash-icon.png')&&!s.includes('buklod-main-canonical.png'));
});
