import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CONNECT_GIF_CATEGORIES,
  searchConnectGifs,
  downloadConnectCatalogGif,
  type ConnectGifCatalogItem,
  type ConnectGifCategory,
} from '@/lib/buklodConnectGifCatalog';
import { pickCommunityPhotos } from '@/lib/buklodPickCommunityPhotos';
import { colors } from '@/lib/theme';

export type BuklodCommunityGifFile = {
  uri: string;
  name: string;
  mimeType: 'image/gif';
  size: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (file: BuklodCommunityGifFile) => void;
  /** Comments already support secure, HTTPS GIF references without a download. */
  onPickRemote?: (item: ConnectGifCatalogItem) => void;
};

export function BuklodCommunityGifPreview({ file, onRemove }: {
  file: BuklodCommunityGifFile;
  onRemove: () => void;
}) {
  return (
    <View style={styles.preview}>
      <ExpoImage source={{ uri: file.uri }} style={styles.previewImage}
        contentFit="contain" cachePolicy="memory-disk" />
      <Pressable accessibilityRole="button" accessibilityLabel="Remove selected GIF"
        onPress={onRemove} style={styles.previewRemove}>
        <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

/** Reused by Public Wall, scoped Wall and both comment sheets.
 * Media upload stays in the caller's existing authenticated posting flow.
 * This picker never sends a message or publishes a post on selection. */
export function BuklodCommunityGifPicker({ visible, onClose, onPick, onPickRemote }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ConnectGifCategory>('All');
  const [items, setItems] = useState<ConnectGifCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [provider, setProvider] = useState<'giphy' | 'fallback'>('fallback');
  const [warning, setWarning] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const requestRef = useRef(0);
  const pickingRef = useRef(false);

  const load = useCallback(async (append: boolean, offset: number) => {
    const current = ++requestRef.current;
    if (append) setLoadingMore(true);
    else { setLoading(true); setFailedIds(new Set()); }
    try {
      const result = await searchConnectGifs({ query, category, offset, limit: 24 });
      if (requestRef.current !== current) return;
      setItems(old => {
        if (!append) return result.items;
        const known = new Set(old.map(item => item.id));
        return [...old, ...result.items.filter(item => !known.has(item.id))];
      });
      setProvider(result.provider);
      setWarning(result.warning ?? null);
      setNextOffset(result.nextOffset);
      setHasMore(result.hasMore);
    } catch {
      if (requestRef.current === current) setWarning('GIFs did not load. Retry to search again.');
    } finally {
      if (requestRef.current === current) { setLoading(false); setLoadingMore(false); }
    }
  }, [query, category]);

  useEffect(() => {
    if (!visible) { requestRef.current++; return; }
    const timeout = setTimeout(() => void load(false, 0), query.trim() ? 320 : 80);
    return () => clearTimeout(timeout);
  }, [visible, query, category, load]);

  const close = () => {
    if (pickingRef.current) return;
    requestRef.current++;
    setQuery('');
    setCategory('All');
    onClose();
  };

  const choose = async (item: ConnectGifCatalogItem) => {
    if (pickingRef.current) return;
    // For comment media, preserve the provider reference; the existing
    // comment encoder stores the URL but never sends until user taps Send.
    if (onPickRemote) { onPickRemote(item); close(); return; }
    pickingRef.current = true;
    setSelecting(true);
    try {
      const file = await downloadConnectCatalogGif(item);
      // Convert Connect's generic attachment MIME type into this strictly
      // GIF-only selector after the catalog's GIF download validation.
      onPick({
        uri: file.uri,
        name: file.name,
        mimeType: 'image/gif',
        size: file.size,
      });
      onClose();
    } catch (error: any) {
      Alert.alert('GIF', error?.message ?? 'Download failed. Please try another GIF.');
    } finally {
      pickingRef.current = false;
      setSelecting(false);
    }
  };

  const chooseFromPhone = async () => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setSelecting(true);
    try {
      const selected = await pickCommunityPhotos({ remaining: 1, maxPhotos: 1, preserveAnimation: true });
      const file = selected[0];
      if (!file) return;
      if (file.mimeType !== 'image/gif' && !/\\.gif(?:[?#]|$)/i.test(file.uri)) {
        Alert.alert('GIF', 'Choose an animated GIF file, not a still image.');
        return;
      }
      onPick({ uri: file.uri, name: 'phone-reaction.gif', mimeType: 'image/gif', size: 0 });
      onClose();
    } catch (error: any) {
      Alert.alert('GIF', error?.message ?? 'Unable to select a GIF from your phone.');
    } finally {
      pickingRef.current = false;
      setSelecting(false);
    }
  };

  const shown = useMemo(() => items.filter(item => !failedIds.has(item.id)), [items, failedIds]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Browse GIFs</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close GIF library" onPress={close}
              hitSlop={12}>
              <MaterialCommunityIcons name="close" size={23} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.greenDark} />
            <TextInput style={styles.searchInput} value={query} onChangeText={setQuery}
              placeholder="Search reactions, Amen, worship..." placeholderTextColor={colors.muted}
              autoCorrect={false} returnKeyType="search" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll} contentContainerStyle={styles.categories}
            keyboardShouldPersistTaps="always">
            {CONNECT_GIF_CATEGORIES.map(choice => (
              <Pressable key={choice} onPress={() => setCategory(choice)}
                accessibilityRole="button" accessibilityState={{ selected: choice === category }}
                style={[styles.chip, choice === category && styles.chipActive]}>
                <Text style={[styles.chipText, choice === category && styles.chipTextActive]}>{choice}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose animated GIF from phone"
            disabled={selecting} onPress={() => void chooseFromPhone()} style={styles.phoneButton}>
            <MaterialCommunityIcons name="cellphone" size={19} color={colors.greenDark} />
            <Text style={styles.phoneText}>Choose from phone</Text>
          </Pressable>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.green} />
              <Text style={styles.hint}>Searching GIFs...</Text>
            </View>
          ) : (
            <FlatList data={shown} numColumns={3} keyExtractor={item => item.id}
              keyboardShouldPersistTaps="always" contentContainerStyle={styles.grid}
              initialNumToRender={9} maxToRenderPerBatch={9} windowSize={5}
              removeClippedSubviews={false}
              renderItem={({ item }) => (
                <Pressable style={styles.item} disabled={selecting}
                  accessibilityRole="button" accessibilityLabel={'Choose '+item.label+' GIF'}
                  onPress={() => void choose(item)}>
                  <ExpoImage source={{ uri: item.previewUri || item.url }} style={styles.thumb}
                    cachePolicy="memory-disk" contentFit="cover" onError={() =>
                      setFailedIds(current => new Set([...current, item.id]))} />
                  <Text numberOfLines={1} style={styles.itemLabel}>{item.label}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.hint}>No matching GIF. Try another search.</Text>
                  <Pressable onPress={() => void load(false, 0)} style={styles.retry}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              }
              ListFooterComponent={hasMore && shown.length ? (
                <Pressable onPress={() => void load(true, nextOffset)} disabled={loadingMore || selecting}
                  style={styles.more}>
                  {loadingMore ? <ActivityIndicator color={colors.green} /> :
                    <Text style={styles.retryText}>Load more GIFs</Text>}
                </Pressable>
              ) : null}
            />
          )}
          {warning ? <Text style={styles.warning}>{provider === 'fallback'
            ? 'Live GIFs unavailable. Showing limited built-in reactions.' : warning}</Text> : null}
          {provider === 'giphy' ? <Text style={styles.attribution}>Powered by GIPHY</Text> : null}
          {selecting ? <View style={styles.sending}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.hint}>Preparing GIF...</Text>
          </View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.35)' },
  sheet: { maxHeight: '86%', height: '76%', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    backgroundColor: colors.white, paddingTop: 8, overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  search: { marginHorizontal: 12, borderColor: colors.line, borderWidth: 1,
    borderRadius: 12, height: 42, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, gap: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  categoryScroll: { flexGrow: 0, height: 48 },
  categories: { alignItems: 'center', paddingHorizontal: 12, gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 16,
    minHeight: 32, justifyContent: 'center', paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: colors.greenDark },
  phoneButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40,
    borderRadius: 11, paddingHorizontal: 11, marginHorizontal: 12, marginBottom: 8,
    backgroundColor: colors.greenSoft },
  phoneText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  grid: { paddingHorizontal: 7, paddingBottom: 20 },
  item: { flex: 1, maxWidth: '32%', minWidth: '30%', margin: 3, overflow: 'hidden',
    borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background },
  thumb: { width: '100%', height: 85 },
  itemLabel: { color: colors.text, fontSize: 11, paddingHorizontal: 5,
    paddingVertical: 5, fontWeight: '700' },
  center: { minHeight: 148, alignItems: 'center', justifyContent: 'center', padding: 14, gap: 9 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  retry: { borderRadius: 10, borderWidth: 1, borderColor: colors.green,
    paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: colors.greenDark, fontWeight: '800', textAlign: 'center' },
  more: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  attribution: { color: colors.muted, fontSize: 10, textAlign: 'center', paddingBottom: 4 },
  warning: { color: colors.muted, fontSize: 11, textAlign: 'center', padding: 5 },
  sending: { position: 'absolute', bottom: 35, alignSelf: 'center', padding: 12,
    borderRadius: 14, backgroundColor: colors.white, flexDirection: 'row', gap: 10 },
  preview: { width: 175, height: 146, borderRadius: 12, marginVertical: 7,
    backgroundColor: colors.background, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  previewRemove: { position: 'absolute', right: 6, top: 6, width: 30, height: 30,
    borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,.65)' },
});
export default BuklodCommunityGifPicker;
