import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import {
  type OfficeAccess,
  type OfficePickedFile,
  cacheOfficeFile,
  formatOfficeBytes,
  formatOfficeTime,
  officeFileIcon,
  openOfficeFile,
  pickOfficeFile,
  safeOfficeName,
  shareOfficeFile,
} from '@/lib/buklodOffice';

type ScopeInfo = {
  scope_id: string;
  scope_name: string;
  scope_type: 'CLUSTER' | 'ORGANIZATION';
  parent_scope_id: string | null;
  is_suborganization: boolean;
  access_level: OfficeAccess;
  quota_bytes: number;
  used_bytes: number;
  trash_retention_days: number;
};

type Folder = {
  id: string;
  scope_id: string;
  parent_id: string | null;
  name: string;
  system_key: string | null;
  is_system: boolean;
  sort_order: number;
};

type OfficeFile = {
  id: string;
  scope_id: string;
  folder_id: string | null;
  uploaded_by: string;
  name: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'TRASHED';
  is_starred: boolean;
  metadata: Record<string, any> | null;
  archived_at: string | null;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Activity = {
  id: number;
  actor_id: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  object_name: string | null;
  details: Record<string, any> | null;
  created_at: string;
};

type Person = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

type Section = 'ACTIVE' | 'STARRED' | 'ARCHIVED' | 'TRASHED' | 'ACTIVITY';

const SECTION_ITEMS: Array<{
  key: Section;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  { key: 'ACTIVE', label: 'Files', icon: 'file-multiple-outline' },
  { key: 'STARRED', label: 'Starred', icon: 'star-outline' },
  { key: 'ARCHIVED', label: 'Archive', icon: 'archive-outline' },
  { key: 'TRASHED', label: 'Trash', icon: 'trash-can-outline' },
  { key: 'ACTIVITY', label: 'Activity', icon: 'history' },
];

function normalizeRpcRow<T>(value: any): T | null {
  if (!value) return null;
  return (Array.isArray(value) ? value[0] : value) as T;
}

function errorText(error: any) {
  return error?.message || String(error || 'Unknown error');
}

function canEdit(access: OfficeAccess) {
  return access === 'EDITOR' || access === 'ADMIN';
}

function canAdmin(access: OfficeAccess) {
  return access === 'ADMIN';
}

function folderIcon(folder: Folder) {
  switch (folder.system_key) {
    case 'reports':
      return 'file-chart-outline';
    case 'forms':
      return 'file-document-edit-outline';
    case 'certificates':
      return 'certificate-outline';
    case 'minutes':
      return 'clipboard-text-clock-outline';
    case 'financial':
      return 'cash-multiple';
    case 'pdfs':
      return 'file-pdf-box';
    case 'spreadsheets':
      return 'file-excel-outline';
    case 'presentations':
      return 'file-powerpoint-outline';
    case 'photos':
      return 'image-multiple-outline';
    case 'audio':
      return 'music-box-multiple-outline';
    case 'videos':
      return 'video-outline';
    case 'other':
      return 'folder-question-outline';
    default:
      return 'folder-outline';
  }
}

function officeLabel(info: ScopeInfo | null) {
  if (!info) return 'ORGANIZER OFFICE';
  if (info.scope_type === 'CLUSTER') return 'CLUSTER OFFICE';
  if (info.is_suborganization) return 'SUB-ORGANIZATION OFFICE';
  return 'ORGANIZATION OFFICE';
}

async function autoCleanupTrash(
  scopeId: string,
  access: OfficeAccess,
  days: number
) {
  if (!canEdit(access)) return;

  const cutoff = new Date(
    Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000
  ).toISOString();

  const expired = await (supabase as any)
    .from('buklod_office_files')
    .select('id,storage_path')
    .eq('scope_id', scopeId)
    .eq('status', 'TRASHED')
    .lt('trashed_at', cutoff)
    .limit(50);

  if (expired.error || !expired.data?.length) return;

  const paths = expired.data
    .map((row: any) => row.storage_path)
    .filter(Boolean);

  if (paths.length) {
    const removed = await supabase.storage
      .from('buklod-office')
      .remove(paths);

    if (removed.error) return;
  }

  await (supabase as any)
    .from('buklod_office_files')
    .delete()
    .in(
      'id',
      expired.data.map((row: any) => row.id)
    );
}

export default function BuklodOfficeOrganizer({
  scopeId,
}: {
  scopeId: string;
}) {
  const { profile } = useAuth();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const profileId = (profile as any)?.id as string | undefined;

  const [info, setInfo] = useState<ScopeInfo | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<OfficeFile[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [section, setSection] = useState<Section>('ACTIVE');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [selected, setSelected] = useState<OfficeFile | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [accessOpen, setAccessOpen] = useState(false);
  const [accessQuery, setAccessQuery] = useState('');
  const [accessPeople, setAccessPeople] = useState<Person[]>([]);
  const [accessSearching, setAccessSearching] = useState(false);
  const [accessTarget, setAccessTarget] = useState<Person | null>(null);

  const cleanedRef = useRef(false);

  const load = useCallback(
    async (withCleanup = true) => {
      if (!scopeId) return;

      const infoResult = await (supabase as any).rpc(
        'buklod_office_scope_info',
        { _scope_id: scopeId }
      );

      if (infoResult.error) {
        setLoading(false);
        Alert.alert('Organizer Office', infoResult.error.message);
        return;
      }

      const nextInfo = normalizeRpcRow<ScopeInfo>(infoResult.data);
      if (!nextInfo) {
        setLoading(false);
        Alert.alert(
          'Organizer Office',
          'This Office is unavailable or you do not have access.'
        );
        router.back();
        return;
      }

      setInfo(nextInfo);

      if (canEdit(nextInfo.access_level)) {
        const defaults = await (supabase as any).rpc(
          'buklod_office_ensure_defaults',
          { _scope_id: scopeId }
        );

        if (defaults.error) {
          console.warn('Office default folders:', defaults.error.message);
        }
      }

      if (withCleanup && !cleanedRef.current) {
        cleanedRef.current = true;
        await autoCleanupTrash(
          scopeId,
          nextInfo.access_level,
          nextInfo.trash_retention_days
        );
      }

      const [folderResult, fileResult, activityResult] = await Promise.all([
        (supabase as any)
          .from('buklod_office_folders')
          .select(
            'id,scope_id,parent_id,name,system_key,is_system,sort_order'
          )
          .eq('scope_id', scopeId)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),

        (supabase as any)
          .from('buklod_office_files')
          .select(
            'id,scope_id,folder_id,uploaded_by,name,original_name,storage_path,mime_type,size_bytes,checksum_sha256,status,is_starred,metadata,archived_at,trashed_at,created_at,updated_at'
          )
          .eq('scope_id', scopeId)
          .order('created_at', { ascending: false })
          .limit(500),

        (supabase as any)
          .from('buklod_office_activity')
          .select(
            'id,actor_id,action,object_type,object_id,object_name,details,created_at'
          )
          .eq('scope_id', scopeId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (!folderResult.error) setFolders(folderResult.data ?? []);
      if (!fileResult.error) setFiles(fileResult.data ?? []);
      if (!activityResult.error) setActivity(activityResult.data ?? []);

      if (fileResult.error) {
        Alert.alert('Organizer Office', fileResult.error.message);
      }

      const refreshedInfo = await (supabase as any).rpc(
        'buklod_office_scope_info',
        { _scope_id: scopeId }
      );
      const finalInfo = normalizeRpcRow<ScopeInfo>(refreshedInfo.data);
      if (!refreshedInfo.error && finalInfo) setInfo(finalInfo);

      setLoading(false);
    },
    [scopeId]
  );

  useEffect(() => {
    void load();

    if (!scopeId) return;

    const channel = supabase
      .channel(`office-${scopeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buklod_office_files',
          filter: `scope_id=eq.${scopeId}`,
        },
        () => void load(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buklod_office_folders',
          filter: `scope_id=eq.${scopeId}`,
        },
        () => void load(false)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, scopeId]);

  useEffect(() => {
    const clean = accessQuery.trim();

    if (!accessOpen || clean.length < 2) {
      setAccessPeople([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setAccessSearching(true);

      const result = await (supabase as any).rpc(
        'buklod_connect_people_search',
        {
          _query: clean,
          _limit: 20,
        }
      );

      if (!cancelled && !result.error) {
        setAccessPeople(result.data ?? []);
      }

      if (!cancelled) setAccessSearching(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessOpen, accessQuery]);

  const currentFolder = useMemo(
    () => folders.find(folder => folder.id === folderId) ?? null,
    [folderId, folders]
  );

  const visibleFiles = useMemo(() => {
    const clean = query.trim().toLowerCase();

    return files.filter(file => {
      if (section === 'ACTIVE' && file.status !== 'ACTIVE') return false;
      if (
        section === 'STARRED' &&
        !(file.status === 'ACTIVE' && file.is_starred)
      ) {
        return false;
      }
      if (section === 'ARCHIVED' && file.status !== 'ARCHIVED') return false;
      if (section === 'TRASHED' && file.status !== 'TRASHED') return false;
      if (folderId && file.folder_id !== folderId) return false;
      if (clean && !file.name.toLowerCase().includes(clean)) return false;
      return true;
    });
  }, [files, folderId, query, section]);

  const usedPercent = useMemo(() => {
    if (!info?.quota_bytes) return 0;
    return Math.min(
      100,
      Math.max(0, (Number(info.used_bytes) / Number(info.quota_bytes)) * 100)
    );
  }, [info]);

  const refresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const upload = async () => {
    if (!info || !profileId || !canEdit(info.access_level) || uploading) return;

    setUploading(true);
    let uploadedPath: string | null = null;

    try {
      const picked = await pickOfficeFile();
      if (!picked) return;

      if (
        Number(info.used_bytes) + picked.size >
        Number(info.quota_bytes)
      ) {
        throw new Error(
          `Storage quota exceeded. ${formatOfficeBytes(
            info.used_bytes
          )} of ${formatOfficeBytes(info.quota_bytes)} is already used.`
        );
      }

      const duplicate = await (supabase as any)
        .from('buklod_office_files')
        .select('id,name,status')
        .eq('scope_id', scopeId)
        .eq('checksum_sha256', picked.checksumSha256)
        .maybeSingle();

      if (duplicate.error) throw duplicate.error;

      if (duplicate.data) {
        Alert.alert(
          'Duplicate file prevented',
          `"${duplicate.data.name}" already contains the same file data. No second storage copy was created.`
        );
        return;
      }

      const automaticFolder =
        folders.find(
          folder => folder.system_key === picked.autoFolderKey
        ) ??
        folders.find(folder => folder.system_key === 'other') ??
        null;

      const targetFolder =
        folderId && currentFolder
          ? currentFolder
          : automaticFolder;

      const fileId = Crypto.randomUUID();
      const path = `${scopeId}/${fileId}/${safeOfficeName(
        picked.name
      )}`;

      const storage = await supabase.storage
        .from('buklod-office')
        .upload(path, picked.bytes, {
          contentType: picked.mimeType,
          upsert: false,
        });

      if (storage.error) throw storage.error;
      uploadedPath = path;

      const inserted = await (supabase as any)
        .from('buklod_office_files')
        .insert({
          id: fileId,
          scope_id: scopeId,
          folder_id: targetFolder?.id ?? null,
          uploaded_by: profileId,
          name: picked.name,
          original_name: picked.originalName,
          storage_path: path,
          mime_type: picked.mimeType,
          size_bytes: picked.size,
          checksum_sha256: picked.checksumSha256,
          status: 'ACTIVE',
          metadata: {
            auto_folder_key: picked.autoFolderKey,
            automatically_organized: !folderId,
            image_optimized: picked.optimized,
          },
        });

      if (inserted.error) throw inserted.error;

      Alert.alert(
        'File organized',
        targetFolder
          ? `"${picked.name}" was stored in ${targetFolder.name}.`
          : `"${picked.name}" was uploaded.`
      );

      await load(false);
    } catch (error: any) {
      if (uploadedPath) {
        await supabase.storage
          .from('buklod-office')
          .remove([uploadedPath]);
      }
      Alert.alert('Upload file', errorText(error));
    } finally {
      setUploading(false);
    }
  };

  const createFolder = async () => {
    if (!info || !profileId || !canEdit(info.access_level)) return;

    const clean = safeOfficeName(newFolderName).trim();
    if (!clean) return;

    const result = await (supabase as any)
      .from('buklod_office_folders')
      .insert({
        scope_id: scopeId,
        parent_id: null,
        name: clean,
        is_system: false,
        sort_order: 200,
        created_by: profileId,
      });

    if (result.error) {
      Alert.alert('New Folder', result.error.message);
      return;
    }

    setNewFolderName('');
    setNewFolderOpen(false);
    await load(false);
  };

  const updateFile = async (
    file: OfficeFile,
    patch: Partial<OfficeFile>
  ) => {
    const result = await (supabase as any)
      .from('buklod_office_files')
      .update(patch)
      .eq('id', file.id);

    if (result.error) {
      Alert.alert('Organizer Office', result.error.message);
      return false;
    }

    setSelected(null);
    await load(false);
    return true;
  };

  const moveFile = async (targetFolderId: string | null) => {
    if (!selected) return;
    await updateFile(selected, {
      folder_id: targetFolderId,
    });
    setMoveOpen(false);
  };

  const permanentlyDelete = async (file: OfficeFile) => {
    if (!info || !canEdit(info.access_level)) return;

    Alert.alert(
      'Delete permanently?',
      `This will permanently remove "${file.name}" from BUKLOD storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              const removed = await supabase.storage
                .from('buklod-office')
                .remove([file.storage_path]);

              if (removed.error) {
                Alert.alert('Delete file', removed.error.message);
                return;
              }

              const deleted = await (supabase as any)
                .from('buklod_office_files')
                .delete()
                .eq('id', file.id);

              if (deleted.error) {
                Alert.alert('Delete file', deleted.error.message);
                return;
              }

              setSelected(null);
              await load(false);
            })(),
        },
      ]
    );
  };

  const openSelected = async (file: OfficeFile) => {
    try {
      await openOfficeFile(file.storage_path);
    } catch (error: any) {
      Alert.alert('Open file', errorText(error));
    }
  };

  const shareSelected = async (file: OfficeFile) => {
    try {
      await shareOfficeFile(file.storage_path, file.name);
    } catch (error: any) {
      Alert.alert('Share file', errorText(error));
    }
  };

  const cacheSelected = async (file: OfficeFile) => {
    try {
      await cacheOfficeFile(file.storage_path, file.name);
      Alert.alert(
        'Available offline',
        `"${file.name}" was cached on this device. The app cache may be cleared by the operating system when space is needed.`
      );
    } catch (error: any) {
      Alert.alert('Cache file', errorText(error));
    }
  };

  const setCollaborator = async (
    person: Person,
    level: 'VIEWER' | 'EDITOR' | 'ADMIN' | 'DEFAULT'
  ) => {
    const result = await (supabase as any).rpc(
      'buklod_office_set_collaborator',
      {
        _scope_id: scopeId,
        _user_id: person.user_id,
        _access_level: level,
      }
    );

    if (result.error) {
      Alert.alert('Office Access', result.error.message);
      return;
    }

    Alert.alert(
      'Office Access',
      level === 'DEFAULT'
        ? `${person.full_name} now uses normal membership access.`
        : `${person.full_name} is now ${level}.`
    );

    setAccessTarget(null);
    setAccessQuery('');
    setAccessPeople([]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.loadingText}>
          Opening Organizer Office...
        </Text>
      </View>
    );
  }

  if (!info) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Office unavailable</Text>
      </View>
    );
  }

  const editAllowed = canEdit(info.access_level);
  const adminAllowed = canAdmin(info.access_level);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color={colors.greenDark}
          />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {info.scope_name}
          </Text>
          <Text style={styles.headerSub}>
            {officeLabel(info)} • {info.access_level}
          </Text>
        </View>

        {adminAllowed ? (
          <Pressable
            onPress={() => setAccessOpen(true)}
            accessibilityLabel="Manage Office access"
            style={styles.headerButton}
          >
            <MaterialCommunityIcons
              name="account-lock-outline"
              size={22}
              color={colors.greenDark}
            />
          </Pressable>
        ) : (
          <View style={styles.headerButton}>
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={21}
              color={colors.greenDark}
            />
          </View>
        )}
      </View>

      <View style={styles.storageCard}>
        <View style={styles.storageTop}>
          <View>
            <Text style={styles.storageLabel}>OFFICE STORAGE</Text>
            <Text style={styles.storageValue}>
              {formatOfficeBytes(info.used_bytes)} /{' '}
              {formatOfficeBytes(info.quota_bytes)}
            </Text>
          </View>

          <Text style={styles.storagePercent}>
            {usedPercent.toFixed(0)}%
          </Text>
        </View>

        <View style={styles.storageTrack}>
          <View
            style={[
              styles.storageFill,
              { width: `${usedPercent}%` },
            ]}
          />
        </View>

        <Text style={styles.storageHint}>
          Files in Trash still use storage until permanently deleted.
          Trash auto-cleans after {info.trash_retention_days} days when
          an authorized Office user opens this workspace.
        </Text>
      </View>

      <View style={styles.actionRow}>
        {editAllowed && (
          <Pressable
            onPress={() => void upload()}
            disabled={uploading}
            style={[
              styles.primaryAction,
              uploading && { opacity: 0.55 },
            ]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name="upload-outline"
                size={20}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.primaryActionText}>
              {uploading ? 'UPLOADING' : 'UPLOAD'}
            </Text>
          </Pressable>
        )}

        {editAllowed && (
          <Pressable
            onPress={() => setNewFolderOpen(true)}
            style={styles.secondaryAction}
          >
            <MaterialCommunityIcons
              name="folder-plus-outline"
              size={20}
              color={colors.greenDark}
            />
            <Text style={styles.secondaryActionText}>
              NEW FOLDER
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sections}
      >
        {SECTION_ITEMS.map(item => {
          const on = section === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setSection(item.key);
                setFolderId(null);
              }}
              style={[
                styles.sectionChip,
                on && styles.sectionChipOn,
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={17}
                color={on ? '#FFFFFF' : colors.greenDark}
              />
              <Text
                style={[
                  styles.sectionChipText,
                  on && styles.sectionChipTextOn,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {section !== 'ACTIVITY' && (
        <>
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons
              name="magnify"
              size={19}
              color={colors.muted}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search files..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={19}
                  color={colors.muted}
                />
              </Pressable>
            )}
          </View>

          {section === 'ACTIVE' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.folders}
            >
              <Pressable
                onPress={() => setFolderId(null)}
                style={[
                  styles.folderCard,
                  folderId === null && styles.folderCardOn,
                ]}
              >
                <MaterialCommunityIcons
                  name="folder-multiple-outline"
                  size={24}
                  color={colors.greenDark}
                />
                <Text
                  numberOfLines={1}
                  style={styles.folderName}
                >
                  All Files
                </Text>
              </Pressable>

              {folders.map(folder => (
                <Pressable
                  key={folder.id}
                  onPress={() => setFolderId(folder.id)}
                  style={[
                    styles.folderCard,
                    folderId === folder.id &&
                      styles.folderCardOn,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={folderIcon(folder) as any}
                    size={24}
                    color={colors.greenDark}
                  />
                  <Text
                    numberOfLines={1}
                    style={styles.folderName}
                  >
                    {folder.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {!!currentFolder && (
            <View style={styles.folderBanner}>
              <MaterialCommunityIcons
                name={folderIcon(currentFolder) as any}
                size={18}
                color={colors.greenDark}
              />
              <Text style={styles.folderBannerText}>
                {currentFolder.name}
              </Text>
              {currentFolder.is_system && (
                <Text style={styles.autoBadge}>AUTO</Text>
              )}
            </View>
          )}

          <FlatList
            data={visibleFiles}
            keyExtractor={item => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
              />
            }
            contentContainerStyle={styles.fileList}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons
                  name="folder-open-outline"
                  size={34}
                  color={colors.muted}
                />
                <Text style={styles.emptyTitle}>
                  No files here
                </Text>
                <Text style={styles.emptyText}>
                  {editAllowed
                    ? 'Upload a file and BUKLOD will organize it automatically.'
                    : 'No files are available in this section.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const folder = folders.find(
                value => value.id === item.folder_id
              );
              const owner = item.uploaded_by === profileId;

              return (
                <Pressable
                  onPress={() => setSelected(item)}
                  style={styles.fileRow}
                >
                  <View style={styles.fileIcon}>
                    <MaterialCommunityIcons
                      name={
                        officeFileIcon(
                          item.name,
                          item.mime_type
                        ) as any
                      }
                      size={24}
                      color={colors.greenDark}
                    />
                  </View>

                  <View style={styles.fileCopy}>
                    <View style={styles.fileTitleRow}>
                      <Text
                        numberOfLines={1}
                        style={styles.fileName}
                      >
                        {item.name}
                      </Text>

                      {item.is_starred && (
                        <MaterialCommunityIcons
                          name="star"
                          size={15}
                          color={colors.green}
                        />
                      )}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={styles.fileMeta}
                    >
                      {folder?.name || 'Unfiled'} •{' '}
                      {formatOfficeBytes(item.size_bytes)}
                      {owner ? ' • OWNER' : ''}
                    </Text>

                    <Text style={styles.fileTime}>
                      {formatOfficeTime(item.created_at)}
                    </Text>
                  </View>

                  <MaterialCommunityIcons
                    name="dots-vertical"
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              );
            }}
          />
        </>
      )}

      {section === 'ACTIVITY' && (
        <FlatList
          data={activity}
          keyExtractor={item => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
          contentContainerStyle={styles.fileList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No Office activity yet
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activityAction}>
                  {item.action.replace(/_/g, ' ')}
                </Text>
                {!!item.object_name && (
                  <Text
                    numberOfLines={1}
                    style={styles.activityName}
                  >
                    {item.object_name}
                  </Text>
                )}
                <Text style={styles.fileTime}>
                  {formatOfficeTime(item.created_at)}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={!!selected && !moveOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setSelected(null)}
          />

          {!!selected && (
            <View style={[styles.sheet, { paddingBottom: drawerBottomInset + 12 }]}>
              <View style={styles.sheetHandle} />

              <Text
                numberOfLines={2}
                style={styles.sheetTitle}
              >
                {selected.name}
              </Text>

              <Text style={styles.sheetMeta}>
                {formatOfficeBytes(selected.size_bytes)} •{' '}
                {selected.uploaded_by === profileId
                  ? 'OWNER'
                  : info.access_level}
              </Text>

              <ActionButton
                icon="eye-outline"
                label="Open / Preview / Download"
                onPress={() => void openSelected(selected)}
              />

              <ActionButton
                icon="download-outline"
                label="Cache for offline use"
                onPress={() => void cacheSelected(selected)}
              />

              {editAllowed && (
                <ActionButton
                  icon="share-variant-outline"
                  label="Share secure link"
                  onPress={() => void shareSelected(selected)}
                />
              )}

              {editAllowed && (
                <ActionButton
                  icon={
                    selected.is_starred
                      ? 'star-off-outline'
                      : 'star-outline'
                  }
                  label={
                    selected.is_starred
                      ? 'Remove from Starred'
                      : 'Add to Starred'
                  }
                  onPress={() =>
                    void updateFile(selected, {
                      is_starred: !selected.is_starred,
                    })
                  }
                />
              )}

              {editAllowed &&
                selected.status !== 'TRASHED' && (
                  <ActionButton
                    icon="folder-move-outline"
                    label="Move to folder"
                    onPress={() => setMoveOpen(true)}
                  />
                )}

              {editAllowed &&
                selected.status === 'ACTIVE' && (
                  <ActionButton
                    icon="archive-outline"
                    label="Archive"
                    onPress={() =>
                      void updateFile(selected, {
                        status: 'ARCHIVED',
                        archived_at:
                          new Date().toISOString(),
                      })
                    }
                  />
                )}

              {editAllowed &&
                selected.status === 'ARCHIVED' && (
                  <ActionButton
                    icon="archive-arrow-up-outline"
                    label="Restore from Archive"
                    onPress={() =>
                      void updateFile(selected, {
                        status: 'ACTIVE',
                        archived_at: null,
                      })
                    }
                  />
                )}

              {editAllowed &&
                selected.status !== 'TRASHED' && (
                  <ActionButton
                    icon="trash-can-outline"
                    label="Move to Trash"
                    danger
                    onPress={() =>
                      void updateFile(selected, {
                        status: 'TRASHED',
                        trashed_at: new Date().toISOString(),
                      })
                    }
                  />
                )}

              {editAllowed &&
                selected.status === 'TRASHED' && (
                  <>
                    <ActionButton
                      icon="restore"
                      label="Restore file"
                      onPress={() =>
                        void updateFile(selected, {
                          status: 'ACTIVE',
                          trashed_at: null,
                        })
                      }
                    />

                    <ActionButton
                      icon="delete-forever-outline"
                      label="Delete permanently"
                      danger
                      onPress={() =>
                        void permanentlyDelete(selected)
                      }
                    />
                  </>
                )}
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={moveOpen && !!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setMoveOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setMoveOpen(false)}
          />

          <View style={[styles.sheet, { paddingBottom: drawerBottomInset + 12 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              Move to Folder
            </Text>

            <ScrollView style={{ maxHeight: 420 }}>
              <ActionButton
                icon="folder-remove-outline"
                label="Unfiled"
                onPress={() => void moveFile(null)}
              />

              {folders.map(folder => (
                <ActionButton
                  key={folder.id}
                  icon={folderIcon(folder) as any}
                  label={folder.name}
                  onPress={() => void moveFile(folder.id)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={newFolderOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNewFolderOpen(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              New Office Folder
            </Text>

            <TextInput
              autoFocus
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              placeholderTextColor={colors.muted}
              style={styles.dialogInput}
            />

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => {
                  setNewFolderOpen(false);
                  setNewFolderName('');
                }}
                style={styles.dialogCancel}
              >
                <Text style={styles.dialogCancelText}>
                  CANCEL
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void createFolder()}
                style={styles.dialogSave}
              >
                <Text style={styles.dialogSaveText}>
                  CREATE
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={accessOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setAccessOpen(false);
          setAccessTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              setAccessOpen(false);
              setAccessTarget(null);
            }}
          />

          <View style={styles.accessSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              Office Access
            </Text>

            <Text style={styles.accessHelp}>
              Scope Admins are ADMIN automatically. Normal active
              members are VIEWER. Add an override here for a specific
              user.
            </Text>

            <View style={styles.searchWrap}>
              <MaterialCommunityIcons
                name="account-search-outline"
                size={19}
                color={colors.muted}
              />
              <TextInput
                value={accessQuery}
                onChangeText={value => {
                  setAccessQuery(value);
                  setAccessTarget(null);
                }}
                placeholder="Search BUKLOD user..."
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
              />
              {accessSearching && (
                <ActivityIndicator
                  size="small"
                  color={colors.green}
                />
              )}
            </View>

            {!!accessTarget ? (
              <View style={styles.accessTarget}>
                <Text style={styles.accessTargetName}>
                  {accessTarget.full_name}
                </Text>

                <View style={styles.accessLevels}>
                  {(
                    [
                      'VIEWER',
                      'EDITOR',
                      'ADMIN',
                      'DEFAULT',
                    ] as const
                  ).map(level => (
                    <Pressable
                      key={level}
                      onPress={() =>
                        void setCollaborator(
                          accessTarget,
                          level
                        )
                      }
                      style={styles.accessLevel}
                    >
                      <Text style={styles.accessLevelText}>
                        {level === 'DEFAULT'
                          ? 'NORMAL ACCESS'
                          : level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {accessPeople.map(person => (
                  <Pressable
                    key={person.user_id}
                    onPress={() => setAccessTarget(person)}
                    style={styles.personRow}
                  >
                    <MaterialCommunityIcons
                      name="account-circle-outline"
                      size={26}
                      color={colors.greenDark}
                    />
                    <Text style={styles.personName}>
                      {person.full_name}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && { opacity: 0.65 },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={21}
        color={danger ? '#B42318' : colors.greenDark}
      />
      <Text
        style={[
          styles.actionButtonText,
          danger && { color: '#B42318' },
        ]}
      >
        {label}
      </Text>
      <MaterialCommunityIcons
        name="chevron-right"
        size={19}
        color={colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 10,
  },
  header: {
    minHeight: 60,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  headerSub: {
    marginTop: 2,
    color: colors.green,
    fontSize: 8,
    fontWeight: '900',
  },
  storageCard: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  storageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storageLabel: {
    color: colors.greenDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  storageValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  storagePercent: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: '900',
  },
  storageTrack: {
    height: 8,
    marginTop: 10,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#E8EFEB',
  },
  storageFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.green,
  },
  storageHint: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 8,
    lineHeight: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 9,
  },
  primaryAction: {
    minHeight: 42,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 13,
    backgroundColor: colors.greenDark,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  secondaryAction: {
    minHeight: 42,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  secondaryActionText: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
  },
  sections: {
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionChip: {
    minHeight: 36,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  sectionChipOn: {
    borderColor: colors.greenDark,
    backgroundColor: colors.greenDark,
  },
  sectionChipText: {
    color: colors.greenDark,
    fontSize: 8.5,
    fontWeight: '900',
  },
  sectionChipTextOn: {
    color: '#FFFFFF',
  },
  searchWrap: {
    minHeight: 43,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
  },
  folders: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 9,
  },
  folderCard: {
    width: 100,
    height: 74,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  folderCardOn: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft,
  },
  folderName: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
  },
  folderBanner: {
    minHeight: 38,
    marginHorizontal: 12,
    marginBottom: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    backgroundColor: colors.greenSoft,
  },
  folderBannerText: {
    flex: 1,
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
  },
  autoBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: colors.greenDark,
    fontSize: 7,
    fontWeight: '900',
  },
  fileList: {
    paddingHorizontal: 12,
    paddingBottom: 28,
    flexGrow: 1,
  },
  fileRow: {
    minHeight: 70,
    marginBottom: 7,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  fileCopy: {
    flex: 1,
    minWidth: 0,
  },
  fileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fileName: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  fileMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 8.5,
  },
  fileTime: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 7.5,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 44,
  },
  emptyTitle: {
    marginTop: 7,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  activityRow: {
    minHeight: 64,
    marginBottom: 7,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  activityDot: {
    width: 9,
    height: 9,
    marginTop: 4,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  activityAction: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
  },
  activityName: {
    marginTop: 3,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13,26,20,0.32)',
  },
  sheet: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 26,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  accessSheet: {
    maxHeight: '82%',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 26,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    marginBottom: 12,
    borderRadius: 3,
    backgroundColor: '#D7DEDA',
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sheetMeta: {
    marginTop: 4,
    marginBottom: 10,
    color: colors.muted,
    fontSize: 8.5,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  actionButtonText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  dialogOverlay: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,26,20,0.32)',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    padding: 16,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
  },
  dialogTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  dialogInput: {
    minHeight: 45,
    marginTop: 12,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.text,
    backgroundColor: '#F8FAF9',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 13,
  },
  dialogCancel: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
  },
  dialogSave: {
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.greenDark,
  },
  dialogSaveText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  accessHelp: {
    marginTop: 6,
    marginBottom: 10,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 13,
  },
  personRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  personName: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  accessTarget: {
    paddingVertical: 10,
  },
  accessTargetName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  accessLevels: {
    gap: 8,
    marginTop: 12,
  },
  accessLevel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.greenSoft,
  },
  accessLevelText: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
  },
});
