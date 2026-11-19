/** Bundle the original zero-paid-API Genesis Godot project into the FIRST native APK.
 * Never run on current BUKLOD production or old staging runtime. */
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');
const { godotPack } = require('../scripts/genesis-native/godotZip.cjs');
module.exports = function withBuklodGenesisGodot(config) {
  if (process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true' ||
      process.env.APP_VARIANT !== 'staging' ||
      (process.env.BUKLOD_APP_TARGET || 'main') !== 'main') {
    throw Error('BLOCK: Godot pack can run only in explicitly isolated Genesis staging preview');
  }
  return withDangerousMod(config, ['android', async mod => {
    const root = mod.modRequest.projectRoot;
    const source = path.join(root,'godot','genesis-creation');
    const {buffer,sha256,entries} = godotPack(source);
    const dest = path.join(root,'android','app','src','main','assets');
    fs.mkdirSync(dest,{recursive:true});
    fs.writeFileSync(path.join(dest,'buklod_genesis_kingdom.zip'),buffer);
    console.info('[genesis-native] Godot local project pack', {files:entries.length, sha256, bytes:buffer.length});
    return mod;
  }]);
};
