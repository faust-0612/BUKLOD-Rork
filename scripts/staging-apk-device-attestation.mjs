#!/usr/bin/env node
/**
 * Read-only BUKLOD staging APK verifier. This tool NEVER installs, launches,
 * clears, restarts, connects to a backend or reads app/user data.
 *
 * Usage:
 * node scripts/staging-apk-device-attestation.mjs --apk=C:\path\staging.apk
 *   --build-id=<EAS build UUID> --source=<Git SHA> --version-code=9
 *   --version-name=1.3.6 [--serial=<ADB USB id>] [--out=C:\path\proof.json]
 *
 * The result is native binary identity evidence only. Expo OTA runtime,
 * update ID/source, backend parity and manual UI acceptance require OTHER proof.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const STAGING_PACKAGE = 'org.mzbministry.buklod.staging';

export function parseAdbDevices(output) {
  return String(output).split(/\r?\n/)
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts.length >= 2 && parts[1] === 'device')
    .map(parts => parts[0]);
}

export function parsePackageDetails(output) {
  const value = String(output);
  const code = value.match(/(?:^|\n)\s*versionCode=(\d+)\b/);
  const version = value.match(/(?:^|\n)\s*versionName=([^\s]+)/);
  return {
    versionCode: code ? Number(code[1]) : null,
    versionName: version ? version[1] : null,
  };
}

export function parsePackagePaths(output) {
  return String(output).split(/\r?\n/).map(v => v.trim())
    .filter(v => /^package:\/.+\.apk$/.test(v))
    .map(v => v.slice('package:'.length));
}

export function parseMeminfoPssKb(output) {
  const str = String(output);
  const total = str.match(/^\s*TOTAL PSS:\s*([\d,]+)/m);
  return total ? Number(total[1].replaceAll(',', '')) : null;
}

export function inspectNativeAttestation(report) {
  const problems = [];
  if (report?.package !== STAGING_PACKAGE) problems.push('wrong_staging_package');
  if (!report?.publisher?.buildId || !/^[0-9a-f-]{36}$/i.test(report.publisher.buildId))
    problems.push('missing_provenance_build_id');
  if (!/^[a-f0-9]{40}$/i.test(report?.publisher?.sourceSha ?? ''))
    problems.push('missing_exact_source_sha');
  if (!Number.isInteger(report?.publisher?.expectedVersionCode))
    problems.push('missing_expected_version_code');
  if (!report?.publisher?.expectedVersionName)
    problems.push('missing_expected_version_name');
  if (!Number.isInteger(report?.installed?.versionCode) ||
      report.installed.versionCode !== report.publisher.expectedVersionCode)
    problems.push('installed_version_code_mismatch');
  if (report?.installed?.versionName !== report?.publisher?.expectedVersionName)
    problems.push('installed_version_name_mismatch');
  if (report?.installed?.apkCount !== 1) problems.push('unexpected_split_apk_count');
  if (!/^[a-f0-9]{64}$/i.test(report?.localSignedApk?.sha256 ?? ''))
    problems.push('missing_signed_apk_hash');
  if (!/^[a-f0-9]{64}$/i.test(report?.installed?.baseApkSha256 ?? ''))
    problems.push('missing_installed_apk_hash');
  if (!report?.localSignedApk?.sha256 ||
      report.localSignedApk.sha256 !== report?.installed?.baseApkSha256)
    problems.push('signed_vs_installed_apk_mismatch');
  return { nativeBinaryMatchesSignedArtifact: problems.length === 0, problems,
    /** Never infer this from package/version/SHA alone. */
    verifiedOtaSourceAndUpdateId: false,
    verifiedBackendContract: false, verifiedManualUx: false, releaseReady: false };
}

export function parseOptions(args) {
  const opts = new Map();
  for (const a of args) {
    if (!a.startsWith('--') || a.indexOf('=') < 3)
      throw new Error('Arguments must use --name=value syntax.');
    const index = a.indexOf('=');
    const key = a.slice(2, index);
    if (!['apk','build-id','source','version-code','version-name','serial','out','adb'].includes(key) ||
        opts.has(key)) throw new Error('Unexpected or duplicate argument: ' + key);
    opts.set(key, a.slice(index + 1));
  }
  for (const required of ['apk','build-id','source','version-code','version-name']) {
    if (!opts.get(required)) throw new Error('Required argument missing: --' + required);
  }
  if (!/^\d+$/.test(opts.get('version-code'))) throw new Error('Invalid version-code.');
  if (!/^[a-f0-9]{40}$/i.test(opts.get('source'))) throw new Error('Invalid source SHA.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opts.get('build-id')))
    throw new Error('Invalid EAS build ID.');
  return opts;
}

function adbCommand(adb, serial, args, timeout = 12000) {
  try {
    return execFileSync(adb, serial ? ['-s',serial,...args] : args, {
      encoding:'utf8', timeout, windowsHide:true, maxBuffer:4*1024*1024,
      stdio:['ignore','pipe','pipe']
    }).trim();
  } catch {
    // Avoid printing raw logcat/dumpsys, serial, device path or user data.
    throw new Error('ADB command failed. Check USB debugging authorization and installed staging package.');
  }
}

async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}

async function main() {
  const o=parseOptions(process.argv.slice(2));
  const local=path.resolve(o.get('apk'));
  if (!local.toLowerCase().endsWith('.apk') || !fs.existsSync(local) ||
      fs.statSync(local).size < 5_000_000)
    throw new Error('A downloaded, nonempty signed staging .apk is required.');
  const fd=fs.openSync(local,'r');
  const header=Buffer.alloc(4);
  try { fs.readSync(fd,header,0,4,0); } finally { fs.closeSync(fd); }
  if (!header.equals(Buffer.from([0x50,0x4b,0x03,0x04])))
    throw new Error('Selected staging APK does not begin with an APK ZIP header.');
  const adb=o.get('adb')||'adb';
  const devices=parseAdbDevices(adbCommand(adb,null,['devices','-l']));
  const serial=o.get('serial') || (devices.length===1 ? devices[0] : null);
  if (!serial || !devices.includes(serial))
    throw new Error('Connect one authorized USB device, or select exactly one with --serial.');
  const pkgPaths=parsePackagePaths(adbCommand(adb,serial,['shell','pm','path',STAGING_PACKAGE]));
  if (pkgPaths.length!==1 || !pkgPaths[0].endsWith('/base.apk'))
    throw new Error('Staging app is missing or installed as unsupported split APK; native identity NOT verified.');
  const pkg=parsePackageDetails(adbCommand(adb,serial,['shell','dumpsys','package',STAGING_PACKAGE]));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-staging-apk-'));
  let installedHash=null;
  try {
    // Only reads the installed staging base APK. No APK install/launch and no
    // production package is touched. Files are removed after SHA-256 hashing.
    const installed=path.join(temp,'installed-base.apk');
    adbCommand(adb,serial,['pull',pkgPaths[0],installed],180000);
    if (!fs.existsSync(installed)) throw new Error('ADB pull produced no installed staging APK');
    installedHash=await sha256File(installed);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
  const localHash=await sha256File(local);
  const getProp=name=>adbCommand(adb,serial,['shell','getprop',name]);
  let pss=null;
  try { pss=parseMeminfoPssKb(adbCommand(adb,serial,['shell','dumpsys','meminfo',STAGING_PACKAGE])); }
  catch { /* Staging process may not be running; not a blocking identity issue. */ }
  const report={
    schema:'buklod-staging-native-attestation-v1',
    observedAt:new Date().toISOString(), package:STAGING_PACKAGE,
    publisher:{
      buildId:o.get('build-id'), sourceSha:o.get('source'),
      expectedVersionCode:Number(o.get('version-code')),
      expectedVersionName:o.get('version-name'),
      proofSource:'Verify GitHub EAS build/workflow/artifact ID separately'
    },
    device:{ model:getProp('ro.product.model'), android:getProp('ro.build.version.release'),
      sdk:Number(getProp('ro.build.version.sdk'))||null, serialStored:false },
    localSignedApk:{ sha256:localHash, sizeBytes:fs.statSync(local).size },
    installed:{ versionCode:pkg.versionCode, versionName:pkg.versionName,
      apkCount:pkgPaths.length, baseApkSha256:installedHash, processPssKb:pss },
    note:'Native signed APK binary only. Expo OTA ID, applied JS source, preview backend access, QA, and actual user acceptance remain UNVERIFIED.',
  };
  const verification=inspectNativeAttestation(report);
  report.verification=verification;
  const out=o.get('out')?path.resolve(o.get('out')):
    path.join(os.tmpdir(),'BUKLOD-staging-native-attestation-'+Date.now()+'.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:verification.nativeBinaryMatchesSignedArtifact?'NATIVE_BINARY_MATCH':'BLOCKED',
    issues:verification.problems, proofFile:out, otaVerified:false, backendVerified:false},null,2));
  if (!verification.nativeBinaryMatchesSignedArtifact) process.exitCode=1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error=>{
    console.error('STAGING ATTESTATION BLOCKED: '+error.message);
    process.exitCode=1;
  });
}
