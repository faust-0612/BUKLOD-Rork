import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { rowsToCsv } from '@/lib/reports/csv';

export async function shareCsv(
  filename: string,
  rows: Record<string, unknown>[]
) {
  const csv = rowsToCsv(rows);

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('File cache directory is unavailable.');

  const path = `${directory}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'Export BUKLOD Report',
      UTI: 'public.comma-separated-values-text',
    });
  }
}

export async function shareWorkbook(
  filename: string,
  workbook: XLSX.WorkBook
) {
  const mimeType =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (Platform.OS === 'web') {
    const bytes = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      compression: true,
    });

    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('File cache directory is unavailable.');

  const path = `${directory}${filename}`;
  const base64 = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'base64',
    compression: true,
  });

  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is unavailable on this device.');
  }

  await Sharing.shareAsync(path, {
    mimeType,
    dialogTitle: 'Export BUKLOD Master Record',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}