import {
  cancelSmartDrawerReminders,
  scheduleSmartDrawerReminders,
} from './reminders';
import {
  getSmartDrawerItem,
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

  if (previous?.reminderIds?.length) {
    await cancelSmartDrawerReminders(previous.reminderIds);
  }

  let item = await saveSmartDrawerItem(userId, {
    ...draft,
    reminderIds: [],
  });

  let reminderWarning: string | null = null;

  try {
    const reminderIds =
      await scheduleSmartDrawerReminders(item);

    if (reminderIds.length) {
      item =
        (await setSmartDrawerReminderIds(
          userId,
          item.id,
          reminderIds,
        )) ?? item;
    }

    return {
      item,
      reminderScheduled: reminderIds.length > 0,
      reminderWarning,
    };
  } catch (error) {
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

  if (
    status !== 'ACTIVE' &&
    current.reminderIds.length
  ) {
    await cancelSmartDrawerReminders(
      current.reminderIds,
    );
  }

  const next =
    await setSmartDrawerStatus(
      userId,
      itemId,
      status,
    );

  if (status !== 'ACTIVE' && next.reminderIds.length) {
    return (
      (await setSmartDrawerReminderIds(
        userId,
        itemId,
        [],
      )) ?? next
    );
  }

  return next;
}
