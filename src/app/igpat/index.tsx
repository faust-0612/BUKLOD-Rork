import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { useAuth } from '@/providers/AuthProvider';

type IgpatRow = {
  id: string;
  user_id?: string | null;
  author_name: string;
  body: string;
  created_at: string;
  media_path: string;
  media_duration_seconds?: number | null;
  media_url?: string | null;
};

function IgpatVideo({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    try {
      if (active) player.play();
      else player.pause();
    } catch {}
  }, [active, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

export default function IgpatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<IgpatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewportHeight = Dimensions.get('window').height;

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_buklod_reels_v1', {
        p_limit: 40,
      });
      if (error) throw error;

      const source = ((data ?? []) as IgpatRow[]).filter(row => Boolean(row.media_path));
      const signed = await Promise.all(
        source.map(async row => {
          const { data: mediaData } = await supabase.storage
            .from('community-media')
            .createSignedUrl(row.media_path, 1800);
          return { ...row, media_url: mediaData?.signedUrl ?? null };
        })
      );

      setRows(signed.filter(row => Boolean(row.media_url)));
      setActiveIndex(0);
    } catch (error) {
      console.warn('BUKLOD IGPAT load:', String((error as any)?.message ?? error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<IgpatRow>> }) => {
      const first = viewableItems.find(item => item.isViewable && typeof item.index === 'number');
      if (typeof first?.index === 'number') setActiveIndex(first.index);
    }
  ).current;

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 80, minimumViewTime: 120 }),
    []
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingTitle}>BUKLOD IGPAT</Text>
        <Text style={styles.loadingTagline}>An Instant Bond.</Text>
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>BUKLOD IGPAT</Text>
        <Text style={styles.emptyCopy}>No available IGPAT videos yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={rows}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: viewportHeight,
          offset: viewportHeight * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={[styles.page, { height: viewportHeight }]}>
            {!!item.media_url && (
              <IgpatVideo uri={item.media_url} active={index === activeIndex} />
            )}
            <View pointerEvents="none" style={styles.scrim} />
            <View style={[styles.brand, { top: insets.top + 12 }]} pointerEvents="none">
              <Text style={styles.brandTitle}>IGPAT</Text>
              <Text style={styles.brandTagline}>An Instant Bond.</Text>
            </View>
            <View style={[styles.meta, { bottom: Math.max(insets.bottom + 28, 36) }]} pointerEvents="none">
              <Text numberOfLines={1} style={styles.author}>
                {resolvePersonDisplayName(item.author_name, item.user_id)}
              </Text>
              {!!item.body && (
                <Text numberOfLines={2} style={styles.caption}>
                  {item.body}
                </Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  page: { width: '100%', backgroundColor: '#050807', overflow: 'hidden' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050807',
    paddingHorizontal: 28,
  },
  loadingTitle: { marginTop: 16, color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 1.2 },
  loadingTagline: { marginTop: 4, color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '700' },
  emptyTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', letterSpacing: 1.1 },
  emptyCopy: { marginTop: 8, color: 'rgba(255,255,255,0.62)', fontSize: 12, textAlign: 'center' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  brand: { position: 'absolute', left: 18 },
  brandTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: 1.4 },
  brandTagline: { marginTop: 1, color: 'rgba(255,255,255,0.66)', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  meta: { position: 'absolute', left: 18, right: 72 },
  author: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  caption: { marginTop: 6, color: 'rgba(255,255,255,0.90)', fontSize: 12, lineHeight: 17, fontWeight: '600' },
});
