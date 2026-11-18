import type {BuklodRenderReleaseIdentity} from './buklodRenderReleaseIdentity';
/** A web session has no trustworthy Android OTA identity. */
export function getBuklodRenderReleaseIdentity(): BuklodRenderReleaseIdentity {
  return {runtimeVersion:null,otaUpdateId:null,updateChannel:null};
}
