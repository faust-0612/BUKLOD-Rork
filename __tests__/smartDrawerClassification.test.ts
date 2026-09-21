import {
  classifySmartDrawerText,
  detectSmartDrawerDate,
  isSmartDrawerOverdue,
} from '@/lib/smartDrawer/classify';

describe('BUKLOD Smart Drawer local intelligence', () => {
  it('detects a natural Filipino shopping list without AI', () => {
    const result = classifySmartDrawerText(
      'Bibilhin: manok, sibuyas, kamatis, toyo, bigas',
    );

    expect(result.type).toBe('SHOPPING_LIST');
    expect(result.listItems.map(item => item.text)).toEqual(
      expect.arrayContaining([
        'manok',
        'sibuyas',
        'kamatis',
        'toyo',
        'bigas',
      ]),
    );
    expect(result.dueAt).toBeNull();
  });

  it('detects bukas plus a clock time as a local due task', () => {
    const now = new Date(2026, 8, 21, 10, 0, 0);
    const result = classifySmartDrawerText(
      'Bayaran kuryente bukas 5 PM',
      now,
    );

    expect(result.type).toBe('DUE_TASK');
    expect(result.dueAt).toBeTruthy();

    const due = new Date(result.dueAt!);
    expect(due.getDate()).toBe(now.getDate() + 1);
    expect(due.getHours()).toBe(17);
  });

  it('detects a meeting with a calendar date as an event', () => {
    const result = classifySmartDrawerText(
      'Parents Meeting October 5, 2026 2:00 PM Room 101',
      new Date(2026, 8, 21, 9, 0, 0),
    );

    expect(result.type).toBe('EVENT');
    expect(result.eventAt).toBeTruthy();

    const event = new Date(result.eventAt!);
    expect(event.getFullYear()).toBe(2026);
    expect(event.getMonth()).toBe(9);
    expect(event.getDate()).toBe(5);
    expect(event.getHours()).toBe(14);
  });

  it('preserves tula/poem as writing content rather than temporary cleanup', () => {
    const result = classifySmartDrawerText(
      'Tula: Sa ilalim ng lumang puno\nTahimik ang umaga',
    );

    expect(result.type).toBe('POEM');
    expect(result.dueAt).toBeNull();
  });

  it('parses next weekday locally without a server call', () => {
    const due = detectSmartDrawerDate(
      'Tawagan next Monday 9 AM',
      new Date(2026, 8, 21, 12, 0, 0),
    );

    expect(due).toBeTruthy();
    const date = new Date(due!);
    expect(date.getDay()).toBe(1);
    expect(date.getHours()).toBe(9);
  });

  it('marks a past due active task overdue but not a completed task', () => {
    const past = new Date(Date.now() - 60_000).toISOString();

    expect(isSmartDrawerOverdue(past, 'ACTIVE')).toBe(true);
    expect(isSmartDrawerOverdue(past, 'DONE')).toBe(false);
    expect(isSmartDrawerOverdue(past, 'ARCHIVED')).toBe(false);
  });
});
