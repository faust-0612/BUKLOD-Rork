import { supabase } from '@/lib/supabase';

export type BsocSupportCase = {
  case_code: string;
  status: string;
  queue_code: string;
  category: string;
  app: string;
  feature: string | null;
  title: string;
  message: string;
  platform: string | null;
  app_version: string | null;
  route: string | null;
  error_code: string | null;
  language_code: string | null;
  diagnostics: Record<string, unknown>;
  incident_code: string | null;
  created_at: string;
  updated_at: string;
};

export type BsocIncident = {
  incident_code: string;
  status: string;
  severity: string;
  app: string;
  feature: string | null;
  category: string;
  platform_scope: string | null;
  error_code: string | null;
  title: string;
  public_message: string;
  affected_users: number;
  opened_at: string;
  updated_at: string;
};

export type BsocSupportMetrics = {
  open: number;
  being_reviewed: number;
  waiting_for_user: number;
  resolved_24h: number;
  active_incidents: number;
};

function rows(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function supportStatusFromBackend(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'triaged') return 'WAITING_FOR_USER';
  if (status === 'in_progress') return 'BEING_REVIEWED';
  if (status === 'resolved' || status === 'closed') return 'RESOLVED';
  return 'OPEN';
}

function supportStatusToBackend(value: unknown): string | null {
  const status = String(value ?? '').trim().toUpperCase();
  if (!status) return null;
  if (status === 'WAITING_FOR_USER') return 'triaged';
  if (status === 'BEING_REVIEWED') return 'in_progress';
  if (status === 'RESOLVED') return 'resolved';
  return 'new';
}

function incidentStatusFromBackend(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'investigating') return 'INVESTIGATING';
  if (
    status === 'fix_ready' ||
    status === 'retest_required' ||
    status === 'retest_passed'
  ) {
    return 'MONITORING';
  }
  if (status === 'closed' || status === 'accepted') return 'RESOLVED';
  return 'POSSIBLE_SHARED_INCIDENT';
}

function incidentStatusToBackend(
  value: 'INVESTIGATING' | 'MONITORING' | 'RESOLVED',
) {
  if (value === 'INVESTIGATING') return 'investigating';
  if (value === 'MONITORING') return 'retest_required';
  return 'closed';
}

function caseCodeFromReference(value: unknown) {
  const ref = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return ref ? `BUK-${ref}` : '';
}

function incidentCodeFromId(value: unknown) {
  const id = String(value ?? '').trim();
  const ref = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return ref ? `INC-${ref}` : id;
}

function supportSearchText(row: any) {
  return [
    row.reference,
    row.category,
    row.title,
    row.support_code,
    row.route,
    row.platform,
    row.error_category,
  ]
    .map(value => String(value ?? '').toLowerCase())
    .join(' ');
}

export async function loadBsocSupportInbox(input: {
  limit?: number;
  status?: string | null;
  queue?: string | null;
  search?: string | null;
} = {}) {
  const { data, error } = await (supabase as any).rpc(
    'buklod_bsoc_support_queue_v1',
    {
      p_status: supportStatusToBackend(input.status),
      p_limit: Math.max(1, Math.min(input.limit ?? 150, 250)),
      p_before: null,
    },
  );

  if (error) throw error;

  let nextRows = rows(data);
  const search = String(input.search ?? '').trim().toLowerCase();
  if (search) {
    nextRows = nextRows.filter(row =>
      supportSearchText(row).includes(search),
    );
  }

  return nextRows.map(row => ({
    case_code:
      caseCodeFromReference(row.reference) ||
      String(row.feedback_id ?? ''),
    status: supportStatusFromBackend(row.status),
    queue_code: 'BSOC',
    category: String(row.category ?? 'OTHER').toUpperCase(),
    app: 'BUKLOD Main',
    feature: null,
    title: String(row.title ?? 'BUKLOD support request'),
    message: String(row.message ?? ''),
    platform: row.platform ? String(row.platform) : null,
    app_version: row.app_version ? String(row.app_version) : null,
    route: row.route ? String(row.route) : null,
    error_code: row.support_code ? String(row.support_code) : null,
    language_code: null,
    diagnostics: {
      feedback_id: row.feedback_id ?? null,
      app_environment: row.app_environment ?? null,
      error_category: row.error_category ?? null,
      assigned_to: row.assigned_to ?? null,
      resolution: row.resolution ?? null,
    },
    incident_code: null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  })) as BsocSupportCase[];
}

export async function loadBsocIncidents(includeResolved = false) {
  const { data, error } = await (supabase as any).rpc(
    'buklod_bsoc_incident_list_v1',
    {
      p_open_only: !includeResolved,
      p_limit: 150,
    },
  );

  if (error) throw error;

  return rows(data).map(row => ({
    incident_code: incidentCodeFromId(row.incident_id),
    status: incidentStatusFromBackend(row.status),
    severity: String(row.severity ?? 'P3').toUpperCase(),
    app: String(row.app_id ?? 'BUKLOD Main'),
    feature: row.area ? String(row.area) : null,
    category: String(row.error_category ?? row.area ?? 'UNKNOWN').toUpperCase(),
    platform_scope: row.platform ? String(row.platform) : null,
    error_code: row.support_code ? String(row.support_code) : null,
    title: String(row.title ?? 'BUKLOD incident'),
    public_message: String(
      row.resolution ?? row.description ?? 'BUKLOD is reviewing this incident.',
    ),
    affected_users: 0,
    opened_at: String(row.opened_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  })) as BsocIncident[];
}

async function loadQueueStatus(status: string) {
  const { data, error } = await (supabase as any).rpc(
    'buklod_bsoc_support_queue_v1',
    {
      p_status: status,
      p_limit: 500,
      p_before: null,
    },
  );
  if (error) throw error;
  return rows(data);
}

export async function loadBsocSupportMetrics() {
  const [
    metricsResult,
    reviewingRows,
    waitingRows,
    resolvedRows,
    incidentsResult,
  ] = await Promise.all([
    (supabase as any).rpc('buklod_bsoc_feedback_metrics_v1', {
      p_hours: 24,
    }),
    loadQueueStatus('in_progress'),
    loadQueueStatus('triaged'),
    loadQueueStatus('resolved'),
    (supabase as any).rpc('buklod_bsoc_incident_list_v1', {
      p_open_only: true,
      p_limit: 500,
    }),
  ]);

  if (metricsResult.error) throw metricsResult.error;
  if (incidentsResult.error) throw incidentsResult.error;

  const metric = (metricsResult.data ?? {}) as Record<string, unknown>;
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const resolved24h = resolvedRows.filter(row => {
    const at = Date.parse(String(row.updated_at ?? ''));
    return Number.isFinite(at) && at >= since;
  }).length;

  return {
    open: Number(metric.open_support_cases ?? 0),
    being_reviewed: reviewingRows.length,
    waiting_for_user: waitingRows.length,
    resolved_24h: resolved24h,
    active_incidents: rows(incidentsResult.data).length,
  } satisfies BsocSupportMetrics;
}

async function resolveFeedbackId(caseCode: string) {
  const query = String(caseCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/^BUK-/, '');

  const { data, error } = await (supabase as any).rpc(
    'buklod_bsoc_support_lookup_v1',
    { p_query: query },
  );
  if (error) throw error;

  const match = rows(data).find(
    row =>
      caseCodeFromReference(row.reference) ===
        String(caseCode ?? '').trim().toUpperCase() ||
      String(row.reference ?? '').trim().toUpperCase() === query,
  );

  if (!match?.feedback_id) {
    throw new Error('Support case not found. Refresh BSOC and try again.');
  }

  return String(match.feedback_id);
}

export async function updateBsocIncident(input: {
  incidentCode: string;
  status:
    | 'POSSIBLE_SHARED_INCIDENT'
    | 'INVESTIGATING'
    | 'IDENTIFIED'
    | 'MONITORING'
    | 'RESOLVED';
  publicMessage?: string;
}) {
  if (
    input.status !== 'INVESTIGATING' &&
    input.status !== 'MONITORING' &&
    input.status !== 'RESOLVED'
  ) {
    throw new Error('Unsupported BSOC incident transition.');
  }

  const list = await (supabase as any).rpc(
    'buklod_bsoc_incident_list_v1',
    {
      p_open_only: false,
      p_limit: 500,
    },
  );
  if (list.error) throw list.error;

  const target = rows(list.data).find(
    row =>
      incidentCodeFromId(row.incident_id) ===
        String(input.incidentCode ?? '').trim().toUpperCase() ||
      String(row.incident_id ?? '') === input.incidentCode,
  );

  if (!target?.incident_id) {
    throw new Error('Incident not found. Refresh BSOC and try again.');
  }

  const status = incidentStatusToBackend(input.status);
  const resolution =
    input.publicMessage?.trim() ||
    (target.resolution ? String(target.resolution) : null);

  const preview = await (supabase as any).rpc(
    'buklod_bsoc_preview_incident_update_v1',
    {
      p_incident_id: target.incident_id,
      p_status: status,
      p_owner_id: target.owner_id ?? null,
      p_resolution: resolution,
    },
  );
  if (preview.error) throw preview.error;

  const expectedUpdatedAt = preview.data?.expected_updated_at;
  if (!expectedUpdatedAt) {
    throw new Error('Incident preview did not return a concurrency token.');
  }

  const applied = await (supabase as any).rpc(
    'buklod_bsoc_apply_incident_update_v1',
    {
      p_incident_id: target.incident_id,
      p_expected_updated_at: expectedUpdatedAt,
      p_status: status,
      p_owner_id:
        preview.data?.current?.owner_id ??
        target.owner_id ??
        null,
      p_resolution:
        input.publicMessage?.trim() ||
        preview.data?.current?.resolution ||
        resolution,
      p_reason: 'BUKLOD BSOC Web incident action',
    },
  );

  if (applied.error) throw applied.error;
  return applied.data;
}

export async function updateBsocSupportCase(input: {
  caseCode: string;
  status: 'OPEN' | 'WAITING_FOR_USER' | 'BEING_REVIEWED' | 'RESOLVED';
  userMessage?: string;
}) {
  const feedbackId = await resolveFeedbackId(input.caseCode);
  const status = supportStatusToBackend(input.status) ?? 'new';

  const preview = await (supabase as any).rpc(
    'buklod_bsoc_preview_support_case_action_v1',
    {
      p_feedback_id: feedbackId,
      p_status: status,
      p_resolution: input.userMessage?.trim() || null,
      p_assigned_to: null,
    },
  );
  if (preview.error) throw preview.error;

  const expectedUpdatedAt = preview.data?.expected_updated_at;
  if (!expectedUpdatedAt) {
    throw new Error('Support preview did not return a concurrency token.');
  }

  const applied = await (supabase as any).rpc(
    'buklod_bsoc_apply_support_case_action_v1',
    {
      p_feedback_id: feedbackId,
      p_expected_updated_at: expectedUpdatedAt,
      p_status: status,
      p_resolution:
        input.userMessage?.trim() ||
        preview.data?.current?.resolution ||
        null,
      p_assigned_to:
        preview.data?.current?.assigned_to ??
        null,
      p_reason: 'BUKLOD BSOC Web support action',
    },
  );

  if (applied.error) throw applied.error;
  return applied.data;
}
