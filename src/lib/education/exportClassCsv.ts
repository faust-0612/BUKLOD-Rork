import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { supabase } from '@/lib/supabase';

function csv(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportEducationClassCsv(classroomId: string, classroomName: string) {
  const { data, error } = await supabase.rpc('buklod_education_class_report_v1', {
    p_classroom_id: classroomId,
  });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    display_name: string | null;
    username: string | null;
    current_weighted_grade: number | null;
    released_components: number | null;
  }>;

  const lines = [
    ['Student', 'Username', 'Current Weighted Grade', 'Released Components']
      .map(csv)
      .join(','),
    ...rows.map(row =>
      [
        row.display_name ?? '',
        row.username ?? '',
        row.current_weighted_grade ?? '',
        row.released_components ?? 0,
      ]
        .map(csv)
        .join(',')
    ),
  ];

  const safe = classroomName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 50) || 'class';
  const target = `${FileSystem.cacheDirectory}BUKLOD_${safe}_class_report.csv`;

  await FileSystem.writeAsStringAsync(target, '\ufeff' + lines.join('\r\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(target, {
    mimeType: 'text/csv',
    dialogTitle: `Export ${classroomName}`,
    UTI: 'public.comma-separated-values-text',
  });
}