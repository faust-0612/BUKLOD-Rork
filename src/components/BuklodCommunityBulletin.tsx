import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type BulletinItem = {
  id: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  published_at: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  country: string | null;
};

function text(
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

function ageLabel(value: string | null) {
  if (!value) {
    return '';
  }

  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) {
    return '';
  }

  const diff =
    Date.now() - time;

  const minutes =
    Math.max(
      1,
      Math.floor(diff / 60000),
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(value)
    .toLocaleDateString(
      'en-PH',
      {
        month: 'short',
        day: 'numeric',
      },
    );
}

export default function BuklodCommunityBulletin() {
  const { profile } = useAuth();

  const [
    items,
    setItems,
  ] =
    useState<BulletinItem[]>([]);
  /* PATCH_167H_R2_FAILED_IMAGE_GUARD */
  const [
    failedImages,
    setFailedImages,
  ] =
    useState<Record<string, boolean>>({});

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    failed,
    setFailed,
  ] =
    useState(false);

  const geo =
    useMemo(
      () => ({
        barangay:
          text(
            profile as any,
            [
              'barangay',
              'barangay_name',
              'address_barangay',
            ],
          ),

        city:
          text(
            profile as any,
            [
              'city_municipality',
              'municipality',
              'municipality_name',
              'city',
              'city_name',
              'address_city',
              'address_municipality',
            ],
          ),

        province:
          text(
            profile as any,
            [
              'province',
              'province_name',
              'address_province',
            ],
          ),

        country:
          text(
            profile as any,
            [
              'country',
              'country_name',
              'address_country',
            ],
          ) || 'Philippines',
      }),
      [profile],
    );

  const localityLabel =
    [
      geo.barangay,
      geo.city,
      geo.province,
    ]
      .filter(Boolean)
      .join(', ');

  const load =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setFailed(false);

        try {
          /*
           * Attempt a background refresh.
           * Failure is intentionally non-blocking:
           * cached/persisted bulletin rows still display.
           */
          try {
            await supabase.functions.invoke(
              'sync-local-news',
              {
                body: {
                  barangay:
                    geo.barangay || null,
                  city_municipality:
                    geo.city || null,
                  province:
                    geo.province || null,
                  country:
                    geo.country || 'Philippines',
                  trigger:
                    'home',
                },
              },
            );
          }
          catch {
            // Offline / function not deployed:
            // continue using database content.
          }

          const { data, error } =
            await supabase
              .from(
                'buklod_local_news_items',
              )
              .select(
                [
                  'id',
                  'title',
                  'summary',
                  'source_name',
                  'source_url',
                  'image_url',
                  'published_at',
                  'barangay',
                  'city_municipality',
                  'province',
                  'country',
                ].join(','),
              )
              .eq(
                'is_active',
                true,
              )
              .order(
                'published_at',
                {
                  ascending:
                    false,
                  nullsFirst:
                    false,
                },
              )
              .limit(30);

          if (error) {
            throw error;
          }

          const rows =
            (data ?? []) as unknown as BulletinItem[];

          /*
           * Geo ranking:
           * barangay first, then city, province,
           * country/nationwide fallback.
           */
          const norm =
            (value: unknown) =>
              String(value ?? '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, ' ');

          const score =
            (item: BulletinItem) => {
              if (
                geo.barangay &&
                norm(item.barangay) ===
                  norm(geo.barangay)
              ) {
                return 4;
              }

              if (
                geo.city &&
                norm(
                  item.city_municipality,
                ) ===
                  norm(geo.city)
              ) {
                return 3;
              }

              if (
                geo.province &&
                norm(item.province) ===
                  norm(geo.province)
              ) {
                return 2;
              }

              if (
                !item.barangay &&
                !item.city_municipality &&
                !item.province &&
                (
                  !item.country ||
                  norm(item.country) ===
                    norm(geo.country)
                )
              ) {
                return 1;
              }

              return 0;
            };

          const ranked =
            rows
              .map(item => ({
                item,
                score:
                  score(item),
              }))
              .filter(
                entry =>
                  entry.score > 0,
              )
              .sort(
                (a, b) =>
                  b.score - a.score,
              )
              .map(
                entry =>
                  entry.item,
              )
              .slice(0, 10);

          setItems(ranked);
        }
        catch (error) {
          console.warn(
            'Community Bulletin:',
            error,
          );

          setFailed(true);
          setItems([]);
        }
        finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        geo.barangay,
        geo.city,
        geo.province,
        geo.country,
      ],
    );


  /* PATCH_167H_R3_REALTIME_NEWS */
  useEffect(
    () => {
      let active = true;

      void load();

      const channel =
        supabase
          .channel(
            `community-bulletin:${Date.now()}:${Math.random()
              .toString(36)
              .slice(2, 8)}`,
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'buklod_local_news_items',
            },
            () => {
              if (active) {
                void load();
              }
            },
          )
          .subscribe();

      return () => {
        active = false;
        void supabase.removeChannel(
          channel,
        );
      };
    },
    [load],
  );
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.titleWrap}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name="newspaper-variant-outline"
              size={18}
              color="#275D45"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              COMMUNITY BULLETIN
            </Text>

            <Text
              style={styles.subtitle}
              numberOfLines={1}
            >
              {localityLabel
                ? `Local updates for ${localityLabel}`
                : 'Local community news and updates'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() =>
            void load(true)
          }
          accessibilityRole="button"
          accessibilityLabel="Refresh Community Bulletin"
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && {
              opacity: 0.65,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={18}
            color="#275D45"
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator
            size="small"
            color="#275D45"
          />

          <Text style={styles.stateText}>
            Loading local updates...
          </Text>
        </View>
      ) : failed ? (
        <View style={styles.stateCard}>
          <MaterialCommunityIcons
            name="wifi-alert"
            size={22}
            color="#6B7280"
          />

          <Text style={styles.stateText}>
            Local updates are temporarily unavailable.
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.stateCard}>
          <MaterialCommunityIcons
            name="newspaper-remove"
            size={22}
            color="#6B7280"
          />

          <Text style={styles.stateText}>
            No new local bulletin yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.carousel
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                void load(true)
              }
            />
          }
        >
          {items.map(item => {
            const location =
              [
                item.barangay,
                item.city_municipality,
                item.province,
              ]
                .filter(Boolean)
                .join(', ');

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.source_url) {
                    void Linking.openURL(
                      item.source_url,
                    );
                  }
                }}
                disabled={
                  !item.source_url
                }
                style={({ pressed }) => [
                  styles.card,
                  pressed && {
                    opacity: 0.9,
                  },
                ]}
              >
                {item.image_url &&
                !failedImages[item.id] ? (
                  <Image
                    source={{
                      uri: item.image_url,
                    }}
                    style={styles.image}
                    resizeMode="cover"
                    onError={() =>
                      setFailedImages(
                        current => ({
                          ...current,
                          [item.id]: true,
                        }),
                      )
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.imagePlaceholder
                    }
                  >
                    <MaterialCommunityIcons
                      name="newspaper-variant-outline"
                      size={28}
                      color="#6B7280"
                    />
                  </View>
                )}

                <View style={styles.body}>
                  <View
                    style={
                      styles.metaRow
                    }
                  >
                    <Text
                      style={
                        styles.source
                      }
                      numberOfLines={1}
                    >
                      {item.source_name ||
                        'Community Update'}
                    </Text>

                    <Text
                      style={styles.age}
                    >
                      {ageLabel(
                        item.published_at,
                      )}
                    </Text>
                  </View>

                  <Text
                    style={styles.cardTitle}
                    numberOfLines={3}
                  >
                    {item.title}
                  </Text>

                  {!!item.summary && (
                    <Text
                      style={styles.summary}
                      numberOfLines={3}
                    >
                      {item.summary}
                    </Text>
                  )}

                  {!!location && (
                    <View
                      style={
                        styles.locationRow
                      }
                    >
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={13}
                        color="#6B7280"
                      />

                      <Text
                        style={
                          styles.location
                        }
                        numberOfLines={1}
                      >
                        {location}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    section: {
      marginTop: 12,
      marginBottom: 10,
    },

    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 10,
    },

    titleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },

    icon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(39,93,69,0.09)',
    },

    title: {
      color: '#17231D',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    subtitle: {
      marginTop: 2,
      color: '#6B7280',
      fontSize: 10,
      fontWeight: '600',
    },

    refreshButton: {
      width: 34,
      height: 34,
      marginLeft: 8,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(39,93,69,0.07)',
    },

    stateCard: {
      minHeight: 92,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 7,
      padding: 16,
      backgroundColor: '#FFFFFF',
    },

    stateText: {
      color: '#6B7280',
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },

    carousel: {
      paddingRight: 12,
      gap: 12,
    },

    card: {
      width: 280,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 17,
      backgroundColor: '#FFFFFF',
    },

    image: {
      width: '100%',
      height: 148,
      backgroundColor: '#EEF1EF',
    },

    imagePlaceholder: {
      width: '100%',
      height: 148,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor: '#EEF1EF',
    },

    body: {
      padding: 12,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 8,
      marginBottom: 6,
    },

    source: {
      flex: 1,
      color: '#275D45',
      fontSize: 9,
      fontWeight: '900',
      textTransform:
        'uppercase',
      letterSpacing: 0.4,
    },

    age: {
      color: '#9CA3AF',
      fontSize: 9,
      fontWeight: '700',
    },

    cardTitle: {
      color: '#17231D',
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '900',
    },

    summary: {
      marginTop: 7,
      color: '#4B5563',
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '500',
    },

    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 9,
    },

    location: {
      flex: 1,
      color: '#6B7280',
      fontSize: 9,
      fontWeight: '700',
    },
  });