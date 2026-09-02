import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  CONNECT_GIF_CATALOG,
  downloadConnectCatalogGif,
  type ConnectGifCatalogItem,
} from '@/lib/buklodConnectGifCatalog';

export type BuklodCommunityGifFile = {
  uri: string;
  name: string;
  mimeType: 'image/gif';
  size: number;
};

const CATEGORIES = [
  'All',
  'Happy',
  'Love',
  'Laugh',
  'Sad',
  'Angry',
  'Celebrate',
  'Prayer',
  'Encourage',
] as const;

type GifCategory = (typeof CATEGORIES)[number];

function searchableText(item: ConnectGifCatalogItem) {
  return `${item.id} ${item.label}`.toLowerCase();
}

function categoryFor(item: ConnectGifCatalogItem): GifCategory {
  const text = searchableText(item);

  if (/pray|amen|bless|faith/.test(text)) return 'Prayer';
  if (/love|heart|hug|kiss/.test(text)) return 'Love';
  if (/laugh|haha|lol|funny/.test(text)) return 'Laugh';
  if (/sad|cry|tear|sorry/.test(text)) return 'Sad';
  if (/angry|mad|rage|annoy/.test(text)) return 'Angry';
  if (/celebrat|clap|congrat|party|thanks|wow/.test(text)) return 'Celebrate';
  if (/peace|yes|hope|strong|support|encourag/.test(text)) return 'Encourage';
  return 'Happy';
}

export function BuklodCommunityGifPreview({
  file,
  onRemove,
}: {
  file: BuklodCommunityGifFile;
  onRemove: () => void;
}) {
  return (
    <View style={styles.previewFrame}>
      <ExpoImage
        source={{ uri: file.uri }}
        style={styles.previewImage}
        contentFit="cover"
        autoplay
      />
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Remove selected GIF"
        style={styles.previewRemove}
      >
        <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function BuklodCommunityGifPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (file: BuklodCommunityGifFile) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GifCategory>('All');
  const [limit, setLimit] = useState(18);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return CONNECT_GIF_CATALOG.filter(item => {
      const matchesCategory =
        category === 'All' || categoryFor(item) === category;
      const matchesQuery =
        !normalized || searchableText(item).includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  const choose = async (item: ConnectGifCatalogItem) => {
    if (busyId) return;

    try {
      setBusyId(item.id);
      const file = await downloadConnectCatalogGif(item);
      const size = Number(file.size ?? 0);

      if (!size) {
        throw new Error('Could not read the downloaded GIF.');
      }

      onPick({
        uri: file.uri,
        name: file.name || `${item.id}.gif`,
        mimeType: 'image/gif',
        size,
      });
    } catch (error: any) {
      Alert.alert(
        'GIF',
        String(error?.message ?? 'Could not download that GIF.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>GIF</Text>
              <Text style={styles.subtitle}>Add an animated GIF to Community</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color="#1F4B3A" />
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={value => {
              setQuery(value);
              setLimit(18);
            }}
            placeholder="Search GIF"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {CATEGORIES.map(item => (
              <Pressable
                key={item}
                onPress={() => {
                  setCategory(item);
                  setLimit(18);
                }}
                style={[
                  styles.category,
                  category === item && styles.categoryOn,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === item && styles.categoryTextOn,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.grid}>
            {rows.slice(0, limit).map(item => (
              <Pressable
                key={item.id}
                disabled={!!busyId}
                onPress={() => void choose(item)}
                style={styles.tile}
              >
                <ExpoImage
                  source={{ uri: item.url }}
                  style={styles.image}
                  contentFit="cover"
                  autoplay
                />
                {busyId === item.id && (
                  <View style={styles.loading}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            ))}

            {!rows.length && (
              <View style={styles.empty}>
                <Text style={styles.subtitle}>No GIF found.</Text>
              </View>
            )}

            {limit < rows.length && (
              <Pressable
                onPress={() => setLimit(current => current + 18)}
                style={styles.more}
              >
                <Text style={styles.moreText}>Load more GIFs</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '82%',
    minHeight: 480,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#173E30',
    fontSize: 19,
    fontWeight: '900',
  },
  subtitle: {
    color: '#60756D',
    fontSize: 12,
  },
  search: {
    marginTop: 13,
    height: 44,
    borderWidth: 1,
    borderColor: '#D8E4DE',
    borderRadius: 13,
    paddingHorizontal: 12,
  },
  categories: {
    gap: 7,
    paddingVertical: 12,
  },
  category: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#CFE0D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOn: {
    backgroundColor: '#1F6B4F',
    borderColor: '#1F6B4F',
  },
  categoryText: {
    color: '#315D4C',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryTextOn: {
    color: '#FFFFFF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 28,
  },
  tile: {
    width: '48%',
    aspectRatio: 1.35,
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: '#EEF4F1',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  empty: {
    width: '100%',
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    width: '100%',
    height: 42,
    borderWidth: 1,
    borderColor: '#1F6B4F',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  moreText: {
    color: '#1F6B4F',
    fontWeight: '900',
  },
  previewFrame: {
    width: 190,
    height: 140,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EEF4F1',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewRemove: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
});

export default BuklodCommunityGifPicker;
