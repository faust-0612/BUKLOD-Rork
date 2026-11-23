/** Overwritten by scripts/genesis-prepare-godot-ota-pack.mjs before every signed APK/OTA export.
 * Empty source manifest fails closed; never claim an arbitrary OTA archive is approved.
 */
export const GENESIS_GODOT_OTA_PACK = {
  schema: 1 as const,
  engine: '4.7.2',
  sha256: '',
  bytes: 0,
} as const;
