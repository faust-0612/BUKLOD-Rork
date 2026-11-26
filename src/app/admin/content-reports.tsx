import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { useAdminShared } from '@/components/useAdminShared';
import { useAuth } from '@/providers/AuthProvider';
import { Button, Card, SectionTitle } from '@/components/UI';
import {
  contentReportEntityLabel,
  contentReportReasonLabel,
  isOpenContentReport,
  listContentReports,
  resolveContentReport,
  type ContentReportRow,
} from '@/lib/buklodContentReports';

export default function ContentReportsAdmin() {
  const shared = useAdminShared();
  const { hasRole } = useAuth();
  const allowed = hasRole('system_admin');
  const loadVersion = useRef(0);
  const pendingActions = useRef(new Set<string>());
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    const seq = ++loadVersion.current;
    setLoading(true);
    try {
      const rows = await listContentReports();
      if (seq !== loadVersion.current) return;
      setReports(rows);
      setLoadError(false);
    } catch {
      if (seq === loadVersion.current) setLoadError(true);
    } finally {
      if (seq === loadVersion.current) setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (allowed) void load();
    return () => { loadVersion.current += 1; };
  }, [allowed, load]);

  const actionReport = async (
    item: ContentReportRow,
    hide: boolean
  ) => {
    if (!allowed || pendingActions.current.has(item.id)) return;
    pendingActions.current.add(item.id);
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
    } finally { pendingActions.current.delete(item.id); }
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
          <Text style={shared.h2}>{loadError ? 'Report count unverified' : loading ? 'Checking reports…' : `${openCount} open`}</Text>
          {loadError && <Text accessibilityRole="alert" style={shared.body}>Unable to verify reports. Pull down to retry; previously loaded items may be stale.</Text>}
          <Text style={shared.muted}>
            {loadError ? 'Last loaded items: ' : 'Total in this list: '}{reports.length}
          </Text>
        </Card>

        <SectionTitle>QUEUE</SectionTitle>

        {!reports.length ? (
          <Card>
            <Text style={shared.muted}>
              {loading ? 'Loading reports...' : loadError ? 'Report status unknown.' : 'No reports yet.'}
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

                {open && !loadError && !loading ? (
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
