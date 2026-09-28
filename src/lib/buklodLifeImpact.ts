import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import {
  loadReferralSummary,
} from '@/lib/buklodRewards';

export type BuklodLifeJourneyStage =
  | 'NONE'
  | 'JESUS_SHARED'
  | 'SEEKING'
  | 'NEW_BEGINNING'
  | 'WALKING_TOGETHER'
  | 'GROWING_IN_FAITH';

export type BuklodLifeShareInfo = {
  referralCode: string;
  shareUrl: string;
  invitedCount: number;
  qualifiedCount: number;
  partial: boolean;
};

export type BuklodLifeImpactActivity = {
  event_type:
    | 'GOSPEL_OPENED'
    | 'SEEKING'
    | 'NEW_BEGINNING'
    | 'WALKING_TOGETHER'
    | 'GROWING_IN_FAITH'
    | string;
  occurred_at: string | null;
  anonymous: true;
};

export type BuklodLifeImpactSummary = {
  people_reached: number;
  gospel_opened: number;
  faith_journeys_started: number;
  new_beginning: number;
  walking_with_you: number;
  growing_in_faith: number;
  recent_activity: BuklodLifeImpactActivity[];
  identity_private: boolean;
  partial: boolean;
  cached?: boolean;
};

const IMPACT_CACHE_PREFIX =
  'buklod:life-impact:v1:';

function toNumber(
  value: unknown,
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? Math.max(
      0,
      parsed
    )
    : 0;
}

async function currentUserId() {
  const {
    data,
  } =
    await supabase.auth
      .getSession();

  return (
    data.session?.user?.id ??
    null
  );
}

export async function loadBuklodLifeShareInfo():
Promise<BuklodLifeShareInfo | null> {

  try {
    const {
      data,
      error,
    } =
      await (
        supabase as any
      ).rpc(
        'get_my_buklod_referral_summary_v2'
      );

    if (
      !error &&
      data &&
      typeof data ===
        'object' &&
      Boolean(
        (
          data as any
        ).identity_ready
      )
    ) {
      const row =
        data as Record<
          string,
          unknown
        >;

      const referralCode =
        String(
          row.referral_code ??
          ''
        ).trim();

      const baseShareUrl =
        String(
          row.share_url ??
          ''
        ).trim();

      const shareUrl =
        referralCode
          ? (
            baseShareUrl
              ? (
                baseShareUrl.includes(
                  '?'
                )
                  ? `${baseShareUrl}&life=1`
                  : `${baseShareUrl}?life=1`
              )
              : `https://buklod.expo.app/register?ref=${encodeURIComponent(
                referralCode
              )}&life=1`
          )
          : '';

      return {
        referralCode,
        shareUrl,
        invitedCount:
          toNumber(
            row.invited_count
          ),
        qualifiedCount:
          toNumber(
            row.qualified_count
          ),
        partial:
          false,
      };
    }
  } catch {
    // Fall through to the legacy summary.
  }

  const legacy =
    await loadReferralSummary()
      .catch(
        () => null
      );

  if (
    !legacy?.referral_code
  ) {
    return null;
  }

  return {
    referralCode:
      legacy.referral_code,
    shareUrl:
      `https://buklod.expo.app/register?ref=${encodeURIComponent(
        legacy.referral_code
      )}&life=1`,
    invitedCount:
      legacy.invited_count,
    qualifiedCount:
      legacy.qualified_count,
    partial:
      true,
  };
}

export async function recordBuklodLifeReferralFunnel(
  eventType:
    | 'SHARE_TAP'
    | 'COPY_LINK'
    | 'COPY_CODE'
    | 'NATIVE_SHARE_OPEN'
    | 'LINK_OPEN'
    | 'SIGNUP_STARTED'
    | 'SIGNUP_COMPLETED',
  source = 'LIFE',
) {

  try {
    await (
      supabase as any
    ).rpc(
      'record_buklod_referral_funnel_event_v2',
      {
        p_event_type:
          eventType,
        p_source:
          source,
      }
    );
  } catch {
    // Analytics must never block sharing or LIFE.
  }
}

export async function markMyBuklodLifeStage(
  stage:
    | 'JESUS_SHARED'
    | 'SEEKING'
    | 'NEW_BEGINNING'
    | 'WALKING_TOGETHER',
) {

  try {
    const {
      data,
      error,
    } =
      await (
        supabase as any
      ).rpc(
        'buklod_life_mark_my_stage_v1',
        {
          p_stage:
            stage,
        }
      );

    if (
      error
    ) {
      throw error;
    }

    return (
      data ??
      null
    );
  } catch {
    // LIFE remains usable before the additive migration is released.
    return null;
  }
}

export async function loadMyBuklodLifeJourney():
Promise<{
  stage:
    BuklodLifeJourneyStage;
} | null> {

  try {
    const {
      data,
      error,
    } =
      await (
        supabase as any
      ).rpc(
        'get_my_buklod_life_journey_v1'
      );

    if (
      error ||
      !data ||
      typeof data !==
        'object'
    ) {
      return null;
    }

    return {
      stage:
        String(
          (
            data as any
          ).stage ??
          'NONE'
        ) as
          BuklodLifeJourneyStage,
    };
  } catch {
    return null;
  }
}

async function impactCacheKey() {
  const userId =
    await currentUserId();

  return userId
    ? `${IMPACT_CACHE_PREFIX}${userId}`
    : null;
}

async function readImpactCache():
Promise<BuklodLifeImpactSummary | null> {

  const key =
    await impactCacheKey();

  if (!key) {
    return null;
  }

  try {
    const raw =
      await AsyncStorage.getItem(
        key
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {
      return null;
    }

    return {
      ...parsed,
      cached:
        true,
    };
  } catch {
    return null;
  }
}

async function writeImpactCache(
  summary:
    BuklodLifeImpactSummary,
) {

  const key =
    await impactCacheKey();

  if (!key) {
    return;
  }

  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify(
        summary
      )
    );
  } catch {
    // Cache is optional.
  }
}

function normalizeImpact(
  row:
    Record<
      string,
      unknown
    >,
  partial:
    boolean,
): BuklodLifeImpactSummary {

  const activity =
    Array.isArray(
      row.recent_activity
    )
      ? row.recent_activity
          .filter(
            item =>
              item &&
              typeof item ===
                'object'
          )
          .slice(
            0,
            12
          )
          .map(
            item => ({
              event_type:
                String(
                  (
                    item as any
                  ).event_type ??
                  ''
                ),
              occurred_at:
                (
                  item as any
                ).occurred_at
                  ? String(
                    (
                      item as any
                    ).occurred_at
                  )
                  : null,
              anonymous:
                true as const,
            })
          )
      : [];

  return {
    people_reached:
      toNumber(
        row.people_reached
      ),
    gospel_opened:
      toNumber(
        row.gospel_opened
      ),
    faith_journeys_started:
      toNumber(
        row.faith_journeys_started ??
        row.seeking
      ),
    new_beginning:
      toNumber(
        row.new_beginning
      ),
    walking_with_you:
      toNumber(
        row.walking_with_you
      ),
    growing_in_faith:
      toNumber(
        row.growing_in_faith
      ),
    recent_activity:
      activity,
    identity_private:
      row.identity_private !==
        false,
    partial,
  };
}

export async function loadBuklodLifeImpact():
Promise<BuklodLifeImpactSummary> {

  try {
    const {
      data,
      error,
    } =
      await (
        supabase as any
      ).rpc(
        'get_my_buklod_life_impact_v1'
      );

    if (
      !error &&
      data &&
      typeof data ===
        'object'
    ) {
      const summary =
        normalizeImpact(
          data as Record<
            string,
            unknown
          >,
          false,
        );

      await writeImpactCache(
        summary
      );

      return summary;
    }
  } catch {
    // Use compatibility fallback below.
  }

  const shareInfo =
    await loadBuklodLifeShareInfo()
      .catch(
        () => null
      );

  if (shareInfo) {
    const fallback =
      normalizeImpact(
        {
          people_reached:
            shareInfo.invitedCount,
          gospel_opened:
            0,
          faith_journeys_started:
            0,
          new_beginning:
            0,
          walking_with_you:
            0,
          growing_in_faith:
            0,
          recent_activity:
            [],
          identity_private:
            true,
        },
        true,
      );

    await writeImpactCache(
      fallback
    );

    return fallback;
  }

  const cached =
    await readImpactCache();

  if (cached) {
    return cached;
  }

  return normalizeImpact(
    {},
    true,
  );
}
