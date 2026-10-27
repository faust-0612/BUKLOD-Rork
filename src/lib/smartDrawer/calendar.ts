/** Explicit export only. No Calendar account permission or background syncing. */
export function makeGoogleCalendarEventUrl(title: string, startsAt: string, notes = '') {
  const startMs = Date.parse(startsAt);
  if (!Number.isFinite(startMs)) throw new Error('A valid date is required to add a calendar event.');
  const format = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const endMs = startMs + 60 * 60 * 1000;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${format(startMs)}%2F${format(endMs)}&details=${encodeURIComponent(notes)}`;
}
