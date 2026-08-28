import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';


import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  supabase,
} from '@/lib/supabase';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import BuklodBulletinVideo
  from '@/components/BuklodBulletinVideo';

import SquareMediaCard from '@/components/SquareMediaCard';

type MyScope = {
  scope_id: string;
  scope_type:
    | 'PUBLIC'
    | 'LOCAL'
    | 'CLUSTER'
    | 'CHURCH'
    | 'ORGANIZATION'
    | 'SYSTEM';
  name: string;
  is_admin?: boolean | null;
  membership_status?:
    | string
    | null;
};

type Bulletin = {
  id: string;
  scope_id: string;
  title: string;
  body: string;
  media_path:
    | string
    | null;
  media_kind:
    | 'image'
    | 'video'
    | null;
  is_pinned: boolean;
  starts_at: string;
  expires_at:
    | string
    | null;
  media_url?:
    | string
    | null;
};

type BulletinCard = {
  scope: MyScope;
  bulletin:
    | Bulletin
    | null;
};
/* PATCH_186G_STABLE_SCOPE_BULLETINS
 *
 * Public Home can remount/re-render while navigating the global dashboard.
 * Keep recent bulletin cards in module memory so the UI does not repeatedly
 * fall back to a spinner. Refreshes are silent.
 */
const BUKLOD_SCOPE_BULLETIN_CACHE_MS =
  5 * 60 * 1000;

const buklodScopeBulletinCache =
  new Map<
    string,
    {
      cards: BulletinCard[];
      loadedAt: number;
    }
  >();


function isActiveMember(
  scope: MyScope,
) {
  return (
    scope.membership_status ===
    'ACTIVE'
  );
}

function shouldIncludeScope(
  active: MyScope | null,
  showFaithContent: boolean,
  scope: MyScope,
) {
  if (!active) {
    return false;
  }

  if (
    active.scope_type ===
    'PUBLIC'
  ) {
    if (!isActiveMember(scope)) {
      return false;
    }

    if (
      scope.scope_type ===
      'CLUSTER'
    ) {
      return true;
    }

    if (
      showFaithContent &&
      scope.scope_type ===
      'CHURCH'
    ) {
      return true;
    }

    return false;
  }

  if (
    active.scope_type ===
    'CLUSTER'
  ) {
    return (
      scope.scope_type ===
        'CLUSTER' &&
      scope.scope_id ===
        active.scope_id &&
      isActiveMember(scope)
    );
  }

  if (
    active.scope_type ===
    'CHURCH'
  ) {
    return (
      (
        scope.scope_type ===
          'CHURCH' &&
        scope.scope_id ===
          active.scope_id
      ) ||
      (
        scope.scope_type ===
          'CLUSTER' &&
        isActiveMember(scope)
      )
    );
  }

  return false;
}

function sortScopes(
  a: MyScope,
  b: MyScope,
) {
  const weight = (
    scope: MyScope,
  ) => {
    if (
      scope.scope_type ===
      'CHURCH'
    ) {
      return 0;
    }

    if (
      scope.scope_type ===
      'CLUSTER'
    ) {
      return 1;
    }

    return 9;
  };

  const difference =
    weight(a) - weight(b);

  if (difference !== 0) {
    return difference;
  }

  return a.name.localeCompare(
    b.name
  );
}

export default function BuklodHomeScopeBulletins() {
  const {
    colors,
  } = useBuklodPresentation();
  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const {
    activeScope,
  } = useBuklodScope();

  const [cards, setCards] =
    useState<BulletinCard[]>([]);

  const [loading, setLoading] =
    useState(false);

  const active =
    activeScope
      ? ({
          scope_id:
            activeScope.scope_id,
          scope_type:
            activeScope.scope_type,
          name:
            activeScope.name,
          is_admin:
            activeScope.is_admin,
          membership_status:
            activeScope
              .membership_status,
        } as MyScope)
      : null;

  const showFaithContent =
    Boolean(
      activeScope
        ?.show_faith_content
    );

  const activeKey =
    active
      ? [
          active.scope_type,
          active.scope_id,
          showFaithContent
            ? 'faith'
            : 'general',
        ].join(':')
      : '';

  const load =
    useCallback(
      async () => {
        if (!active) {
          setCards([]);
          return;
        }

        if (
          ![
            'PUBLIC',
            'CLUSTER',
            'CHURCH',
          ].includes(
            active.scope_type
          )
        ) {
          setCards([]);
          return;
        }

        /*
         * PATCH_186G_STABLE_SCOPE_BULLETINS
         *
         * Never replace a usable bulletin card with a loading spinner.
         * If a fresh cache exists, return immediately.
         * If stale cache exists, keep it visible while refreshing.
         */
        const cached =
          buklodScopeBulletinCache.get(
            activeKey
          );

        if (cached) {
          setCards(
            cached.cards
          );

          if (
            Date.now() -
              cached.loadedAt <
            BUKLOD_SCOPE_BULLETIN_CACHE_MS
          ) {
            setLoading(false);
            return;
          }
        }

        /*
         * First load is intentionally silent. The bulletin section
         * stays hidden until real content is ready.
         */
        setLoading(false);

        try {
          const {
            data: scopeRows,
            error: scopeError,
          } = await (
            supabase as any
          ).rpc(
            'buklod_my_scopes'
          );

          if (scopeError) {
            throw scopeError;
          }

          const scopes =
            (
              scopeRows ?? []
            ) as MyScope[];

          const targets =
            scopes
              .filter(scope =>
                shouldIncludeScope(
                  active,
                  showFaithContent,
                  scope
                )
              )
              .sort(sortScopes);

          if (!targets.length) {
            const emptyCards:
              BulletinCard[] =
                [];

            setCards(
              emptyCards
            );

            buklodScopeBulletinCache.set(
              activeKey,
              {
                cards:
                  emptyCards,
                loadedAt:
                  Date.now(),
              }
            );

            return;
          }

          const ids =
            targets.map(
              scope =>
                scope.scope_id
            );

          const now =
            new Date()
              .toISOString();

          const {
            data: bulletinRows,
            error: bulletinError,
          } = await (
            supabase as any
          )
            .from(
              'buklod_scope_bulletins'
            )
            .select(
              'id,scope_id,title,body,media_path,media_kind,is_pinned,starts_at,expires_at'
            )
            .in(
              'scope_id',
              ids
            )
            .eq(
              'is_published',
              true
            )
            .lte(
              'starts_at',
              now
            )
            .order(
              'is_pinned',
              {
                ascending: false,
              }
            )
            .order(
              'starts_at',
              {
                ascending: false,
              }
            );

          if (bulletinError) {
            throw bulletinError;
          }

          const rows =
            (
              bulletinRows ?? []
            ) as Bulletin[];

          const activeRows =
            rows.filter(
              item =>
                !item.expires_at ||
                Date.parse(
                  item.expires_at
                ) > Date.now()
            );

          const firstByScope =
            new Map<
              string,
              Bulletin
            >();

          for (
            const item of activeRows
          ) {
            if (
              !firstByScope.has(
                item.scope_id
              )
            ) {
              firstByScope.set(
                item.scope_id,
                item
              );
            }
          }

          const withMedia =
            await Promise.all(
              targets.map(
                async scope => {
                  const bulletin =
                    firstByScope.get(
                      scope.scope_id
                    ) ?? null;

                  if (
                    !bulletin
                      ?.media_path
                  ) {
                    return {
                      scope,
                      bulletin,
                    };
                  }

                  const {
                    data: signed,
                  } = await (
                    supabase as any
                  )
                    .storage
                    .from(
                      'scope-bulletin-media'
                    )
                    .createSignedUrl(
                      bulletin.media_path,
                      3600
                    );

                  return {
                    scope,
                    bulletin: {
                      ...bulletin,
                      media_url:
                        signed
                          ?.signedUrl ??
                        null,
                    },
                  };
                }
              )
            );

          setCards(
            withMedia
          );

          buklodScopeBulletinCache.set(
            activeKey,
            {
              cards:
                withMedia,
              loadedAt:
                Date.now(),
            }
          );
        } catch (error) {
          console.warn(
            'Scope bulletins:',
            String(
              (error as any)
                ?.message ??
                error
            )
          );

          if (!cached) {
            setCards([]);
          }
        } finally {
          setLoading(false);
        }
      },
      [
        activeKey,
        showFaithContent,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);
  /*
   * PATCH_170C_BULLETIN_FOCUS_REFRESH
   *
   * /scope is preserved while the bulletin editor is open.
   * When router.back() returns to Cluster Home, this reloads
   * the latest published bulletin immediately.
   */
  useFocusEffect(
    useCallback(() => {
      void load();

      return undefined;
    }, [load])
  );

  /*
   * Also refresh if another Cluster admin publishes/updates
   * a bulletin while this Home is already open.
   *
   * The topic is unique per mount to avoid Supabase Realtime
   * "callbacks after subscribe()" channel collisions.
   */
  useEffect(() => {
    if (!active?.scope_id) {
      return;
    }

    const channel =
      supabase
        .channel(
          `scope-bulletin-home:${active.scope_id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'buklod_scope_bulletins',
          },
          payload => {
            const row =
              (
                payload.new ??
                payload.old ??
                null
              ) as
                | {
                    scope_id?: string;
                  }
                | null;

            if (
              !row?.scope_id ||
              row.scope_id ===
                active.scope_id
            ) {
              void load();
            }
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    active?.scope_id,
    load,
  ]);

  if (
    !active ||
    ![
      'PUBLIC',
      'CLUSTER',
      'CHURCH',
    ].includes(
      active.scope_type
    )
  ) {
    return null;
  }

  if (
    !loading &&
    cards.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[
          styles.sectionTitle,
          {
              /* UI_002_R8_R4_BULLETIN_CENTER */
              textAlign: 'center',
              alignSelf: 'stretch',
            },
        ]}>
        BULLETINS
      </Text>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={colors.green}
          />
        </View>
      ) : (
        cards.map(
          ({
            scope,
            bulletin,
          }) => (
            <View
              key={scope.scope_id}
              style={styles.card}
            >
              <View style={styles.scopeRow}>
                <View style={styles.scopeIcon}>
                  <MaterialCommunityIcons
                    name={
                      scope.scope_type ===
                      'CHURCH'
                        ? 'church'
                        : 'account-group-outline'
                    }
                    size={18}
                    color={colors.white}
                  />
                </View>

                <View style={styles.scopeCopy}>
                  <Text style={styles.scopeType}>
                    {scope.scope_type ===
                    'CHURCH'
                      ? 'CHURCH BULLETIN'
                      : 'CLUSTER BULLETIN'}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={styles.scopeName}
                  >
                    {scope.name}
                  </Text>
                </View>

                {!!scope.is_admin && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      `Edit ${scope.name} bulletin`
                    }
                    onPress={() =>
                      router.push({
                        pathname:
                          '/scope/bulletin-editor',
                        params: {
                          scopeId:
                            scope.scope_id,
                        },
                      } as any)
                    }
                    style={styles.edit}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={
                        colors.greenDark
                      }
                    />
                  </Pressable>
                )}
              </View>

              {bulletin ? (
                <>
                  {!!bulletin.media_url &&
                    bulletin.media_kind ===
                      'image' && (
                      <SquareMediaCard
                        uri={
                          bulletin.media_url
                        }
                        accessibilityLabel={
                          bulletin.title
                        }
                        style={{ marginBottom: 6 }}
                      />
                    )}

                  {!!bulletin.media_url &&
                    bulletin.media_kind ===
                      'video' && (
                      <SquareMediaCard
                        accessibilityLabel={
                          bulletin.title
                        }
                        style={{ marginBottom: 6 }}
                      >
                      <BuklodBulletinVideo
                        uri={
                          bulletin.media_url
                        }
                        style={styles.mediaVideo}
                      />
                      </SquareMediaCard>
                    )}

                  <Text style={styles.bulletinTitle}>
                    {bulletin.is_pinned
                      ? '\uD83D\uDCCC '
                      : ''}
                    {bulletin.title}
                  </Text>

                  <Text style={styles.body}>
                    {bulletin.body}
                  </Text>
                </>
              ) : (
                <Text style={styles.empty}>
                  No bulletin has been posted yet.
                </Text>
              )}
            </View>
          )
        )
      )}
</View>
  );
}

function createStyles(
  colors: ReturnType<
    typeof useBuklodPresentation
  >['colors']
) {
  return StyleSheet.create({
  section: {
    marginTop: 6,
    gap: 6,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    marginHorizontal: 0,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  sectionTitle: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.75,
    paddingHorizontal: 12,
  },

  loading: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    backgroundColor: colors.white,
    width: '100%',
    alignSelf: 'stretch',
    marginHorizontal: 0,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 12,
  },

  scopeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      colors.greenDark,
  },

  scopeCopy: {
    flex: 1,
  },

  scopeType: {
    color: colors.green,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.65,
  },

  scopeName: {
    marginTop: 2,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },

  edit: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      colors.greenSoft,
  },

  mediaVideo: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
    marginBottom: 0,
    borderRadius: 0,
  },

  bulletinTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
    paddingHorizontal: 12,
  },

  body: {
    marginTop: 6,
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  empty: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  });
}