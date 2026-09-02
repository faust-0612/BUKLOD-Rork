import { supabase } from '@/lib/supabase';

export const CONTENT_REPORT_ENTITY_TYPES = [
  'post',
  'comment',
  'prayer',
  'bulletin',
] as const;

export type ContentReportEntityType =
  (typeof CONTENT_REPORT_ENTITY_TYPES)[number];

export const CONTENT_REPORT_REASONS = [
  {
    id: 'spam',
    label: 'Unwanted or repeated',
    hint: 'Same message over and over, ads, or junk.',
  },
  {
    id: 'harassment',
    label: 'Hurtful or bullying',
    hint: 'Attacks a person or group.',
  },
  {
    id: 'privacy',
    label: 'Personal information',
    hint: 'Private details that should not be shared.',
  },
  {
    id: 'misinformation',
    label: 'False or misleading',
    hint: 'Looks untrue or meant to confuse people.',
  },
  {
    id: 'inappropriate',
    label: 'Not right for this community',
    hint: 'Unsafe, offensive, or out of place here.',
  },
  {
    id: 'other',
    label: 'Something else',
    hint: 'Tell us more in the notes.',
  },
] as const;

export type ContentReportReasonId =
  (typeof CONTENT_REPORT_REASONS)[number]['id'];

export type ContentReportRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  reporter_name: string;
  snippet: string | null;
};

export function contentReportReasonLabel(reason: string) {
  const match = CONTENT_REPORT_REASONS.find(
    (item) => item.id === reason
  );
  return match?.label ?? reason;
}

export function contentReportEntityLabel(entityType: string) {
  switch (String(entityType || '').toLowerCase()) {
    case 'comment':
      return 'Comment';
    case 'prayer':
      return 'Prayer';
    case 'bulletin':
      return 'Bulletin';
    default:
      return 'Post';
  }
}

function readReportRow(raw: any): ContentReportRow | null {
  const id = String(raw?.id ?? '').trim();
  if (!id) {
    return null;
  }

  const reporter =
    raw?.reporter_name ??
    raw?.reporter?.full_name ??
    raw?.reporter?.display_name ??
    'Member';

  return {
    id,
    entity_type: String(raw?.entity_type ?? 'post'),
    entity_id: String(raw?.entity_id ?? ''),
    reason: String(raw?.reason ?? 'other'),
    details: raw?.details ? String(raw.details) : null,
    status: String(raw?.status ?? 'open'),
    resolution: raw?.resolution ? String(raw.resolution) : null,
    created_at: String(raw?.created_at ?? ''),
    reporter_name: String(reporter || 'Member'),
    snippet: raw?.snippet ? String(raw.snippet) : null,
  };
}

export async function submitContentReport(args: {
  entityType: string;
  entityId: string;
  reason: string;
  details?: string | null;
}) {
  const entityType = String(args.entityType || 'post').trim();
  const entityId = String(args.entityId || '').trim();
  const reason = String(args.reason || 'other').trim();
  const details = String(args.details ?? '').trim() || null;

  if (!entityId) {
    throw new Error('This item can no longer be reported.');
  }

  const { error } = await (supabase as any).rpc(
    'submit_content_report',
    {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_reason: reason,
      p_details: details,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listContentReports(): Promise<ContentReportRow[]> {
  const rpc = await (supabase as any).rpc(
    'list_buklod_content_reports_v1'
  );

  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data
      .map((row: any) => readReportRow(row))
      .filter((row: ContentReportRow | null): row is ContentReportRow => !!row);
  }

  const { data, error } = await supabase
    .from('content_reports')
    .select(
      'id,entity_type,entity_id,reason,details,status,resolution,created_at,reporter:reporter_id(full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => readReportRow(row))
    .filter((row): row is ContentReportRow => !!row);
}

export async function resolveContentReport(args: {
  reportId: string;
  hideContent: boolean;
  resolution: string;
}) {
  const { error } = await (supabase as any).rpc(
    'resolve_content_report',
    {
      p_report_id: args.reportId,
      p_hide_content: args.hideContent,
      p_resolution: args.resolution,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function isOpenContentReport(status: string) {
  const value = String(status || '').toLowerCase();
  return value === 'open' || value === 'pending' || value === 'new';
}
