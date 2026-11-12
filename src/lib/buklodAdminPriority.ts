import { supabase } from '@/lib/supabase';
import { listContentReports, isOpenContentReport, contentReportReasonLabel } from '@/lib/buklodContentReports';
import { listFocusAppPaymentRequests } from '@/lib/buklodFocusAppSubscription';
import { listFaithPaymentRequests } from '@/lib/buklodScopeFaithAccess';
import { listScopeProductPayments } from '@/lib/buklodScopeProductAccess';
import { adminListBuklodR38Withdrawals } from '@/lib/buklodR38AdminEconomy';
import { bsocCaseRoute, mergePendingCaseSamples, rankPriorityLevel } from '@/lib/buklodAdminPriorityPolicy';

/**
 * In-app System Admin work queue, derived from canonical request records.
 * A "read" notification is not the same as a completed request.
 * No payments, approvals or support cases are mutated by this module.
 */
export type PriorityGroup = 'support' | 'advertising' | 'approvals' | 'safety' | 'privacy';
export type PriorityLevel = 'urgent' | 'high' | 'normal';
export type AdminPriorityItem = {
  key: string;
  group: PriorityGroup;
  source: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  route: string;
  level: PriorityLevel;
};

export type AdminPrioritySnapshot = {
  items: AdminPriorityItem[];
  pendingTotal: number;
  unreadSupportAlerts: number | null;
  failedSources: string[];
  cappedSources: string[];
  refreshedAt: number;
};

const LIMIT = 100;
const text = (value: unknown, fallback = '') =>
  String(value ?? fallback).trim().slice(0, 160);
const date = (value: unknown) => {
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
};
const errorIf = (error: { message?: string } | null) => {
  if (error) throw new Error(error.message || 'Could not load request source');
};
const row = (
  group: PriorityGroup, source: string, id: unknown,
  title: unknown, summary: unknown, status: unknown,
  createdAt: unknown, route: string, level: PriorityLevel
): AdminPriorityItem => ({
  key: source + ':' + text(id),
  group, source, title: text(title, source), summary: text(summary),
  status: text(status), createdAt: date(createdAt), route, level,
});

export function rankAdminPriority(item: AdminPriorityItem, now = Date.now()) {
  return rankPriorityLevel(item.level, item.createdAt, now);
}

type LoadResult = { items: AdminPriorityItem[]; capped?: boolean; total?: number };
type Source = { name: string; load: () => Promise<LoadResult> };

export async function fetchAdminPriorityRequests(full = false): Promise<AdminPrioritySnapshot> {
  const sources: Source[] = [
    {
      name: 'BSOC support',
      load: async () => {
        // Read only compact fields through existing admin RLS. The legacy
        // support RPC also returns full message bodies, which is too costly
        // for a dashboard badge when hundreds of cases are pending.
        const eachSide = full ? 125 : 25;
        // Sample both new and oldest still-open cases so an aged request
        // cannot disappear behind hundreds of newer submissions.
        // Only small RLS-protected fields cross the wire.
        const [latest, oldest] = await Promise.all([
          supabase.from('user_feedback')
            .select('id,title,category,status,created_at', { count: 'exact' })
            .in('status', ['new', 'triaged', 'in_progress'])
            .order('created_at', { ascending: false }).limit(eachSide),
          supabase.from('user_feedback')
            .select('id,title,category,status,created_at')
            .in('status', ['new', 'triaged', 'in_progress'])
            .order('created_at', { ascending: true }).limit(eachSide),
        ]);
        errorIf(latest.error);
        errorIf(oldest.error);
        const records = mergePendingCaseSamples(latest.data || [], oldest.data || []);
        const count = latest.count;
        return {
          items: records.map(c => row(
            'support', 'BSOC support', c.id, c.title || 'Help request',
            c.category || 'Member concern', c.status, c.created_at,
            bsocCaseRoute(c.id),
            c.status === 'new' ? 'high' : 'normal'
          )),
          total: count ?? records.length,
          capped: (count ?? records.length) > records.length,
        };
      },
    },
    {
      name: 'Paid advertisements',
      load: async () => {
        const { data, error } = await supabase.from('buklod_paid_ad_campaigns')
          .select('id,advertiser_name,headline,status,payment_status,requested_at,created_at')
          .eq('status', 'pending').order('created_at', { ascending: false }).limit(LIMIT);
        errorIf(error);
        const records = data || [];
        return {
          items: records.map(a => row(
            'advertising', 'Paid advertisements', a.id,
            'Ad: ' + a.advertiser_name,
            (a.headline || 'Campaign review') + ' · Payment ' + a.payment_status,
            a.status, a.requested_at || a.created_at,
            '/admin/sponsors', 'high'
          )),
          capped: records.length === LIMIT,
        };
      },
    },
    {
      name: 'Local sponsors',
      load: async () => {
        const { data, error } = await supabase.from('app_sponsors')
          .select('id,sponsor_name,headline,status,created_at')
          .eq('status', 'pending').order('created_at', { ascending: false }).limit(LIMIT);
        errorIf(error);
        const records = data || [];
        return {
          items: records.map(a => row(
            'advertising', 'Local sponsors', a.id, 'Sponsor: ' + a.sponsor_name,
            a.headline, a.status, a.created_at, '/admin/sponsors', 'normal'
          )),
          capped: records.length === LIMIT,
        };
      },
    },
    {
      name: 'Content reports',
      load: async () => {
        const records = (await listContentReports()).filter(a => isOpenContentReport(a.status));
        return {
          items: records.map(a => row(
            'safety', 'Content reports', a.id,
            contentReportReasonLabel(a.reason), a.entity_type + ' · Reported content',
            a.status, a.created_at, '/admin/content-reports', 'urgent'
          )),
          capped: records.length >= 200,
        };
      },
    },
    {
      name: 'Account recovery',
      load: async () => {
        const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
          body: { action: 'admin_list_requests' },
        });
        errorIf(error);
        if (!data?.ok || !Array.isArray(data.requests)) {
          throw new Error('Account recovery queue unavailable');
        }
        const pending = ['pending', 'pending_review', 'new', 'requested', 'needs_match'];
        return {
          items: data.requests
            .filter((a: any) => pending.includes(String(a.status || '').toLowerCase()))
            .map((a: any) => row(
              'support', 'Account recovery', a.id,
              'Account recovery assistance', a.needs_match ? 'Account matching required' : 'Identity verification requested',
              a.status, a.requested_at || a.created_at, '/admin/account-recovery', 'urgent'
            )),
        };
      },
    },
    {
      name: 'Focus App payments',
      load: async () => {
        const records = await listFocusAppPaymentRequests('pending_admin', LIMIT);
        return {
          items: records.map(a => row(
            'approvals', 'Focus App payments', a.id,
            a.display_name || a.focus_app_code, a.scope_name + ' · Payment verification',
            a.status, a.created_at, '/admin/attendance/focus-apps/payments', 'high'
          )),
          capped: records.length === LIMIT,
        };
      },
    },
    {
      name: 'Faith payments',
      load: async () => {
        const records = await listFaithPaymentRequests('pending_admin', LIMIT);
        return {
          items: records.map(a => row(
            'approvals', 'Faith payments', a.id,
            a.payment_kind, (a.scope_name || 'Cluster') + ' · Payment verification',
            a.status, a.created_at, '/admin/faith-payments', 'high'
          )),
          capped: records.length === LIMIT,
        };
      },
    },
    {
      name: 'Scope product payments',
      load: async () => {
        const records = await listScopeProductPayments('pending_admin', LIMIT);
        return {
          items: records.map(a => row(
            'approvals', 'Scope product payments', a.id,
            a.product_code, (a.scope_name || 'Organization') + ' · Payment verification',
            a.status, a.created_at, '/admin/faith-payments', 'high'
          )),
          capped: records.length === LIMIT,
        };
      },
    },
    {
      name: 'Points and mentoring reviews',
      load: async () => {
        const [achievements, mentoring, checkins] = await Promise.all([
          (supabase as any).rpc('admin_get_buklod_r2_rewards_monitor_v1'),
          (supabase as any).rpc('admin_get_buklod_r2_mentor_evidence_v1'),
          (supabase as any).rpc('admin_get_buklod_home_checkin_queue_r3'),
        ]);
        errorIf(achievements.error);
        errorIf(mentoring.error);
        errorIf(checkins.error);
        const overview = achievements.data || {};
        const nominations: any[] = Array.isArray(overview.recent_nominations)
          ? overview.recent_nominations.filter((r: any) => r.status === 'pending') : [];
        const photos: any[] = Array.isArray(mentoring.data) ? mentoring.data : [];
        const attendance: any[] = Array.isArray(checkins.data) ? checkins.data : [];
        return {
          items: [
            ...nominations.map(n => row('approvals', 'Major achievements', n.id,
              'Achievement: ' + n.type, 'Milestone evidence pending verification',
              n.status, n.submitted_at, '/admin/points-r2-monitor', 'high')),
            ...photos.filter(p => p.status === 'pending_admin'
              || (p.status === 'reported' && !!p.photo_path)).map(p => row(
                'approvals', 'Mentor reports', p.session_id,
                'Mentoring: ' + p.lesson, 'Photo evidence submitted for verification',
                p.status, p.session_date, '/admin/points-r2-monitor', 'high'
              )),
            ...attendance.map(a => row('approvals', 'Home attendance', a.id,
              'Check-in: ' + a.event, 'Member attendance verification',
              a.status, a.checked_in_at, '/admin/points-r2-monitor', 'normal')),
          ],
          capped: Number(overview.nominations?.pending || 0) > nominations.length,
        };
      },
    },
    {
      name: 'Withdrawal requests',
      load: async () => {
        const response = await adminListBuklodR38Withdrawals(null);
        const records = (response.rows || []).filter(a =>
          ['requested', 'pending', 'pending_admin', 'approved', 'processing'].includes(a.status));
        return {
          items: records.map(a => row(
            'approvals', 'Withdrawal requests', a.id,
            'Payout review · ' + a.currency + ' ' + a.requested_amount,
            'Financial request; verify account and settlement controls',
            a.status, a.requested_at, '/admin/economy-operations', 'urgent'
          )),
          capped: response.rows.length >= 100,
        };
      },
    },
    {
      name: 'Privacy requests',
      load: async () => {
        const { data, error } = await supabase.from('data_subject_requests')
          .select('id,request_type,status,submitted_at')
          .neq('status', 'completed')
          .order('submitted_at', { ascending: false }).limit(LIMIT);
        errorIf(error);
        const records = data || [];
        return {
          items: records.map(a => row(
            'privacy', 'Privacy requests', a.id,
            'Data rights: ' + a.request_type, 'Privacy review or response required',
            a.status, a.submitted_at, '/admin/privacy', 'urgent'
          )),
          capped: records.length === LIMIT,
        };
      },
    },
    {
      name: 'Account deletion',
      load: async () => {
        const { data, error } = await supabase.from('account_deletion_requests')
          .select('id,status,requested_at').eq('status', 'submitted')
          .order('requested_at', { ascending: false }).limit(LIMIT);
        errorIf(error);
        const records = data || [];
        return {
          items: records.map(a => row(
            'privacy', 'Account deletion', a.id,
            'Account deletion request', 'Handle through verified privacy procedure',
            a.status, a.requested_at, '/admin/privacy', 'urgent'
          )),
          capped: records.length === LIMIT,
        };
      },
    },
  ];
  // Bounded concurrency protects the backend when the console opens.
  const results: PromiseSettledResult<LoadResult>[] = [];
  for (let i = 0; i < sources.length; i += 4) {
    results.push(...await Promise.allSettled(sources.slice(i, i + 4).map(s => s.load())));
  }
  const items: AdminPriorityItem[] = [];
  let pendingTotal = 0;
  const failedSources: string[] = [];
  const cappedSources: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') failedSources.push(sources[i].name);
    else {
      items.push(...result.value.items);
      pendingTotal += result.value.total ?? result.value.items.length;
      if (result.value.capped) cappedSources.push(sources[i].name);
    }
  });
  const current = Date.now();
  items.sort((a, b) => rankAdminPriority(b, current) - rankAdminPriority(a, current)
    || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    || a.key.localeCompare(b.key));

  const unread = await supabase.from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'bsoc_support').is('read_at', null);
  if (unread.error) failedSources.push('Unread support notifications');
  return {
    items, pendingTotal,
    unreadSupportAlerts: unread.error ? null : (unread.count || 0),
    failedSources, cappedSources, refreshedAt: current,
  };
}
