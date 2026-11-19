/** User-initiated Android DocumentsProvider import. No Google OAuth, automatic backup, or Drive account tokens. */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { getGenesisNativeFoundation } from '@/features/season2/genesis/genesisNativeFoundation';
const TYPES = ['image/gif','image/jpeg','image/png','image/webp'] as const;
const MAX_BYTES = 25 * 1024 * 1024;
export type GenesisProviderMedia = {uri:string; name:string; mimeType:typeof TYPES[number]; size:number};
export async function pickGenesisCommunityMediaFromProvider():Promise<GenesisProviderMedia|null>{
  if(Platform.OS!=='android'||!getGenesisNativeFoundation().cosmeticHaptics)return null;
  const result = await DocumentPicker.getDocumentAsync({type:[...TYPES],multiple:false,copyToCacheDirectory:true});
  if(result.canceled||result.assets.length!==1)return null;
  const asset=result.assets[0];
  if(!/^file:\/\//.test(asset.uri))throw new Error('The provider could not copy the file into private cache.');
  const mime=String(asset.mimeType??'').toLowerCase().split(';')[0].trim();
  if(!(TYPES as readonly string[]).includes(mime))throw new Error('Choose a GIF, PNG, JPEG, or WebP image.');
  const size=Number(asset.size??new File(asset.uri).size);
  if(!Number.isFinite(size)||size<1||size>MAX_BYTES)throw new Error('The selected image must be 1 byte to 25 MB.');
  return {uri:asset.uri,name:String(asset.name||'selected-image').slice(0,120),mimeType:mime as GenesisProviderMedia['mimeType'],size};
}
