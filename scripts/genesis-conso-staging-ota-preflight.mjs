#!/usr/bin/env node
/**
 * Genesis staging OTA source preflight. READ-ONLY, cannot publish.
 * The signed APK baseline is the installed 2.0.0-genesis-preview source.
 * Deliberately fail closed when native inputs differ: those require a new APK.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const APK_SOURCE = '5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0';
const RUNTIME = '2.0.0-genesis-preview';
const CHANNEL = 'season2-genesis-preview';
const APK_PACKAGE = 'org.mzbministry.buklod.staging';
const failures = [];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000 }).trim();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const check = (name, callback) => {
  try { callback(); console.log('PASS ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.error('BLOCK ' + name + ': ' + error.message); }
};
const contrastRatio = (front, back) => {
  const lum = hex => {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c =>
      c<=0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4);
    return rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722;
  };
  const a = lum(front), b = lum(back);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
};

check('Exact installed native source is present in Git history', () => {
  assert.equal(git('rev-parse', APK_SOURCE), APK_SOURCE);
  assert.equal(git('merge-base', APK_SOURCE, 'HEAD'), APK_SOURCE,
    'OTA must descend from actual signed APK source');
});
check('Unmodified native configuration, dependencies and local native module code', () => {
  const protectedPaths = [
    'app.config.js', 'eas.json', 'package.json', 'package-lock.json',
    'babel.config.js', 'metro.config.js', 'android/', 'ios/', 'modules/',
    'plugins/', 'google-services.staging.json', 'google-services.production.json'
  ];
  const changed = git('diff', '--name-only', APK_SOURCE, 'HEAD', '--', ...protectedPaths);
  assert.equal(changed, '', 'Native-incompatible changes: ' + changed);
});
check('Expo update targets Genesis staging and never production', () => {
  const e = JSON.parse(read('eas.json'));
  assert.equal(e.build['season2-genesis-preview'].channel, CHANNEL);
  assert.equal(e.build['season2-genesis-preview'].environment, 'preview');
  assert.equal(e.build['season2-genesis-preview'].env.APP_VARIANT, 'staging');
  assert.equal(e.build['season2-genesis-preview'].env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW, 'true');
  assert.notEqual(e.build.production.channel, CHANNEL);
  const env = ['APP_VARIANT', 'EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW', 'BUKLOD_APP_TARGET'];
  const before = Object.fromEntries(env.map(k => [k, process.env[k]]));
  try {
    Object.assign(process.env, { APP_VARIANT: 'staging', EXPO_PUBLIC_APP_ENV: 'staging', EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW: 'true', BUKLOD_APP_TARGET: 'main' });
    const config = require(path.join(root, 'app.config.js'))({ config: {} });
    assert.equal(config.android.package, APK_PACKAGE);
    assert.equal(config.runtimeVersion, RUNTIME);
    assert.equal(config.extra.appTarget, 'main');
    assert.equal(config.extra.appEnvironment, 'staging');
    assert.equal(config.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads')[1].androidAppId, 'ca-app-pub-3940256099942544~3347511713');
  } finally {
    for (const k of env) if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k];
  }
});
check('Three owner-provided Galaxy assets exist as real bundled JPEGs', () => {
  const gallery = read('src/features/season2/genesis/genesisGalleryAssets.ts');
  for (const name of ['nebula','creation','earth']) {
    const buf = fs.readFileSync(path.join(root, 'assets/season2/genesis/galaxy', name + '.jpg'));
    assert.ok(buf.length >= 4000, name + ' JPEG is absent or a stub');
    assert.equal(buf[0], 0xFF); assert.equal(buf[1], 0xD8); assert.equal(buf[2], 0xFF);
    assert.equal(buf.at(-2), 0xFF); assert.equal(buf.at(-1), 0xD9);
    assert.ok(gallery.includes('galaxy/' + name + '.jpg'), 'Bundler registry missing ' + name);
  }
});
check('Galaxy visuals and readable scope cards are present', () => {
  const c = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
  const scope = read('src/app/scope/index.tsx');
  const org = read('src/components/BuklodScopeHomeDashboard.tsx');
  const visual = read('src/features/season2/genesis/GenesisVisuals.tsx');
  assert.match(c, /clusterInk = GENESIS_CLUSTER \? '#F8FAFF'/);
  assert.match(c, /clusterMuted = GENESIS_CLUSTER \? '#D4E3F4'/);
  assert.match(c, /GENESIS_CLUSTER \? 'transparent' : '#F2F7FD'/);
  assert.match(org, /GENESIS_ORG \? 'transparent' : '#F2F7FD'/);
  assert.match(scope, /'rgba\(15,32,59,\.94\)'/);
  assert.match(visual, /GENESIS_GALAXY_IMAGES.nebula/);
  for (const [fg,bg] of [['#F8FAFF','#0C1B37'],['#D4E3F4','#0C1B37'],['#F4F8FF','#122748'],['#FFE8B6','#0F203B'],['#D2E0F7','#0F203B']]) {
    assert.ok(contrastRatio(fg,bg) >= 4.5, 'Contrast regression ' + fg + '/' + bg);
  }
});
check('Connect inbox remains isolated from personal message background and ads', () => {
  const inbox = read('src/app/(tabs)/messages.tsx');
  const background = read('src/components/connect/ConnectThreadBackground.tsx');
  assert.ok(inbox.includes('<ConnectThreadBackground style={styles.screen} genesisInbox>'));
  assert.ok(background.includes('genesisInbox && isGenesisPreviewBuild()'));
  assert.ok(background.includes('GenesisCosmicSky active={false} minimal transparent'));
  assert.ok(background.includes('<BackgroundLayers'));
  assert.ok(inbox.includes('<BuklodFirstViewAd'));
  assert.ok(read('src/components/BuklodClusterHomeCommandCenterImpl.tsx').includes('BuklodFirstViewAd placement="cluster"'));
});
check('No accidental production OTA or Season 2 backend activation logic in preflight', () => {
  const script = read('scripts/genesis-conso-staging-ota-preflight.mjs');
  assert.ok(!/execFileSync\(\s*['"]eas['"]/.test(script));
  assert.ok(!/execFileSync\(\s*['\"](?:eas|npx)['\"]/.test(script));
  assert.ok(read('src/features/season2/genesis/genesisContract.ts').includes('isGenesisPreviewEnabled'));
});

if (failures.length) {
  console.error('\nGENESIS_STAGING_OTA_PREP_BLOCKED: ' + failures.length + ' checks');
  process.exitCode = 1;
} else {
  console.log('\nSOURCE_PREFLIGHT_PASS — NOT A DEPLOYMENT');
  console.log('Runtime ' + RUNTIME + ' channel ' + CHANNEL + ', installed-source ' + APK_SOURCE);
  console.log('Physical Android QA, first-view AdMob and signed build verification are separate mandatory publication gates.');
}
