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

export async function loadBsocSupportInbox(input: {
  limit?: number;
  status?: string | null;
  queue?: string | null;
  search?: string | null;
} = {}) {
  const { data, error } = await supabase.rpc(
    'buklod_bsoc_support_inbox_v1' as any,
    {
      p_limit: Math.max(1, Math.min(input.limit ?? 150, 250)),
      p_status: input.status ?? null,
      p_queue: input.queue ?? null,
      p_search: input.search?.trim() || null,
    } as any,
  );

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as BsocSupportCase[];
}

export async function loadBsocIncidents(includeResolved = false) {
  const { data, error } = await supabase.rpc(
    'buklod_bsoc_incidents_v1' as any,
    {
      p_limit: 150,
      p_include_resolved: includeResolved,
    } as any,
  );

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as BsocIncident[];
}

export async function loadBsocSupportMetrics() {
  const { data, error } = await supabase.rpc(
    'buklod_bsoc_support_metrics_v1' as any,
  );

  if (error) throw error;
  const row = (data ?? {}) as Partial<BsocSupportMetrics>;

  return {
    open: Number(row.open ?? 0),
    being_reviewed: Number(row.being_reviewed ?? 0),
    waiting_for_user: Number(row.waiting_for_user ?? 0),
    resolved_24h: Number(row.resolved_24h ?? 0),
    active_incidents: Number(row.active_incidents ?? 0),
  } satisfies BsocSupportMetrics;
}

export async function updateBsocSupportCase(input: {
  caseCode: string;
  status: 'OPEN' | 'WAITING_FOR_USER' | 'BEING_REVIEWED' | 'RESOLVED';
  userMessage?: string;
}) {
  const { data, error } = await supabase.rpc(
    'buklod_bsoc_update_support_case_v1' as any,
    {
      p_case_code: input.caseCode,
      p_status: input.status,
      p_user_message: input.userMessage?.trim() || null,
    } as any,
  );

  if (error) throw error;
  return data;
}
