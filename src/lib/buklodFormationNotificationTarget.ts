type FormationNotificationData = {
  approval_id?: string | null;
  scope_id?: string | null;
  learner_id?: string | null;
  item_kind?: string | null;
  item_id?: string | null;
  auto_approved?: boolean | null;
};

export type FormationNotificationTarget = {
  path: string;
  scopeId?: string | null;
};

const FORMATION_NOTIFICATION_KINDS = new Set([
  'formation_pending',
  'formation_approval_pending',
  'formation_approved',
  'formation_needs_improvement',
  'formation_auto_approved',
]);

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export function buklodFormationNotificationTarget(
  kind: string,
  data: FormationNotificationData | null | undefined
): FormationNotificationTarget | null {
  const normalizedKind = clean(kind).toLowerCase();

  if (!FORMATION_NOTIFICATION_KINDS.has(normalizedKind) || !data) {
    return null;
  }

  const scopeId = clean(data.scope_id);
  const itemKind = clean(data.item_kind).toUpperCase();
  const itemId = clean(data.item_id);
  const approvalId = clean(data.approval_id);

  if (itemKind === 'DAILY_READING' && itemId) {
    const query = new URLSearchParams();

    if (scopeId) query.set('scopeId', scopeId);
    if (approvalId) query.set('approvalId', approvalId);
    query.set('notificationKind', normalizedKind);

    const suffix = query.toString();

    return {
      path: `/scope/faith-monitoring/daily-reading/${encodeURIComponent(itemId)}${suffix ? `?${suffix}` : ''}`,
      scopeId: scopeId || null,
    };
  }

  if (scopeId) {
    const query = new URLSearchParams();
    query.set('scopeId', scopeId);
    if (itemKind) query.set('focusKind', itemKind);
    if (itemId) query.set('itemId', itemId);
    if (approvalId) query.set('approvalId', approvalId);
    query.set('notificationKind', normalizedKind);

    return {
      path: `/scope/faith-monitoring/report?${query.toString()}`,
      scopeId,
    };
  }

  return null;
}
