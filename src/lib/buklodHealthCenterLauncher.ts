/**
 * BUKLOD Health Center is a separate, patient-managed PWA.
 * Do not append authentication, symptom/concern details, health record identifiers,
 * member ids, referral ids, or analytics query strings to these public doors.
 */
export const BUKLOD_HEALTH_CENTER_URL = 'https://buklod-health-center.vercel.app/';
export const BUKLOD_HEALTH_CONSULTATION_URL = 'https://buklod-health-center.vercel.app/consult';
export const BUKLOD_HEALTH_PROFESSIONALS_URL = 'https://buklod-health-center.vercel.app/consult/professionals';

// Client availability is OFF until the separately authenticated HC backend has
// been deployed, verified, and explicitly enabled for the exact OTA environment.
// This UI flag never authorizes clinician privileges or provider API access.
export const BUKLOD_HEALTH_CONSULTATION_READY =
  typeof process !== 'undefined' && process.env.EXPO_PUBLIC_HEALTH_CONSULTATION_ENABLED === 'true';
export const BUKLOD_HEALTH_PROFESSIONALS_READY =
  typeof process !== 'undefined' && process.env.EXPO_PUBLIC_HEALTH_PROFESSIONAL_PORTAL_ENABLED === 'true';

export async function launchBuklodHealthCenter(
  openUrl: (url: string) => Promise<unknown>,
): Promise<void> {
  await openUrl(BUKLOD_HEALTH_CENTER_URL);
}

export async function launchBuklodHealthConsultation(
  openUrl: (url: string) => Promise<unknown>,
): Promise<void> {
  await openUrl(BUKLOD_HEALTH_CONSULTATION_URL);
}

export async function launchBuklodHealthProfessionals(
  openUrl: (url: string) => Promise<unknown>,
): Promise<void> {
  await openUrl(BUKLOD_HEALTH_PROFESSIONALS_URL);
}
