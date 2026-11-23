import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../native-genesis/android/app/build.gradle.kts',import.meta.url),'utf8');
const game = readFileSync(new URL('../native-genesis/android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/GenesisGameActivity.kt',import.meta.url),'utf8');
const workflow = readFileSync(new URL('../.github/workflows/genesis-native-gha-diagnostic-20261123.yml',import.meta.url),'utf8');

test('GodotActivity FragmentActivity supertype is provided by a concrete AndroidX dependency',()=>{
 assert.match(game,/class GenesisGameActivity\s*:\s*GodotActivity/);
 assert.match(source,/implementation\("org\.godotengine:godot:4\.7\.2\.stable"\)/);
 assert.match(source,/implementation\("androidx\.fragment:fragment:1\.9\.1"\)/);
 assert.match(source,/implementation\("androidx\.core:core-splashscreen:1\.2\.0"\)/);
 assert.doesNotMatch(source,/\bexpo(?:-router|-modules|-updates)?\b|org\.mzbministry\.buklod\.staging/i);
});
test('the bounded compile diagnostic rechecks AndroidX supertype resolution before any APK stage',()=>{
 assert.ok(workflow.includes('tests/genesis-native-godot-androidx-dependencies-20261123.test.mjs'));
 assert.ok(workflow.includes(':app:compileDebugKotlin'));
 assert.ok(workflow.includes(':app:compileDebugJavaWithJavac'));
 assert.doesNotMatch(workflow,/assembleRelease|assembleDebug|upload-artifact|secrets\./);
});
