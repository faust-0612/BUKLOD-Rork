/**
 * BUKLOD Health Center is a separate patient-managed application.
 * Main BUKLOD launches its verified public HTTPS origin without sharing
 * Supabase tokens, member profiles, or medical records across products.
 */
export const BUKLOD_HEALTH_CENTER_URL = 'https://buklod-health-center.vercel.app/';

export async function launchBuklodHealthCenter(
  openUrl: (url: string) => Promise<unknown>,
): Promise<void> {
  await openUrl(BUKLOD_HEALTH_CENTER_URL);
}
