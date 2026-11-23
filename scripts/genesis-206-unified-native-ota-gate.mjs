#!/usr/bin/env node
/**
 * BUKLOD Genesis 2.0.6 — consolidated staging/native release HOLD.
 * Read-only; no build, OTA, Expo, EAS, backend write or network operation.
 * An approved native APK is a prerequisite, not an output of this script.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = JSON.parse(readFileSync(path.join(root,
  '.buklod/releases/genesis-206-unified-native-conso-hold-20261124.json'), 'utf8'));
export const GATES = Object.freeze([
  'contentSha', 'contentInventory', 'productionParity', 'nativeSource',
  'separateBackend', 'approvedDistributionRights', 'fullNativeFeatureParity',
  'correctGodotPack', 'localSignedApk', 'ownerDeviceEvidence',
  'adsNavigationRecovery', 'gifSplashAudio', 'rollback', 'ownerAcceptance'
]);
export function evaluateGate(facts) {
  const blockers = GATES.filter(key => facts[key] !== true);
  return { status: blockers.length ? 'BLOCKED_BEFORE_RELEASE' :
    'READY_FOR_MANUAL_RC_REVIEW_NOT_PUBLISHED', blockers,
    published: false, backendMutated: false };
}
// Stream large owner APKs rather than holding 800+ MB in Node heap.
function digest(file) {
  const hash=createHash('sha256'), fd=openSync(file,'r');
  const buf=Buffer.allocUnsafe(1024*1024);
  try {
    let count;
    while((count=readSync(fd,buf,0,buf.length,null))>0)hash.update(buf.subarray(0,count));
    return hash.digest('hex');
  } finally {closeSync(fd);}
}
function safeRead(file) {
  if (!file || !existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return null; }
}
function checked(fn) { try { return fn() === true; } catch { return false; } }
function command(executable, args, cwd = root) {
  const outcome = spawnSync(executable, args, {cwd, encoding:'utf8',
    timeout:60000, maxBuffer:10*1024*1024});
  return outcome.status === 0 ? outcome.stdout || '' : null;
}
export function inspectLocal(env = process.env) {
  const facts = Object.fromEntries(GATES.map(k => [k,false]));
  const archive = env.GENESIS_206_CONSO_ZIP;
  const inspectedZip = checked(() => {
    if (!archive || !existsSync(archive)) return false;
    if (statSync(archive).size !== release.candidate.bytes ||
        digest(archive) !== release.candidate.sha256) return false;
    const checkedZip = command('unzip', ['-tqq',archive]);
    if (checkedZip === null) return false;
    facts.contentSha = true;
    const text = command('unzip', ['-Z1',archive]);
    if (text === null) return false;
    const entries = text.split(/\r?\n/).filter(Boolean);
    const set = new Set(entries);
    const count = re => entries.filter(x => re.test(x)).length;
    return set.size === entries.length &&
      count(/^3d\/(kenney|kaykit)\/.*\.glb$/) === 22 &&
      count(/^3d\/private\//) === 0 &&
      count(/^private-fx\/.*\.png$/) === 48 &&
      count(/^audio\/sfx\/.*\.wav$/) === 70 &&
      set.has('data/private_fx_manifest.json') &&
      set.has('scenes/PremiumWorld3D.tscn') &&
      !set.has('data/private_3d_manifest.json');
  });
  facts.contentInventory = inspectedZip;
  facts.productionParity = checked(() => {
    const main = release.source.productionMain;
    // Exact production history must be integrated; a matching file snapshot or
    // manifest marker is NOT proof of cumulative commit ancestry.
    const localMain=command('git',['rev-parse','refs/remotes/origin/main'])?.trim();
    return localMain === main && !!localMain &&
      command('git',['cat-file','-t',main])?.trim() === 'commit' &&
      command('git',['merge-base','--is-ancestor',main,'HEAD']) !== null &&
      command('git',['branch','--show-current'])?.trim() !== 'main';
  });
  const nativeRoot = env.GENESIS_206_NATIVE_SOURCE_DIR || path.join(root,'native-genesis');
  facts.nativeSource = checked(() => {
    const gradle = readFileSync(path.join(nativeRoot,'android/app/build.gradle.kts'),'utf8');
    const manifest = readFileSync(path.join(nativeRoot,'android/app/src/main/AndroidManifest.xml'),'utf8');
    return gradle.includes('org.mzbministry.buklod.genesis.nativeapp') &&
      gradle.includes('org.godotengine:godot') &&
      !/expo|eas|vercel/i.test(gradle) &&
      /android:exported="false"/.test(manifest);
  });
  facts.separateBackend = checked(() => {
    const url = new URL(env.GENESIS_NATIVE_STAGING_SUPABASE_URL || '');
    const key = env.GENESIS_NATIVE_STAGING_SUPABASE_PUBLISHABLE_KEY || '';
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') &&
      !url.hostname.includes('yhanxndaqbmuzbdqlblu') &&
      key.startsWith('sb_publishable_') &&
      !/service.role|service_role|secret/i.test(key);
  });
  const rights = safeRead(env.GENESIS_206_DELIVERY_RIGHTS_RECEIPT);
  facts.approvedDistributionRights = checked(() =>
    rights?.packSha256 === release.candidate.sha256 &&
    rights?.commercialInGameDistributionApproved === true &&
    rights?.localNativeApkDeliveryApproved === true &&
    rights?.independentLicenseProofsVerified === true &&
    rights?.licensesReviewedCount >= release.candidate.sourceLicenseStatements);
  const parity = safeRead(path.join(nativeRoot,'parity.json'));
  facts.fullNativeFeatureParity = checked(() =>
    Array.isArray(parity?.features) && parity.features.length >= 20 &&
    parity.features.every(f => f.implemented === true && f.verified === true &&
      typeof f.evidencePath === 'string' && f.evidencePath.length > 0 &&
      !path.isAbsolute(f.evidencePath) && !f.evidencePath.split(/[\\/]/).includes('..') &&
      existsSync(path.resolve(nativeRoot,f.evidencePath))));
  const apk = env.GENESIS_NATIVE_SIGNED_APK;
  const qa = safeRead(env.GENESIS_NATIVE_QA_EVIDENCE);
  const apkSha = checked(() => !!apk && existsSync(apk)) ?
    (()=>{try{return digest(apk)}catch{return null}})() : null;
  const apkFile = checked(() => !!apk && existsSync(apk) &&
    statSync(apk).size > 800000000);
  facts.localSignedApk = checked(() => {
    if (!apkFile || !apkSha || !env.GENESIS_NATIVE_SIGNING_CERT_SHA256) return false;
    const badging = command('aapt',['dump','badging',apk]);
    const signature = command('apksigner',['verify','--print-certs',apk]);
    const cert = env.GENESIS_NATIVE_SIGNING_CERT_SHA256.replace(/:/g,'').toLowerCase();
    return !!badging && !!signature &&
      badging.includes("package: name='org.mzbministry.buklod.genesis.nativeapp'") &&
      signature.toLowerCase().replace(/:/g,'').includes(cert);
  });
  facts.correctGodotPack = checked(() => {
    if (!facts.localSignedApk) return false;
    const files = command('unzip',['-Z1',apk]);
    if (!files) return false;
    const names = files.split(/\r?\n/);
    return names.includes('assets/godot/empire-arena.pck') &&
      names.some(x => /^lib\/arm64-v8a\/.*godot.*\.so$/i.test(x)) &&
      !names.some(x => /expo(modules|updates|devlauncher)/i.test(x));
  });
  const sameApk = !!apkSha && qa?.apkSha256 === apkSha &&
    qa?.package === 'org.mzbministry.buklod.genesis.nativeapp';
  facts.ownerDeviceEvidence = sameApk && qa?.device?.physicalAndroid === true &&
    qa?.device?.firstAndSecondLaunch === true &&
    qa?.device?.runtimeCrashFree === true &&
    qa?.device?.godotRealGameplay === true &&
    qa?.device?.heroes13AndKingdom39Verified === true;
  facts.adsNavigationRecovery = sameApk &&
    qa?.regressions?.admobFirstViewAndFill === 'PASS' &&
    qa?.regressions?.instantDashboardTabs === 'PASS' &&
    qa?.regressions?.compactSpacing === 'PASS';
  facts.gifSplashAudio = sameApk &&
    qa?.regressions?.gboardGifSend === 'PASS' &&
    qa?.regressions?.nativeSplash === 'PASS' &&
    qa?.regressions?.audioFocus === 'PASS' &&
    qa?.regressions?.weakNetworkOffline === 'PASS';
  facts.rollback = sameApk && qa?.regressions?.rollback === 'PASS';
  facts.ownerAcceptance = sameApk &&
    qa?.owner?.visualAcceptance === true &&
    qa?.owner?.reviewedPackageSha256 === apkSha;
  return {facts, result:evaluateGate(facts)};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {facts,result} = inspectLocal();
  console.log(JSON.stringify({target:'GENESIS_NATIVE_LOCAL_ONLY_CONSO', facts, ...result},null,2));
  if(result.status !== 'READY_FOR_MANUAL_RC_REVIEW_NOT_PUBLISHED')process.exitCode = 1;
}
