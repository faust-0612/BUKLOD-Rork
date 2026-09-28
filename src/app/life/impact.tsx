import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
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

import {
  LinearGradient,
} from 'expo-linear-gradient';

import {
  router,
} from 'expo-router';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import BuklodLifeTabs from '@/components/BuklodLifeTabs';

import {
  normalizeBuklodLifeLanguage,
} from '@/lib/buklodLifeContent';

import {
  loadBuklodLifeImpact,
  type BuklodLifeImpactSummary,
} from '@/lib/buklodLifeImpact';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useNetwork,
} from '@/providers/NetworkProvider';


type ImpactMetric = {
  key: keyof Pick<
    BuklodLifeImpactSummary,
    | 'people_reached'
    | 'gospel_opened'
    | 'faith_journeys_started'
    | 'walking_with_you'
  >;
  icon:
    | 'seed'
    | 'sprout'
    | 'leaf'
    | 'account-group-outline';
  labelFil: string;
  labelEn: string;
};


const METRICS:
ImpactMetric[] = [
  {
    key:
      'people_reached',
    icon:
      'seed',
    labelFil:
      'Mga Naabot',
    labelEn:
      'People Reached',
  },
  {
    key:
      'gospel_opened',
    icon:
      'sprout',
    labelFil:
      'Gospel Binuksan',
    labelEn:
      'Gospel Opened',
  },
  {
    key:
      'faith_journeys_started',
    icon:
      'leaf',
    labelFil:
      'Faith Journeys',
    labelEn:
      'Faith Journeys Started',
  },
  {
    key:
      'walking_with_you',
    icon:
      'account-group-outline',
    labelFil:
      'Nagpapatuloy',
    labelEn:
      'People Walking With You',
  },
];


export default function BuklodLifeImpactScreen() {

  const insets =
    useSafeAreaInsets();

  const {
    profile,
  } =
    useAuth();

  const {
    online,
  } =
    useNetwork();

  const language =
    useMemo(
      () =>
        normalizeBuklodLifeLanguage(
          (
            profile as any
          )?.preferred_language
        ),
      [
        profile,
      ]
    );

  const [
    summary,
    setSummary,
  ] =
    useState<
      BuklodLifeImpactSummary |
      null
    >(null);

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


  const copy =
    language === 'fil'
      ? {
        title:
          'Life Impact',
        subtitle:
          'Mga binhing naitanim. Mga buhay na naabot. Mga paglalakbay na nagsimula.',
        tree:
          'Iyong Life Tree',
        treeNote:
          'Bawat yugto ay simbolo ng voluntary at privacy-safe na LIFE milestone.',
        recent:
          'Kamakailang Activity',
        empty:
          'Wala pang LIFE impact activity. Maaari kang magbahagi ng BUKLOD nang walang pressure at walang conversion reward.',
        privacy:
          'Pribado ang identity ng recipient. Anonymized milestones lamang ang makikita rito.',
        partial:
          'Partial data muna habang hinihintay ang integrated LIFE backend migration.',
        offline:
          'Offline ka. Huling naka-cache na LIFE impact ang ipinapakita kung available.',
        badges:
          'Faith Impact Recognition',
        badgesSub:
          'Optional recognition lamang — walang cash, walang conversion points.',
        viewShare:
          'IBAHAGI ANG BUKLOD',
      }
      : {
        title:
          'Life Impact',
        subtitle:
          'Seeds planted. Lives touched. Faith journeys beginning.',
        tree:
          'Your Life Tree',
        treeNote:
          'Each stage represents a voluntary, privacy-safe LIFE milestone.',
        recent:
          'Recent Activity',
        empty:
          'No LIFE impact activity yet. You can share BUKLOD without pressure and without conversion rewards.',
        privacy:
          'Recipient identity stays private. Only anonymized milestones appear here.',
        partial:
          'Partial data is shown while the integrated LIFE backend migration is pending.',
        offline:
          'You are offline. The latest cached LIFE impact is shown when available.',
        badges:
          'Faith Impact Recognition',
        badgesSub:
          'Optional recognition only — no cash and no conversion points.',
        viewShare:
          'SHARE BUKLOD',
      };


  const load =
    useCallback(
      async (
        mode:
          'initial' |
          'refresh' =
            'initial'
      ) => {

        if (
          mode === 'refresh'
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        try {
          setSummary(
            await loadBuklodLifeImpact()
          );
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      []
    );


  useEffect(() => {
    void load();
  }, [
    load,
  ]);


  const badgeRows =
    useMemo(
      () => [
        {
          title:
            'Seed Sower',
          description:
            language === 'fil'
              ? 'May taong naabot sa pamamagitan ng iyong BUKLOD invitation.'
              : 'Someone was reached through your BUKLOD invitation.',
          icon:
            'seed',
          unlocked:
            (
              summary?.people_reached ??
              0
            ) > 0,
        },
        {
          title:
            'Light Bearer',
          description:
            language === 'fil'
              ? 'May taong kusang nagbukas ng Discover Jesus.'
              : 'Someone voluntarily opened Discover Jesus.',
          icon:
            'lantern',
          unlocked:
            (
              summary?.gospel_opened ??
              0
            ) > 0,
        },
        {
          title:
            'One More',
          description:
            language === 'fil'
              ? 'May taong nagsimulang tuklasin ang pananampalataya.'
              : 'A faith journey began through your invitation.',
          icon:
            'sprout',
          unlocked:
            (
              summary
                ?.faith_journeys_started ??
              0
            ) > 0,
        },
        {
          title:
            'Fisher of Men',
          description:
            language === 'fil'
              ? 'May taong pumili ng susunod na hakbang sa faith journey.'
              : 'Someone chose a next step in their faith journey.',
          icon:
            'fish',
          unlocked:
            (
              summary?.walking_with_you ??
              0
            ) > 0,
        },
        {
          title:
            'Life Builder',
          description:
            language === 'fil'
              ? 'Recognition para sa patuloy na paglago sa faith journey.'
              : 'Recognition for continued growth in a faith journey.',
          icon:
            'tree',
          unlocked:
            (
              summary?.growing_in_faith ??
              0
            ) > 0,
        },
      ],
      [
        language,
        summary,
      ]
    );


  const activityLabel =
    (
      eventType:
        string
    ) => {

      if (
        language === 'fil'
      ) {
        switch (
          eventType
        ) {
          case 'GOSPEL_OPENED':
            return 'May taong inimbitahan mo na nagbukas ng Discover Jesus.';
          case 'SEEKING':
            return 'May binhing naitanim na nagsimulang tuklasin ang pananampalataya.';
          case 'NEW_BEGINNING':
            return 'May taong naabot mo na kusang nagsimulang journey with Jesus.';
          case 'WALKING_TOGETHER':
            return 'May taong pumili ng susunod na hakbang sa kanyang faith journey.';
          case 'GROWING_IN_FAITH':
            return 'May faith journey na patuloy na lumalago.';
          default:
            return 'May bagong anonymized LIFE milestone.';
        }
      }

      switch (
        eventType
      ) {
        case 'GOSPEL_OPENED':
          return 'Someone you invited opened the Discover Jesus journey.';
        case 'SEEKING':
          return 'A seed you planted has begun exploring faith.';
        case 'NEW_BEGINNING':
          return 'Someone you reached voluntarily began a journey with Jesus.';
        case 'WALKING_TOGETHER':
          return 'Someone chose a next step in their faith journey.';
        case 'GROWING_IN_FAITH':
          return 'A faith journey continues to grow.';
        default:
          return 'A new anonymized LIFE milestone was recorded.';
      }
    };


  const hasActivity =
    Boolean(
      summary
        ?.recent_activity
        ?.length
    );


  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={[
        styles.content,
        {
          paddingTop:
            Math.max(
              insets.top,
              14
            ),

          paddingBottom:
            Math.max(
              insets.bottom + 28,
              42
            ),
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={() =>
            void load(
              'refresh'
            )
          }
          tintColor="#2F6D3A"
        />
      }
      showsVerticalScrollIndicator={
        false
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.back
          }
          accessibilityRole="button"
          accessibilityLabel={
            language === 'fil'
              ? 'Bumalik'
              : 'Back'
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color="#24442B"
          />
        </Pressable>

        <View
          style={{
            flex:
              1,
          }}
        >
          <Text
            style={
              styles.brand
            }
          >
            BUKLOD
            <Text
              style={
                styles.lifeWord
              }
            >
              {' '}Life
            </Text>
          </Text>

          <Text
            style={
              styles.smallBrand
            }
          >
            {copy.title}
          </Text>
        </View>

        <View
          style={
            styles.languageBadge
          }
        >
          <Text
            style={
              styles.languageText
            }
          >
            {
              language === 'fil'
                ? 'FILIPINO'
                : 'ENGLISH'
            }
          </Text>
        </View>
      </View>

      <BuklodLifeTabs
        active="impact"
        language={
          language
        }
      />

      <LinearGradient
        colors={[
          '#E8F7FF',
          '#DCEEF4',
          '#EDF5EA',
        ]}
        start={{
          x:
            0,
          y:
            0,
        }}
        end={{
          x:
            1,
          y:
            1,
        }}
        style={
          styles.hero
        }
      >
        <MaterialCommunityIcons
          name="chart-timeline-variant-shimmer"
          size={31}
          color="#2F6D3A"
        />

        <Text
          style={
            styles.heroTitle
          }
        >
          {copy.title}
        </Text>

        <Text
          style={
            styles.heroSubtitle
          }
        >
          {copy.subtitle}
        </Text>
      </LinearGradient>

      {!online && (
        <View
          style={
            styles.infoBar
          }
        >
          <MaterialCommunityIcons
            name="wifi-off"
            size={18}
            color="#735F2D"
          />

          <Text
            style={
              styles.infoBarText
            }
          >
            {copy.offline}
          </Text>
        </View>
      )}

      {loading ? (
        <View
          style={
            styles.loadingCard
          }
        >
          <ActivityIndicator
            color="#2F6D3A"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            {
              language === 'fil'
                ? 'Kinukuha ang LIFE impact…'
                : 'Loading LIFE impact…'
            }
          </Text>
        </View>
      ) : (
        <>
          <View
            style={
              styles.metricGrid
            }
          >
            {
              METRICS.map(
                (
                  metric,
                  index
                ) => (
                  <View
                    key={
                      metric.key
                    }
                    style={[
                      styles.metricCard,
                      index === 0 && {
                        backgroundColor:
                          '#FFF5E8',
                      },
                      index === 1 && {
                        backgroundColor:
                          '#EAF5E8',
                      },
                      index === 2 && {
                        backgroundColor:
                          '#EDF4FF',
                      },
                      index === 3 && {
                        backgroundColor:
                          '#FFF4E5',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        metric.icon
                      }
                      size={27}
                      color={
                        index === 0
                          ? '#B2752E'
                          : index === 1
                          ? '#4E8B3D'
                          : index === 2
                          ? '#567EB9'
                          : '#C98B2A'
                      }
                    />

                    <Text
                      style={
                        styles.metricValue
                      }
                    >
                      {
                        (
                          summary?.[
                            metric.key
                          ] ??
                          0
                        ).toLocaleString(
                          'en-PH'
                        )
                      }
                    </Text>

                    <Text
                      style={
                        styles.metricLabel
                      }
                    >
                      {
                        language ===
                        'fil'
                          ? metric.labelFil
                          : metric.labelEn
                      }
                    </Text>
                  </View>
                )
              )
            }
          </View>

          <View
            style={
              styles.treeCard
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  {copy.tree}
                </Text>

                <Text
                  style={
                    styles.sectionSub
                  }
                >
                  {copy.treeNote}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.treeVisual
              }
            >
              <View
                style={
                  styles.treeHalo
                }
              />

              <MaterialCommunityIcons
                name="tree"
                size={150}
                color="#4F8E3C"
              />
            </View>

            <View
              style={
                styles.treeLegend
              }
            >
              <LifeLegend
                icon="seed"
                label={
                  language === 'fil'
                    ? 'Invitation / Seed'
                    : 'Invitation / Seed'
                }
                value={
                  summary?.people_reached ??
                  0
                }
              />

              <LifeLegend
                icon="sprout"
                label={
                  language === 'fil'
                    ? 'Discover Jesus / Sprout'
                    : 'Discover Jesus / Sprout'
                }
                value={
                  summary?.gospel_opened ??
                  0
                }
              />

              <LifeLegend
                icon="leaf"
                label={
                  language === 'fil'
                    ? 'Seeking / Leaf'
                    : 'Seeking / Leaf'
                }
                value={
                  summary
                    ?.faith_journeys_started ??
                  0
                }
              />

              <LifeLegend
                icon="flower"
                label={
                  language === 'fil'
                    ? 'New Beginning / Flower'
                    : 'New Beginning / Flower'
                }
                value={
                  summary?.new_beginning ??
                  0
                }
              />

              <LifeLegend
                icon="fruit-cherries"
                label={
                  language === 'fil'
                    ? 'Ongoing Growth / Fruit'
                    : 'Ongoing Growth / Fruit'
                }
                value={
                  summary?.growing_in_faith ??
                  0
                }
              />
            </View>
          </View>

          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={{
                flex:
                  1,
              }}
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                {copy.recent}
              </Text>

              <Text
                style={
                  styles.sectionSub
                }
              >
                {copy.privacy}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.activityCard
            }
          >
            {hasActivity ? (
              summary!
                .recent_activity
                .map(
                  (
                    item,
                    index
                  ) => (
                    <View
                      key={
                        `${item.event_type}-${item.occurred_at ?? index}`
                      }
                      style={[
                        styles.activityRow,
                        index > 0 &&
                          styles.activityBorder,
                      ]}
                    >
                      <View
                        style={
                          styles.activityIcon
                        }
                      >
                        <MaterialCommunityIcons
                          name={
                            item.event_type ===
                            'GOSPEL_OPENED'
                              ? 'sprout'
                              : item.event_type ===
                                'NEW_BEGINNING'
                              ? 'flower'
                              : item.event_type ===
                                'WALKING_TOGETHER'
                              ? 'account-group-outline'
                              : 'leaf'
                          }
                          size={21}
                          color="#4B7B4F"
                        />
                      </View>

                      <View
                        style={{
                          flex:
                            1,
                        }}
                      >
                        <Text
                          style={
                            styles.activityText
                          }
                        >
                          {
                            activityLabel(
                              item.event_type
                            )
                          }
                        </Text>

                        {!!item.occurred_at && (
                          <Text
                            style={
                              styles.activityTime
                            }
                          >
                            {
                              new Date(
                                item.occurred_at
                              ).toLocaleString(
                                language ===
                                  'fil'
                                  ? 'fil-PH'
                                  : 'en-PH'
                              )
                            }
                          </Text>
                        )}
                      </View>
                    </View>
                  )
                )
            ) : (
              <View
                style={
                  styles.empty
                }
              >
                <MaterialCommunityIcons
                  name="sprout-outline"
                  size={30}
                  color="#78907B"
                />

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  {copy.empty}
                </Text>
              </View>
            )}
          </View>

          <View
            style={
              styles.badgesCard
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              {copy.badges}
            </Text>

            <Text
              style={
                styles.sectionSub
              }
            >
              {copy.badgesSub}
            </Text>

            <View
              style={
                styles.badgeList
              }
            >
              {
                badgeRows.map(
                  badge => (
                    <View
                      key={
                        badge.title
                      }
                      style={[
                        styles.badgeRow,
                        !badge.unlocked &&
                          styles.badgeLocked,
                      ]}
                    >
                      <View
                        style={[
                          styles.badgeIcon,
                          badge.unlocked &&
                            styles.badgeIconOn,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            badge.icon as any
                          }
                          size={24}
                          color={
                            badge.unlocked
                              ? '#B87924'
                              : '#8B938D'
                          }
                        />
                      </View>

                      <View
                        style={{
                          flex:
                            1,
                        }}
                      >
                        <Text
                          style={
                            styles.badgeTitle
                          }
                        >
                          {
                            badge.title
                          }
                        </Text>

                        <Text
                          style={
                            styles.badgeDesc
                          }
                        >
                          {
                            badge.description
                          }
                        </Text>
                      </View>

                      <MaterialCommunityIcons
                        name={
                          badge.unlocked
                            ? 'check-circle'
                            : 'lock-outline'
                        }
                        size={19}
                        color={
                          badge.unlocked
                            ? '#4D8B4A'
                            : '#A3AAA4'
                        }
                      />
                    </View>
                  )
                )
              }
            </View>
          </View>

          {summary?.partial && (
            <View
              style={
                styles.infoBar
              }
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color="#735F2D"
              />

              <Text
                style={
                  styles.infoBarText
                }
              >
                {copy.partial}
              </Text>
            </View>
          )}

          <Pressable
            onPress={() =>
              router.push(
                '/life/share' as any
              )
            }
            style={
              styles.shareButton
            }
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={19}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.shareButtonText
              }
            >
              {copy.viewShare}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}


function LifeLegend({
  icon,
  label,
  value,
}: {
  icon:
    | 'seed'
    | 'sprout'
    | 'leaf'
    | 'flower'
    | 'fruit-cherries';
  label:
    string;
  value:
    number;
}) {
  return (
    <View
      style={
        styles.legendRow
      }
    >
      <View
        style={
          styles.legendIcon
        }
      >
        <MaterialCommunityIcons
          name={
            icon
          }
          size={19}
          color="#47764A"
        />
      </View>

      <Text
        style={
          styles.legendLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.legendValue
        }
      >
        {
          value.toLocaleString(
            'en-PH'
          )
        }
      </Text>
    </View>
  );
}


const styles =
  StyleSheet.create({

    screen: {
      flex:
        1,

      backgroundColor:
        '#FAFAF7',
    },

    content: {
      paddingHorizontal:
        14,
    },

    header: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,

      marginBottom:
        12,
    },

    back: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E3E8E1',
    },

    brand: {
      fontSize:
        22,

      fontWeight:
        '900',

      color:
        '#173D22',
    },

    lifeWord: {
      color:
        '#6C8B2A',

      fontStyle:
        'italic',
    },

    smallBrand: {
      marginTop:
        1,

      fontSize:
        9,

      fontWeight:
        '800',

      color:
        '#607061',
    },

    languageBadge: {
      paddingHorizontal:
        8,

      paddingVertical:
        6,

      borderRadius:
        999,

      backgroundColor:
        '#E7F0DF',
    },

    languageText: {
      fontSize:
        7,

      fontWeight:
        '900',

      color:
        '#365D3E',

      letterSpacing:
        0.7,
    },

    hero: {
      padding:
        18,

      borderRadius:
        22,

      marginBottom:
        12,

      borderWidth:
        1,

      borderColor:
        '#DCE8E8',
    },

    heroTitle: {
      marginTop:
        8,

      fontSize:
        24,

      fontWeight:
        '900',

      color:
        '#1C3A2A',
    },

    heroSubtitle: {
      marginTop:
        5,

      fontSize:
        12,

      lineHeight:
        18,

      color:
        '#53675A',
    },

    infoBar: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        8,

      padding:
        11,

      borderRadius:
        14,

      backgroundColor:
        '#FFF6E1',

      marginBottom:
        12,
    },

    infoBarText: {
      flex:
        1,

      fontSize:
        10,

      lineHeight:
        15,

      color:
        '#6F5C32',
    },

    loadingCard: {
      minHeight:
        180,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        9,

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E3E8E1',
    },

    loadingText: {
      fontSize:
        11,

      color:
        '#68736A',
    },

    metricGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        9,

      marginBottom:
        13,
    },

    metricCard: {
      width:
        '48.6%',

      minHeight:
        142,

      padding:
        14,

      borderRadius:
        18,

      borderWidth:
        1,

      borderColor:
        '#E3E6E0',

      justifyContent:
        'center',
    },

    metricValue: {
      marginTop:
        8,

      fontSize:
        28,

      lineHeight:
        32,

      fontWeight:
        '900',

      color:
        '#24372B',
    },

    metricLabel: {
      marginTop:
        3,

      fontSize:
        10,

      lineHeight:
        14,

      fontWeight:
        '800',

      color:
        '#57635B',
    },

    treeCard: {
      padding:
        16,

      borderRadius:
        21,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E2E6E0',

      marginBottom:
        15,
    },

    sectionHeader: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',

      marginBottom:
        10,
    },

    sectionTitle: {
      fontSize:
        17,

      fontWeight:
        '900',

      color:
        '#24372B',
    },

    sectionSub: {
      marginTop:
        3,

      fontSize:
        10,

      lineHeight:
        15,

      color:
        '#768078',
    },

    treeVisual: {
      minHeight:
        188,

      alignItems:
        'center',

      justifyContent:
        'center',

      position:
        'relative',
    },

    treeHalo: {
      position:
        'absolute',

      width:
        145,

      height:
        145,

      borderRadius:
        73,

      backgroundColor:
        '#FFF1BC',
    },

    treeLegend: {
      gap:
        7,

      marginTop:
        2,
    },

    legendRow: {
      minHeight:
        43,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,

      paddingHorizontal:
        10,

      borderRadius:
        13,

      backgroundColor:
        '#F7F9F5',
    },

    legendIcon: {
      width:
        30,

      height:
        30,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#E6EFE1',
    },

    legendLabel: {
      flex:
        1,

      fontSize:
        10,

      fontWeight:
        '800',

      color:
        '#48574C',
    },

    legendValue: {
      fontSize:
        13,

      fontWeight:
        '900',

      color:
        '#2F6D3A',
    },

    activityCard: {
      borderRadius:
        18,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E3E7E1',

      overflow:
        'hidden',

      marginBottom:
        15,
    },

    activityRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        10,

      padding:
        13,
    },

    activityBorder: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        '#E5E8E4',
    },

    activityIcon: {
      width:
        36,

      height:
        36,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EAF2E6',
    },

    activityText: {
      fontSize:
        11,

      lineHeight:
        16,

      fontWeight:
        '800',

      color:
        '#435047',
    },

    activityTime: {
      marginTop:
        3,

      fontSize:
        8.5,

      color:
        '#8A918B',
    },

    empty: {
      minHeight:
        128,

      alignItems:
        'center',

      justifyContent:
        'center',

      padding:
        18,

      gap:
        8,
    },

    emptyText: {
      textAlign:
        'center',

      fontSize:
        10.5,

      lineHeight:
        16,

      color:
        '#727B73',
    },

    badgesCard: {
      padding:
        15,

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E2E6E1',

      marginBottom:
        13,
    },

    badgeList: {
      gap:
        8,

      marginTop:
        12,
    },

    badgeRow: {
      minHeight:
        76,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,

      padding:
        10,

      borderRadius:
        15,

      backgroundColor:
        '#FFF9EC',

      borderWidth:
        1,

      borderColor:
        '#F0E4C8',
    },

    badgeLocked: {
      backgroundColor:
        '#F5F6F4',

      borderColor:
        '#E4E7E3',
    },

    badgeIcon: {
      width:
        44,

      height:
        44,

      borderRadius:
        15,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#E8EAE7',
    },

    badgeIconOn: {
      backgroundColor:
        '#FFE9B4',
    },

    badgeTitle: {
      fontSize:
        12,

      fontWeight:
        '900',

      color:
        '#3B443D',
    },

    badgeDesc: {
      marginTop:
        3,

      fontSize:
        9,

      lineHeight:
        13,

      color:
        '#747D75',
    },

    shareButton: {
      minHeight:
        49,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,

      backgroundColor:
        '#2F6D3A',
    },

    shareButtonText: {
      fontSize:
        11,

      fontWeight:
        '900',

      color:
        '#FFFFFF',
    },

  });
