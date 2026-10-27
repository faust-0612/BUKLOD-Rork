import React, {
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ensureImagePickerLibraryAccess,
} from '@/lib/buklodImagePickerAccess';
import {
  persistSmartDrawerAsset,
} from '@/lib/smartDrawer/assets';
import {
  commitSmartDrawerItem,
} from '@/lib/smartDrawer/service';
import { useAuth } from '@/providers/AuthProvider';

type Picked = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  kind?: 'IMPORT' | 'FILE';
};

export default function SmartDrawerImport() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const choose = async () => {
    setNotice('');

    const allowed = await ensureImagePickerLibraryAccess(
      ImagePicker.requestMediaLibraryPermissionsAsync,
    );

    if (!allowed) {
      setNotice(
        'Storage permission is needed to import images. Your existing Drawer items were not affected.',
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.9,
      });

    if (result.canceled) return;

    setItems(previous => [
      ...previous,
      ...result.assets.map(asset => ({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        kind: 'IMPORT' as const,
      })),
    ]);
  };

  const chooseFiles = async () => {
    setNotice('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setItems(previous => [...previous, ...result.assets.map(file => ({
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        kind: 'FILE' as const,
      }))]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not select files.');
    }
  };

  const save = async () => {
    if (!user?.id || !items.length || busy) return;
    setBusy(true);
    setNotice('');

    let saved = 0;

    try {
      for (const picked of items) {
        const asset = await persistSmartDrawerAsset({
          userId: user.id,
          uri: picked.uri,
          kind: picked.kind ?? 'IMPORT',
          mimeType: picked.mimeType,
          width: picked.width,
          height: picked.height,
          originalName: picked.fileName,
        });

        await commitSmartDrawerItem(
          user.id,
          {
            title:
              picked.fileName?.replace(/\.[^.]+$/, '') ||
              'Imported File',
            body: '',
            extractedText: '',
            type: 'DOCUMENT',
            assets: [asset],
            status: 'ACTIVE',
            syncState: 'LOCAL_ONLY',
          },
        );
        saved += 1;
      }

      setNotice(
        `${saved} item${saved === 1 ? '' : 's'} saved in Documents. The original files stay on this device.`,
      );

      setTimeout(() => {
        router.replace('/drawer' as any);
      }, 900);
    } catch (error) {
      setNotice(
        `Import stopped after ${saved} saved item${saved === 1 ? '' : 's'}. ${error instanceof Error ? error.message : 'The remaining file could not be saved.'}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: Math.max(16, insets.bottom),
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#173B63"
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            Import Photos & Files
          </Text>
          <Text style={styles.subtitle}>
            Add photos, PDFs, documents or text files.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Pressable
          onPress={() => void choose()}
          style={styles.pickButton}
        >
          <MaterialCommunityIcons
            name="image-multiple-outline"
            size={22}
            color="#0A6EBD"
          />
          <Text style={styles.pickText}>
            Choose Photos
          </Text>
        </Pressable>

        <Pressable onPress={() => void chooseFiles()} style={styles.pickButton}>
          <MaterialCommunityIcons name="file-document-outline" size={22} color="#0A6EBD" />
          <Text style={styles.pickText}>Choose Files (PDF, DOCX, TXT…)</Text>
        </Pressable>

        {items.length ? (
          <View style={styles.grid}>
            {items.map((item, index) => (
              <View
                key={`${item.uri}:${index}`}
                style={styles.thumbWrap}
              >
                {item.kind === 'FILE' ? (
                  <View style={[styles.thumb, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E7EFF9' }]}>
                    <MaterialCommunityIcons name="file-document-outline" size={30} color="#245F91" />
                    <Text numberOfLines={2} style={{ fontSize: 10, textAlign: 'center' }}>{item.fileName}</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.thumb} />
                )}
                <View style={styles.selected}>
                  <MaterialCommunityIcons
                    name="check"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="image-search-outline"
              size={38}
              color="#87A3B9"
            />
            <Text style={styles.emptyTitle}>
              No images selected
            </Text>
            <Text style={styles.emptyText}>
              Screenshots, receipts, appointment cards and document photos can all be saved.
            </Text>
          </View>
        )}

        {!!notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.count}>
          {items.length} selected
        </Text>
        <Pressable
          disabled={!items.length || busy}
          onPress={() => void save()}
          style={[
            styles.importButton,
            (!items.length || busy) && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <MaterialCommunityIcons
              name="tray-arrow-down"
              size={18}
              color="#FFFFFF"
            />
          )}
          <Text style={styles.importText}>
            {busy ? 'Importing…' : 'Import'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FAFD',
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E9F1',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#173B63',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: '#71869A',
    fontSize: 10.5,
  },
  content: {
    padding: 14,
  },
  pickButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE0EC',
    backgroundColor: '#EAF4FC',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickText: {
    color: '#0A6EBD',
    fontWeight: '900',
    fontSize: 12,
  },
  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  thumbWrap: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E7EEF4',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  selected: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0B70C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 7,
  },
  emptyTitle: {
    color: '#294D6B',
    fontWeight: '900',
    fontSize: 14,
  },
  emptyText: {
    maxWidth: 300,
    color: '#74889A',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  notice: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#EEF5FA',
    padding: 11,
  },
  noticeText: {
    color: '#36566F',
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  count: {
    flex: 1,
    color: '#667D91',
    fontSize: 11,
    fontWeight: '800',
  },
  importButton: {
    minWidth: 130,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0B70C9',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.48,
  },
  importText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
});
