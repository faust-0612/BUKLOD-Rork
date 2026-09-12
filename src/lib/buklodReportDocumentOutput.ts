import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { encode } from 'base64-arraybuffer';

export async function outputReportDocument(html: string, fileName: string) {
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('A writable export directory is unavailable.');

  const bytes = new TextEncoder().encode(html);
  const base64 = encode(bytes.buffer);
  const uri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/msword',
      dialogTitle: `Export ${fileName}`,
      UTI: 'com.microsoft.word.doc',
    });
  }
  return uri;
}
