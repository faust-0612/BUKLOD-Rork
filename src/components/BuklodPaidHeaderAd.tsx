import React, {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { isHiddenCommunityCardCopy } from '@/lib/buklodCommunityCardVisibility';
import { useAuth } from '@/providers/AuthProvider';

type Placement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer'
  | 'me';

type Campaign = {
  id: string;
  advertiser_name: string;
  headline: string;
  short_text: string | null;
  image_url: string | null;
  destination_url: string | null;
  placement:
    | 'all'
    | Placement;
  coverage_level:
    | 'barangay'
    | 'city'
    | 'province'
    | 'nationwide';
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  priority: number | null;
};

function norm(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function firstText(
  source: Record<string, any> | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = source?.[key];
    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return '';
}

function campaignMatchesGeo(
  campaign: Campaign,
  profile: Record<string, any>,
) {
  if (
    campaign.coverage_level ===
    'nationwide'
  ) {
    return true;
  }

  const userProvince =
    firstText(profile, [
      'province',
      'province_name',
      'address_province',
    ]);

  const userCity =
    firstText(profile, [
      'city_municipality',
      'municipality',
      'municipality_name',
      'city',
      'city_name',
      'address_city',
      'address_municipality',
    ]);

  const userBarangay =
    firstText(profile, [
      'barangay',
      'barangay_name',
      'address_barangay',
    ]);

  if (
    campaign.coverage_level ===
    'province'
  ) {
    return (
      !!userProvince &&
      norm(userProvince) ===
        norm(campaign.province)
    );
  }

  if (
    campaign.coverage_level ===
    'city'
  ) {
    return (
      !!userProvince &&
      !!userCity &&
      norm(userProvince) ===
        norm(campaign.province) &&
      norm(userCity) ===
        norm(campaign.city_municipality)
    );
  }

  return (
    !!userProvince &&
    !!userCity &&
    !!userBarangay &&
    norm(userProvince) ===
      norm(campaign.province) &&
    norm(userCity) ===
      norm(campaign.city_municipality) &&
    norm(userBarangay) ===
      norm(campaign.barangay)
  );
}

export default function BuklodPaidHeaderAd({
  placement,
  fallback,
}: {
  placement: Placement;
  fallback?: ReactNode;
}) {
  const { profile } = useAuth();

  const [campaigns, setCampaigns] =
    useState<Campaign[]>([]);

  const [index, setIndex] =
    useState(0);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data, error } =
        await supabase
          .from(
            'buklod_paid_ad_campaigns',
          )
          .select(
            [
              'id',
              'advertiser_name',
              'headline',
              'short_text',
              'image_url',
              'destination_url',
              'placement',
              'coverage_level',
              'barangay',
              'city_municipality',
              'province',
              'priority',
            ].join(','),
          )
          .in(
            'placement',
            ['all', placement],
          )
          .order(
            'priority',
            { ascending: false },
          )
          .limit(50);

      if (!alive) return;

      if (error) {
        console.warn(
          'BUKLOD paid-ad load failed:',
          error.message,
        );
        setCampaigns([]);
        return;
      }

      const profileRecord =
        (profile ?? {}) as Record<
          string,
          any
        >;

      const eligible =
        ((data ?? []) as unknown as Campaign[])
          .filter(
            campaign =>
              campaignMatchesGeo(
                campaign,
                profileRecord,
              ),
          )
          .filter(
            campaign =>
              placement !== 'community' ||
              !isHiddenCommunityCardCopy(
                campaign.advertiser_name,
                campaign.headline,
                campaign.short_text,
              ),
          );

      setCampaigns(eligible);
      setIndex(0);
    };

    load();

    return () => {
      alive = false;
    };
  }, [
    placement,
    profile,
  ]);

  useEffect(() => {
    if (campaigns.length <= 1) {
      return;
    }

    const timer = setInterval(
      () => {
        setIndex(
          current =>
            (current + 1) %
            campaigns.length,
        );
      },
      9000,
    );

    return () =>
      clearInterval(timer);
  }, [campaigns.length]);

  const campaign =
    useMemo(
      () =>
        campaigns.length
          ? campaigns[
              index %
                campaigns.length
            ]
          : null,
      [campaigns, index],
    );

  useEffect(() => {
    if (!campaign?.id) return;

    void supabase
      .from(
        'buklod_paid_ad_events',
      )
      .insert({
        campaign_id:
          campaign.id,
        event_type:
          'impression',
        placement,
      });
  }, [
    campaign?.id,
    placement,
  ]);

  if (!campaign) {
    return (
      <>
        {fallback ?? null}
      </>
    );
  }

  const open = async () => {
    void supabase
      .from(
        'buklod_paid_ad_events',
      )
      .insert({
        campaign_id:
          campaign.id,
        event_type:
          'click',
        placement,
      });

    const url =
      campaign.destination_url
        ?.trim();

    if (!url) return;

    try {
      await Linking.openURL(url);
    }
    catch (error) {
      console.warn(
        'BUKLOD paid-ad link failed:',
        error,
      );
    }
  };

  return (
    <Pressable
      accessibilityRole={
        campaign.destination_url
          ? 'link'
          : undefined
      }
      accessibilityLabel={
        `Sponsored: ${campaign.advertiser_name}`
      }
      onPress={
        campaign.destination_url
          ? open
          : undefined
      }
      style={({ pressed }) => [
        styles.shell,
        pressed &&
          campaign.destination_url
          ? styles.pressed
          : null,
      ]}
    >
      {campaign.image_url ? (
        <Image
          source={{
            uri:
              campaign.image_url,
          }}
          resizeMode="cover"
          style={
            styles.image
          }
        />
      ) : (
        <View
          style={
            styles.textOnly
          }
        >
          <Text
            numberOfLines={1}
            style={
              styles.sponsored
            }
          >
            SPONSORED
          </Text>

          <Text
            numberOfLines={1}
            style={
              styles.headline
            }
          >
            {campaign.headline}
          </Text>
        </View>
      )}

      <View
        pointerEvents="none"
        style={
          styles.badge
        }
      >
        <Text
          style={
            styles.badgeText
          }
        >
          LOCAL AD
        </Text>
      </View>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    shell: {
      width: 188,
      height: 42,
      marginRight: 8,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        StyleSheet
          .hairlineWidth,
      borderColor:
        'rgba(255,255,255,0.55)',
    },

    pressed: {
      opacity: 0.78,
    },

    image: {
      width: '100%',
      height: '100%',
    },

    textOnly: {
      flex: 1,
      justifyContent:
        'center',
      paddingHorizontal: 9,
      paddingRight: 46,
    },

    sponsored: {
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.7,
      color: '#4D6A5D',
    },

    headline: {
      marginTop: 1,
      fontSize: 11,
      lineHeight: 13,
      fontWeight: '900',
      color: '#12271E',
    },

    badge: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor:
        'rgba(0,0,0,0.68)',
    },

    badgeText: {
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0.4,
      color: '#FFFFFF',
    },
  });