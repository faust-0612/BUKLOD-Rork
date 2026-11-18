/**
 * Exact OTA identity read synchronously from the JS bundle currently running.
 * No network request, no persistent device identifier, no native dependency
 * change. Unlike the version registry, this snapshot belongs to the crash.
 */
import * as Updates from 'expo-updates';
import type {BuklodRenderReleaseIdentity} from './buklodRenderReleaseIdentity';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function getBuklodRenderReleaseIdentity(): BuklodRenderReleaseIdentity {
  const ota = Updates.isEnabled && typeof Updates.updateId === 'string' && uuid.test(Updates.updateId)
    ? Updates.updateId : null;
  const runtime = typeof Updates.runtimeVersion === 'string' &&
    /^[A-Za-z0-9_.-]{1,60}$/.test(Updates.runtimeVersion)
    ? Updates.runtimeVersion : null;
  const channel = typeof Updates.channel === 'string' &&
    /^(production|staging|preview|development)$/i.test(Updates.channel)
    ? Updates.channel.toLowerCase() : null;
  return {runtimeVersion:runtime,otaUpdateId:ota,updateChannel:channel};
}
