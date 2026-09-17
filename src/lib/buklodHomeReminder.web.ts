export type BuklodHomeReminderScheduleResult = {
  id: string;
  delivery: 'web-in-app';
};

export async function scheduleBuklodHomeReminder(args: {
  at: Date;
  message: string;
}): Promise<BuklodHomeReminderScheduleResult> {
  const id = `web-${args.at.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, delivery: 'web-in-app' };
}

export async function cancelBuklodHomeReminder(_id: string) {
  return;
}
