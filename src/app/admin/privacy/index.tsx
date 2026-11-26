import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
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
import { supabase } from '@/lib/supabase';

export default function PrivacyAdmin() {
  const shared = useAdminShared();
  const { hasRole } = useAuth();
  const allowed = hasRole('system_admin');
  const loadVersion = useRef(0);
  const pendingActions = useRef(new Set<string>());
  const [requests, setRequests] = useState<any[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<{ id: string; status: string; requested_at: string }[]>([]);
  const [deletionError, setDeletionError] = useState('');
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState(false);
  const [reportError, setReportError] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    const seq = ++loadVersion.current;
    setLoading(true);
    try {
      const [rights, reportRows, deletion] = await Promise.allSettled([
        supabase.from('data_subject_requests')
          .select('id,request_type,status,request_text,response_text,submitted_at,user:user_id(full_name)')
          .order('submitted_at', { ascending: false }).limit(100),
        listContentReports(),
        supabase.from('account_deletion_requests')
          .select('id,status,requested_at').eq('status', 'submitted')
          .order('requested_at', { ascending: true }).limit(100),
      ]);
      if (seq !== loadVersion.current) return;
      if (rights.status === 'fulfilled' && !rights.value.error) {
        setRequests(rights.value.data ?? []);
        setRequestError(false);
      } else setRequestError(true);
      if (reportRows.status === 'fulfilled') {
        setReports(reportRows.value);
        setReportError(false);
      } else setReportError(true);
      if (deletion.status === 'fulfilled' && !deletion.value.error) {
        setDeletionRequests(deletion.value.data ?? []);
        setDeletionError('');
      } else setDeletionError('Unable to verify deletion requests. Pull down to retry.');
    } finally {
      if (seq === loadVersion.current) setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (allowed) void load();
    return () => { loadVersion.current += 1; };
  }, [allowed, load]);

  const completeRequest = async (item: any) => {
    if (!allowed || pendingActions.current.has(item.id)) return;
    pendingActions.current.add(item.id);
    try {
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
    await load();
    } catch {
      Alert.alert('Privacy Request', 'Could not complete this request. Please retry.');
    } finally { pendingActions.current.delete(item.id); }
  };

  const actionReport = async (item: ContentReportRow, hide: boolean) => {
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
      Alert.alert('Moderation', error?.message || 'Could not update this report.');
    } finally { pendingActions.current.delete(item.id); }
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
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Text style={shared.h1}>Privacy & Moderation</Text>

        <SectionTitle>ACCOUNT DELETION REQUESTS</SectionTitle>
        {!!deletionError && <Text accessibilityRole="alert" style={shared.body}>
          {deletionError} Previously loaded items, if any, may be stale.
        </Text>}
        {loading && !deletionRequests.length && <Text style={shared.muted}>Checking deletion requests…</Text>}
        {deletionRequests.map(item => (
          <Card key={item.id}>
            <Text style={shared.h2}>Account deletion · Submitted</Text>
            <Text selectable style={shared.muted}>Request reference: {item.id}</Text>
            <Text style={shared.muted}>{new Date(item.requested_at).toLocaleString()}</Text>
            <Text style={shared.body}>
              Sensitive request. Verify the account owner and follow the documented
              privacy/deletion procedure. Review the oldest requests first. This screen does not delete accounts automatically.
              Do not mark a request resolved until the protected procedure has been verified.
            </Text>
          </Card>
        ))}
        {!deletionRequests.length && !deletionError && !loading && (
          <Card><Text style={shared.muted}>No account deletion requests awaiting review.</Text></Card>
        )}

        <SectionTitle>DATA SUBJECT REQUESTS</SectionTitle>
        {requestError && <Text accessibilityRole="alert" style={shared.body}>Unable to verify privacy requests. Pull down to retry; previously loaded items may be stale.</Text>}
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
              {item.status !== 'completed' && !requestError && !loading && (
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
            <Text style={shared.muted}>{loading ? 'Checking privacy requests…' : requestError ? 'Privacy request status unknown.' : 'No privacy requests.'}</Text>
          </Card>
        )}

        <SectionTitle>REPORTED POSTS & COMMENTS</SectionTitle>
        <Card>
          <Text style={shared.h2}>{reportError ? 'Report count unverified' : loading ? 'Checking reports…' : `${openReports.length} open reports`}</Text>
          {reportError && <Text accessibilityRole="alert" style={shared.body}>Unable to verify reports. Pull down to retry; previously loaded items may be stale.</Text>}
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
            <Text style={shared.muted}>{loading ? 'Checking content reports…' : reportError ? 'Content report status unknown.' : 'No open content reports.'}</Text>
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
              {!reportError && !loading && <View style={{ gap: 7, marginTop: 9 }}>
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
              </View>}
            </Card>
          ))
        )}
      </ScrollView>
    </AdminGate>
  );
}
