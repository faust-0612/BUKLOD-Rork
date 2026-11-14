/** Opt-in isolated, build-time-only Godot pack for BUKLOD Kingdom native lab.
 * Never install into current production, staging-user or classroom builds. */
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');
const { godotPack } = require('../scripts/kingdom-lab/godotZip.cjs');

module.exports = function withBuklodKingdomNativeLab(config) {
  if (process.env.BUKLOD_APP_TARGET !== 'kingdom-native-lab') {
    throw new Error('Godot Android plugin must never run outside dedicated kingdom-native-lab target.');
  }
  return withDangerousMod(config, ['android', async mod => {
    const root = mod.modRequest.projectRoot;
    const source = path.join(root, 'godot', 'kingdom-zero-assets');
    const { buffer, sha256, entries } = godotPack(source);
    const targetDir = path.join(root, 'android', 'app', 'src', 'main', 'assets');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'buklod_kingdom.zip'), buffer, { flag: 'w' });
    console.info('[kingdom-native-lab] bundled isolated Godot world pack', {
      entries: entries.length,
      sha256,
      bytes: buffer.length,
    });
    return mod;
  }]);
};
