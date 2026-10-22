import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
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
import { supabase } from '@/lib/supabase';

export default function PrivacyAdmin() {
  const [requests, setRequests] = useState<any[]>([]);
  const [reports, setReports] = useState<ContentReportRow[]>([]);

  const load = useCallback(async () => {
    const [{ data: r }, reportRows] = await Promise.all([
      supabase
        .from('data_subject_requests')
        .select(
          'id,request_type,status,request_text,response_text,submitted_at,user:user_id(full_name)'
        )
        .order('submitted_at', { ascending: false })
        .limit(100),
      listContentReports().catch(() => [] as ContentReportRow[]),
    ]);
    setRequests(r ?? []);
    setReports(reportRows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completeRequest = async (item: any) => {
    const { error } = await supabase
      .from('data_subject_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        response_text:
          item.response_text ||
          'Processed by BUKLOD privacy administration.',
      })
      .eq('id', item.id);
    if (error) {
      return Alert.alert('Privacy Request', error.message);
    }
    void load();
  };

  const actionReport = async (item: ContentReportRow, hide: boolean) => {
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
      Alert.alert('Moderation', error?.message || 'Could not update this report.');
    }
  };

  const openReports = reports.filter((item) =>
    isOpenContentReport(item.status)
  );

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={shared.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => void load()} />
        }
      >
        <Text style={shared.h1}>Privacy & Moderation</Text>

        <SectionTitle>DATA SUBJECT REQUESTS</SectionTitle>
        {requests.length ? (
          requests.map((item) => (
            <Card key={item.id}>
              <Text style={shared.h2}>
                {item.user?.full_name || 'User'} • {item.request_type}
              </Text>
              <Text style={shared.muted}>
                {item.status} • {new Date(item.submitted_at).toLocaleString()}
              </Text>
              {!!item.request_text && (
                <Text style={[shared.body, { marginTop: 6 }]}>
                  {item.request_text}
                </Text>
              )}
              {item.status !== 'completed' && (
                <View style={{ marginTop: 9 }}>
                  <Button
                    title="MARK COMPLETED"
                    onPress={() => completeRequest(item)}
                  />
                </View>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <Text style={shared.muted}>No privacy requests.</Text>
          </Card>
        )}

        <SectionTitle>REPORTED POSTS & COMMENTS</SectionTitle>
        <Card>
          <Text style={shared.h2}>{openReports.length} open reports</Text>
          <Text style={shared.muted}>
            Members report from any post. Choose a reason, then a System Admin
            reviews it here.
          </Text>
          <View style={{ marginTop: 10 }}>
            <Button
              title="OPEN FULL REPORT QUEUE"
              onPress={() => router.push('/admin/content-reports' as any)}
            />
          </View>
        </Card>

        {!openReports.length ? (
          <Card>
            <Text style={shared.muted}>No open content reports.</Text>
          </Card>
        ) : (
          openReports.map((item) => (
            <Card key={item.id}>
              <Text style={shared.h2}>
                {contentReportReasonLabel(item.reason)} •{' '}
                {contentReportEntityLabel(item.entity_type)}
              </Text>
              <Text style={shared.muted}>
                Reporter: {item.reporter_name} • {item.status}
              </Text>
              {!!item.snippet && (
                <Text style={[shared.body, { marginTop: 6 }]}>
                  {item.snippet}
                </Text>
              )}
              {!!item.details && (
                <Text style={[shared.body, { marginTop: 6 }]}>
                  {item.details}
                </Text>
              )}
              <View style={{ gap: 7, marginTop: 9 }}>
                {item.entity_type === 'post' ? (
                  <Button
                    title="OPEN POST"
                    outline
                    onPress={() =>
                      router.push(`/post/${item.entity_id}` as any)
                    }
                  />
                ) : null}
                <Button
                  title="HIDE CONTENT & RESOLVE"
                  onPress={() => void actionReport(item, true)}
                />
                <Button
                  title="KEEP CONTENT & RESOLVE"
                  outline
                  onPress={() => void actionReport(item, false)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </AdminGate>
  );
}
