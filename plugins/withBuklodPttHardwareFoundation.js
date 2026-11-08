const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  ['android.permission.BLUETOOTH_SCAN', 'neverForLocation'],
  ['android.permission.BLUETOOTH_CONNECT', null],
  ['android.permission.NEARBY_WIFI_DEVICES', 'neverForLocation'],
  ['android.permission.ACCESS_WIFI_STATE', null],
  ['android.permission.CHANGE_WIFI_STATE', null],
  // No connectedDevice foreground service: PTT uses Stream VoIP transport.
];

function ensurePermission(manifest, name, flags) {
  manifest.manifest['uses-permission'] ||= [];
  const rows = manifest.manifest['uses-permission'];
  let row = rows.find((entry) => entry?.$?.['android:name'] === name);
  if (!row) {
    row = { $: { 'android:name': name } };
    rows.push(row);
  }
  if (flags) row.$['android:usesPermissionFlags'] = flags;
}

function ensureFeature(manifest, name) {
  manifest.manifest['uses-feature'] ||= [];
  const rows = manifest.manifest['uses-feature'];
  if (!rows.some((entry) => entry?.$?.['android:name'] === name)) {
    rows.push({
      $: {
        'android:name': name,
        'android:required': 'false',
      },
    });
  }
}

module.exports = function withBuklodPttHardwareFoundation(config) {
  return withAndroidManifest(config, (mod) => {
    for (const [name, flags] of PERMISSIONS) {
      ensurePermission(mod.modResults, name, flags);
    }

    // Hardware is OPTIONAL so BUKLOD still installs on phones without these accessories.
    ensureFeature(mod.modResults, 'android.hardware.bluetooth_le');
    ensureFeature(mod.modResults, 'android.hardware.usb.host');

    return mod;
  });
};
