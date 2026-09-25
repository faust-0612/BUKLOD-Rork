import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { LIFE_GOSPEL_CORE_VERSION } from '@/lib/buklodLifeContent';

/* BUKLOD_LIFE_PRIVACY_SAFE_TELEMETRY_R1
 *
 * Product-health only. Never attach topic/struggle/question/prayer/response
 * text or spiritual-state labels to telemetry.
 */
export type BuklodLifeEvent =
  | 'life_opened'
  | 'life_topic_opened'
  | 'life_question_opened'
  | 'life_explore_jesus_started'
  | 'life_gospel_step_viewed'
  | 'life_help_someone_opened'
  | 'life_ai_fallback_used'
  | 'life_content_error'
  | 'life_language_selected'
  | 'life_gospel_path_completed';

export async function trackBuklodLifeEvent(
  event: BuklodLifeEvent,
  input: {
    locale?: string | null;
    online?: boolean | null;
  } = {},
) {
  try {
    await withBuklodTimeout(
      supabase.functions.invoke('buklod-support-v1', {
        body: {
          action: 'telemetry',
          event,
          category: null,
          support_code: null,
          route: '/life',
          feature: 'LIFE',
          outcome: 'product_health',
          app: 'BUKLOD Main',
          app_version: Constants.expoConfig?.version ?? '',
          platform: Platform.OS,
          metadata: {
            gospel_core_version: LIFE_GOSPEL_CORE_VERSION,
            language_pack: input.locale ?? 'en',
            ai_mode: 'CURATED_FALLBACK_SAFE',
            online:
              typeof input.online === 'boolean'
                ? input.online
                : null,
          },
        },
      }),
      4_000,
      'BUKLOD LIFE telemetry',
    );
  } catch {
    // Telemetry must never block LIFE or offline content.
  }
}
