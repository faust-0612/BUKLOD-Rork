import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type ScopeFaithMonitoringFeedbackItem = {
  id: string;
  scope_id: string;
  target_user_id: string | null;
  target_name?: string | null;
  headline: string | null;
  message: string;
  updated_at: string | null;
  updated_by: string | null;
};

export type ScopeFaithMonitoringFeedbackView = {
  scope_id: string;
  general: ScopeFaithMonitoringFeedbackItem | null;
  personal: ScopeFaithMonitoringFeedbackItem | null;
};

const LOCAL_ITEMS_KEY_PREFIX =
  'buklod:faith-monitoring-feedback-items:v2:';

function localItemsKey(scopeId: string) {
  return `${LOCAL_ITEMS_KEY_PREFIX}${scopeId}`;
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

function parseItem(raw: unknown): ScopeFaithMonitoringFeedbackItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;
  const scopeId = String(row.scope_id ?? '').trim();
  const id = String(row.id ?? '').trim() || `${scopeId}-local`;

  if (!scopeId) return null;

  return {
    id,
    scope_id: scopeId,
    target_user_id: row.target_user_id
      ? String(row.target_user_id)
      : null,
    target_name: row.target_name
      ? String(row.target_name)
      : null,
    headline: row.headline ? String(row.headline) : null,
    message: String(row.message ?? ''),
    updated_at: row.updated_at ? String(row.updated_at) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
  };
}

function hasContent(item: ScopeFaithMonitoringFeedbackItem | null | undefined) {
  if (!item) return false;

  return Boolean(item.headline?.trim() || item.message.trim());
}

export function hasFaithMonitoringFeedbackContent(
  view: ScopeFaithMonitoringFeedbackView | null | undefined
) {
  if (!view) return false;

  return hasContent(view.general) || hasContent(view.personal);
}

function buildMemberView(
  scopeId: string,
  items: ScopeFaithMonitoringFeedbackItem[],
  userId?: string | null
): ScopeFaithMonitoringFeedbackView {
  const general =
    items.find((item) => !item.target_user_id && hasContent(item)) ??
    null;

  const personal = userId
    ? items.find(
        (item) =>
          item.target_user_id === userId && hasContent(item)
      ) ?? null
    : null;

  return {
    scope_id: scopeId,
    general,
    personal,
  };
}

async function loadLocalItems(
  scopeId: string
): Promise<ScopeFaithMonitoringFeedbackItem[]> {
  const raw = await AsyncStorage.getItem(localItemsKey(scopeId));

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(parseItem)
      .filter(Boolean) as ScopeFaithMonitoringFeedbackItem[];
  } catch {
    return [];
  }
}

async function saveLocalItems(
  scopeId: string,
  items: ScopeFaithMonitoringFeedbackItem[]
) {
  await AsyncStorage.setItem(
    localItemsKey(scopeId),
    JSON.stringify(items)
  );
}

function upsertLocalItem(
  items: ScopeFaithMonitoringFeedbackItem[],
  next: ScopeFaithMonitoringFeedbackItem
) {
  const index = items.findIndex((item) =>
    next.target_user_id
      ? item.target_user_id === next.target_user_id
      : !item.target_user_id
  );

  if (index >= 0) {
    const copy = [...items];
    copy[index] = next;
    return copy;
  }

  return [next, ...items];
}

function parseMemberView(
  raw: unknown,
  scopeId: string
): ScopeFaithMonitoringFeedbackView | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;

  return {
    scope_id: String(row.scope_id ?? scopeId),
    general: parseItem(row.general),
    personal: parseItem(row.personal),
  };
}

export async function fetchScopeFaithMonitoringFeedbackForMember(input: {
  scopeId: string;
  userId?: string | null;
}): Promise<ScopeFaithMonitoringFeedbackView> {
  const { data, error } = await supabase.rpc(
    'buklod_scope_faith_monitoring_feedback_for_member_v1',
    { p_scope_id: input.scopeId }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      const items = await loadLocalItems(input.scopeId);
      return buildMemberView(
        input.scopeId,
        items,
        input.userId
      );
    }

    throw error;
  }

  const parsed =
    parseMemberView(data, input.scopeId) ??
    buildMemberView(input.scopeId, [], input.userId);

  return parsed;
}

export async function fetchScopeFaithMonitoringFeedbackAdminList(
  scopeId: string
): Promise<ScopeFaithMonitoringFeedbackItem[]> {
  const { data, error } = await supabase.rpc(
    'buklod_scope_faith_monitoring_feedback_admin_list_v1',
    { p_scope_id: scopeId }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      return loadLocalItems(scopeId);
    }

    throw error;
  }

  if (!Array.isArray(data)) return [];

  return data
    .map(parseItem)
    .filter(Boolean) as ScopeFaithMonitoringFeedbackItem[];
}

export async function upsertScopeFaithMonitoringFeedback(input: {
  scopeId: string;
  targetUserId?: string | null;
  targetName?: string | null;
  headline?: string | null;
  message: string;
}): Promise<ScopeFaithMonitoringFeedbackItem> {
  const headline = input.headline?.trim() || null;
  const message = input.message.trim();
  const targetUserId = input.targetUserId?.trim() || null;

  const { data, error } = await supabase.rpc(
    'upsert_buklod_scope_faith_monitoring_feedback_v1',
    {
      p_scope_id: input.scopeId,
      p_target_user_id: targetUserId,
      p_headline: headline,
      p_message: message,
    }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      const next: ScopeFaithMonitoringFeedbackItem = {
        id: `${input.scopeId}-${targetUserId ?? 'general'}`,
        scope_id: input.scopeId,
        target_user_id: targetUserId,
        target_name: input.targetName ?? null,
        headline,
        message,
        updated_at: new Date().toISOString(),
        updated_by: null,
      };

      const items = await loadLocalItems(input.scopeId);
      const merged = upsertLocalItem(items, next);
      await saveLocalItems(input.scopeId, merged);
      return next;
    }

    throw error;
  }

  const parsed = parseItem(data);

  if (!parsed) {
    throw new Error('Could not save faith monitoring feedback.');
  }

  const items = await loadLocalItems(input.scopeId);
  const merged = upsertLocalItem(items, {
    ...parsed,
    target_name: input.targetName ?? parsed.target_name ?? null,
  });
  await saveLocalItems(input.scopeId, merged);

  return parsed;
}

/** @deprecated Use fetchScopeFaithMonitoringFeedbackForMember */
export async function fetchScopeFaithMonitoringFeedback(
  scopeId: string
): Promise<ScopeFaithMonitoringFeedbackItem | null> {
  const view = await fetchScopeFaithMonitoringFeedbackForMember({
    scopeId,
  });

  return view.general ?? view.personal;
}

export type ScopeFaithMonitoringFeedback = ScopeFaithMonitoringFeedbackItem;
