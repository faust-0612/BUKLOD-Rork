import {
  LIFE_GOSPEL_CORE_VERSION,
  LIFE_SCRIPTURE_PACK_VERSION,
  LIFE_SOUL_WINNER_GUIDE_VERSION,
} from '@/lib/buklodLifeContent';

export function getBuklodLifeDiagnostics(locale: string) {
  return {
    life_route: '/life',
    life_gospel_core_version: LIFE_GOSPEL_CORE_VERSION,
    life_scripture_pack_version: LIFE_SCRIPTURE_PACK_VERSION,
    life_soul_winner_version: LIFE_SOUL_WINNER_GUIDE_VERSION,
    life_ai_mode: 'CURATED_STATIC_FALLBACK_READY',
    life_language_pack:
      String(locale || 'en').toLowerCase() === 'en'
        ? 'APPROVED_EN'
        : 'FALLBACK_EN',
    life_private_journey_storage: 'NOT_COLLECTED',
  } as const;
}
