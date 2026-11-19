/** Conservative, deterministic graphics budget for signed Genesis preview.
 * Device total RAM is only a starting tier; app focus, Reduced Motion and
 * video/call priority remain independently enforced by Genesis motion policy. */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type { GenesisQuality, GenesisSurface } from './genesisContract';
import { getGenesisNativeFoundation } from './genesisNativeFoundation';
const GiB=1024*1024*1024;
export function classifyGenesisMemory(bytes:number|null|undefined):GenesisQuality{
  if(typeof bytes!=='number'||!Number.isFinite(bytes)||bytes<=0)return 'balanced';
  if(bytes<3*GiB)return 'minimal';
  if(bytes>=6*GiB)return 'full';
  return 'balanced';
}
export function getGenesisDeviceQuality(_surface:GenesisSurface):GenesisQuality{
  // Unknown hardware is balanced. Never use this to modify a live Season 1 screen.
  if(Platform.OS!=='android'||!getGenesisNativeFoundation().cosmeticHaptics)return 'balanced';
  return classifyGenesisMemory(Device.totalMemory);
}
