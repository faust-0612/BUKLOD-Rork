type FormationNotificationData = {
  approval_id?: string | null;
  scope_id?: string | null;
  learner_id?: string | null;
  item_kind?: string | null;
  item_id?: string | null;
  submission_id?: string | null;
  devotional_id?: string | null;
  auto_approved?: boolean | null;
  report_only?: boolean | null;
  pending_count?: number | null;
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
  'formation_pending_reminder',
  'formation_submission_report',
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

  // Outcome notices are sent to the learner, while pending/report notices are
  // reviewer-facing. Canonical DAILY_DEVOTION item_id = devotional_reward_submissions.id,
  // not devotionals.id. Never interpret the submission id as a devotional id.
  // This also repairs old notifications that contain only item_id + scope_id.
  if (
    itemKind === 'DAILY_DEVOTION' &&
    (normalizedKind === 'formation_needs_improvement' ||
     normalizedKind === 'formation_approved')
  ) {
    const submissionId = clean(data.submission_id) || itemId;
    const query = new URLSearchParams();
    if (submissionId) query.set('submissionId', submissionId);
    query.set('notificationKind', normalizedKind);
    // Personal records are already bound to auth.uid() by row-level security.
    // Do not switch scopes for a private revision: that could hide old records.
    return { path: `/devotional/submissions?${query.toString()}` };
  }

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
