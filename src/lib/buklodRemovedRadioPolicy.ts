/** Rejection-only compatibility for PTT removed from BUKLOD Main. */
export function isRemovedBuklodRadioPayload(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  const value = (key: string) => String(data[key] ?? '').trim().toLowerCase();
  return ['kind', 'type', 'event_type'].some(key => value(key).startsWith('ptt_')) ||
    value('call_type') === 'buklod_ptt' || value('call_cid').startsWith('buklod_ptt:');
}
