import type { BuklodLifeLanguage } from '@/lib/buklodLifeContent';

/** LIFE's reviewed Filipino/English content is independent of the app-wide pack approval. */
function explicitLanguage(value: unknown): BuklodLifeLanguage | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (/^(fil|tl)(-|$)/.test(raw) || raw === 'filipino' || raw === 'tagalog') return 'fil';
  if (/^en(-|$)/.test(raw) || raw === 'english') return 'en';
  return null;
}

export function resolveBuklodLifeLanguage(input: {
  appPreference?: unknown;
  profileLanguage?: unknown;
  deviceLanguage?: unknown;
  country?: unknown;
  province?: unknown;
}): BuklodLifeLanguage {
  const app = explicitLanguage(input.appPreference);
  if (app) return app;
  const profile = explicitLanguage(input.profileLanguage);
  if (profile) return profile;

  // No approved Cebuano/Ilocano LIFE copy: use Filipino, not a fictitious translation.
  const regional = String(input.profileLanguage ?? '').trim().toLowerCase();
  if (/^(ceb|ilo)(-|$)/.test(regional) || /cebu|bisaya|iloc|ilok/.test(regional)) return 'fil';
  const device = explicitLanguage(input.deviceLanguage);
  if (device === 'fil') return 'fil';
  const country = String(input.country ?? '').trim().toLowerCase();
  const province = String(input.province ?? '').trim();
  if (country === 'ph' || country.includes('philipp') || province) return 'fil';
  return device ?? 'en';
}
