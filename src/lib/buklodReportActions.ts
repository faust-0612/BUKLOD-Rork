import { supabase } from '@/lib/supabase';
import type { ScopeManagementAction } from '@/lib/buklodReportConsolidation';

const SUPERVISOR_ONLY_ACTION_TYPES = new Set([
  'REASSIGNMENT_REVIEW',
  'SUSPENSION_REVIEW',
  'DISMISSAL_REVIEW',
]);

export async function fetchMyReportActions(scopeId?: string | null): Promise<ScopeManagementAction[]> {
  const { data, error } = await (supabase as any).rpc('buklod_report_my_actions_v1', {
    p_scope_id: scopeId || null,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data as ScopeManagementAction[] : [])
    .filter((action) => !SUPERVISOR_ONLY_ACTION_TYPES.has(action.action_type));
}

export async function updateMyReportAction(args: {
  actionId: string;
  status: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'DONE';
  outcome?: string | null;
}) {
  const { data, error } = await (supabase as any).rpc('buklod_report_update_my_action_v1', {
    p_action_id: args.actionId,
    p_status: args.status,
    p_outcome: args.outcome ?? null,
  });
  if (error) throw error;
  const action = data as ScopeManagementAction;
  if (SUPERVISOR_ONLY_ACTION_TYPES.has(action.action_type)) {
    throw new Error('This administrative review can only be completed by an authorized supervisor.');
  }
  return action;
}
