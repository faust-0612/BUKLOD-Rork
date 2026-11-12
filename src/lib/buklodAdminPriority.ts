import { supabase } from '@/lib/supabase';
import { listContentReports, isOpenContentReport, contentReportReasonLabel } from '@/lib/buklodContentReports';
import { listFocusAppPaymentRequests } from '@/lib/buklodFocusAppSubscription';
import { listFaithPaymentRequests } from '@/lib/buklodScopeFaithAccess';
import { listScopeProductPayments } from '@/lib/buklodScopeProductAccess';

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
  const age = Math.max(0, now - new Date(item.createdAt).getTime());
  const base = item.level === 'urgent' ? 3 : item.level === 'high' ? 2 : 1;
  // 72h unattended requests escalate, but never outrank a different
  // category already marked urgent by policy.
  return Math.min(3, base + (age >= 72 * 3600 * 1000 ? 1 : 0));
}

type LoadResult = { items: AdminPriorityItem[]; capped?: boolean };
type Source = { name: string; load: () => Promise<LoadResult> };

export async function fetchAdminPriorityRequests(full = false): Promise<AdminPrioritySnapshot> {
  const sources: Source[] = [
    {
      name: 'BSOC support',
      load: async () => {
        const items: AdminPriorityItem[] = [];
        let before: string | null = null;
        let capped = false;
        const maxPages = full ? 8 : 1;
        const pageSize = full ? 250 : LIMIT;
        for (let page = 0; page < maxPages; page++) {
          const response = await supabase.rpc('buklod_bsoc_support_queue_v1', {
            p_status: null, p_limit: pageSize, p_before: before,
          });
          errorIf(response.error);
          const records = Array.isArray(response.data) ? response.data : [];
          for (const c of records) {
            if (!['new', 'triaged', 'in_progress'].includes(String(c.status))) continue;
            items.push(row(
              'support', 'BSOC support', c.feedback_id, c.title || 'Help request',
              (c.reference || '') + ' · ' + (c.category || 'Member concern'),
              c.status, c.created_at, '/admin/bsoc-support',
              c.status === 'new' ? 'high' : 'normal'
            ));
          }
          if (records.length < pageSize) { capped = false; break; }
          capped = true;
          const last = records[records.length - 1]?.created_at;
          if (!last || last === before) break;
          before = last;
        }
        return { items, capped };
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
  const failedSources: string[] = [];
  const cappedSources: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') failedSources.push(sources[i].name);
    else {
      items.push(...result.value.items);
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
    items,
    unreadSupportAlerts: unread.error ? null : (unread.count || 0),
    failedSources, cappedSources, refreshedAt: current,
  };
}
