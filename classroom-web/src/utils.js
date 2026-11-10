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

/** UI guard only; the server independently revalidates faculty ownership. */
export function canRequestClassDeletion(context, signedInUserId) {
  return Boolean(
    signedInUserId &&
    context?.role === 'FACULTY' &&
    context?.faculty_user_id === signedInUserId
  );
}
/** Exact, case-sensitive classroom name avoids deleting the wrong class. */
export function deletionNameMatches(typedName, canonicalName) {
  return typeof typedName === 'string' &&
    typeof canonicalName === 'string' &&
    canonicalName.trim().length > 0 &&
    typedName === canonicalName.trim();
}
