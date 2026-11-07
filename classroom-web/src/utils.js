export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}
export function safeLink(value) {
  try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
export function formatDate(value) {
  if (!value) return 'No date set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(date);
}
export function clampText(value, limit) {
  return String(value || '').trim().slice(0,Math.max(0,limit));
}
