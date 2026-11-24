'use strict';
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/** Staging ONLY. Bundle a real Godot main-pack in the same BUKLOD APK.
 * EAS prebuild and local prebuild both run this config mod. No network,
 * no runtime PCK downloads, no production signing or backend mutations.
 */
module.exports = function withBuklodGodotArenaPack(config) {
  return withDangerousMod(config, [
    'android',
    async mod => {
      if (process.env.APP_VARIANT !== 'staging' ||
          process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true' ||
          process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED !== 'true' ||
          process.env.BUKLOD_APP_TARGET === 'classroom') {
        throw new Error('BUKLOD Godot Arena pack plugin is only allowed in isolated Genesis MAIN staging');
      }
      const root = mod.modRequest.projectRoot;
      const output = path.resolve(mod.modRequest.platformProjectRoot,
        'app/src/main/assets/godot/empire-arena.zip');
      const script = path.join(root, 'scripts/build-empire-godot-pack.mjs');
      execFileSync(process.execPath, [script, '--out=' + output, '--native-bootstrap'], {
        cwd: root, stdio: 'inherit', timeout: 30000,
        env: { ...process.env, EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED: 'false' }
      });
      if (!fs.existsSync(output) || fs.statSync(output).size < 500) {
        throw new Error('BUKLOD Godot Arena asset is absent; refuse to create a falsely compatible APK');
      }
      return mod;
    },
  ]);
};
