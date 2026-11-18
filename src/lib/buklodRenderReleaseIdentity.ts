/**
 * Default (web, tests, non-native) crash identity. Never infer an OTA from the
 * marketing appVersion; non-native platforms have no native Expo update ID.
 */
export type BuklodRenderReleaseIdentity = {
  runtimeVersion: string | null;
  otaUpdateId: string | null;
  updateChannel: string | null;
};
export function getBuklodRenderReleaseIdentity(): BuklodRenderReleaseIdentity {
  return {runtimeVersion:null,otaUpdateId:null,updateChannel:null};
}
