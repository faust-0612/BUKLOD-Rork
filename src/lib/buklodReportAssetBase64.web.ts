import { encode as base64Encode } from 'base64-arraybuffer';
import type { DocumentPickerAsset } from 'expo-document-picker';

export async function readReportAssetBase64(asset: DocumentPickerAsset) {
  if (asset.file) return base64Encode(await asset.file.arrayBuffer());
  if (asset.base64) return asset.base64;
  throw new Error('The selected browser file could not be read.');
}
