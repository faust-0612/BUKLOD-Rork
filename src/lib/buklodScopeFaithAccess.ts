import { resolveBuklodActiveClusterTruth } from '@/lib/buklodActiveClusterTruth';
import { supabase } from '@/lib/supabase';
import { BUKLOD_PAID_FEATURES_ENABLED } from '@/lib/buklodCommercialCatalog';

export type FaithLessonStageAccess = {
  stage_code: number;
  title: string;
  price_php: number;
  scope_unlocked: boolean;
  pending_request_id: string | null;
};

export type FaithFeatureAccess = {
  price_php: number;
  unlocked: boolean;
  pending_request_id: string | null;
};

export type ScopeFaithAccessStatus = {
  scope_id: string;
  gcash_number: string;
  is_mzb_scope_exempt: boolean;
  is_mzb_user_exempt: boolean;
  has_active_cluster: boolean;
  cluster_id: string | null;
  cluster_name: string | null;
  cluster_role: string | null;
  organization_id: string | null;
  organization_name: string | null;
  join_status: 'NONE' | 'PENDING' | 'ACTIVE';
  daily_reading: FaithFeatureAccess;
  devotion_word: FaithFeatureAccess;
  lesson_stages: FaithLessonStageAccess[];
};

export type FaithPaymentRequestRow = {
  id: string;
  payment_kind: string;
  scope_id: string | null;
  scope_name: string | null;
  stage_code: number | null;
  feature_code: string | null;
  submitted_by: string;
  submitter_name: string;
  gcash_reference: string;
  amount_php: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
};

export type FaithPaymentKind =
  | 'LESSON_STAGE'
  | 'DAILY_READING'
  | 'DEVOTION_WORD';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFeatureAccess(raw: unknown): FaithFeatureAccess {
  const row = (raw ?? {}) as Record<string, unknown>;

  return {
    price_php: toNumber(row.price_php),
    unlocked: row.unlocked === true,
    pending_request_id: row.pending_request_id
      ? String(row.pending_request_id)
      : null,
  };
}

function parseAccessStatus(raw: unknown): ScopeFaithAccessStatus | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;
  const scopeId = String(row.scope_id ?? '').trim();

  if (!scopeId) return null;

  const stages = Array.isArray(row.lesson_stages)
    ? row.lesson_stages
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const stage = item as Record<string, unknown>;
          const stageCode = toNumber(stage.stage_code, 0);

          if (!stageCode) return null;

          return {
            stage_code: stageCode,
            title: String(stage.title ?? `Buklod ${stageCode}`),
            price_php: toNumber(stage.price_php),
            scope_unlocked: stage.scope_unlocked === true,
            pending_request_id: stage.pending_request_id
              ? String(stage.pending_request_id)
              : null,
          };
        })
        .filter(Boolean) as FaithLessonStageAccess[]
    : [];

  const joinRaw = String(row.join_status ?? 'NONE').trim().toUpperCase();
  const joinStatus: ScopeFaithAccessStatus['join_status'] =
    joinRaw === 'PENDING' || joinRaw === 'ACTIVE' ? joinRaw : 'NONE';

  return {
    scope_id: scopeId,
    gcash_number: String(row.gcash_number ?? '09811646218'),
    is_mzb_scope_exempt: row.is_mzb_scope_exempt === true,
    is_mzb_user_exempt: row.is_mzb_user_exempt === true,
    has_active_cluster: row.has_active_cluster === true,
    cluster_id: row.cluster_id ? String(row.cluster_id) : null,
    cluster_name: row.cluster_name ? String(row.cluster_name) : null,
    cluster_role: row.cluster_role ? String(row.cluster_role) : null,
    organization_id: row.organization_id ? String(row.organization_id) : null,
    organization_name: row.organization_name
      ? String(row.organization_name)
      : null,
    join_status: joinStatus,
    daily_reading: parseFeatureAccess(row.daily_reading),
    devotion_word: parseFeatureAccess(row.devotion_word),
    lesson_stages: stages,
  };
}

function parsePaymentRows(raw: unknown): FaithPaymentRequestRow[] {
  if (!raw || typeof raw !== 'object') return [];

  const container = raw as Record<string, unknown>;
  const rows = container.requests;

  if (!Array.isArray(rows)) return [];

  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? '').trim();

      if (!id) return null;

      return {
        id,
        payment_kind: String(row.payment_kind ?? ''),
        scope_id: row.scope_id ? String(row.scope_id) : null,
        scope_name: row.scope_name ? String(row.scope_name) : null,
        stage_code:
          row.stage_code == null ? null : toNumber(row.stage_code),
        feature_code: row.feature_code
          ? String(row.feature_code)
          : null,
        submitted_by: String(row.submitted_by ?? ''),
        submitter_name: String(row.submitter_name ?? 'Member'),
        gcash_reference: String(row.gcash_reference ?? ''),
        amount_php: toNumber(row.amount_php),
        status: String(row.status ?? ''),
        created_at: String(row.created_at ?? ''),
        reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
        admin_note: row.admin_note ? String(row.admin_note) : null,
      };
    })
    .filter(Boolean) as FaithPaymentRequestRow[];
}

import { mergeFaithLessonStages } from '@/lib/buklodLessonStages';

export function buildDefaultScopeFaithAccessStatus(
  scopeId: string,
): ScopeFaithAccessStatus {
  return {
    scope_id: scopeId,
    gcash_number: '09811646218',
    is_mzb_scope_exempt: false,
    is_mzb_user_exempt: false,
    has_active_cluster: false,
    cluster_id: null,
    cluster_name: null,
    cluster_role: null,
    organization_id: null,
    organization_name: null,
    join_status: 'NONE',
    daily_reading: {
      price_php: 0,
      unlocked: false,
      pending_request_id: null,
    },
    devotion_word: {
      price_php: 0,
      unlocked: false,
      pending_request_id: null,
    },
    lesson_stages: mergeFaithLessonStages(null),
  };
}

/**
 * Never blocks lesson UI — falls back to local 101–107 defaults when RPC is missing.
 */
export async function fetchScopeFaithAccessStatusResilient(
  scopeId: string,
): Promise<ScopeFaithAccessStatus> {
  try {
    const status = await fetchScopeFaithAccessStatus(scopeId);

    if (status) {
      return {
        ...status,
        lesson_stages: mergeFaithLessonStages(
          status.lesson_stages,
          {
            mzbScopeExempt: status.is_mzb_scope_exempt,
          },
        ),
      };
    }
  } catch (error) {
    console.warn(
      'Scope faith access status fallback:',
      error,
    );
  }

  return buildDefaultScopeFaithAccessStatus(scopeId);
}

export async function fetchScopeFaithAccessStatus(
  scopeId: string
): Promise<ScopeFaithAccessStatus | null> {
  const { data, error } = await buklodFaithAccessRpcWithClusterTruth(scopeId);

  if (error) {
    throw error;
  }

  return parseAccessStatus(data);
}

export async function submitFaithPayment(input: {
  scopeId?: string | null;
  paymentKind: FaithPaymentKind;
  gcashReference: string;
  stageCode?: number;
}) {
  if (!BUKLOD_PAID_FEATURES_ENABLED) throw new Error('Paid features are paused pending final approval.');
  const { data, error } = await supabase.rpc(
    'buklod_submit_faith_payment_v1',
    {
      p_scope_id: input.scopeId ?? null,
      p_payment_kind: input.paymentKind,
      p_gcash_reference: input.gcashReference.trim(),
      p_stage_code: input.stageCode ?? null,
      p_feature_code: null,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function listFaithPaymentRequests(
  status = 'pending_admin',
  limit = 50
): Promise<FaithPaymentRequestRow[]> {
  const { data, error } = await supabase.rpc(
    'buklod_admin_list_faith_payments_v1',
    {
      p_status: status,
      p_limit: limit,
    }
  );

  if (error) {
    throw error;
  }

  return parsePaymentRows(data);
}

export async function reviewFaithPayment(
  requestId: string,
  approve: boolean,
  adminNote?: string
) {
  const { data, error } = await supabase.rpc(
    'buklod_admin_review_faith_payment_v1',
    {
      p_request_id: requestId,
      p_approve: approve,
      p_admin_note: adminNote ?? null,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

/* PATCH_191H_FAITH_ACCESS_CLUSTER_TRUTH
 *
 * If a Home/Public scope cannot be resolved by the faith-access RPC,
 * recover the signed-in user's real ACTIVE Cluster and ask the SAME
 * backend faith-access RPC again using that real Cluster id.
 *
 * Important: this does NOT fabricate Cluster membership.
 * The backend remains authoritative for feature access and authorization.
 */
function buklodFaithRawHasActiveCluster(
  raw: unknown,
): boolean {
  const row =
    Array.isArray(raw)
      ? raw[0] ?? null
      : raw;

  return Boolean(
    row &&
      typeof row === 'object' &&
      (row as any).has_active_cluster ===
        true,
  );
}

async function buklodFaithAccessRpcWithClusterTruth(
  scopeId: string | null | undefined,
): Promise<any> {
  const invoke = (id: string) =>
    (supabase as any).rpc(
      'buklod_scope_faith_access_status_v1',
      {
        p_scope_id: id,
      },
    );

  const requestedScopeId =
    String(scopeId ?? '').trim();

  const first =
    requestedScopeId
      ? await invoke(requestedScopeId)
      : {
          data: null,
          error: new Error(
            'Faith access scope is empty',
          ),
        };

  if (
    !first?.error &&
    buklodFaithRawHasActiveCluster(
      first?.data,
    )
  ) {
    return first;
  }

  try {
    const truth =
      await resolveBuklodActiveClusterTruth();

    const clusterId =
      String(
        truth?.scope_id ?? '',
      ).trim();

    if (clusterId) {
      const second =
        await invoke(clusterId);

      if (!second?.error) {
        return second;
      }

      console.warn(
        '191H faith access retry:',
        second.error,
      );
    }
  } catch (error) {
    console.warn(
      '191H faith ACTIVE Cluster truth:',
      error,
    );
  }

  return first;
}
