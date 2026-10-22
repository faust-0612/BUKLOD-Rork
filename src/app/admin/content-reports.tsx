import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import {
  contentReportEntityLabel,
  contentReportReasonLabel,
  isOpenContentReport,
  listContentReports,
  resolveContentReport,
  type ContentReportRow,
} from '@/lib/buklodContentReports';

export default function ContentReportsAdmin() {
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await listContentReports();
      setReports(rows);
    } catch (error: any) {
      Alert.alert(
        'Reports',
        error?.message || 'Could not load reports.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const actionReport = async (
    item: ContentReportRow,
    hide: boolean
  ) => {
    try {
      await resolveContentReport({
        reportId: item.id,
        hideContent: hide,
        resolution: hide
          ? 'Hidden after System Admin review.'
          : 'Reviewed; the post or comment stays visible.',
      });
      await load();
    } catch (error: any) {
      Alert.alert(
        'Reports',
        error?.message || 'Could not update this report.'
      );
    }
  };

  const openCount = reports.filter((row) =>
    isOpenContentReport(row.status)
  ).length;

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={shared.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Text style={shared.h1}>Reported posts & comments</Text>
        <Text style={shared.muted}>
          Members tap Report on a post or comment and choose a reason.
          Open items wait here for a System Admin.
        </Text>

        <Card>
          <Text style={shared.h2}>{openCount} open</Text>
          <Text style={shared.muted}>
            {reports.length} total in this list
          </Text>
        </Card>

        <SectionTitle>QUEUE</SectionTitle>

        {!reports.length ? (
          <Card>
            <Text style={shared.muted}>
              {loading ? 'Loading reports...' : 'No reports yet.'}
            </Text>
          </Card>
        ) : (
          reports.map((item) => {
            const open = isOpenContentReport(item.status);
            return (
              <Card key={item.id}>
                <Text style={shared.h2}>
                  {contentReportReasonLabel(item.reason)}
                </Text>
                <Text style={shared.muted}>
                  {contentReportEntityLabel(item.entity_type)}
                  {' • '}
                  {item.status}
                  {item.created_at
                    ? ` • ${new Date(item.created_at).toLocaleString()}`
                    : ''}
                </Text>
                <Text style={[shared.muted, { marginTop: 4 }]}>
                  Reported by {item.reporter_name}
                </Text>
                {!!item.snippet && (
                  <Text style={[shared.body, { marginTop: 8 }]}>
                    {item.snippet}
                  </Text>
                )}
                {!!item.details && (
                  <Text style={[shared.body, { marginTop: 6 }]}>
                    Note: {item.details}
                  </Text>
                )}
                {!!item.resolution && (
                  <Text style={[shared.muted, { marginTop: 6 }]}>
                    {item.resolution}
                  </Text>
                )}

                {item.entity_type === 'post' && !!item.entity_id ? (
                  <View style={{ marginTop: 10 }}>
                    <Button
                      title="OPEN POST"
                      outline
                      onPress={() =>
                        router.push(`/post/${item.entity_id}` as any)
                      }
                    />
                  </View>
                ) : null}

                {open ? (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    <Button
                      title="HIDE AND CLOSE"
                      onPress={() => void actionReport(item, true)}
                    />
                    <Button
                      title="KEEP VISIBLE AND CLOSE"
                      outline
                      onPress={() => void actionReport(item, false)}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </AdminGate>
  );
}
