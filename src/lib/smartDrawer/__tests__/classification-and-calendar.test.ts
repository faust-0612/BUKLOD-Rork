import { classifySmartDrawerText, detectSmartDrawerDate, detectSmartDrawerExpiry } from '../classify';
import { makeGoogleCalendarEventUrl } from '../calendar';

const now = new Date('2026-10-27T02:00:00.000Z');

describe('Smart Drawer explicit reminder inference', () => {
  test('does not invent alarms for vague or unrelated content', () => {
    expect(detectSmartDrawerDate('mamaya', now)).toBeNull();
    expect(detectSmartDrawerDate('Shopping list: rice, eggs, 30 pesos', now)).toBeNull();
    expect(detectSmartDrawerDate('2026-02-30', now)).toBeNull();
  });

  test('understands natural Filipino and English dates', () => {
    expect(detectSmartDrawerDate('bukas 2:30pm', now)).not.toBeNull();
    expect(detectSmartDrawerDate('sa loob ng 45 minuto', now)).toBe(
      new Date(now.getTime() + 45 * 60_000).toISOString(),
    );
    expect(detectSmartDrawerDate('next lunes 10am', now)).not.toBeNull();
    expect(detectSmartDrawerDate('ngayon 13:00', now)).not.toBeNull();
  });

  test('expires only with explicit end-date wording, including past dates', () => {
    expect(detectSmartDrawerExpiry('valid until 2026-11-09 14:00', now)).not.toBeNull();
    expect(detectSmartDrawerExpiry('expires 2026-10-20', now)).not.toBeNull();
    expect(detectSmartDrawerExpiry('My notes for 2026-11-09', now)).toBeNull();
  });

  test('does not misfile manuscripts as checklists because they have commas and paragraphs', () => {
    const manuscript = 'My memoir, first chapter.\nThe mountain breathed, and the river answered.\nThis is not a list.';
    expect(classifySmartDrawerText(manuscript, now).type).toBe('WRITING');
    expect(classifySmartDrawerText('Shopping: rice, eggs, milk', now).listItems.length).toBe(3);
  });
});

describe('optional Calendar export', () => {
  test('constructs a fixed 1-hour event without leaking external URLs', () => {
    const url = makeGoogleCalendarEventUrl('Planning & review', '2026-11-02T10:00:00.000Z', 'Agenda');
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('text=Planning%20%26%20review');
    expect(url).toContain('dates=20261102T100000Z%2F20261102T110000Z');
  });
  test('rejects invalid dates', () => {
    expect(() => makeGoogleCalendarEventUrl('Event', 'not a date')).toThrow();
  });
});
