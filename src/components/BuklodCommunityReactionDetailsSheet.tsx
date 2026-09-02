import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

import {
  BuklodTappableAvatar,
} from '@/components/BuklodTappableAvatar';
import {
  BUKLOD_COMMUNITY_REACTION_OPTIONS,
  type BuklodReactionOption,
} from '@/components/BuklodReactionAction';
import {
  type CommunityReactionDetailRow,
  type CommunityReactionDetailsTarget,
  fetchCommunityReactionDetails,
  resolveCommunityReactionCommentId,
  resolveCommunityReactionMediaPosition,
  resolveCommunityReactionPostId,
} from '@/lib/buklodCommunityReactions';
import {
  colors,
} from '@/lib/theme';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

type Props = {
  visible: boolean;
  target: CommunityReactionDetailsTarget | null;
  initialFilter?: string | null;
  onClose: () => void;
};

const PAGE_SIZE = 40;

function emojiForReaction(
  key: string,
  options: readonly BuklodReactionOption[]
) {
  return (
    options.find(option => option.key === key)?.emoji ?? '\u2764\uFE0F'
  );
}

export function BuklodCommunityReactionDetailsSheet({
  visible,
  target,
  initialFilter = null,
  onClose,
}: Props) {
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const { theme } = useBuklodTheme();
  const [rows, setRows] = useState<CommunityReactionDetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const offsetRef = useRef(0);
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const postId = resolveCommunityReactionPostId(
    target
  );
  const commentId =
    resolveCommunityReactionCommentId(
      target
    );
  const mediaPosition =
    resolveCommunityReactionMediaPosition(
      target
    );
  const reactionCounts =
    target?.reaction_counts ?? null;

  const filters = useMemo(
    () =>
      BUKLOD_COMMUNITY_REACTION_OPTIONS.filter(
        option =>
          Number(reactionCounts?.[option.key] ?? 0) > 0
      ),
    [reactionCounts]
  );

  useEffect(() => {
    if (!visible) {
      setRows([]);
      setFilter(null);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      offsetRef.current = 0;
      loadingMoreRef.current = false;
      return;
    }

    setFilter(initialFilter ?? null);
  }, [
    visible,
    initialFilter,
    postId,
    commentId,
  ]);

  useEffect(() => {
    if (!visible || (!postId && !commentId)) {
      return;
    }

    const requestId = ++requestRef.current;
    offsetRef.current = 0;
    setRows([]);
    setError(null);
    setLoading(true);
    setHasMore(false);
    loadingMoreRef.current = false;

    void (async () => {
      try {
        const batch =
          await fetchCommunityReactionDetails({
            postId,
            commentId,
            mediaPosition,
            reaction: filter,
            limit: PAGE_SIZE,
            offset: 0,
            knownDisplayNames:
              target?.known_display_names ??
              null,
          });

        if (requestId !== requestRef.current) {
          return;
        }

        setRows(batch);
        offsetRef.current = batch.length;
        setHasMore(batch.length >= PAGE_SIZE);
      } catch (loadError: any) {
        if (requestId !== requestRef.current) {
          return;
        }

        setRows([]);
        setHasMore(false);
        setError(
          String(
            loadError?.message ??
              'Could not load reactions.'
          )
        );
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      }
    })();
  }, [
    visible,
    postId,
    commentId,
    mediaPosition,
    filter,
  ]);

  const loadMore = async () => {
    if (
      !visible ||
      (!postId && !commentId) ||
      loading ||
      loadingMoreRef.current ||
      !hasMore
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);

    const requestId = requestRef.current;
    const nextOffset = offsetRef.current;

    try {
      const batch =
        await fetchCommunityReactionDetails({
          postId,
          commentId,
          mediaPosition,
          reaction: filter,
          limit: PAGE_SIZE,
          offset: nextOffset,
          knownDisplayNames:
            target?.known_display_names ??
            null,
        });

      if (requestId !== requestRef.current) {
        return;
      }

      setRows(current => [...current, ...batch]);
      offsetRef.current = nextOffset + batch.length;
      setHasMore(batch.length >= PAGE_SIZE);
    } catch (loadError: any) {
      if (requestId !== requestRef.current) {
        return;
      }

      setHasMore(false);
      setError(
        String(
          loadError?.message ??
            'Could not load more reactions.'
        )
      );
    } finally {
      if (requestId === requestRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  };

  const total =
    Number(target?.total_reactions ?? 0) > 0
      ? Number(target?.total_reactions ?? 0)
      : Number(target?.reaction_count ?? 0) > 0
        ? Number(target?.reaction_count ?? 0)
        : Object.values(reactionCounts ?? {}).reduce(
            (sum, count) => sum + Number(count ?? 0),
            0
          );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismiss}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom: drawerBottomInset,
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.title,
                  { color: theme.textPrimary },
                ]}
              >
                Who reacted
              </Text>
              <Text
                style={[
                  styles.sub,
                  { color: theme.textMuted },
                ]}
              >
                {total} total
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close reactions"
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.textPrimary}
              />
            </Pressable>
          </View>

          {filters.length > 0 && (
            <View style={styles.filters}>
              <Pressable
                onPress={() => setFilter(null)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: theme.border,
                    backgroundColor:
                      filter === null
                        ? theme.accentSoft
                        : theme.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      filter === null
                        ? theme.accent
                        : theme.textMuted,
                    fontWeight: '800',
                    fontSize: 11,
                  }}
                >
                  All
                </Text>
              </Pressable>

              {filters.map(option => (
                <Pressable
                  key={option.key}
                  onPress={() => setFilter(option.key)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: theme.border,
                      backgroundColor:
                        filter === option.key
                          ? theme.accentSoft
                          : theme.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={styles.filterEmoji}>
                    {option.emoji}
                  </Text>
                  <Text
                    style={{
                      color:
                        filter === option.key
                          ? theme.accent
                          : theme.textMuted,
                      fontWeight: '800',
                      fontSize: 10,
                    }}
                  >
                    {Number(reactionCounts?.[option.key] ?? 0)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item, index) =>
                `${item.user_id}-${item.reaction}-${index}`
              }
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={7}
              onEndReached={() => {
                void loadMore();
              }}
              onEndReachedThreshold={0.35}
              ListEmptyComponent={
                <Text
                  style={[
                    styles.empty,
                    { color: theme.textMuted },
                  ]}
                >
                  {error
                    ? error
                    : postId || commentId
                      ? 'No reactions yet.'
                      : 'Reaction details unavailable.'}
                </Text>
              }
              ListFooterComponent={
                loadingMore
                  ? (
                    <ActivityIndicator
                      color={colors.green}
                      style={{ marginVertical: 12 }}
                    />
                  )
                  : null
              }
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <BuklodTappableAvatar
                    userId={item.user_id}
                    name={item.display_name}
                    size={36}
                  />

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.name,
                      { color: theme.textPrimary },
                    ]}
                  >
                    {item.display_name}
                  </Text>

                  <Text style={styles.reactionEmoji}>
                    {emojiForReaction(
                      item.reaction,
                      BUKLOD_COMMUNITY_REACTION_OPTIONS
                    )}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  sub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterEmoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  loading: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  reactionEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
});

export default BuklodCommunityReactionDetailsSheet;
