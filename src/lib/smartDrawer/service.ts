import {
  cancelSmartDrawerReminders,
  scheduleSmartDrawerReminders,
} from './reminders';
import {
  getSmartDrawerItem,
  querySmartDrawerItems,
  saveSmartDrawerItem,
  setSmartDrawerReminderIds,
  setSmartDrawerStatus,
} from './localStore';
import type {
  SmartDrawerDraft,
  SmartDrawerItem,
} from './types';

export async function commitSmartDrawerItem(
  userId: string,
  draft: SmartDrawerDraft,
): Promise<{
  item: SmartDrawerItem;
  reminderScheduled: boolean;
  reminderWarning: string | null;
}> {
  const previous = draft.id
    ? await getSmartDrawerItem(userId, draft.id)
    : null;

  // Persist the item before touching its old alarms. A failed local write
  // must never silently erase an already scheduled reminder.
  const oldIds = previous?.reminderIds ?? [];
  let item = await saveSmartDrawerItem(userId, {
    ...draft,
    reminderIds: oldIds,
  });

  let reminderWarning: string | null = null;
  let newIds: string[] = [];

  try {
    newIds = await scheduleSmartDrawerReminders(item);

    const saved = await setSmartDrawerReminderIds(
      userId,
      item.id,
      newIds,
    );
    if (!saved) {
      throw new Error('Drawer item changed before reminders could be saved.');
    }
    item = saved;
    await cancelSmartDrawerReminders(oldIds);

    return {
      item,
      reminderScheduled: newIds.length > 0,
      reminderWarning,
    };
  } catch (error) {
    // If the schedule succeeded but the local ID write failed, roll back
    // only the new notifications. The old schedule stays recoverable.
    await cancelSmartDrawerReminders(newIds);
    reminderWarning =
      error instanceof Error
        ? error.message
        : 'BUKLOD could not schedule the reminder.';

    return {
      item,
      reminderScheduled: false,
      reminderWarning,
    };
  }
}

/**
 * Reconcile the nearest due items after a reminder-style change. Work is
 * deliberately bounded so a large local Drawer cannot stall settings/UI
 * or exhaust the platform's pending local-notification slots in one pass.
 */
export async function refreshUpcomingSmartDrawerReminders(
  userId: string,
  maxItems = 20,
) {
  const rows = await querySmartDrawerItems(userId, {
    view: 'future-reminders',
    limit: Math.min(100, maxItems + 1),
  });
  let updated = 0;
  let failed = 0;
  for (const item of rows.slice(0, maxItems)) {
    const result = await commitSmartDrawerItem(userId, {
      ...item,
      id: item.id,
    });
    if (result.reminderWarning) failed += 1;
    else updated += 1;
  }
  return { updated, failed, more: rows.length > maxItems };
}

export async function transitionSmartDrawerItem(
  userId: string,
  itemId: string,
  status: SmartDrawerItem['status'],
) {
  const current =
    await getSmartDrawerItem(userId, itemId);

  if (!current) {
    throw new Error('Drawer item not found.');
  }

  if (status === 'ACTIVE') {
    return (
      await commitSmartDrawerItem(
        userId,
        {
          ...current,
          id: current.id,
          status: 'ACTIVE',
          deletedAt: null,
          syncState: 'LOCAL_ONLY',
        },
      )
    ).item;
  }

  const next =
    await setSmartDrawerStatus(
      userId,
      itemId,
      status,
    );

  if (next.reminderIds.length) {
    const cleared = await setSmartDrawerReminderIds(
        userId,
        itemId,
        [],
      );
    if (cleared) {
      await cancelSmartDrawerReminders(next.reminderIds);
      return cleared;
    }
  }

  return next;
}
