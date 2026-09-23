import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';

export type BsocHealthOverview = {
  generated_at?: string | null;
  hours?: number;
  detected_issues?: number;
  event_occurrences?: number;
  local_self_heal_success?: number;
  remote_shadow_proposals?: number;
  remote_auto_healed?: number;
  verification_failures?: number;
  escalated_events?: number;
  incident_linked_events?: number;
  support_cases_created?: number;
  top_signatures?: Array<{
    error_signature?: string | null;
    app_id?: string | null;
    occurrences?: number;
    affected_users?: number;
    last_seen_at?: string | null;
  }>;
};

export type BsocHealthEvent = {
  event_id: string;
  user_ref: string;
  app_id: string;
  app_version: string | null;
  platform: string;
  environment: string;
  route_module: string | null;
  health_category: string;
  severity: string;
  safe_error_code: string;
  error_signature: string;
  repeat_count: number;
  local_self_heal_result: string | null;
  lifecycle_state: string;
  incident_id: string | null;
  support_case_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type BsocRecoveryRun = {
  recovery_run_id: string;
  event_id: string;
  user_ref: string;
  app_id: string;
  route_module: string | null;
  playbook_id: string;
  playbook_version: number;
  mode: string;
  state: string;
  attempt_count: number;
  verification_result: string | null;
  incident_id: string | null;
  support_case_id: string | null;
  started_at: string;
  finished_at: string | null;
};

export type BsocRecoveryPlaybook = {
  playbook_id: string;
  version: number;
  app_id: string | null;
  module_pattern: string | null;
  health_category: string;
  error_signature: string;
  risk_level: string;
  action_kind: string;
  max_attempts: number;
  timeout_seconds: number;
  cooldown_seconds: number;
  verification_type: string;
  escalation_target: string;
  audit_required: boolean;
  mode: string;
  kill_switch: boolean;
  qa_verified_at: string | null;
  executor_ready: boolean;
  updated_at: string;
};

export type BsocUserHealthSnapshot = {
  generated_at?: string | null;
  user_id?: string | null;
  latest_event?: Record<string, unknown> | null;
  categories?: Array<Record<string, unknown>>;
  recent_recoveries?: Array<Record<string, unknown>>;
};

async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  label: string,
): Promise<T> {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(name, args),
    8_000,
    label,
  );

  if (result.error) {
    throw new Error(
      String(result.error.message ?? result.error ?? label),
    );
  }

  return result.data as T;
}

export async function loadBsocHealthOverview(
  hours = 24,
): Promise<BsocHealthOverview> {
  const data = await rpc<BsocHealthOverview>(
    'buklod_bsoc_health_overview_v1',
    { p_hours: Math.max(1, Math.min(hours, 720)) },
    'BSOC health overview',
  );

  return data ?? {};
}

export async function loadBsocHealthEvents(input: {
  hours?: number;
  state?: string | null;
  limit?: number;
} = {}): Promise<BsocHealthEvent[]> {
  const data = await rpc<BsocHealthEvent[]>(
    'buklod_bsoc_health_event_list_v1',
    {
      p_hours: Math.max(1, Math.min(input.hours ?? 24, 720)),
      p_state: input.state?.trim() || null,
      p_limit: Math.max(1, Math.min(input.limit ?? 100, 500)),
    },
    'BSOC health events',
  );

  return Array.isArray(data) ? data : [];
}

export async function loadBsocRecoveryRuns(input: {
  hours?: number;
  limit?: number;
} = {}): Promise<BsocRecoveryRun[]> {
  const data = await rpc<BsocRecoveryRun[]>(
    'buklod_bsoc_recovery_run_list_v1',
    {
      p_hours: Math.max(1, Math.min(input.hours ?? 24, 720)),
      p_limit: Math.max(1, Math.min(input.limit ?? 100, 500)),
    },
    'BSOC recovery runs',
  );

  return Array.isArray(data) ? data : [];
}

export async function loadBsocRecoveryPlaybooks(): Promise<
  BsocRecoveryPlaybook[]
> {
  const result = await withBuklodTimeout(
    (supabase as any)
      .from('bsoc_recovery_playbooks')
      .select(
        [
          'playbook_id',
          'version',
          'app_id',
          'module_pattern',
          'health_category',
          'error_signature',
          'risk_level',
          'action_kind',
          'max_attempts',
          'timeout_seconds',
          'cooldown_seconds',
          'verification_type',
          'escalation_target',
          'audit_required',
          'mode',
          'kill_switch',
          'qa_verified_at',
          'executor_ready',
          'updated_at',
        ].join(','),
      )
      .order('playbook_id', { ascending: true })
      .order('version', { ascending: false }),
    8_000,
    'BSOC recovery playbooks',
  );

  if (result.error) {
    throw new Error(
      String(
        result.error.message ??
          result.error ??
          'BSOC recovery playbooks unavailable',
      ),
    );
  }

  return Array.isArray(result.data)
    ? (result.data as BsocRecoveryPlaybook[])
    : [];
}

export async function loadBsocUserHealthSnapshot(
  userId: string,
): Promise<BsocUserHealthSnapshot> {
  if (!userId) throw new Error('User id is required.');

  return rpc<BsocUserHealthSnapshot>(
    'buklod_bsoc_user_health_snapshot_v1',
    { p_user_id: userId },
    'BSOC user health snapshot',
  );
}

export function bsocVerifiedRecoveryRate(
  overview: BsocHealthOverview | null,
) {
  if (!overview) return null;

  const verified = Number(
    overview.remote_auto_healed ?? 0,
  );
  const failed = Number(
    overview.verification_failures ?? 0,
  );
  const denominator = verified + failed;

  if (denominator <= 0) return null;
  return (verified / denominator) * 100;
}

export function bsocSupportDeflectionRate(
  overview: BsocHealthOverview | null,
) {
  if (!overview) return null;

  const local = Number(
    overview.local_self_heal_success ?? 0,
  );
  const remote = Number(
    overview.remote_auto_healed ?? 0,
  );
  const support = Number(
    overview.support_cases_created ?? 0,
  );
  const denominator = local + remote + support;

  if (denominator <= 0) return null;
  return ((local + remote) / denominator) * 100;
}
