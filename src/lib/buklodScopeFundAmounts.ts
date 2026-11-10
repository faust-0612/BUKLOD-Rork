/** Exact centavos conversion; never trust client-calculated funds at the database boundary. */
export function parseScopeContributionMinor(input: string): number | null {
  const value = input.trim();
  if (!/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?$/.test(value)) return null;
  const [pesos, cents = ''] = value.split('.');
  const minor = Number(pesos) * 100 + Number(cents.padEnd(2, '0'));
  return minor >= 100 && minor <= 100000000 ? minor : null;
}
export function normalizeScopeGcashReference(input: string): string | null {
  const value = input.trim().replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9_-]{6,80}$/.test(value) ? value : null;
}