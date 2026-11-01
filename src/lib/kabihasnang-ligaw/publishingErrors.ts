/** Translate Supabase PostgREST error objects (which need not be native Error instances). */
export function klPublishingErrorMessage(error: unknown): string {
  const record = error && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown }
    : null;
  const code = typeof record?.code === 'string' ? record.code : '';
  const message = typeof record?.message === 'string'
    ? record.message.trim()
    : error instanceof Error ? error.message.trim() : '';

  if (code === '23502') {
    return 'Hindi makagawa ng chapter dahil may kulang na required database ID (KL-23502). Kailangan ng server repair.';
  }
  if (code === '42501' || /(?:admin only|story admin access denied)/i.test(message)) {
    return 'Walang KL Admin permission ang kasalukuyang account. Mag-sign in bilang aktibong system admin.';
  }
  if (/(?:network request failed|failed to fetch|networkerror|load failed)/i.test(message)) {
    return 'Hindi makontak ang server. Suriin ang connection at subukan muli; hindi nawala ang draft.';
  }
  if (/(?:timeout|timed out)/i.test(message) || ['408', '503', '504'].includes(code)) {
    return 'Nag-timeout o pansamantalang unavailable ang server. Buksan muna ang chapter list bago ulitin.';
  }
  const safeMessage = message.replace(/[\r\n]+/g, ' ').slice(0, 240);
  return safeMessage ? safeMessage + (code ? ' (' + code + ')' : '')
    : 'Hindi natuloy ang request. Subukan muli.';
}
