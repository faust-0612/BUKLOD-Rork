import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdminGate } from '@/components/AdminGate';
import { Card, SectionTitle, shared } from '@/components/UI';
import {
  isDraftLessonMemberVisible,
  loadAdminFormationCurriculumPreview,
} from '@/lib/buklodFormationProgress';
import { colors } from '@/lib/theme';

type PreviewRow = {
  track_lesson_id: string;
  stage_code: number;
  role_track_code?: string;
  lesson_sequence: number;
  lesson_title?: string;
  lesson_code?: string;
  is_required?: boolean;
  is_active?: boolean;
  published_version_status?: string;
  source_label?: string;
  source_document?: string;
  source_page_start?: number | null;
  source_page_end?: number | null;
  component_code?: string;
  track_slug?: string;
  member_visible?: boolean;
};

export default function AdminFormationCurriculumPreviewScreen() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAdminFormationCurriculumPreview({});
      setRows(data as PreviewRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>IMPLEMENTATION 005</Text>
        <Text style={shared.h1}>Curriculum Preview</Text>
        <Text style={shared.muted}>
          Source provenance for 101–105 and publish status for generated 106/107
          lessons. Draft lessons are not member-accessible.
        </Text>

        {loading && <ActivityIndicator color={colors.green} />}

        <SectionTitle>TRACK LESSONS</SectionTitle>
        {!loading && rows.length === 0 && (
          <Card>
            <Text style={shared.muted}>
              No curriculum rows yet. Run SYNC 101–105 SOURCE from the Lesson
              Builder after migrations are applied.
            </Text>
          </Card>
        )}

        {rows.map((row) => {
          const memberVisible = isDraftLessonMemberVisible({
            stageCode: row.stage_code,
            publishedVersionStatus: row.published_version_status,
            memberVisible: row.member_visible,
          });

          return (
            <Card key={row.track_lesson_id}>
              <Text style={styles.title}>
                BUKLOD {row.stage_code}
                {row.role_track_code ? ` · ${row.role_track_code}` : ''} · L
                {row.lesson_sequence}
              </Text>
              <Text style={shared.body}>{row.lesson_title ?? 'Untitled lesson'}</Text>
              <Text style={shared.muted}>
                {row.is_required ? 'Required' : 'Optional'} ·{' '}
                {row.is_active ? 'Active' : 'Inactive'} · Version:{' '}
                {row.published_version_status ?? 'none'} · Member:{' '}
                {memberVisible ? 'visible' : 'blocked'}
              </Text>
              {row.source_label && (
                <Text style={styles.source}>
                  SOURCE: {row.source_label}
                  {row.source_page_start != null
                    ? ` · pp. ${row.source_page_start}${
                        row.source_page_end != null
                          ? `–${row.source_page_end}`
                          : ''
                      }`
                    : ''}
                </Text>
              )}
              {row.component_code && (
                <Text style={shared.muted}>
                  {row.component_code}
                  {row.track_slug ? ` · ${row.track_slug}` : ''}
                  {row.lesson_code ? ` · ${row.lesson_code}` : ''}
                </Text>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 48 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  title: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  source: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.greenDark,
  },
});
