import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root = new URL('../native-genesis/android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/', import.meta.url);
const read = f => readFileSync(new URL(f, root),'utf8');

test('four worlds use a constant local PCK and only a whitelisted preview scene',()=>{
 const policy = read('GenesisNativeContract.kt');
 const game = read('GenesisGameActivity.kt');
 assert.match(policy,/setOf\("arena", "kingdom", "community", "house"\)/);
 assert.match(policy,/res:\/\/godot\/empire-arena\.pck/);
 assert.match(policy,/res:\/\/scenes\/WorldPreview\.tscn/);
 assert.match(game,/validWorld\(/);
 assert.match(game,/gameArguments\(/);
 assert.doesNotMatch(game,/getExternalFilesDir|\.http|intent\?\.data/);
});

test('pack verification and UI state do not assume successful native startup',()=>{
 const source = read('NativeHomeActivity.kt');
 const policy = read('GenesisNativeContract.kt');
 assert.match(source,/pending_unconfirmed_launch/);
 assert.match(source,/\.commit\(\)/);
 assert.match(source,/if \(!localPackVerified \|\| hasUnconfirmedLaunch\(\)/);
 assert.match(source,/manual reset required/i);
 assert.match(policy,/MessageDigest\.isEqual/);
 assert.match(policy,/readLine\(\)/);
 assert.match(policy,/MessageDigest\.getInstance\("SHA-256"\)/);
 assert.doesNotMatch(source,/\bexpo\b|EAS|publish|Supabase/);
});

test('APK release gate checks the same PCK asset used by Android and local pack exporter',()=>{
 const gate = readFileSync(new URL('../scripts/genesis-native-local-only-gate.mjs',import.meta.url),'utf8');
 const pack = readFileSync(new URL('../native-genesis/prepare-pack-local.sh',import.meta.url),'utf8');
 assert.match(gate,/assets\/godot\/empire-arena\.pck/);
 assert.doesNotMatch(gate,/assets\/godot\/empire-arena\.zip/);
 assert.match(pack,/empire-arena\.pck/);
});

test('pure Kotlin core compiles and executes hash/scene/input edge cases on JVM', t=>{
 const kotlin = spawnSync('kotlinc',['-version'],{encoding:'utf8',timeout:8000});
 if(kotlin.error || kotlin.status!==0){ t.skip('Local Kotlin compiler absent'); return; }
 const working = mkdtempSync(join(tmpdir(),'genesis-kotlin-core-'));
 try {
  const command = spawnSync('kotlinc',[
    new URL('GenesisNativeContract.kt',root).pathname,
    new URL('./native/GenesisNativeContractSmoke.kt',import.meta.url).pathname,
    '-include-runtime','-d',join(working,'core.jar')
  ],{encoding:'utf8',timeout:65000});
  assert.equal(command.status,0,command.stderr);
  const runtime = spawnSync('java',['-jar',join(working,'core.jar')],{encoding:'utf8',timeout:15000});
  assert.equal(runtime.status,0,runtime.stderr);
  assert.match(runtime.stdout,/KOTLIN_NATIVE_CONTRACT_PASS/);
 } finally{ rmSync(working,{recursive:true,force:true}); }
});
