/**
 * Browser-selected Expo ImagePicker assets expose a real web File. Never call
 * expo-file-system on web: its native file URI reader is unavailable there.
 * Native upload stays ArrayBuffer-backed for Supabase's React Native client.
 */
export type AdvertisePickerUploadAsset = {
  uri: string;
  file?: Blob | null;
};

export async function readAdvertiseUploadBody(
  asset: AdvertisePickerUploadAsset,
  web: boolean,
  readNativeArrayBuffer: () => Promise<ArrayBuffer>,
  fetchWebBlob: (uri: string) => Promise<Blob> = async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Cannot read selected browser media. Please select the file again.');
    return response.blob();
  },
): Promise<Blob | ArrayBuffer> {
  if (web) {
    // Web ImagePicker.file is a browser File (Blob), safe for Supabase uploads.
    // Older browser pickers may only return blob: URI, so fetch that as fallback.
    const body = asset.file ?? (await fetchWebBlob(asset.uri));
    if (!body?.size) {
      throw new Error('The selected browser file is empty. Choose a valid photo or video.');
    }
    return body;
  }

  const bytes = await readNativeArrayBuffer();
  if (!bytes.byteLength) {
    throw new Error('The selected file is empty. Choose a valid photo or video.');
  }
  return bytes;
}
