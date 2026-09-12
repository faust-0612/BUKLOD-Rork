import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

export async function outputReportWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('A writable export directory is unavailable.');

  const uri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Export ${fileName}`,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
  return uri;
}
