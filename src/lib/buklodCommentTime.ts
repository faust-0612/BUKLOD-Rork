export function compactCommentTime(iso: string, now = Date.now()): string {
  const posted = new Date(iso).getTime();
  if (!Number.isFinite(posted)) return '';
  const seconds = Math.max(0, Math.floor((now - posted) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  return Math.floor(seconds / 86400) + 'd';
}
