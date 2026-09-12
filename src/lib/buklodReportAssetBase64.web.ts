import { encode as base64Encode } from 'base64-arraybuffer';
import type { DocumentPickerAsset } from 'expo-document-picker';

function stripDataUrlPrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('data:')) return trimmed;
  const commaIndex = trimmed.indexOf(',');
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

export async function readReportAssetBase64(asset: DocumentPickerAsset) {
  const embedded = typeof asset.base64 === 'string'
    ? stripDataUrlPrefix(asset.base64)
    : '';
  if (embedded) return embedded;

  if (asset.file) {
    return base64Encode(await asset.file.arrayBuffer());
  }

  if (asset.uri) {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`The selected form could not be read (${response.status}).`);
    }
    return base64Encode(await response.arrayBuffer());
  }

  throw new Error('The selected browser file could not be read. Choose the form again.');
}
